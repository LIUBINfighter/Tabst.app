use std::path::{Path, PathBuf};
use std::time::Instant;

use reqwest::{
    header::{HeaderMap, HeaderValue, RANGE},
    StatusCode,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{ipc::Channel, Manager};
use tokio::fs;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use crate::to_error;

const DEFAULT_MODEL_VERSION: &str = "v1";
const DEFAULT_MODEL_REPO: &str = "ggml-org/SmolVLM-500M-Instruct-GGUF";
const MANIFEST_FILE_NAME: &str = "model-manifest.json";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ModelStatus {
    pub(crate) version: String,
    pub(crate) downloaded: bool,
    pub(crate) downloaded_bytes: u64,
    pub(crate) total_bytes: u64,
    pub(crate) checksum_verified: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DownloadProgress {
    pub(crate) phase: String,
    pub(crate) downloaded_bytes: u64,
    pub(crate) total_bytes: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) speed_bps: Option<u64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct ModelManifest {
    pub(crate) version: String,
    pub(crate) model_repo: String,
    pub(crate) files: Vec<ModelManifestFile>,
    pub(crate) llama_server_args: Option<LlamaServerArgs>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct ModelManifestFile {
    pub(crate) filename: String,
    pub(crate) sha256: String,
    pub(crate) size: u64,
    pub(crate) required: bool,
    #[serde(rename = "type")]
    pub(crate) file_type: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct LlamaServerArgs {
    pub(crate) ctx_size: Option<u32>,
    pub(crate) np: Option<u32>,
    pub(crate) host: Option<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct CachedModelPaths {
    pub(crate) model_path: PathBuf,
    pub(crate) mmproj_path: PathBuf,
    pub(crate) manifest: ModelManifest,
}

fn model_dir<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let app_local_data = app.path().app_local_data_dir().map_err(to_error)?;
    Ok(app_local_data.join("models"))
}

fn manifest_path<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    Ok(model_dir(app)?.join(MANIFEST_FILE_NAME))
}

fn manifest_urls(repo: &str) -> Vec<String> {
    vec![
        format!("https://huggingface.co/{repo}/resolve/main/{MANIFEST_FILE_NAME}"),
        format!("https://hf-mirror.com/{repo}/resolve/main/{MANIFEST_FILE_NAME}"),
    ]
}

fn file_urls(repo: &str, filename: &str) -> Vec<String> {
    vec![
        format!("https://huggingface.co/{repo}/resolve/main/{filename}"),
        format!("https://hf-mirror.com/{repo}/resolve/main/{filename}"),
    ]
}

fn send_progress(channel: &Channel<DownloadProgress>, progress: DownloadProgress) {
    let _ = channel.send(progress);
}

pub(crate) async fn get_model_status<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> ModelStatus {
    let Ok(path) = manifest_path(app) else {
        return empty_status();
    };
    let Ok(data) = fs::read_to_string(&path).await else {
        return empty_status();
    };
    let Ok(manifest) = serde_json::from_str::<ModelManifest>(&data).and_then(validate_manifest)
    else {
        return empty_status();
    };
    let Ok(dir) = model_dir(app) else {
        return empty_status();
    };

    let total_bytes = manifest.files.iter().map(|file| file.size).sum();
    let mut downloaded_bytes = 0_u64;
    let mut checksum_verified = true;
    for file in &manifest.files {
        let Ok(path) = model_file_path(&dir, file) else {
            return empty_status();
        };
        if let Ok(metadata) = fs::metadata(&path).await {
            downloaded_bytes = downloaded_bytes.saturating_add(metadata.len());
        }
        if file.required && !verify_checksum(&path, &file.sha256).await.unwrap_or(false) {
            checksum_verified = false;
        }
    }

    ModelStatus {
        version: manifest.version,
        downloaded: downloaded_bytes >= total_bytes && checksum_verified,
        downloaded_bytes,
        total_bytes,
        checksum_verified,
    }
}

pub(crate) async fn download_model<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    version: String,
    on_progress: Channel<DownloadProgress>,
) -> Result<(), String> {
    let repo = DEFAULT_MODEL_REPO;
    let dir = model_dir(app)?;
    fs::create_dir_all(&dir).await.map_err(to_error)?;

    send_progress(
        &on_progress,
        DownloadProgress {
            phase: "connecting".to_string(),
            downloaded_bytes: 0,
            total_bytes: 0,
            speed_bps: None,
        },
    );

    let manifest = download_manifest(repo).await?;
    if manifest.version != version && version != DEFAULT_MODEL_VERSION {
        return Err("model-version-unsupported".to_string());
    }
    let repo = manifest.model_repo.clone();
    let total_bytes = manifest.files.iter().map(|file| file.size).sum();
    let mut completed_bytes = 0_u64;

    for file in &manifest.files {
        let target = model_file_path(&dir, file)?;
        if verify_checksum(&target, &file.sha256)
            .await
            .unwrap_or(false)
        {
            completed_bytes = completed_bytes.saturating_add(file.size);
            continue;
        }

        download_file_with_fallback(
            &repo,
            file,
            &dir,
            completed_bytes,
            total_bytes,
            &on_progress,
        )
        .await?;
        if !verify_checksum(&target, &file.sha256).await? {
            let _ = fs::remove_file(&target).await;
            return Err("model-checksum-mismatch".to_string());
        }
        completed_bytes = completed_bytes.saturating_add(file.size);
    }

    send_progress(
        &on_progress,
        DownloadProgress {
            phase: "verifying".to_string(),
            downloaded_bytes: total_bytes,
            total_bytes,
            speed_bps: None,
        },
    );
    let encoded = serde_json::to_string_pretty(&manifest).map_err(to_error)?;
    fs::write(dir.join(MANIFEST_FILE_NAME), encoded)
        .await
        .map_err(to_error)?;
    send_progress(
        &on_progress,
        DownloadProgress {
            phase: "complete".to_string(),
            downloaded_bytes: total_bytes,
            total_bytes,
            speed_bps: None,
        },
    );

    Ok(())
}

pub(crate) async fn ensure_model_cached<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<CachedModelPaths, String> {
    let dir = model_dir(app)?;
    let manifest_data = fs::read_to_string(dir.join(MANIFEST_FILE_NAME))
        .await
        .map_err(|_| "model-not-found".to_string())?;
    let manifest = serde_json::from_str::<ModelManifest>(&manifest_data)
        .and_then(validate_manifest)
        .map_err(to_error)?;

    let main_file = manifest
        .files
        .iter()
        .find(|file| file.file_type == "main" && file.required)
        .ok_or_else(|| "model-not-found".to_string())?;
    let model_path = model_file_path(&dir, main_file)?;
    if !verify_checksum(&model_path, &main_file.sha256).await? {
        return Err("model-checksum-mismatch".to_string());
    }

    let mmproj_file = manifest
        .files
        .iter()
        .find(|file| file.file_type == "mmproj" && file.required)
        .ok_or_else(|| "model-not-found".to_string())?;
    let mmproj_path = model_file_path(&dir, mmproj_file)?;
    if !verify_checksum(&mmproj_path, &mmproj_file.sha256).await? {
        return Err("model-checksum-mismatch".to_string());
    }

    Ok(CachedModelPaths {
        model_path,
        mmproj_path,
        manifest,
    })
}

async fn download_manifest(repo: &str) -> Result<ModelManifest, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(5))
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(to_error)?;

    for url in manifest_urls(repo) {
        match client.get(&url).send().await {
            Ok(response) if response.status().is_success() => {
                let text = response.text().await.map_err(to_error)?;
                return serde_json::from_str(&text)
                    .and_then(validate_manifest)
                    .map_err(to_error);
            }
            _ => continue,
        }
    }

    if repo == DEFAULT_MODEL_REPO {
        return Ok(default_model_manifest());
    }

    Err("model-download-failed".to_string())
}

