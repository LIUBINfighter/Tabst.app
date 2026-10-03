use std::collections::HashMap;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use dirs::{document_dir, home_dir};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::{Map, Value};
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
    let mut guard = allowed_path_registry()
        .lock()
        .map_err(|_| "path-access-lock-failed".to_string())?;
    if let Some(index) = guard
        .exact_files
        .iter()
        .position(|existing| existing.as_path() == old_path)
    {
        guard.exact_files[index] = new_path.to_path_buf();
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
    let scope = {
        let guard = allowed_path_registry()
            .lock()
            .map_err(|_| "path-access-lock-failed".to_string())?;
        scope_for_canonical_path(&guard, &canonical_path)?
    };

    let scope = match scope {
        Some(value) => value,
        None => {
            if !register_persisted_repo_scope_for_path(&canonical_path)? {
                return Err("path-outside-workspace".to_string());
            }

            let guard = allowed_path_registry()
                .lock()
                .map_err(|_| "path-access-lock-failed".to_string())?;
            scope_for_canonical_path(&guard, &canonical_path)?
                .ok_or_else(|| "path-outside-workspace".to_string())?
        }
    };

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
    drop(guard);

    if register_persisted_repo_scope_for_path(&canonical_path)? {
        let guard = allowed_path_registry()
            .lock()
            .map_err(|_| "path-access-lock-failed".to_string())?;
        if guard.roots.iter().any(|root| root == &canonical_path) {
            return Ok(canonical_path);
        }
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

pub(crate) fn normalize_loaded_repos(repos: Vec<Repo>) -> Vec<Repo> {
    repos
        .into_iter()
        .map(|repo| {
            let canonical_path = normalize_non_empty_path(&repo.path)
                .and_then(|path| canonicalize_existing_path(&path).ok())
                .filter(|path| path.is_dir());

            match canonical_path {
                Some(path) => Repo {
                    path: path.to_string_lossy().to_string(),
                    ..repo
                },
                None => repo,
            }
        })
        .collect()
}

pub(crate) fn prepare_repos_for_persistence(
    existing_repos: &[Repo],
    incoming_repos: Vec<Repo>,
) -> Vec<Repo> {
    let existing_by_id = existing_repos
        .iter()
        .cloned()
        .map(|repo| (repo.id.clone(), repo))
        .collect::<HashMap<_, _>>();

    incoming_repos
        .into_iter()
        .filter_map(|repo| {
            let authorized_path = normalize_non_empty_path(&repo.path)
                .and_then(|path| authorize_workspace_root(&path).ok());

            if let Some(path) = authorized_path {
                return Some(Repo {
                    path: path.to_string_lossy().to_string(),
                    ..repo
                });
            }

            existing_by_id.get(&repo.id).map(|existing| Repo {
                path: existing.path.clone(),
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

fn register_persisted_repo_scope_for_path(canonical_path: &Path) -> Result<bool, String> {
    let metadata_dir = match global_metadata_dir() {
        Ok(value) => value,
        Err(_) => return Ok(false),
    };
    let repos_path = metadata_dir.join("repos.json");
    let repos = read_json_file::<Vec<Repo>>(&repos_path)
        .ok()
        .flatten()
        .unwrap_or_default();

    for repo in repos {
        let Some(path) = normalize_non_empty_path(&repo.path) else {
            continue;
        };
        let Ok(canonical_repo_path) = canonicalize_existing_path(&path) else {
            continue;
        };
        if !canonical_repo_path.is_dir() {
            continue;
        }
        if canonical_path == canonical_repo_path || canonical_path.starts_with(&canonical_repo_path)
        {
            register_allowed_root(&canonical_repo_path)?;
            return Ok(true);
        }
    }

    Ok(false)
}

pub(crate) fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|ch| match ch {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            other => other,
        })
        .collect()
}

// Thread-local stand-in for `$HOME`, installed by `test_helpers::with_temp_home`.
//
// Tests cannot replace `HOME` privately: the harness runs tests concurrently, and
// `with_temp_home` has to write the process-global variable because Tauri resolves
// its own app-data directory straight from it. Without this override a test that
// resolved a home directory while another test's temporary `HOME` was installed
// would build paths inside that temporary directory and then race the cleanup that
// deletes it -- surfacing as a bogus `No such file or directory (os error 2)` from
// whichever unrelated assertion happened to run next. Resolving through this
// override keeps each test's artificial home private to the thread that set it.
#[cfg(test)]
std::thread_local! {
    static TEST_HOME_OVERRIDE: std::cell::RefCell<Option<PathBuf>> =
        const { std::cell::RefCell::new(None) };
}

/// The home directory installed by `with_test_home` on this thread, if any.
#[cfg(test)]
fn test_home_override() -> Option<PathBuf> {
    TEST_HOME_OVERRIDE.with(|slot| slot.borrow().clone())
}

/// The real home directory of the test process, captured before any test installs a
/// temporary one.
///
/// `with_temp_home` writes the process-global `HOME` variable, so a test that does
/// not install an override must not read that variable itself. Capturing it lazily is
/// safe because a test only replaces `HOME` after calling this function, and the
/// first caller wins the `OnceLock` before any replacement can have happened.
#[cfg(test)]
fn pristine_home() -> Option<PathBuf> {
    static CAPTURED: OnceLock<Option<PathBuf>> = OnceLock::new();

    CAPTURED
        .get_or_init(|| std::env::var_os("HOME").map(PathBuf::from))
        .clone()
}

/// The home directory paths should resolve against, fake homes included.
///
/// In production this is a no-op so that `home_dir()` and `document_dir()` stay the
/// single source of truth.
#[cfg(test)]
fn test_resolved_home() -> Option<PathBuf> {
    test_home_override().or_else(pristine_home)
}

#[cfg(not(test))]
fn test_resolved_home() -> Option<PathBuf> {
    None
}

/// Run `run` with `home` installed as the home directory of the current thread.
#[cfg(test)]
pub(crate) fn with_test_home<T>(home: &Path, run: impl FnOnce() -> T) -> T {
    struct ClearOverride;

    impl Drop for ClearOverride {
        fn drop(&mut self) {
            TEST_HOME_OVERRIDE.with(|slot| *slot.borrow_mut() = None);
        }
    }

    TEST_HOME_OVERRIDE.with(|slot| *slot.borrow_mut() = Some(home.to_path_buf()));
    let _clear_override = ClearOverride;
    run()
}

pub(crate) fn default_save_dir() -> PathBuf {
    home_base_dir().join("tabst")
}

/// The directory holding the user's home directory.
fn home_base_dir() -> PathBuf {
    if let Some(home) = test_resolved_home() {
        // `document_dir()` resolves to `<home>/Documents`; mirror that against the
        // resolved home so a test keeps the same layout without reading the
        // process-global variable another test may currently own.
        return home.join("Documents");
    }

    document_dir()
        .or_else(home_dir)
        .unwrap_or_else(|| PathBuf::from("."))
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

fn resolved_home_dir() -> Option<PathBuf> {
    if let Some(home) = test_resolved_home() {
        return Some(home);
    }

    home_dir()
}

pub(crate) fn global_metadata_dir() -> Result<PathBuf, String> {
    let base = resolved_home_dir().unwrap_or_else(|| PathBuf::from("."));
    let metadata_dir = base.join(".tabst");
    fs::create_dir_all(&metadata_dir).map_err(to_error)?;
    Ok(metadata_dir)
}

pub(crate) fn settings_json_path() -> Result<PathBuf, String> {
    Ok(global_metadata_dir()?.join("settings.json"))
}

pub(crate) fn load_settings_json() -> Result<Map<String, Value>, String> {
    match read_json_file::<Value>(&settings_json_path()?)? {
        Some(Value::Object(object)) => Ok(object),
        Some(_) | None => Ok(Map::new()),
    }
}

pub(crate) fn save_settings_json(settings: &Map<String, Value>) -> Result<(), String> {
    write_json_file(&settings_json_path()?, &Value::Object(settings.clone()))
}

#[cfg(test)]
pub(crate) mod test_helpers {
    use std::env;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};
    use std::time::{SystemTime, UNIX_EPOCH};

    pub(crate) fn now_ms() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|value| value.as_millis() as u64)
            .unwrap_or(0)
    }

    pub(crate) fn temp_dir_for(prefix: &str, test_name: &str) -> PathBuf {
        let mut dir = env::temp_dir();
        dir.push(format!(
            "tabst-tauri-{}-{}-{}-{}",
            prefix,
            test_name,
            std::process::id(),
            now_ms()
        ));
        fs::create_dir_all(&dir).expect("failed to create temp test directory");
        // Resolve symlinks and macOS firmlinks (e.g. /var -> /private/var)
        // once, up front. Later fs::canonicalize calls on freshly created files
        // inside this directory then run against the already-resolved path,
        // avoiding intermittent ENOENT from realpath racing the firmlink
        // boundary during path-authorization checks.
        fs::canonicalize(&dir).unwrap_or(dir)
    }

    pub(crate) fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    /// Serialize access to the process-global `HOME` variable.
    ///
    /// Poisoning is deliberately ignored: a test that panicked while holding the
    /// lock must not turn every later test into a secondary failure.
    pub(crate) fn lock_home_env() -> std::sync::MutexGuard<'static, ()> {
        env_lock()
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub(crate) fn with_temp_home<T>(
        prefix: &str,
        test_name: &str,
        run: impl FnOnce(PathBuf) -> T,
    ) -> T {
        // Held until the temporary home has been removed, so two tests can never
        // interleave their replacement of `HOME`.
        let _guard = lock_home_env();
        let home_dir = temp_dir_for(prefix, test_name);

        // Capture the real home before replacing it, so tests that do not install an
        // override never observe the temporary value. See `TEST_HOME_OVERRIDE`.
        let _ = super::pristine_home();
        let previous_home = env::var_os("HOME");

        unsafe {
            env::set_var("HOME", &home_dir);
        }

        let result = super::with_test_home(&home_dir, || run(home_dir.clone()));

        if let Some(value) = previous_home {
            unsafe {
                env::set_var("HOME", value);
            }
        } else {
            unsafe {
                env::remove_var("HOME");
            }
        }

        let _ = fs::remove_dir_all(&home_dir);
        result
    }
}

pub(crate) fn app_state_path<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(to_error)?;
    fs::create_dir_all(&app_data).map_err(to_error)?;
    Ok(app_data.join("app-state.json"))
}

fn copy_dir_recursive(source_path: &Path, target_path: &Path) -> Result<(), String> {
    fs::create_dir_all(target_path).map_err(to_error)?;

    for entry in fs::read_dir(source_path).map_err(to_error)? {
        let entry = entry.map_err(to_error)?;
        let source_child = entry.path();
        let target_child = target_path.join(entry.file_name());

        if source_child.is_dir() {
            copy_dir_recursive(&source_child, &target_child)?;
        } else {
            fs::copy(&source_child, &target_child).map_err(to_error)?;
        }
    }

    Ok(())
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
            if source_path.is_dir() {
                if target_path.exists() {
                    return Err("target-exists".to_string());
                }
                copy_dir_recursive(source_path, target_path)?;
                fs::remove_dir_all(source_path).map_err(to_error)?;
                return Ok(());
            }
            Err(to_error(error))
        }
    }
}

