use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::UNIX_EPOCH;

use notify::event::{EventKind, ModifyKind};
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tauri::Emitter;

use crate::{
    global_metadata_dir, normalize_non_empty_path, now_ms, read_json_file, rename_path, to_error,
    write_json_file, BasicResult, BasicSuccess, FileNode, Repo, RepoFsChangedEvent, RepoMetadata,
    RepoWatchManager, RepoWatcherState, ScanDirectoryResult,
};

const SUPPORTED_EXTENSIONS: [&str; 7] = [".md", ".atex", ".gp", ".gp3", ".gp4", ".gp5", ".gpx"];

pub(crate) fn map_notify_event_type(kind: &EventKind) -> &'static str {
    match kind {
        EventKind::Create(_) => "rename",
        EventKind::Remove(_) => "rename",
        EventKind::Modify(ModifyKind::Name(_)) => "rename",
        EventKind::Modify(_) => "change",
        EventKind::Access(_) => "change",
        EventKind::Any => "change",
        EventKind::Other => "change",
    }
}

pub(crate) fn create_repo_watcher<F>(
    repo_path: PathBuf,
    on_event: F,
) -> Result<RecommendedWatcher, String>
where
    F: Fn(RepoFsChangedEvent) + Send + Sync + 'static,
{
    let repo_path_string = repo_path.to_string_lossy().to_string();
    let callback: Arc<dyn Fn(RepoFsChangedEvent) + Send + Sync> = Arc::new(on_event);
    let callback_for_watcher = Arc::clone(&callback);
    let repo_path_for_watcher = repo_path_string.clone();

    let mut watcher =
        notify::recommended_watcher(move |result: notify::Result<notify::Event>| match result {
            Ok(event) => {
                let changed_path = event
                    .paths
                    .first()
                    .map(|value| value.to_string_lossy().to_string());

                callback_for_watcher(RepoFsChangedEvent {
                    repo_path: repo_path_for_watcher.clone(),
                    event_type: map_notify_event_type(&event.kind).to_string(),
                    changed_path,
                });
            }
            Err(_) => {
                callback_for_watcher(RepoFsChangedEvent {
                    repo_path: repo_path_for_watcher.clone(),
                    event_type: "error".to_string(),
                    changed_path: None,
                });
            }
        })
        .map_err(to_error)?;

    watcher
        .watch(&repo_path, RecursiveMode::Recursive)
        .map_err(to_error)?;

    Ok(watcher)
}

fn mtime_to_ms(path: &Path) -> Option<u64> {
    let metadata = fs::metadata(path).ok()?;
    let modified = metadata.modified().ok()?;
    modified
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|value| value.as_millis() as u64)
}

fn has_supported_extension(path: &Path) -> bool {
    let file_name = match path.file_name().and_then(|value| value.to_str()) {
        Some(value) => value,
        None => return false,
    };
    let lower = file_name.to_lowercase();
    SUPPORTED_EXTENSIONS.iter().any(|ext| lower.ends_with(ext))
}

fn sort_file_nodes(nodes: &mut [FileNode]) {
    nodes.sort_by(|left, right| {
        let left_time = left.mtime_ms.unwrap_or(0);
        let right_time = right.mtime_ms.unwrap_or(0);
        right_time
            .cmp(&left_time)
            .then_with(|| left.name.to_lowercase().cmp(&right.name.to_lowercase()))
    });
}

fn scan_directory_recursive(dir_path: &Path) -> Result<Vec<FileNode>, String> {
    let entries = fs::read_dir(dir_path).map_err(to_error)?;
    let mut nodes: Vec<FileNode> = Vec::new();

    for entry in entries {
        let entry = entry.map_err(to_error)?;
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }

        let path = entry.path();
        let path_string = path.to_string_lossy().to_string();
        let mtime_ms = mtime_to_ms(&path);

        if path.is_dir() {
            let mut children = scan_directory_recursive(&path)?;
            if children.is_empty() {
                continue;
            }
            sort_file_nodes(&mut children);
            nodes.push(FileNode {
                id: path_string.clone(),
                name,
                path: path_string,
                node_type: "folder".to_string(),
                mtime_ms,
                content: None,
                children: Some(children),
                is_expanded: Some(false),
            });
            continue;
        }

        if !path.is_file() || !has_supported_extension(&path) {
            continue;
        }

        nodes.push(FileNode {
            id: path_string.clone(),
            name,
            path: path_string,
            node_type: "file".to_string(),
            mtime_ms,
            content: None,
            children: None,
            is_expanded: None,
        });
    }

    sort_file_nodes(&mut nodes);
    Ok(nodes)
}

#[tauri::command]
pub(crate) fn scan_directory(dir_path: String) -> Option<ScanDirectoryResult> {
    let normalized_path = normalize_non_empty_path(&dir_path)?;
    let nodes = scan_directory_recursive(&normalized_path).ok()?;

    Some(ScanDirectoryResult {
        nodes,
        expanded_folders: Vec::new(),
    })
}

#[tauri::command]
pub(crate) fn load_repos() -> Vec<Repo> {
    let metadata_dir = match global_metadata_dir() {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };
    let repos_path = metadata_dir.join("repos.json");

    read_json_file::<Vec<Repo>>(&repos_path)
        .ok()
        .flatten()
        .unwrap_or_default()
}

