use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    authorize_workspace_root, ensure_parent, normalize_non_empty_path, now_ms, read_json_file,
    to_error, validate_child_name, write_json_file,
};

const DATASET_SCHEMA_VERSION: u32 = 1;
const SAMPLE_SCHEMA_VERSION: u32 = 1;
const EXPORT_SCHEMA_VERSION: u32 = 1;
const DATASET_MANIFEST_FILE_NAME: &str = "dataset.json";
const SAMPLE_MANIFEST_FILE_NAME: &str = "metadata.json";
const SOURCE_FILE_NAME: &str = "source.atex";
const MIDI_ARTIFACT_KIND: &str = "midi";
const MIDI_ARTIFACT_FILE_NAME: &str = "score.mid";
const WAV_ARTIFACT_KIND: &str = "wav";
const WAV_ARTIFACT_FILE_NAME: &str = "audio.wav";
const IMAGE_ARTIFACT_KIND: &str = "image";
const IMAGE_ARTIFACT_FILE_NAME: &str = "render.png";
const LEGACY_AUDIO_ARTIFACT_KIND: &str = "audio";

static UID_COUNTER: AtomicU64 = AtomicU64::new(0);

fn make_short_uid_suffix() -> String {
    // Keep this ASCII-only, filename-component friendly.
    // Includes timestamp + pid + monotonic counter to avoid collisions within the same ms.
    let ts = now_ms();
    let pid = std::process::id();
    let ctr = UID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{ts}-{pid}-{ctr}")
}