fn default_model_manifest() -> ModelManifest {
    ModelManifest {
        version: DEFAULT_MODEL_VERSION.to_string(),
        model_repo: DEFAULT_MODEL_REPO.to_string(),
        files: vec![
            ModelManifestFile {
                filename: "SmolVLM-500M-Instruct-Q8_0.gguf".to_string(),
                sha256: "9d4612de6a42214499e301494a3ecc2be0abdd9de44e663bda63f1152fad1bf4"
                    .to_string(),
                size: 436_806_912,
                required: true,
                file_type: "main".to_string(),
            },
            ModelManifestFile {
                filename: "mmproj-SmolVLM-500M-Instruct-Q8_0.gguf".to_string(),
                sha256: "d1eb8b6b23979205fdf63703ed10f788131a3f812c7b1f72e0119d5d81295150"
                    .to_string(),
                size: 108_783_360,
                required: true,
                file_type: "mmproj".to_string(),
            },
        ],
        llama_server_args: Some(LlamaServerArgs {
            ctx_size: Some(4096),
            np: Some(1),
            host: None,
        }),
    }
}

async fn download_file_with_fallback(
    repo: &str,
    file: &ModelManifestFile,
    dir: &Path,
    completed_bytes: u64,
    total_bytes: u64,
    on_progress: &Channel<DownloadProgress>,
) -> Result<(), String> {
    for url in file_urls(repo, &file.filename) {
        if download_file(&url, file, dir, completed_bytes, total_bytes, on_progress)
            .await
            .is_ok()
        {
            return Ok(());
        }
    }

    Err("model-download-failed".to_string())
}

