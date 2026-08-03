use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rfd::FileDialog;
use serde_json::{Map, Value};
use tokio::process::Command;
use tokio::time::{sleep, timeout};

use crate::{
    authorize_existing_workspace_path, authorize_target_path_in_scope, load_settings_json,
    normalize_non_empty_path, save_settings_json, MuseScoreSettingsResponse,
    MuseScoreValidationResponse, MusicXmlExportResponse,
};

const EXTERNAL_TOOLS_KEY: &str = "externalTools";
const MUSESCORE_PATH_KEY: &str = "museScoreExecutablePath";
const VALIDATION_TIMEOUT: Duration = Duration::from_secs(15);
const CONVERSION_TIMEOUT: Duration = Duration::from_secs(120);
const OUTPUT_APPEAR_TIMEOUT: Duration = Duration::from_secs(30);
const GP_EXTENSIONS: [&str; 5] = ["gp", "gp3", "gp4", "gp5", "gpx"];

fn configured_musescore_path() -> Result<Option<String>, String> {
    let settings = load_settings_json()?;
    Ok(settings
        .get(EXTERNAL_TOOLS_KEY)
        .and_then(Value::as_object)
        .and_then(|tools| tools.get(MUSESCORE_PATH_KEY))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .map(ToOwned::to_owned))
}

fn save_configured_musescore_path(path: Option<&str>) -> Result<(), String> {
    let mut settings = load_settings_json()?;
    let tools = settings
        .entry(EXTERNAL_TOOLS_KEY.to_string())
        .or_insert_with(|| Value::Object(Map::new()));
    if !tools.is_object() {
        *tools = Value::Object(Map::new());
    }

    let tools = tools
        .as_object_mut()
        .ok_or_else(|| "invalid-external-tools-settings".to_string())?;
    match path.map(str::trim).filter(|path| !path.is_empty()) {
        Some(value) => {
            tools.insert(
                MUSESCORE_PATH_KEY.to_string(),
                Value::String(value.to_string()),
            );
        }
        None => {
            tools.remove(MUSESCORE_PATH_KEY);
        }
    }

    save_settings_json(&settings)
}

fn validate_executable_file(executable_path: &str) -> Result<PathBuf, String> {
    let path = normalize_non_empty_path(executable_path)
        .ok_or_else(|| "invalid-musescore-path".to_string())?;
    let canonical = fs::canonicalize(path).map_err(|_| "musescore-not-found".to_string())?;
    if !canonical.is_file() {
        return Err("musescore-not-a-file".to_string());
    }
    Ok(canonical)
}

#[cfg(target_os = "windows")]
fn external_process_path(path: &Path) -> PathBuf {
    let value = path.to_string_lossy();
    if let Some(rest) = value.strip_prefix(r"\\?\UNC\") {
        return PathBuf::from(format!(r"\\{rest}"));
    }
    if let Some(rest) = value.strip_prefix(r"\\?\") {
        return PathBuf::from(rest);
    }
    path.to_path_buf()
}

#[cfg(not(target_os = "windows"))]
fn external_process_path(path: &Path) -> PathBuf {
    path.to_path_buf()
}

fn output_path_for_source(source_path: &Path) -> PathBuf {
    source_path.with_extension("mxl")
}

fn is_supported_gp_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            GP_EXTENSIONS
                .iter()
                .any(|candidate| extension.eq_ignore_ascii_case(candidate))
        })
        .unwrap_or(false)
}

fn temporary_output_path(output_path: &Path) -> PathBuf {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let stem = output_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("score");
    output_path.with_file_name(format!(
        "{stem}.tabst-export-{}-{timestamp}.mxl",
        std::process::id()
    ))
}

