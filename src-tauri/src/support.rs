use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use dirs::{document_dir, home_dir};
use serde::{de::DeserializeOwned, Serialize};
use tauri::Manager;

use crate::Repo;

pub(crate) const RELEASES_FEED_URL: &str =
    "https://github.com/LIUBINfighter/Tabst.app/releases.atom";

#[derive(Debug, Clone)]
pub(crate) enum WorkspacePathScope {
    Root(PathBuf),
    ExactFile(PathBuf),
}

#[derive(Debug, Default)]
struct AllowedPathRegistry {
    roots: Vec<PathBuf>,
    exact_files: Vec<PathBuf>,
}

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

fn allowed_path_registry() -> &'static Mutex<AllowedPathRegistry> {
    static REGISTRY: OnceLock<Mutex<AllowedPathRegistry>> = OnceLock::new();
    REGISTRY.get_or_init(|| Mutex::new(AllowedPathRegistry::default()))
}

fn push_unique_path(paths: &mut Vec<PathBuf>, candidate: PathBuf) {
    if paths.iter().any(|existing| existing == &candidate) {
        return;
    }
    paths.push(candidate);
}

fn implicit_default_workspace_root() -> Result<PathBuf, String> {
    let default_root = default_save_dir();
    fs::create_dir_all(&default_root).map_err(to_error)?;
    fs::canonicalize(default_root).map_err(to_error)
}

pub(crate) fn canonicalize_existing_path(path: &Path) -> Result<PathBuf, String> {
    fs::canonicalize(path).map_err(to_error)
}

pub(crate) fn canonicalize_target_path(path: &Path) -> Result<PathBuf, String> {
    let file_name = path
        .file_name()
        .ok_or_else(|| "invalid-path".to_string())?
        .to_os_string();
    let parent = path.parent().ok_or_else(|| "invalid-path".to_string())?;
    let canonical_parent = fs::canonicalize(parent).map_err(to_error)?;
    Ok(canonical_parent.join(file_name))
}

fn longest_matching_root<'a>(roots: &'a [PathBuf], path: &Path) -> Option<&'a PathBuf> {
    roots
        .iter()
        .filter(|root| path.starts_with(root))
        .max_by_key(|root| root.components().count())
}

fn scope_for_canonical_path(
    registry: &AllowedPathRegistry,
    canonical_path: &Path,
) -> Result<Option<WorkspacePathScope>, String> {
    let default_root = implicit_default_workspace_root()?;
    if canonical_path.starts_with(&default_root) {
        return Ok(Some(WorkspacePathScope::Root(default_root)));
    }

    if let Some(root) = longest_matching_root(&registry.roots, canonical_path) {
        return Ok(Some(WorkspacePathScope::Root(root.clone())));
    }

    if let Some(file) = registry
        .exact_files
        .iter()
        .find(|file| file.as_path() == canonical_path)
    {
        return Ok(Some(WorkspacePathScope::ExactFile(file.clone())));
    }

    Ok(None)
}

fn scope_allows_existing_path(scope: &WorkspacePathScope, canonical_path: &Path) -> bool {
    match scope {
        WorkspacePathScope::Root(root) => canonical_path.starts_with(root),
        WorkspacePathScope::ExactFile(file_path) => {
            canonical_path == file_path
                || file_path
                    .parent()
                    .map(|parent| canonical_path == parent)
                    .unwrap_or(false)
        }
    }
}

pub(crate) fn scope_allows_target_path(scope: &WorkspacePathScope, canonical_path: &Path) -> bool {
    match scope {
        WorkspacePathScope::Root(root) => canonical_path.starts_with(root),
        WorkspacePathScope::ExactFile(file_path) => file_path
            .parent()
            .map(|parent| canonical_path.parent() == Some(parent))
            .unwrap_or(false),
    }
}

pub(crate) fn register_allowed_root(path: &Path) -> Result<PathBuf, String> {
    let canonical_path = canonicalize_existing_path(path)?;
    if !canonical_path.is_dir() {
        return Err("invalid-repo-path".to_string());
    }

    let mut guard = allowed_path_registry()
        .lock()
        .map_err(|_| "path-access-lock-failed".to_string())?;
    push_unique_path(&mut guard.roots, canonical_path.clone());
    Ok(canonical_path)
}

pub(crate) fn register_allowed_file(path: &Path) -> Result<PathBuf, String> {
    let canonical_path = canonicalize_existing_path(path)?;
    if !canonical_path.is_file() {
        return Err("invalid-file-path".to_string());
    }

    let mut guard = allowed_path_registry()
        .lock()
        .map_err(|_| "path-access-lock-failed".to_string())?;
    push_unique_path(&mut guard.exact_files, canonical_path.clone());
    Ok(canonical_path)
}