#[tauri::command]
pub(crate) fn save_repos(repos: Vec<Repo>) {
    if let Ok(metadata_dir) = global_metadata_dir() {
        let repos_path = metadata_dir.join("repos.json");
        let _ = write_json_file(&repos_path, &repos);
    }
}

#[tauri::command]
pub(crate) fn load_workspace_metadata(repo_path: String) -> Option<RepoMetadata> {
    let normalized_path = normalize_non_empty_path(&repo_path)?;
    let metadata_path = normalized_path.join(".tabst").join("workspace.json");

    read_json_file::<RepoMetadata>(&metadata_path)
        .ok()
        .flatten()
}

#[tauri::command]
pub(crate) fn save_workspace_metadata(repo_path: String, metadata: RepoMetadata) {
    if let Some(normalized_path) = normalize_non_empty_path(&repo_path) {
        let workspace_dir = normalized_path.join(".tabst");
        let metadata_path = workspace_dir.join("workspace.json");
        let _ = write_json_file(&metadata_path, &metadata);
    }
}

#[tauri::command]
pub(crate) fn delete_file(
    file_path: String,
    behavior: String,
    repo_path: Option<String>,
) -> BasicResult {
    let normalized_file_path = match normalize_non_empty_path(&file_path) {
        Some(value) => value,
        None => {
            return BasicResult {
                success: false,
                error: Some("invalid-file-path".to_string()),
            };
        }
    };

    if behavior == "system-trash" {
        return match trash::delete(&normalized_file_path) {
            Ok(()) => BasicResult {
                success: true,
                error: None,
            },
            Err(error) => BasicResult {
                success: false,
                error: Some(to_error(error)),
            },
        };
    }

    if behavior == "repo-trash" {
        let normalized_repo_path =
            match repo_path.and_then(|value| normalize_non_empty_path(&value)) {
                Some(value) => value,
                None => {
                    return BasicResult {
                        success: false,
                        error: Some("missing-repo-path".to_string()),
                    };
                }
            };

        let metadata_dir = match global_metadata_dir() {
            Ok(value) => value,
            Err(error) => {
                return BasicResult {
                    success: false,
                    error: Some(error),
                };
            }
        };

        let repo_name = normalized_repo_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("repo")
            .to_string();

        let trash_dir = metadata_dir.join(".trash").join(repo_name);
        if let Err(error) = fs::create_dir_all(&trash_dir) {
            return BasicResult {
                success: false,
                error: Some(to_error(error)),
            };
        }

        let file_name = normalized_file_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("deleted")
            .to_string();
        let target_path = trash_dir.join(format!("{}_{}", now_ms(), file_name));

        return match rename_path(&normalized_file_path, &target_path) {
            Ok(()) => BasicResult {
                success: true,
                error: None,
            },
            Err(error) => BasicResult {
                success: false,
                error: Some(error),
            },
        };
    }

    BasicResult {
        success: false,
        error: Some("Invalid delete behavior or missing repo path".to_string()),
    }
}

#[tauri::command]
pub(crate) fn start_repo_watch(
    app: tauri::AppHandle,
    watch_manager: tauri::State<'_, RepoWatchManager>,
    repo_path: String,
) -> BasicResult {
    let normalized_repo_path = match normalize_non_empty_path(&repo_path) {
        Some(value) => value,
        None => {
            return BasicResult {
                success: false,
                error: Some("invalid-repo-path".to_string()),
            };
        }
    };

    if !normalized_repo_path.exists() {
        return BasicResult {
            success: false,
            error: Some("repo-path-not-found".to_string()),
        };
    }

    let normalized_repo_path_string = normalized_repo_path.to_string_lossy().to_string();

    {
        let mut guard = match watch_manager.active.lock() {
            Ok(value) => value,
            Err(_) => {
                return BasicResult {
                    success: false,
                    error: Some("repo-watch-lock-failed".to_string()),
                };
            }
        };

        if let Some(active_watch) = guard.as_ref() {
            if active_watch.repo_path == normalized_repo_path_string {
                return BasicResult {
                    success: true,
                    error: None,
                };
            }
        }

        *guard = None;
    }

    let app_handle = app.clone();
    let watcher = match create_repo_watcher(normalized_repo_path.clone(), move |event| {
        let _ = app_handle.emit("repo-fs-changed", event);
    }) {
        Ok(value) => value,
        Err(error) => {
            return BasicResult {
                success: false,
                error: Some(error),
            };
        }
    };

    let mut guard = match watch_manager.active.lock() {
        Ok(value) => value,
        Err(_) => {
            return BasicResult {
                success: false,
                error: Some("repo-watch-lock-failed".to_string()),
            };
        }
    };

    *guard = Some(RepoWatcherState {
        repo_path: normalized_repo_path_string,
        _watcher: watcher,
    });

    BasicResult {
        success: true,
        error: None,
    }
}

#[tauri::command]
pub(crate) fn stop_repo_watch(watch_manager: tauri::State<'_, RepoWatchManager>) -> BasicSuccess {
    if let Ok(mut guard) = watch_manager.active.lock() {
        *guard = None;
    }

    BasicSuccess { success: true }
}