fn replace_output_file(temporary_path: &Path, output_path: &Path) -> Result<(), String> {
    if !output_path.exists() {
        return fs::rename(temporary_path, output_path)
            .map_err(|_| "target-replace-failed".to_string());
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let stem = output_path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("score");
    let backup_path = output_path.with_file_name(format!(
        "{stem}.tabst-backup-{}-{timestamp}.mxl",
        std::process::id()
    ));

    let _ = fs::remove_file(&backup_path);
    fs::rename(output_path, &backup_path).map_err(|_| "target-replace-failed".to_string())?;
    if fs::rename(temporary_path, output_path).is_err() {
        let _ = fs::rename(&backup_path, output_path);
        return Err("target-replace-failed".to_string());
    }
    let _ = fs::remove_file(&backup_path);
    Ok(())
}

fn looks_like_mxl(path: &Path) -> bool {
    let Ok(data) = fs::read(path) else {
        return false;
    };
    data.len() >= 22
        && data.starts_with(b"PK")
        && data.windows(4).rev().any(|window| window == b"PK\x05\x06")
}

async fn wait_for_generated_file(path: &Path, wait_time: Duration) -> bool {
    let started_at = tokio::time::Instant::now();
    loop {
        if looks_like_mxl(path) {
            return true;
        }
        if started_at.elapsed() >= wait_time {
            return false;
        }
        sleep(Duration::from_millis(100)).await;
    }
}

fn compact_version(stdout: &[u8], stderr: &[u8]) -> Option<String> {
    let text = format!(
        "{} {}",
        String::from_utf8_lossy(stdout),
        String::from_utf8_lossy(stderr)
    );
    let compact = text.split_whitespace().collect::<Vec<_>>().join(" ");
    (!compact.is_empty()).then_some(compact)
}

fn validation_failure(error: impl Into<String>) -> MuseScoreValidationResponse {
    MuseScoreValidationResponse {
        success: false,
        executable_path: None,
        version: None,
        error: Some(error.into()),
    }
}

fn export_failure(
    output_path: Option<&Path>,
    exit_code: Option<i32>,
    error: impl Into<String>,
) -> MusicXmlExportResponse {
    MusicXmlExportResponse {
        success: false,
        output_path: output_path
            .map(|path| external_process_path(path).to_string_lossy().into_owned()),
        exit_code,
        error: Some(error.into()),
    }
}

fn first_existing_candidate(candidates: &[&str]) -> Option<PathBuf> {
    candidates
        .iter()
        .map(PathBuf::from)
        .find(|path| path.is_file())
}

#[cfg(target_os = "macos")]
fn detect_default_musescore_executable() -> Option<PathBuf> {
    let bundle = PathBuf::from("/Applications/MuseScore 4.app");
    if !bundle.is_dir() {
        return None;
    }
    resolve_app_bundle_executable(&bundle)
}

#[cfg(target_os = "windows")]
fn detect_default_musescore_executable() -> Option<PathBuf> {
    const CANDIDATES: [&str; 2] = [
        r"C:\Program Files\MuseScore 4\bin\MuseScore4.exe",
        r"C:\Program Files\MuseScore 4\bin\MuseScore.exe",
    ];
    first_existing_candidate(&CANDIDATES)
}

#[cfg(all(unix, not(target_os = "macos")))]
fn detect_default_musescore_executable() -> Option<PathBuf> {
    const CANDIDATES: [&str; 3] = [
        "/usr/bin/mscore",
        "/usr/local/bin/mscore",
        "/opt/musescore/bin/mscore",
    ];
    first_existing_candidate(&CANDIDATES)
}

#[tauri::command]
pub(crate) fn load_musescore_settings() -> MuseScoreSettingsResponse {
    match configured_musescore_path() {
        Ok(executable_path) => MuseScoreSettingsResponse {
            success: true,
            executable_path,
            default_executable_path: detect_default_musescore_executable()
                .map(|path| path.to_string_lossy().into_owned()),
            error: None,
        },
        Err(error) => MuseScoreSettingsResponse {
            success: false,
            executable_path: None,
            default_executable_path: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub(crate) async fn validate_musescore_executable(
    executable_path: String,
) -> MuseScoreValidationResponse {
    let executable = match validate_executable_file(&executable_path) {
        Ok(path) => path,
        Err(error) => return validation_failure(error),
    };

    let external_executable = external_process_path(&executable);
    let mut command = Command::new(&external_executable);
    command.arg("--version").kill_on_drop(true);
    let output = match timeout(VALIDATION_TIMEOUT, command.output()).await {
        Ok(Ok(output)) => output,
        Ok(Err(_)) => return validation_failure("musescore-launch-failed"),
        Err(_) => return validation_failure("musescore-validation-timeout"),
    };

    if !output.status.success() {
        return validation_failure("musescore-validation-failed");
    }

    MuseScoreValidationResponse {
        success: true,
        executable_path: Some(external_executable.to_string_lossy().into_owned()),
        version: compact_version(&output.stdout, &output.stderr),
        error: None,
    }
}

#[tauri::command]
pub(crate) async fn save_musescore_executable_path(
    executable_path: Option<String>,
) -> MuseScoreValidationResponse {
    let trimmed = executable_path
        .as_deref()
        .map(str::trim)
        .filter(|path| !path.is_empty());

    let Some(path) = trimmed else {
        return match save_configured_musescore_path(None) {
            Ok(()) => MuseScoreValidationResponse {
                success: true,
                executable_path: None,
                version: None,
                error: None,
            },
            Err(error) => validation_failure(error),
        };
    };

    let validation = validate_musescore_executable(path.to_string()).await;
    if !validation.success {
        return validation;
    }

    let Some(canonical_path) = validation.executable_path.as_deref() else {
        return validation_failure("invalid-musescore-path");
    };
    if let Err(error) = save_configured_musescore_path(Some(canonical_path)) {
        return validation_failure(error);
    }

    validation
}

#[cfg(target_os = "macos")]
fn resolve_app_bundle_executable(app_bundle: &Path) -> Option<PathBuf> {
    let macos_dir = app_bundle.join("Contents/MacOS");
    if !macos_dir.is_dir() {
        return None;
    }

    const CANDIDATES: [&str; 5] = [
        "mscore",
        "MuseScore",
        "MuseScore4",
        "MuseScore 4",
        "MuseScore-4",
    ];
    for name in CANDIDATES {
        let candidate = macos_dir.join(name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }

    let mut entries = fs::read_dir(&macos_dir).ok()?.collect::<Vec<_>>();
    entries.sort_by_key(|entry| {
        entry
            .as_ref()
            .map(|value| value.file_name())
            .unwrap_or_default()
    });
    for entry in entries {
        if let Ok(entry) = entry {
            let candidate = entry.path();
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

#[cfg(target_os = "macos")]
fn pick_musescore_executable() -> Option<PathBuf> {
    let selected = FileDialog::new()
        .add_filter("MuseScore Application", &["app"])
        .pick_file()?;
    resolve_app_bundle_executable(&selected)
}

#[cfg(target_os = "windows")]
fn pick_musescore_executable() -> Option<PathBuf> {
    FileDialog::new()
        .add_filter("Executable", &["exe"])
        .pick_file()
}

#[cfg(all(unix, not(target_os = "macos")))]
fn pick_musescore_executable() -> Option<PathBuf> {
    FileDialog::new()
        .add_filter("Executable", &["AppImage"])
        .pick_file()
}

#[tauri::command]
pub(crate) async fn select_musescore_executable() -> Option<MuseScoreValidationResponse> {
    let selected = pick_musescore_executable()?;
    Some(validate_musescore_executable(selected.to_string_lossy().into_owned()).await)
}

#[tauri::command]
pub(crate) async fn convert_gp_to_mxl(
    source_path: String,
    overwrite: bool,
) -> MusicXmlExportResponse {
    let executable_path = match configured_musescore_path() {
        Ok(Some(path)) => path,
        Ok(None) => return export_failure(None, None, "musescore-not-configured"),
        Err(error) => return export_failure(None, None, error),
    };
    let executable = match validate_executable_file(&executable_path) {
        Ok(path) => path,
        Err(error) => return export_failure(None, None, error),
    };

    let normalized_source = match normalize_non_empty_path(&source_path) {
        Some(path) => path,
        None => return export_failure(None, None, "invalid-source-path"),
    };
    let (source, scope) = match authorize_existing_workspace_path(&normalized_source) {
        Ok(value) => value,
        Err(error) => return export_failure(None, None, error),
    };
    if !source.is_file() {
        return export_failure(None, None, "source-not-a-file");
    }
    if !is_supported_gp_path(&source) {
        return export_failure(None, None, "unsupported-source-format");
    }

    let output_candidate = output_path_for_source(&source);
    let output_path = match authorize_target_path_in_scope(&scope, &output_candidate) {
        Ok(path) => path,
        Err(error) => return export_failure(None, None, error),
    };
    if output_path.exists() && !overwrite {
        return export_failure(Some(&output_path), None, "target-exists");
    }

    let temporary_path = temporary_output_path(&output_path);
    let _ = fs::remove_file(&temporary_path);

    let external_executable = external_process_path(&executable);
    let external_source = external_process_path(&source);
    let external_temporary_path = external_process_path(&temporary_path);
    let mut command = Command::new(&external_executable);
    command
        .arg("-o")
        .arg(&external_temporary_path)
        .arg(&external_source)
        .kill_on_drop(true);

    let output = match timeout(CONVERSION_TIMEOUT, command.output()).await {
        Ok(Ok(output)) => output,
        Ok(Err(_)) => return export_failure(Some(&output_path), None, "musescore-launch-failed"),
        Err(_) => {
            let _ = fs::remove_file(&temporary_path);
            return export_failure(Some(&output_path), None, "musescore-conversion-timeout");
        }
    };

    let exit_code = output.status.code();
    if !output.status.success() {
        let _ = fs::remove_file(&temporary_path);
        return export_failure(Some(&output_path), exit_code, "musescore-conversion-failed");
    }
    if !wait_for_generated_file(&temporary_path, OUTPUT_APPEAR_TIMEOUT).await {
        return export_failure(Some(&output_path), exit_code, "mxl-not-generated");
    }
    if !looks_like_mxl(&temporary_path) {
        let _ = fs::remove_file(&temporary_path);
        return export_failure(Some(&output_path), exit_code, "invalid-mxl-output");
    }

    if let Err(error) = replace_output_file(&temporary_path, &output_path) {
        let _ = fs::remove_file(&temporary_path);
        return export_failure(Some(&output_path), exit_code, error);
    }

    MusicXmlExportResponse {
        success: true,
        output_path: Some(
            external_process_path(&output_path)
                .to_string_lossy()
                .into_owned(),
        ),
        exit_code,
        error: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[cfg(target_os = "macos")]
    use std::os::unix::fs::PermissionsExt;

    #[test]
    fn recognizes_supported_gp_extensions_case_insensitively() {
        assert!(is_supported_gp_path(Path::new("song.gp")));
        assert!(is_supported_gp_path(Path::new("song.GP5")));
        assert!(is_supported_gp_path(Path::new("song.gpx")));
        assert!(!is_supported_gp_path(Path::new("song.atex")));
        assert!(!is_supported_gp_path(Path::new("song.mxl")));
    }

    #[test]
    fn derives_same_directory_mxl_path() {
        let source = Path::new("C:/scores/Flower Dance.gp");
        assert_eq!(
            output_path_for_source(source),
            PathBuf::from("C:/scores/Flower Dance.mxl")
        );
    }

    #[test]
    fn creates_temporary_path_with_mxl_extension() {
        let output = Path::new("C:/scores/song.mxl");
        let temporary = temporary_output_path(output);
        assert_eq!(
            temporary.extension().and_then(|value| value.to_str()),
            Some("mxl")
        );
        assert_ne!(temporary, output);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn removes_windows_verbatim_prefix_for_external_processes() {
        assert_eq!(
            external_process_path(Path::new(r"\\?\F:\scores\song.gp")),
            PathBuf::from(r"F:\scores\song.gp")
        );
        assert_eq!(
            external_process_path(Path::new(r"\\?\UNC\server\share\song.gp")),
            PathBuf::from(r"\\server\share\song.gp")
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn resolves_executable_from_app_bundle() {
        let mut bundle = std::env::temp_dir();
        bundle.push(format!(
            "tabst-musescore-bundle-{}-{}",
            std::process::id(),
            crate::now_ms()
        ));
        let macos_dir = bundle.join("Contents/MacOS");
        std::fs::create_dir_all(&macos_dir).expect("create bundle MacOS dir");
        let executable = macos_dir.join("mscore");
        std::fs::write(&executable, "#!/bin/sh").expect("write fake executable");
        std::fs::set_permissions(&executable, std::fs::Permissions::from_mode(0o755))
            .expect("set executable permissions");

        let resolved = resolve_app_bundle_executable(&bundle).expect("resolve bundle");
        assert_eq!(resolved, executable);
        let _ = std::fs::remove_dir_all(&bundle);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn app_bundle_without_executables_is_not_resolvable() {
        let mut bundle = std::env::temp_dir();
        bundle.push(format!(
            "tabst-musescore-empty-{}-{}",
            std::process::id(),
            crate::now_ms()
        ));
        std::fs::create_dir_all(&bundle.join("Contents/Resources")).expect("create bundle dirs");

        assert!(resolve_app_bundle_executable(&bundle).is_none());
        let _ = std::fs::remove_dir_all(&bundle);
    }

    #[test]
    fn picks_the_first_existing_candidate() {
        let dir = crate::test_helpers::temp_dir_for("musescore", "candidates");
        let existing = dir.join("mscore");
        std::fs::write(&existing, "#!/bin/sh").expect("write candidate");
        let missing = dir.join("missing-mscore");

        let found =
            first_existing_candidate(&[missing.to_str().unwrap(), existing.to_str().unwrap()]);
        assert_eq!(found, Some(existing));

        assert!(first_existing_candidate(&[missing.to_str().unwrap()]).is_none());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