fn make_unique_container_id(
    container_dir: &Path,
    prefix: &str,
    conflict_error: &str,
) -> Result<String, String> {
    fs::create_dir_all(container_dir).map_err(to_error)?;

    // Loop is mostly to guard against the (very unlikely) case of collisions.
    for _ in 0..8 {
        let candidate = format!("{prefix}-{}", make_short_uid_suffix());
        let validated = validate_child_name(&candidate)?;
        if !container_dir.join(&validated).exists() {
            return Ok(validated);
        }
    }

    Err(conflict_error.to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum SampleReviewStatus {
    Pending,
    Approved,
    Rejected,
}

impl Default for SampleReviewStatus {
    fn default() -> Self {
        Self::Pending
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ArtifactState {
    Missing,
    Ready,
    Stale,
}

impl Default for ArtifactState {
    fn default() -> Self {
        Self::Missing
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DatasetManifest {
    pub(crate) schema_version: u32,
    pub(crate) id: String,
    pub(crate) name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) description: Option<String>,
    pub(crate) created_at: u64,
    pub(crate) updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SampleSourceManifest {
    pub(crate) file_name: String,
    pub(crate) text_hash: String,
    pub(crate) updated_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SampleArtifactManifest {
    pub(crate) file_name: String,
    #[serde(default)]
    pub(crate) state: ArtifactState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) source_hash: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) updated_at: Option<u64>,
}

pub(crate) type SampleArtifactsManifest = BTreeMap<String, SampleArtifactManifest>;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SampleManifest {
    pub(crate) schema_version: u32,
    pub(crate) id: String,
    pub(crate) dataset_id: String,
    pub(crate) title: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) tags: Vec<String>,
    #[serde(default)]
    pub(crate) review_status: SampleReviewStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) review_notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) metadata: Option<Value>,
    pub(crate) source: SampleSourceManifest,
    #[serde(default = "make_default_artifacts")]
    pub(crate) artifacts: SampleArtifactsManifest,
    pub(crate) created_at: u64,
    pub(crate) updated_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SampleSummary {
    pub(crate) id: String,
    pub(crate) title: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub(crate) tags: Vec<String>,
    pub(crate) review_status: SampleReviewStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) review_notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) metadata: Option<Value>,
    pub(crate) source: SampleSourceManifest,
    pub(crate) artifacts: SampleArtifactsManifest,
    pub(crate) created_at: u64,
    pub(crate) updated_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LoadedDataset {
    pub(crate) dataset: DatasetManifest,
    pub(crate) samples: Vec<SampleSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LoadedSample {
    pub(crate) sample: SampleManifest,
    pub(crate) source_text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DatasetListEntry {
    pub(crate) dataset: DatasetManifest,
    pub(crate) sample_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DatasetCommandResponse<T> {
    pub(crate) success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateDatasetInput {
    #[serde(default)]
    pub(crate) id: Option<String>,
    pub(crate) name: String,
    #[serde(default)]
    pub(crate) description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CreateSampleInput {
    #[serde(default)]
    pub(crate) id: Option<String>,
    #[serde(default)]
    pub(crate) title: Option<String>,
    #[serde(default)]
    pub(crate) tags: Option<Vec<String>>,
    #[serde(default)]
    pub(crate) source_text: Option<String>,
    #[serde(default)]
    pub(crate) metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UpdateSampleInput {
    #[serde(default)]
    pub(crate) title: Option<String>,
    #[serde(default)]
    pub(crate) tags: Option<Vec<String>>,
    #[serde(default)]
    pub(crate) review_status: Option<SampleReviewStatus>,
    #[serde(default)]
    pub(crate) review_notes: Option<String>,
    #[serde(default)]
    pub(crate) metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DatasetExportResult {
    pub(crate) path: String,
    pub(crate) relative_path: String,
    pub(crate) exported_count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportSourcePayload {
    text: String,
    text_hash: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct JsonlExportRecord {
    schema_version: u32,
    dataset_id: String,
    dataset_name: String,
    sample_id: String,
    title: String,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    metadata: Option<Value>,
    review_status: SampleReviewStatus,
    source: ExportSourcePayload,
    artifacts: SampleArtifactsManifest,
}

fn tabel_root(repo_root: &Path) -> PathBuf {
    repo_root.join(".tabel")
}

fn datasets_root(repo_root: &Path) -> PathBuf {
    tabel_root(repo_root).join("datasets")
}

fn exports_root(repo_root: &Path) -> PathBuf {
    tabel_root(repo_root).join("exports")
}

fn dataset_dir(repo_root: &Path, dataset_id: &str) -> PathBuf {
    datasets_root(repo_root).join(dataset_id)
}

fn dataset_manifest_path(repo_root: &Path, dataset_id: &str) -> PathBuf {
    dataset_dir(repo_root, dataset_id).join(DATASET_MANIFEST_FILE_NAME)
}

fn dataset_samples_dir(repo_root: &Path, dataset_id: &str) -> PathBuf {
    dataset_dir(repo_root, dataset_id).join("samples")
}

fn sample_dir(repo_root: &Path, dataset_id: &str, sample_id: &str) -> PathBuf {
    dataset_samples_dir(repo_root, dataset_id).join(sample_id)
}

fn sample_manifest_path(repo_root: &Path, dataset_id: &str, sample_id: &str) -> PathBuf {
    sample_dir(repo_root, dataset_id, sample_id).join(SAMPLE_MANIFEST_FILE_NAME)
}

fn sample_source_path(repo_root: &Path, dataset_id: &str, sample_id: &str) -> PathBuf {
    sample_dir(repo_root, dataset_id, sample_id).join(SOURCE_FILE_NAME)
}

fn authorize_repo_root(repo_path: &str) -> Result<PathBuf, String> {
    let normalized_repo_path =
        normalize_non_empty_path(repo_path).ok_or_else(|| "invalid-repo-path".to_string())?;
    authorize_workspace_root(&normalized_repo_path)
}

fn hash_text(source_text: &str) -> String {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in source_text.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("fnv1a64:{hash:016x}")
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|text| {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn normalize_required_text(value: &str, error: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(error.to_string());
    }
    Ok(trimmed.to_string())
}

fn normalize_tags(tags: Option<Vec<String>>) -> Vec<String> {
    tags.unwrap_or_default()
        .into_iter()
        .filter_map(|tag| {
            let trimmed = tag.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        })
        .collect()
}

fn normalize_artifact_kind(value: &str) -> Result<String, String> {
    let normalized = validate_child_name(value).map_err(|_| "invalid-artifact-kind".to_string())?;
    Ok(normalized.to_ascii_lowercase())
}

fn normalize_artifact_file_name(value: &str) -> Result<String, String> {
    validate_child_name(value).map_err(|_| "invalid-artifact-file-name".to_string())
}

fn slugify(value: &str, fallback_prefix: &str) -> String {
    let mut slug = String::new();
    let mut previous_was_separator = false;

    for ch in value.chars() {
        let normalized = ch.to_ascii_lowercase();
        if normalized.is_ascii_alphanumeric() {
            slug.push(normalized);
            previous_was_separator = false;
            continue;
        }

        if matches!(normalized, ' ' | '-' | '_') && !previous_was_separator && !slug.is_empty() {
            slug.push('-');
            previous_was_separator = true;
        }
    }

    while slug.ends_with('-') {
        slug.pop();
    }

    if slug.is_empty() {
        return format!("{fallback_prefix}-{}", now_ms());
    }

    slug
}

fn ensure_unique_id(
    container_dir: &Path,
    requested_id: Option<String>,
    label: &str,
    fallback_prefix: &str,
    conflict_error: &str,
) -> Result<String, String> {
    fs::create_dir_all(container_dir).map_err(to_error)?;

    if let Some(id) = requested_id {
        let validated = validate_child_name(&id)?;
        if container_dir.join(&validated).exists() {
            return Err(conflict_error.to_string());
        }
        return Ok(validated);
    }

    let base = slugify(label, fallback_prefix);
    if !container_dir.join(&base).exists() {
        return Ok(base);
    }

    for suffix in 1..=1024 {
        let candidate = format!("{base}-{suffix}");
        if !container_dir.join(&candidate).exists() {
            return Ok(candidate);
        }
    }

    Err(conflict_error.to_string())
}

fn make_missing_artifact(file_name: &str) -> SampleArtifactManifest {
    SampleArtifactManifest {
        file_name: file_name.to_string(),
        state: ArtifactState::Missing,
        source_hash: None,
        updated_at: None,
    }
}

fn make_default_artifacts() -> SampleArtifactsManifest {
    let mut artifacts = SampleArtifactsManifest::new();
    for (artifact_kind, file_name) in [
        (MIDI_ARTIFACT_KIND, MIDI_ARTIFACT_FILE_NAME),
        (WAV_ARTIFACT_KIND, WAV_ARTIFACT_FILE_NAME),
        (IMAGE_ARTIFACT_KIND, IMAGE_ARTIFACT_FILE_NAME),
    ] {
        artifacts.insert(artifact_kind.to_string(), make_missing_artifact(file_name));
    }

    artifacts
}

fn ensure_default_artifacts(artifacts: &mut SampleArtifactsManifest) {
    if !artifacts.contains_key(WAV_ARTIFACT_KIND) {
        if let Some(legacy_audio_artifact) = artifacts.get(LEGACY_AUDIO_ARTIFACT_KIND).cloned() {
            artifacts.insert(WAV_ARTIFACT_KIND.to_string(), legacy_audio_artifact);
        }
    }

    for (artifact_kind, file_name) in [
        (MIDI_ARTIFACT_KIND, MIDI_ARTIFACT_FILE_NAME),
        (WAV_ARTIFACT_KIND, WAV_ARTIFACT_FILE_NAME),
        (IMAGE_ARTIFACT_KIND, IMAGE_ARTIFACT_FILE_NAME),
    ] {
        artifacts
            .entry(artifact_kind.to_string())
            .or_insert_with(|| make_missing_artifact(file_name));
    }
}

fn normalize_sample_manifest(manifest: &mut SampleManifest) {
    ensure_default_artifacts(&mut manifest.artifacts);
}

fn read_required_json<T: for<'de> Deserialize<'de>>(
    path: &Path,
    missing_error: &str,
) -> Result<T, String> {
    read_json_file(path)?.ok_or_else(|| missing_error.to_string())
}

fn read_required_text(path: &Path, missing_error: &str) -> Result<String, String> {
    if !path.exists() {
        return Err(missing_error.to_string());
    }
    fs::read_to_string(path).map_err(to_error)
}

fn write_text_file(path: &Path, content: &str) -> Result<(), String> {
    ensure_parent(path)?;

    let parent = path
        .parent()
        .ok_or_else(|| "missing-parent-directory".to_string())?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "invalid-target-file-name".to_string())?;
    let temp_path = parent.join(format!(
        ".{}.tmp-{}-{}",
        file_name,
        std::process::id(),
        now_ms()
    ));

    fs::write(&temp_path, content).map_err(to_error)?;

    match fs::rename(&temp_path, path) {
        Ok(()) => Ok(()),
        Err(rename_error) => {
            if path.exists() {
                fs::remove_file(path).map_err(to_error)?;
                return match fs::rename(&temp_path, path) {
                    Ok(()) => Ok(()),
                    Err(error) => {
                        let _ = fs::remove_file(&temp_path);
                        Err(to_error(error))
                    }
                };
            }

            let _ = fs::remove_file(&temp_path);
            Err(to_error(rename_error))
        }
    }
}

fn write_binary_file(path: &Path, content: &[u8]) -> Result<(), String> {
    ensure_parent(path)?;

    let parent = path
        .parent()
        .ok_or_else(|| "missing-parent-directory".to_string())?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "invalid-target-file-name".to_string())?;
    let temp_path = parent.join(format!(
        ".{}.tmp-{}-{}",
        file_name,
        std::process::id(),
        now_ms()
    ));

    fs::write(&temp_path, content).map_err(to_error)?;

    match fs::rename(&temp_path, path) {
        Ok(()) => Ok(()),
        Err(rename_error) => {
            if path.exists() {
                fs::remove_file(path).map_err(to_error)?;
                return match fs::rename(&temp_path, path) {
                    Ok(()) => Ok(()),
                    Err(error) => {
                        let _ = fs::remove_file(&temp_path);
                        Err(to_error(error))
                    }
                };
            }

            let _ = fs::remove_file(&temp_path);
            Err(to_error(rename_error))
        }
    }
}

fn load_dataset_manifest(repo_root: &Path, dataset_id: &str) -> Result<DatasetManifest, String> {
    let validated_dataset_id = validate_child_name(dataset_id)?;
    read_required_json(
        &dataset_manifest_path(repo_root, &validated_dataset_id),
        "dataset-not-found",
    )
}

fn load_sample_manifest(
    repo_root: &Path,
    dataset_id: &str,
    sample_id: &str,
) -> Result<SampleManifest, String> {
    let validated_dataset_id = validate_child_name(dataset_id)?;
    let validated_sample_id = validate_child_name(sample_id)?;
    let mut manifest: SampleManifest = read_required_json(
        &sample_manifest_path(repo_root, &validated_dataset_id, &validated_sample_id),
        "sample-not-found",
    )?;
    normalize_sample_manifest(&mut manifest);
    Ok(manifest)
}

fn sample_summary_from_manifest(manifest: SampleManifest) -> SampleSummary {
    SampleSummary {
        id: manifest.id,
        title: manifest.title,
        tags: manifest.tags,
        review_status: manifest.review_status,
        review_notes: manifest.review_notes,
        metadata: manifest.metadata,
        source: manifest.source,
        artifacts: manifest.artifacts,
        created_at: manifest.created_at,
        updated_at: manifest.updated_at,
    }
}

fn list_sample_manifests(
    repo_root: &Path,
    dataset_id: &str,
) -> Result<Vec<SampleManifest>, String> {
    let validated_dataset_id = validate_child_name(dataset_id)?;
    let samples_dir = dataset_samples_dir(repo_root, &validated_dataset_id);
    if !samples_dir.exists() {
        return Ok(Vec::new());
    }

    let mut manifests = Vec::new();
    for entry in fs::read_dir(&samples_dir).map_err(to_error)? {
        let entry = entry.map_err(to_error)?;
        if !entry.path().is_dir() {
            continue;
        }

        let mut sample_manifest: SampleManifest = read_required_json(
            &entry.path().join(SAMPLE_MANIFEST_FILE_NAME),
            "sample-not-found",
        )?;
        normalize_sample_manifest(&mut sample_manifest);
        manifests.push(sample_manifest);
    }

    // Keep sample ordering stable and independent from timestamp changes.
    manifests.sort_by(|left, right| left.id.cmp(&right.id));

    Ok(manifests)
}

fn list_dataset_manifests(repo_root: &Path) -> Result<Vec<DatasetManifest>, String> {
    let datasets_dir = datasets_root(repo_root);
    if !datasets_dir.exists() {
        return Ok(Vec::new());
    }

    let mut manifests = Vec::new();
    for entry in fs::read_dir(&datasets_dir).map_err(to_error)? {
        let entry = entry.map_err(to_error)?;
        if !entry.path().is_dir() {
            continue;
        }

        let manifest: DatasetManifest = read_required_json(
            &entry.path().join(DATASET_MANIFEST_FILE_NAME),
            "dataset-not-found",
        )?;
        manifests.push(manifest);
    }

    manifests.sort_by(|left, right| {
        right
            .updated_at
            .cmp(&left.updated_at)
            .then_with(|| left.id.cmp(&right.id))
    });

    Ok(manifests)
}

fn list_datasets_impl(repo_root: &Path) -> Result<Vec<DatasetListEntry>, String> {
    let mut entries = Vec::new();

    for dataset in list_dataset_manifests(repo_root)? {
        let sample_count = list_sample_manifests(repo_root, &dataset.id)?.len();
        entries.push(DatasetListEntry {
            dataset,
            sample_count,
        });
    }

    Ok(entries)
}

fn create_dataset_impl(
    repo_root: &Path,
    input: CreateDatasetInput,
) -> Result<DatasetManifest, String> {
    let name = normalize_required_text(&input.name, "invalid-dataset-name")?;
    let datasets_dir = datasets_root(repo_root);
    let dataset_id = if input.id.is_some() {
        ensure_unique_id(
            &datasets_dir,
            input.id,
            &name,
            "dataset",
            "dataset-already-exists",
        )?
    } else {
        // Don't derive filesystem directory names from free-form dataset names.
        // It can exceed platform filename component limits.
        make_unique_container_id(&datasets_dir, "dataset", "dataset-already-exists")?
    };
    let dataset_dir_path = dataset_dir(repo_root, &dataset_id);
    fs::create_dir_all(dataset_dir_path.join("samples")).map_err(to_error)?;

    let timestamp = now_ms();
    let manifest = DatasetManifest {
        schema_version: DATASET_SCHEMA_VERSION,
        id: dataset_id,
        name,
        description: normalize_optional_text(input.description),
        created_at: timestamp,
        updated_at: timestamp,
    };
    write_json_file(&dataset_manifest_path(repo_root, &manifest.id), &manifest)?;
    Ok(manifest)
}

fn load_dataset_impl(repo_root: &Path, dataset_id: &str) -> Result<LoadedDataset, String> {
    let dataset = load_dataset_manifest(repo_root, dataset_id)?;
    let samples = list_sample_manifests(repo_root, &dataset.id)?
        .into_iter()
        .map(sample_summary_from_manifest)
        .collect();

    Ok(LoadedDataset { dataset, samples })
}

fn create_sample_impl(
    repo_root: &Path,
    dataset_id: &str,
    input: CreateSampleInput,
) -> Result<LoadedSample, String> {
    let dataset = load_dataset_manifest(repo_root, dataset_id)?;
    let samples_dir = dataset_samples_dir(repo_root, &dataset.id);

    let mut source_text = input.source_text.unwrap_or_default();
    if source_text.trim().is_empty() {
        source_text = String::new();
    }

    // Title can be omitted if source is provided. If both are empty, fail.
    let normalized_title = normalize_optional_text(input.title);
    if normalized_title.is_none() && source_text.is_empty() {
        return Err("Sample title or source is required.".to_string());
    }

    let derive_title_from_source = |text: &str| -> String {
        let first = text
            .lines()
            .map(|l| l.trim())
            .find(|l| !l.is_empty())
            .unwrap_or("Untitled");

        // Keep title short enough for UI labels / filenames.
        if first.len() > 64 {
            first.chars().take(64).collect::<String>()
        } else {
            first.to_string()
        }
    };

    let title = normalized_title.unwrap_or_else(|| derive_title_from_source(&source_text));

    let sample_id = if input.id.is_some() {
        ensure_unique_id(
            &samples_dir,
            input.id,
            &title,
            "sample",
            "sample-already-exists",
        )?
    } else {
        // Don't derive filesystem directory names from free-form sample titles.
        // It can exceed platform filename component limits during imports.
        make_unique_container_id(&samples_dir, "sample", "sample-already-exists")?
    };
    let sample_dir_path = sample_dir(repo_root, &dataset.id, &sample_id);
    fs::create_dir_all(&sample_dir_path).map_err(to_error)?;

    let timestamp = now_ms();
    let source_text = source_text;
    let sample = SampleManifest {
        schema_version: SAMPLE_SCHEMA_VERSION,
        id: sample_id,
        dataset_id: dataset.id,
        title,
        tags: normalize_tags(input.tags),
        review_status: SampleReviewStatus::Pending,
        review_notes: None,
        metadata: input.metadata,
        source: SampleSourceManifest {
            file_name: SOURCE_FILE_NAME.to_string(),
            text_hash: hash_text(&source_text),
            updated_at: timestamp,
        },
        artifacts: make_default_artifacts(),
        created_at: timestamp,
        updated_at: timestamp,
    };

    write_text_file(
        &sample_source_path(repo_root, &sample.dataset_id, &sample.id),
        &source_text,
    )?;
    write_json_file(
        &sample_manifest_path(repo_root, &sample.dataset_id, &sample.id),
        &sample,
    )?;

    Ok(LoadedSample {
        sample,
        source_text,
    })
}

fn load_sample_impl(
    repo_root: &Path,
    dataset_id: &str,
    sample_id: &str,
) -> Result<LoadedSample, String> {
    let sample = load_sample_manifest(repo_root, dataset_id, sample_id)?;
    let source_text = read_required_text(
        &sample_source_path(repo_root, &sample.dataset_id, &sample.id),
        "sample-source-not-found",
    )?;

    Ok(LoadedSample {
        sample,
        source_text,
    })
}

fn invalidate_artifact_for_source(artifact: &mut SampleArtifactManifest, next_source_hash: &str) {
    if artifact.source_hash.as_deref() == Some(next_source_hash) {
        return;
    }

    artifact.state = ArtifactState::Stale;
}

fn save_sample_source_impl(
    repo_root: &Path,
    dataset_id: &str,
    sample_id: &str,
    source_text: String,
) -> Result<LoadedSample, String> {
    let mut sample = load_sample_manifest(repo_root, dataset_id, sample_id)?;
    let source_path = sample_source_path(repo_root, &sample.dataset_id, &sample.id);
    write_text_file(&source_path, &source_text)?;

    let timestamp = now_ms();
    let next_source_hash = hash_text(&source_text);
    sample.source.text_hash = next_source_hash.clone();
    sample.source.updated_at = timestamp;
    ensure_default_artifacts(&mut sample.artifacts);
    for artifact in sample.artifacts.values_mut() {
        invalidate_artifact_for_source(artifact, &next_source_hash);
    }
    sample.updated_at = timestamp;

    write_json_file(
        &sample_manifest_path(repo_root, &sample.dataset_id, &sample.id),
        &sample,
    )?;

    Ok(LoadedSample {
        sample,
        source_text,
    })
}

fn save_sample_artifact_impl(
    repo_root: &Path,
    dataset_id: &str,
    sample_id: &str,
    artifact_kind: &str,
    target_file_name: &str,
    bytes: Vec<u8>,
) -> Result<LoadedSample, String> {
    let mut sample = load_sample_manifest(repo_root, dataset_id, sample_id)?;
    let normalized_artifact_kind = normalize_artifact_kind(artifact_kind)?;
    let normalized_file_name = normalize_artifact_file_name(target_file_name)?;

    let artifact_path =
        sample_dir(repo_root, &sample.dataset_id, &sample.id).join(&normalized_file_name);
    write_binary_file(&artifact_path, &bytes)?;

    let timestamp = now_ms();
    let source_hash = sample.source.text_hash.clone();
    ensure_default_artifacts(&mut sample.artifacts);
    let artifact = sample
        .artifacts
        .entry(normalized_artifact_kind)
        .or_insert_with(|| make_missing_artifact(&normalized_file_name));
    artifact.file_name = normalized_file_name;
    artifact.state = ArtifactState::Ready;
    artifact.source_hash = Some(source_hash);
    artifact.updated_at = Some(timestamp);
    sample.updated_at = timestamp;

    write_json_file(
        &sample_manifest_path(repo_root, &sample.dataset_id, &sample.id),
        &sample,
    )?;

    let source_text = read_required_text(
        &sample_source_path(repo_root, &sample.dataset_id, &sample.id),
        "sample-source-not-found",
    )?;

    Ok(LoadedSample {
        sample,
        source_text,
    })
}

fn update_sample_impl(
    repo_root: &Path,
    dataset_id: &str,
    sample_id: &str,
    update: UpdateSampleInput,
) -> Result<LoadedSample, String> {
    let mut sample = load_sample_manifest(repo_root, dataset_id, sample_id)?;
    let source_text = read_required_text(
        &sample_source_path(repo_root, &sample.dataset_id, &sample.id),
        "sample-source-not-found",
    )?;

    if let Some(title) = update.title {
        sample.title = normalize_required_text(&title, "invalid-sample-title")?;
    }
    if let Some(tags) = update.tags {
        sample.tags = normalize_tags(Some(tags));
    }
    if let Some(review_status) = update.review_status {
        sample.review_status = review_status;
    }
    if let Some(review_notes) = update.review_notes {
        sample.review_notes = normalize_optional_text(Some(review_notes));
    }
    if let Some(metadata) = update.metadata {
        sample.metadata = Some(metadata);
    }

    sample.updated_at = now_ms();
    write_json_file(
        &sample_manifest_path(repo_root, &sample.dataset_id, &sample.id),
        &sample,
    )?;

    Ok(LoadedSample {
        sample,
        source_text,
    })
}

fn export_dataset_jsonl_impl(
    repo_root: &Path,
    dataset_id: &str,
) -> Result<DatasetExportResult, String> {
    let dataset = load_dataset_manifest(repo_root, dataset_id)?;
    let samples = list_sample_manifests(repo_root, &dataset.id)?;
    let mut records = Vec::new();

    for sample in samples {
        if !matches!(sample.review_status, SampleReviewStatus::Approved) {
            continue;
        }

        let source_text = read_required_text(
            &sample_source_path(repo_root, &sample.dataset_id, &sample.id),
            "sample-source-not-found",
        )?;
        records.push(JsonlExportRecord {
            schema_version: EXPORT_SCHEMA_VERSION,
            dataset_id: dataset.id.clone(),
            dataset_name: dataset.name.clone(),
            sample_id: sample.id.clone(),
            title: sample.title.clone(),
            tags: sample.tags.clone(),
            metadata: sample.metadata.clone(),
            review_status: sample.review_status.clone(),
            source: ExportSourcePayload {
                text: source_text,
                text_hash: sample.source.text_hash.clone(),
            },
            artifacts: sample.artifacts.clone(),
        });
    }

    let export_dir = exports_root(repo_root).join(&dataset.id);
    fs::create_dir_all(&export_dir).map_err(to_error)?;
    let export_name = format!("{}-approved-{}.jsonl", dataset.id, now_ms());
    let export_path = export_dir.join(export_name);
    let content = records
        .iter()
        .map(|record| serde_json::to_string(record).map_err(to_error))
        .collect::<Result<Vec<_>, _>>()?
        .join("\n");
    write_text_file(&export_path, &content)?;

    let relative_path = export_path
        .strip_prefix(repo_root)
        .map_err(to_error)?
        .to_string_lossy()
        .replace('\\', "/");

    Ok(DatasetExportResult {
        path: export_path.to_string_lossy().to_string(),
        relative_path,
        exported_count: records.len(),
    })
}

#[tauri::command]
pub(crate) fn list_datasets(repo_path: String) -> DatasetCommandResponse<Vec<DatasetListEntry>> {
    let repo_root = match authorize_repo_root(&repo_path) {
        Ok(value) => value,
        Err(error) => {
            return DatasetCommandResponse {
                success: false,
                data: None,
                error: Some(error),
            };
        }
    };

    match list_datasets_impl(&repo_root) {
        Ok(data) => DatasetCommandResponse {
            success: true,
            data: Some(data),
            error: None,
        },
        Err(error) => DatasetCommandResponse {
            success: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub(crate) fn create_dataset(
    repo_path: String,
    input: CreateDatasetInput,
) -> DatasetCommandResponse<DatasetManifest> {
    let repo_root = match authorize_repo_root(&repo_path) {
        Ok(value) => value,
        Err(error) => {
            return DatasetCommandResponse {
                success: false,
                data: None,
                error: Some(error),
            };
        }
    };

    match create_dataset_impl(&repo_root, input) {
        Ok(data) => DatasetCommandResponse {
            success: true,
            data: Some(data),
            error: None,
        },
        Err(error) => DatasetCommandResponse {
            success: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub(crate) fn load_dataset(
    repo_path: String,
    dataset_id: String,
) -> DatasetCommandResponse<LoadedDataset> {
    let repo_root = match authorize_repo_root(&repo_path) {
        Ok(value) => value,
        Err(error) => {
            return DatasetCommandResponse {
                success: false,
                data: None,
                error: Some(error),
            };
        }
    };

    match load_dataset_impl(&repo_root, &dataset_id) {
        Ok(data) => DatasetCommandResponse {
            success: true,
            data: Some(data),
            error: None,
        },
        Err(error) => DatasetCommandResponse {
            success: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub(crate) fn create_sample(
    repo_path: String,
    dataset_id: String,
    input: CreateSampleInput,
) -> DatasetCommandResponse<LoadedSample> {
    let repo_root = match authorize_repo_root(&repo_path) {
        Ok(value) => value,
        Err(error) => {
            return DatasetCommandResponse {
                success: false,
                data: None,
                error: Some(error),
            };
        }
    };

    match create_sample_impl(&repo_root, &dataset_id, input) {
        Ok(data) => DatasetCommandResponse {
            success: true,
            data: Some(data),
            error: None,
        },
        Err(error) => DatasetCommandResponse {
            success: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub(crate) fn load_sample(
    repo_path: String,
    dataset_id: String,
    sample_id: String,
) -> DatasetCommandResponse<LoadedSample> {
    let repo_root = match authorize_repo_root(&repo_path) {
        Ok(value) => value,
        Err(error) => {
            return DatasetCommandResponse {
                success: false,
                data: None,
                error: Some(error),
            };
        }
    };

    match load_sample_impl(&repo_root, &dataset_id, &sample_id) {
        Ok(data) => DatasetCommandResponse {
            success: true,
            data: Some(data),
            error: None,
        },
        Err(error) => DatasetCommandResponse {
            success: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub(crate) fn save_sample_source(
    repo_path: String,
    dataset_id: String,
    sample_id: String,
    source_text: String,
) -> DatasetCommandResponse<LoadedSample> {
    let repo_root = match authorize_repo_root(&repo_path) {
        Ok(value) => value,
        Err(error) => {
            return DatasetCommandResponse {
                success: false,
                data: None,
                error: Some(error),
            };
        }
    };

    match save_sample_source_impl(&repo_root, &dataset_id, &sample_id, source_text) {
        Ok(data) => DatasetCommandResponse {
            success: true,
            data: Some(data),
            error: None,
        },
        Err(error) => DatasetCommandResponse {
            success: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub(crate) fn save_sample_artifact(
    repo_path: String,
    dataset_id: String,
    sample_id: String,
    artifact_kind: String,
    target_file_name: String,
    bytes: Vec<u8>,
) -> DatasetCommandResponse<LoadedSample> {
    let repo_root = match authorize_repo_root(&repo_path) {
        Ok(value) => value,
        Err(error) => {
            return DatasetCommandResponse {
                success: false,
                data: None,
                error: Some(error),
            };
        }
    };

    match save_sample_artifact_impl(
        &repo_root,
        &dataset_id,
        &sample_id,
        &artifact_kind,
        &target_file_name,
        bytes,
    ) {
        Ok(data) => DatasetCommandResponse {
            success: true,
            data: Some(data),
            error: None,
        },
        Err(error) => DatasetCommandResponse {
            success: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub(crate) fn update_sample(
    repo_path: String,
    dataset_id: String,
    sample_id: String,
    update: UpdateSampleInput,
) -> DatasetCommandResponse<LoadedSample> {
    let repo_root = match authorize_repo_root(&repo_path) {
        Ok(value) => value,
        Err(error) => {
            return DatasetCommandResponse {
                success: false,
                data: None,
                error: Some(error),
            };
        }
    };

    match update_sample_impl(&repo_root, &dataset_id, &sample_id, update) {
        Ok(data) => DatasetCommandResponse {
            success: true,
            data: Some(data),
            error: None,
        },
        Err(error) => DatasetCommandResponse {
            success: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub(crate) fn export_dataset_jsonl(
    repo_path: String,
    dataset_id: String,
) -> DatasetCommandResponse<DatasetExportResult> {
    let repo_root = match authorize_repo_root(&repo_path) {
        Ok(value) => value,
        Err(error) => {
            return DatasetCommandResponse {
                success: false,
                data: None,
                error: Some(error),
            };
        }
    };

    match export_dataset_jsonl_impl(&repo_root, &dataset_id) {
        Ok(data) => DatasetCommandResponse {
            success: true,
            data: Some(data),
            error: None,
        },
        Err(error) => DatasetCommandResponse {
            success: false,
            data: None,
            error: Some(error),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{read_json_file, register_allowed_root};
    use serde_json::json;

    fn temp_repo_dir(test_name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "tabst-tabel-{}-{}-{}",
            test_name,
            std::process::id(),
            now_ms()
        ));
        fs::create_dir_all(&dir).expect("failed to create temp repo dir");
        dir
    }

    #[test]
    fn dataset_roundtrip_uses_repo_local_tabel_storage() {
        let repo_dir = temp_repo_dir("dataset-roundtrip");
        register_allowed_root(&repo_dir).expect("register repo root");
        let repo_path = repo_dir.to_string_lossy().to_string();

        let created_dataset = create_dataset(
            repo_path.clone(),
            CreateDatasetInput {
                id: Some("training-set".to_string()),
                name: "Training Set".to_string(),
                description: Some("first pass dataset".to_string()),
            },
        );
        assert!(created_dataset.success, "dataset creation should succeed");

        let created_sample = create_sample(
            repo_path.clone(),
            "training-set".to_string(),
            CreateSampleInput {
                id: Some("sample-a".to_string()),
                title: Some("Sample A".to_string()),
                tags: Some(vec!["riff".to_string(), "clean".to_string()]),
                source_text: None,
                metadata: Some(json!({ "difficulty": "easy" })),
            },
        );
        assert!(created_sample.success, "sample creation should succeed");
        assert_eq!(
            created_sample
                .data
                .as_ref()
                .expect("sample payload")
                .sample
                .source
                .file_name,
            SOURCE_FILE_NAME
        );

        let listed = list_datasets(repo_path.clone());
        assert!(listed.success, "listing datasets should succeed");
        assert_eq!(
            listed
                .data
                .as_ref()
                .expect("dataset list payload")
                .first()
                .expect("dataset entry")
                .sample_count,
            1
        );

        let loaded_dataset = load_dataset(repo_path.clone(), "training-set".to_string());
        assert!(loaded_dataset.success, "dataset load should succeed");
        let dataset_payload = loaded_dataset.data.expect("dataset payload");
        assert_eq!(dataset_payload.samples.len(), 1);
        assert_eq!(dataset_payload.samples[0].id, "sample-a");

        let loaded_sample = load_sample(
            repo_path.clone(),
            "training-set".to_string(),
            "sample-a".to_string(),
        );
        assert!(loaded_sample.success, "sample load should succeed");
        let sample_payload = loaded_sample.data.expect("sample payload");
        assert_eq!(sample_payload.source_text, "");
        assert!(
            sample_payload
                .sample
                .artifacts
                .contains_key(MIDI_ARTIFACT_KIND),
            "new samples should include a midi artifact entry"
        );
        assert!(
            sample_payload
                .sample
                .artifacts
                .contains_key(WAV_ARTIFACT_KIND),
            "new samples should include a wav artifact entry"
        );
        assert!(
            sample_payload
                .sample
                .artifacts
                .contains_key(IMAGE_ARTIFACT_KIND),
            "new samples should keep legacy image compatibility entry"
        );
        assert!(
            repo_dir
                .join(".tabel/datasets/training-set/dataset.json")
                .exists(),
            "dataset manifest should live under repo/.tabel"
        );
        assert!(
            repo_dir
                .join(".tabel/datasets/training-set/samples/sample-a/source.atex")
                .exists(),
            "sample source should live under repo/.tabel"
        );

        let _ = fs::remove_dir_all(&repo_dir);
    }

    #[test]
    fn loading_legacy_audio_artifact_backfills_wav_artifact_entry() {
        let repo_dir = temp_repo_dir("legacy-audio-migration");
        register_allowed_root(&repo_dir).expect("register repo root");
        let repo_path = repo_dir.to_string_lossy().to_string();

        create_dataset(
            repo_path.clone(),
            CreateDatasetInput {
                id: Some("migration-set".to_string()),
                name: "Migration Set".to_string(),
                description: None,
            },
        );
        create_sample(
            repo_path.clone(),
            "migration-set".to_string(),
            CreateSampleInput {
                id: Some("sample-1".to_string()),
                title: Some("Sample 1".to_string()),
                tags: None,
                source_text: None,
                metadata: None,
            },
        );

        let manifest_path = sample_manifest_path(&repo_dir, "migration-set", "sample-1");
        let mut manifest: SampleManifest = read_json_file(&manifest_path)
            .expect("read sample manifest")
            .expect("sample manifest");
        manifest.artifacts.remove(MIDI_ARTIFACT_KIND);
        manifest.artifacts.remove(WAV_ARTIFACT_KIND);
        manifest.artifacts.insert(
            LEGACY_AUDIO_ARTIFACT_KIND.to_string(),
            SampleArtifactManifest {
                file_name: WAV_ARTIFACT_FILE_NAME.to_string(),
                state: ArtifactState::Ready,
                source_hash: Some("fnv1a64:legacyaudiohash".to_string()),
                updated_at: Some(now_ms()),
            },
        );
        write_json_file(&manifest_path, &manifest).expect("write legacy sample manifest");

        let loaded = load_sample(
            repo_path,
            "migration-set".to_string(),
            "sample-1".to_string(),
        );
        assert!(loaded.success, "loading legacy sample should succeed");
        let loaded_sample = loaded.data.expect("loaded sample payload").sample;
        assert!(
            loaded_sample.artifacts.contains_key(MIDI_ARTIFACT_KIND),
            "legacy sample should backfill midi artifact default"
        );
        assert!(
            loaded_sample.artifacts.contains_key(WAV_ARTIFACT_KIND),
            "legacy sample should backfill wav artifact from audio"
        );
        assert_eq!(
            loaded_sample
                .artifacts
                .get(WAV_ARTIFACT_KIND)
                .expect("wav artifact")
                .source_hash
                .as_deref(),
            Some("fnv1a64:legacyaudiohash")
        );

        let _ = fs::remove_dir_all(&repo_dir);
    }

    #[test]
    fn saving_source_invalidates_only_artifacts_with_mismatched_hashes() {
        let repo_dir = temp_repo_dir("source-invalidation");
        register_allowed_root(&repo_dir).expect("register repo root");
        let repo_path = repo_dir.to_string_lossy().to_string();

        create_dataset(
            repo_path.clone(),
            CreateDatasetInput {
                id: Some("review-set".to_string()),
                name: "Review Set".to_string(),
                description: None,
            },
        );
        create_sample(
            repo_path.clone(),
            "review-set".to_string(),
            CreateSampleInput {
                id: Some("sample-1".to_string()),
                title: Some("Sample 1".to_string()),
                tags: None,
                source_text: None,
                metadata: None,
            },
        );

        let new_source = "title \"Song\"\n.\n".to_string();
        let new_hash = hash_text(&new_source);
        let manifest_path = sample_manifest_path(&repo_dir, "review-set", "sample-1");
        let mut manifest: SampleManifest = read_json_file(&manifest_path)
            .expect("read sample manifest result")
            .expect("sample manifest");
        manifest.artifacts.insert(
            "custom-audio".to_string(),
            SampleArtifactManifest {
                file_name: "custom.wav".to_string(),
                state: ArtifactState::Ready,
                source_hash: Some("fnv1a64:oldhash000000".to_string()),
                updated_at: Some(now_ms()),
            },
        );
        if let Some(midi_artifact) = manifest.artifacts.get_mut(MIDI_ARTIFACT_KIND) {
            midi_artifact.state = ArtifactState::Ready;
            midi_artifact.source_hash = Some("fnv1a64:oldhash000000".to_string());
        }
        if let Some(wav_artifact) = manifest.artifacts.get_mut(WAV_ARTIFACT_KIND) {
            wav_artifact.state = ArtifactState::Ready;
            wav_artifact.source_hash = Some(new_hash.clone());
        }
        write_json_file(&manifest_path, &manifest).expect("write updated sample manifest");

        let saved = save_sample_source(
            repo_path.clone(),
            "review-set".to_string(),
            "sample-1".to_string(),
            new_source.clone(),
        );
        assert!(saved.success, "saving source should succeed");

        let saved_manifest = saved.data.expect("saved sample payload").sample;
        assert_eq!(saved_manifest.source.text_hash, new_hash);
        assert_eq!(
            saved_manifest
                .artifacts
                .get(MIDI_ARTIFACT_KIND)
                .expect("midi artifact")
                .state,
            ArtifactState::Stale
        );
        assert_eq!(
            saved_manifest
                .artifacts
                .get(WAV_ARTIFACT_KIND)
                .expect("wav artifact")
                .state,
            ArtifactState::Ready
        );
        assert_eq!(
            saved_manifest
                .artifacts
                .get("custom-audio")
                .expect("custom artifact")
                .state,
            ArtifactState::Stale
        );
        assert_eq!(
            saved_manifest
                .artifacts
                .get(WAV_ARTIFACT_KIND)
                .expect("wav artifact")
                .source_hash
                .as_deref(),
            Some(saved_manifest.source.text_hash.as_str())
        );

        let _ = fs::remove_dir_all(&repo_dir);
    }

    #[test]
    fn saving_binary_artifact_writes_bytes_and_updates_manifest() {
        let repo_dir = temp_repo_dir("binary-artifact-save");
        register_allowed_root(&repo_dir).expect("register repo root");
        let repo_path = repo_dir.to_string_lossy().to_string();

        create_dataset(
            repo_path.clone(),
            CreateDatasetInput {
                id: Some("artifact-set".to_string()),
                name: "Artifact Set".to_string(),
                description: None,
            },
        );
        create_sample(
            repo_path.clone(),
            "artifact-set".to_string(),
            CreateSampleInput {
                id: Some("sample-1".to_string()),
                title: Some("Sample 1".to_string()),
                tags: None,
                source_text: None,
                metadata: None,
            },
        );

        let source_save = save_sample_source(
            repo_path.clone(),
            "artifact-set".to_string(),
            "sample-1".to_string(),
            "title \"Artifact\"\n".to_string(),
        );
        assert!(source_save.success, "source save should succeed");

        let midi_bytes = vec![0x4D, 0x54, 0x68, 0x64, 0x00, 0x00, 0x00, 0x06];
        let saved = save_sample_artifact(
            repo_path,
            "artifact-set".to_string(),
            "sample-1".to_string(),
            MIDI_ARTIFACT_KIND.to_string(),
            "generated.mid".to_string(),
            midi_bytes.clone(),
        );
        assert!(saved.success, "binary artifact save should succeed");

        let payload = saved.data.expect("saved sample payload");
        let midi_artifact = payload
            .sample
            .artifacts
            .get(MIDI_ARTIFACT_KIND)
            .expect("midi artifact entry");
        assert_eq!(midi_artifact.file_name, "generated.mid");
        assert_eq!(midi_artifact.state, ArtifactState::Ready);
        assert_eq!(
            midi_artifact.source_hash.as_deref(),
            Some(payload.sample.source.text_hash.as_str())
        );
        assert!(
            midi_artifact.updated_at.is_some(),
            "binary artifact save should stamp updated_at"
        );

        let artifact_path =
            repo_dir.join(".tabel/datasets/artifact-set/samples/sample-1/generated.mid");
        let persisted_bytes = fs::read(&artifact_path).expect("read persisted artifact bytes");
        assert_eq!(persisted_bytes, midi_bytes);

        let _ = fs::remove_dir_all(&repo_dir);
    }

    #[test]
    fn export_writes_jsonl_for_only_approved_samples() {
        let repo_dir = temp_repo_dir("export-jsonl");
        register_allowed_root(&repo_dir).expect("register repo root");
        let repo_path = repo_dir.to_string_lossy().to_string();

        create_dataset(
            repo_path.clone(),
            CreateDatasetInput {
                id: Some("export-set".to_string()),
                name: "Export Set".to_string(),
                description: None,
            },
        );

        create_sample(
            repo_path.clone(),
            "export-set".to_string(),
            CreateSampleInput {
                id: Some("approved-one".to_string()),
                title: Some("Approved One".to_string()),
                tags: Some(vec!["approved".to_string()]),
                source_text: None,
                metadata: Some(json!({ "tempo": 120 })),
            },
        );
        save_sample_source(
            repo_path.clone(),
            "export-set".to_string(),
            "approved-one".to_string(),
            "title \"Approved\"\n".to_string(),
        );
        update_sample(
            repo_path.clone(),
            "export-set".to_string(),
            "approved-one".to_string(),
            UpdateSampleInput {
                title: None,
                tags: None,
                review_status: Some(SampleReviewStatus::Approved),
                review_notes: Some("looks good".to_string()),
                metadata: None,
            },
        );

        let approved_manifest_path = sample_manifest_path(&repo_dir, "export-set", "approved-one");
        let mut approved_manifest: SampleManifest = read_json_file(&approved_manifest_path)
            .expect("read approved sample manifest")
            .expect("approved sample manifest");
        if let Some(image_artifact) = approved_manifest.artifacts.get_mut(IMAGE_ARTIFACT_KIND) {
            image_artifact.state = ArtifactState::Missing;
            image_artifact.source_hash = None;
            image_artifact.updated_at = None;
        }
        write_json_file(&approved_manifest_path, &approved_manifest)
            .expect("write approved sample manifest");

        create_sample(
            repo_path.clone(),
            "export-set".to_string(),
            CreateSampleInput {
                id: Some("pending-one".to_string()),
                title: Some("Pending One".to_string()),
                tags: None,
                source_text: None,
                metadata: None,
            },
        );
        save_sample_source(
            repo_path.clone(),
            "export-set".to_string(),
            "pending-one".to_string(),
            "title \"Pending\"\n".to_string(),
        );

        let exported = export_dataset_jsonl(repo_path, "export-set".to_string());
        assert!(exported.success, "export should succeed");
        let export_payload = exported.data.expect("export payload");
        assert_eq!(export_payload.exported_count, 1);
        assert!(
            export_payload
                .relative_path
                .starts_with(".tabel/exports/export-set/"),
            "export should stay within repo-local .tabel exports"
        );

        let export_content = fs::read_to_string(&export_payload.path).expect("read export file");
        let export_lines = export_content.lines().collect::<Vec<_>>();
        assert_eq!(
            export_lines.len(),
            1,
            "only approved samples export"
        );

        let record: Value = serde_json::from_str(export_lines[0]).expect("parse exported jsonl");
        assert_eq!(
            record["sampleId"],
            Value::String("approved-one".to_string())
        );
        assert_eq!(
            record["reviewStatus"],
            Value::String("approved".to_string())
        );
        assert!(
            record.get("description").is_none(),
            "export schema should not include removed description field"
        );
        assert!(
            record.get("split").is_none(),
            "export schema should not include removed split field"
        );
        assert!(
            record.get("consistencyStatus").is_none(),
            "export schema should not include removed consistency status field"
        );
        assert!(
            record
                .get("artifacts")
                .and_then(|artifacts| artifacts.get(MIDI_ARTIFACT_KIND))
                .is_some(),
            "jsonl export should include map-based midi artifact"
        );
        assert!(
            record
                .get("artifacts")
                .and_then(|artifacts| artifacts.get(WAV_ARTIFACT_KIND))
                .is_some(),
            "jsonl export should include map-based wav artifact"
        );

        let _ = fs::remove_dir_all(&repo_dir);
    }

    #[test]
    fn long_sample_title_does_not_break_filesystem_paths() {
        let repo_dir = temp_repo_dir("long-sample-title");
        register_allowed_root(&repo_dir).expect("register repo root");
        let repo_path = repo_dir.to_string_lossy().to_string();

        let created_dataset = create_dataset(
            repo_path.clone(),
            CreateDatasetInput {
                id: None,
                name: "dataset-with-short-name".to_string(),
                description: None,
            },
        );
        assert!(created_dataset.success, "dataset creation should succeed");

        let long_title = "T".repeat(600);
        let created_sample = create_sample(
            repo_path.clone(),
            created_dataset
                .data
                .as_ref()
                .expect("dataset payload")
                .id
                .clone(),
            CreateSampleInput {
                id: None,
                title: Some(long_title),
                tags: None,
                source_text: None,
                metadata: None,
            },
        );
        assert!(created_sample.success, "sample creation should succeed");
        let sample = created_sample.data.expect("sample payload").sample;

        let persisted_source_path = sample_source_path(&repo_dir, &sample.dataset_id, &sample.id);
        assert!(
            persisted_source_path.exists(),
            "sample source should persist even with long titles"
        );

        let persisted_manifest_path =
            sample_manifest_path(&repo_dir, &sample.dataset_id, &sample.id);
        assert!(
            persisted_manifest_path.exists(),
            "sample manifest should persist even with long titles"
        );

        let _ = fs::remove_dir_all(&repo_dir);
    }
}