#[cfg(test)]
mod home_resolution_tests {
    use std::env;
    use std::ffi::OsString;

    use super::{
        default_save_dir, global_metadata_dir, pristine_home, test_helpers::lock_home_env,
        test_resolved_home,
    };

    /// Restores `HOME` even when the test panics inside the replaced window.
    struct RestoreHome(Option<OsString>);

    impl Drop for RestoreHome {
        fn drop(&mut self) {
            unsafe {
                match &self.0 {
                    Some(value) => env::set_var("HOME", value),
                    None => env::remove_var("HOME"),
                }
            }
        }
    }

    /// A test that does not install a home override must keep resolving the real home
    /// even while another test has `HOME` pointed at a temporary directory.
    ///
    /// Regression test for the intermittent `No such file or directory (os error 2)`
    /// reported by `delete_file_repo_trash_rejects_paths_outside_the_repo_root`:
    /// resolving the default workspace root under a temporary home made the test race
    /// the cleanup that deletes that home.
    #[test]
    fn a_replaced_home_does_not_leak_into_path_resolution() {
        let _guard = lock_home_env();
        let real_home = pristine_home().expect("test process should have a home directory");
        let previous_home = env::var_os("HOME");
        let foreign_home = env::temp_dir().join("tabst-tauri-test-foreign-home");

        unsafe {
            env::set_var("HOME", &foreign_home);
        }
        let _restore = RestoreHome(previous_home);

        assert_eq!(
            test_resolved_home(),
            Some(real_home),
            "path resolution must ignore the temporary HOME another test installed"
        );
        assert!(
            !default_save_dir().starts_with(&foreign_home),
            "default save dir must not be rooted in another test's temporary home"
        );
        assert!(
            !global_metadata_dir()
                .expect("global metadata dir")
                .starts_with(&foreign_home),
            "global metadata dir must not be rooted in another test's temporary home"
        );
    }
}