async fn download_file(
    url: &str,
    file: &ModelManifestFile,
    dir: &Path,
    completed_bytes: u64,
    total_bytes: u64,
    on_progress: &Channel<DownloadProgress>,
) -> Result<(), String> {
    let filename = validate_manifest_filename(&file.filename)?;
    let target = dir.join(filename);
    let tmp = dir.join(format!("{filename}.tmp"));
    let existing_bytes = fs::metadata(&tmp)
        .await
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    let mut headers = HeaderMap::new();
    if existing_bytes > 0 {
        headers.insert(
            RANGE,
            HeaderValue::from_str(&format!("bytes={existing_bytes}-")).map_err(to_error)?,
        );
    }
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(5))
        .read_timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(to_error)?;
    let mut response = client
        .get(url)
        .headers(headers)
        .send()
        .await
        .map_err(to_error)?;
    if !response.status().is_success() {
        return Err("model-download-failed".to_string());
    }
    let server_resumed = response.status() == StatusCode::PARTIAL_CONTENT;
    let should_append = existing_bytes > 0 && server_resumed;

    let mut output = fs::OpenOptions::new()
        .create(true)
        .append(should_append)
        .write(true)
        .truncate(!should_append)
        .open(&tmp)
        .await
        .map_err(to_error)?;
    let start = Instant::now();
    let mut downloaded_for_file = if should_append { existing_bytes } else { 0 };

    while let Some(chunk) = response.chunk().await.map_err(to_error)? {
        output.write_all(&chunk).await.map_err(to_error)?;
        downloaded_for_file = downloaded_for_file.saturating_add(chunk.len() as u64);
        let elapsed = start.elapsed().as_secs().max(1);
        send_progress(
            on_progress,
            DownloadProgress {
                phase: "downloading".to_string(),
                downloaded_bytes: completed_bytes.saturating_add(downloaded_for_file),
                total_bytes,
                speed_bps: Some(downloaded_for_file / elapsed),
            },
        );
    }
    output.flush().await.map_err(to_error)?;

    if downloaded_for_file != file.size {
        return Err("model-download-failed".to_string());
    }
    fs::rename(tmp, target).await.map_err(to_error)
}

fn validate_manifest(manifest: ModelManifest) -> serde_json::Result<ModelManifest> {
    for file in &manifest.files {
        validate_manifest_filename(&file.filename).map_err(serde::de::Error::custom)?;
    }

    let required_main_count = manifest
        .files
        .iter()
        .filter(|file| file.required && file.file_type == "main")
        .count();
    let required_mmproj_count = manifest
        .files
        .iter()
        .filter(|file| file.required && file.file_type == "mmproj")
        .count();
    if required_main_count != 1 || required_mmproj_count != 1 {
        return Err(serde::de::Error::custom(
			"model manifest must contain exactly one required main file and one required mmproj file",
		));
    }

    Ok(manifest)
}

fn validate_manifest_filename(filename: &str) -> Result<&str, String> {
    if filename.is_empty()
        || filename == "."
        || filename == ".."
        || filename.contains('/')
        || filename.contains('\\')
    {
        return Err("model-manifest-invalid-filename".to_string());
    }

    let path = Path::new(filename);
    if path.is_absolute() || path.file_name().and_then(|name| name.to_str()) != Some(filename) {
        return Err("model-manifest-invalid-filename".to_string());
    }

    Ok(filename)
}

fn model_file_path(dir: &Path, file: &ModelManifestFile) -> Result<PathBuf, String> {
    Ok(dir.join(validate_manifest_filename(&file.filename)?))
}

async fn verify_checksum(path: &PathBuf, expected: &str) -> Result<bool, String> {
    let mut file = fs::File::open(path).await.map_err(to_error)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer).await.map_err(to_error)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    let actual = hex::encode(hasher.finalize());
    Ok(actual.eq_ignore_ascii_case(expected))
}

fn empty_status() -> ModelStatus {
    ModelStatus {
        version: DEFAULT_MODEL_VERSION.to_string(),
        downloaded: false,
        downloaded_bytes: 0,
        total_bytes: 0,
        checksum_verified: false,
    }
}
