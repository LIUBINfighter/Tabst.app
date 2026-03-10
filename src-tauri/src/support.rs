use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use dirs::{document_dir, home_dir};
use serde::{de::DeserializeOwned, Serialize};
use tauri::Manager;

pub(crate) const RELEASES_FEED_URL: &str =
    "https://github.com/LIUBINfighter/Tabst.app/releases.atom";

pub(crate) fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis() as u64)
        .unwrap_or(0)
}

pub(crate) fn to_error(error: impl ToString) -> String {
    error.to_string()
}

pub(crate) fn asset_virtual_path_candidates(rel_path: &str) -> Vec<String> {
    let normalized = rel_path.trim_start_matches('/').to_string();
    let mut candidates = vec![normalized.clone()];

    match normalized.as_str() {
        "docs/README.md" => candidates.push("README.md".to_string()),
        "docs/ROADMAP.md" => candidates.push("ROADMAP.md".to_string()),
        _ => {}
    }

    candidates
}

pub(crate) fn is_update_supported_runtime(platform: &str, is_debug_build: bool) -> bool {
    !is_debug_build && matches!(platform, "windows" | "macos" | "linux")
}

pub(crate) fn update_check_unsupported_message() -> String {
    "仅支持正式打包版本的更新检查（开发调试构建不可用）".to_string()
}

pub(crate) fn update_install_unsupported_message() -> String {
    "仅支持正式打包版本安装更新（开发调试构建不可用）".to_string()
}

pub(crate) fn normalize_non_empty_path(path: &str) -> Option<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(PathBuf::from(trimmed))
}

pub(crate) fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|ch| match ch {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            other => other,
        })
        .collect()
}

pub(crate) fn default_save_dir() -> PathBuf {
    let base = document_dir()
        .or_else(home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("tabst")
}

pub(crate) fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(to_error)?;
    }
    Ok(())
}

pub(crate) fn write_json_file<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    ensure_parent(path)?;
    let data = serde_json::to_string_pretty(value).map_err(to_error)?;

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

    fs::write(&temp_path, data).map_err(to_error)?;

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

pub(crate) fn read_json_file<T: DeserializeOwned>(path: &Path) -> Result<Option<T>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let data = fs::read_to_string(path).map_err(to_error)?;
    if data.trim().is_empty() {
        return Ok(None);
    }

    let parsed = serde_json::from_str::<T>(&data).map_err(to_error)?;
    Ok(Some(parsed))
}

pub(crate) fn global_metadata_dir() -> Result<PathBuf, String> {
    let base = home_dir().unwrap_or_else(|| PathBuf::from("."));
    let metadata_dir = base.join(".tabst");
    fs::create_dir_all(&metadata_dir).map_err(to_error)?;
    Ok(metadata_dir)
}

pub(crate) fn app_state_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(to_error)?;
    fs::create_dir_all(&app_data).map_err(to_error)?;
    Ok(app_data.join("app-state.json"))
}

pub(crate) fn rename_path(source_path: &Path, target_path: &Path) -> Result<(), String> {
    match fs::rename(source_path, target_path) {
        Ok(()) => Ok(()),
        Err(error) => {
            if source_path.is_file() {
                fs::copy(source_path, target_path).map_err(to_error)?;
                fs::remove_file(source_path).map_err(to_error)?;
                return Ok(());
            }
            Err(to_error(error))
        }
    }
}