pub(crate) fn replace_registered_exact_file(
    old_path: &Path,
    new_path: &Path,
) -> Result<(), String> {
    let old_canonical = canonicalize_existing_path(old_path)?;
    let new_canonical = canonicalize_existing_path(new_path)?;

    let mut guard = allowed_path_registry()
        .lock()
        .map_err(|_| "path-access-lock-failed".to_string())?;
    if let Some(index) = guard
        .exact_files
        .iter()
        .position(|existing| existing == &old_canonical)
    {
        guard.exact_files[index] = new_canonical;
    }
    Ok(())
}

pub(crate) fn unregister_allowed_path(path: &Path) -> Result<(), String> {
    let canonical_path = match canonicalize_existing_path(path) {
        Ok(value) => value,
        Err(_) => return Ok(()),
    };

    let mut guard = allowed_path_registry()
        .lock()
        .map_err(|_| "path-access-lock-failed".to_string())?;
    guard
        .exact_files
        .retain(|existing| existing != &canonical_path);
    guard.roots.retain(|existing| existing != &canonical_path);
    Ok(())
}

pub(crate) fn authorize_existing_workspace_path(
    path: &Path,
) -> Result<(PathBuf, WorkspacePathScope), String> {
    let canonical_path = canonicalize_existing_path(path)?;
    let guard = allowed_path_registry()
        .lock()
        .map_err(|_| "path-access-lock-failed".to_string())?;
    let scope = scope_for_canonical_path(&guard, &canonical_path)?
        .ok_or_else(|| "path-outside-workspace".to_string())?;

    if !scope_allows_existing_path(&scope, &canonical_path) {
        return Err("path-outside-workspace".to_string());
    }

    Ok((canonical_path, scope))
}

pub(crate) fn authorize_existing_path_in_scope(
    scope: &WorkspacePathScope,
    path: &Path,
) -> Result<PathBuf, String> {
    let canonical_path = canonicalize_existing_path(path)?;
    if scope_allows_existing_path(scope, &canonical_path) {
        return Ok(canonical_path);
    }
    Err("path-outside-workspace".to_string())
}

pub(crate) fn authorize_target_path_in_scope(
    scope: &WorkspacePathScope,
    path: &Path,
) -> Result<PathBuf, String> {
    let canonical_path = canonicalize_target_path(path)?;
    if scope_allows_target_path(scope, &canonical_path) {
        return Ok(canonical_path);
    }
    Err("path-outside-workspace".to_string())
}

pub(crate) fn authorize_workspace_root(path: &Path) -> Result<PathBuf, String> {
    let canonical_path = canonicalize_existing_path(path)?;
    if !canonical_path.is_dir() {
        return Err("invalid-repo-path".to_string());
    }

    let default_root = implicit_default_workspace_root()?;
    if canonical_path.starts_with(&default_root) {
        return Ok(canonical_path);
    }

    let guard = allowed_path_registry()
        .lock()
        .map_err(|_| "path-access-lock-failed".to_string())?;
    if guard.roots.iter().any(|root| root == &canonical_path) {
        return Ok(canonical_path);
    }

    Err("path-outside-workspace".to_string())
}

pub(crate) fn path_is_within_root(root: &Path, path: &Path) -> bool {
    path.starts_with(root)
}

pub(crate) fn validate_child_name(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("invalid-name".to_string());
    }

    let path = Path::new(trimmed);
    if path.is_absolute() {
        return Err("invalid-name".to_string());
    }

    let mut components = path.components();
    match (components.next(), components.next()) {
        (Some(Component::Normal(_)), None) => Ok(trimmed.to_string()),
        _ => Err("invalid-name".to_string()),
    }
}

pub(crate) fn validate_repo_relative_path(path: &str) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("invalid-file-path".to_string());
    }

    let candidate = Path::new(trimmed);
    if candidate.is_absolute() {
        return Err("invalid-file-path".to_string());
    }

    let mut normalized = PathBuf::new();
    for component in candidate.components() {
        match component {
            Component::CurDir => continue,
            Component::Normal(part) => normalized.push(part),
            Component::ParentDir | Component::RootDir | Component::Prefix(_) => {
                return Err("invalid-file-path".to_string());
            }
        }
    }

    let value = normalized.to_string_lossy().replace('\\', "/");
    if value.is_empty() {
        return Err("invalid-file-path".to_string());
    }

    Ok(value)
}

pub(crate) fn sanitize_repos_for_persistence(repos: Vec<Repo>) -> Vec<Repo> {
    repos
        .into_iter()
        .filter_map(|repo| {
            let path = normalize_non_empty_path(&repo.path)?;
            let canonical_path = authorize_workspace_root(&path).ok()?;
            Some(Repo {
                path: canonical_path.to_string_lossy().to_string(),
                ..repo
            })
        })
        .collect()
}

pub(crate) fn register_persisted_repos(repos: &[Repo]) {
    for repo in repos {
        if let Some(path) = normalize_non_empty_path(&repo.path) {
            let _ = register_allowed_root(&path);
        }
    }
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
