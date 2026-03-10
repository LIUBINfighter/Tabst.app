use std::fs;
use std::path::PathBuf;
use std::process::Command;

use rfd::FileDialog;
use tauri::Manager;

use crate::{
    app_state_path, asset_virtual_path_candidates, default_save_dir, normalize_non_empty_path,
    now_ms, rename_path, sanitize_name, to_error, AppState, AppStateWithContent,
    AppStateWithContentFile, BasicResult, FileResult, FolderResult, OperationResult,
    ReadFileBytesResponse, ReadFileResponse, SaveResult,
};

#[tauri::command]
pub(crate) fn open_file(extensions: Vec<String>) -> Option<FileResult> {
    let mut dialog = FileDialog::new();

    let normalized_extensions = extensions
        .iter()
        .map(|ext| ext.trim().trim_start_matches('.').to_string())
        .filter(|ext| !ext.is_empty())
        .collect::<Vec<_>>();

    if !normalized_extensions.is_empty() {
        let values = normalized_extensions
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>();
        dialog = dialog.add_filter("Supported", &values);
    }

    let selected = dialog.pick_file()?;
    let content = fs::read_to_string(&selected).ok()?;
    let name = selected.file_name()?.to_string_lossy().to_string();

    Some(FileResult {
        path: selected.to_string_lossy().to_string(),
        name,
        content,
    })
}

#[tauri::command]
pub(crate) fn select_folder() -> Option<String> {
    FileDialog::new()
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub(crate) fn create_file(
    ext: Option<String>,
    preferred_dir: Option<String>,
) -> Option<FileResult> {
    let save_dir = preferred_dir
        .and_then(|value| normalize_non_empty_path(&value))
        .unwrap_or_else(default_save_dir);

    if fs::create_dir_all(&save_dir).is_err() {
        return None;
    }

    let normalized_ext = match ext {
        Some(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                ".md".to_string()
            } else if trimmed.starts_with('.') {
                trimmed.to_string()
            } else {
                format!(".{}", trimmed)
            }
        }
        None => ".md".to_string(),
    };

    let file_name = format!("untitled_{}{}", now_ms(), normalized_ext);
    let file_path = save_dir.join(&file_name);
    if fs::write(&file_path, "").is_err() {
        return None;
    }

    Some(FileResult {
        path: file_path.to_string_lossy().to_string(),
        name: file_name,
        content: String::new(),
    })
}

#[tauri::command]
pub(crate) fn create_folder(
    folder_name: Option<String>,
    preferred_dir: Option<String>,
) -> Option<FolderResult> {
    let target_dir = preferred_dir
        .and_then(|value| normalize_non_empty_path(&value))
        .unwrap_or_else(default_save_dir);

    if fs::create_dir_all(&target_dir).is_err() {
        return None;
    }

    let raw_name = folder_name
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("untitled_folder_{}", now_ms()));

    let safe_base = sanitize_name(&raw_name);
    let mut suffix = 0_u64;

    loop {
        let final_name = if suffix == 0 {
            safe_base.clone()
        } else {
            format!("{}_{}", safe_base, suffix)
        };

        let folder_path = target_dir.join(&final_name);
        if folder_path.exists() {
            suffix += 1;
            continue;
        }

        if fs::create_dir_all(&folder_path).is_err() {
            return None;
        }

        return Some(FolderResult {
            path: folder_path.to_string_lossy().to_string(),
            name: final_name,
        });
    }
}

#[tauri::command]
pub(crate) fn save_file(file_path: String, content: String) -> SaveResult {
    let normalized_path = match normalize_non_empty_path(&file_path) {
        Some(value) => value,
        None => {
            return SaveResult {
                success: false,
                error: Some("invalid-file-path".to_string()),
            };
        }
    };

    match fs::write(normalized_path, content) {
        Ok(()) => SaveResult {
            success: true,
            error: None,
        },
        Err(error) => SaveResult {
            success: false,
            error: Some(to_error(error)),
        },
    }
}

#[tauri::command]
pub(crate) fn load_app_state(app: tauri::AppHandle) -> AppStateWithContent {
    let state_file = match app_state_path(&app) {
        Ok(path) => path,
        Err(_) => {
            return AppStateWithContent {
                files: Vec::new(),
                active_repo_id: None,
                active_file_id: None,
            };
        }
    };

    let state = crate::read_json_file::<AppState>(&state_file)
        .ok()
        .flatten()
        .unwrap_or(AppState {
            files: Vec::new(),
            active_repo_id: None,
            active_file_id: None,
        });

    let mut files: Vec<AppStateWithContentFile> = Vec::new();
    for file in state.files {
        let path = PathBuf::from(&file.path);
        if !path.exists() || !path.is_file() {
            continue;
        }

        let content = match fs::read_to_string(&path) {
            Ok(value) => value,
            Err(_) => continue,
        };

        files.push(AppStateWithContentFile {
            id: file.id,
            name: file.name,
            path: file.path,
            content,
        });
    }

    let active_file_id = match state.active_file_id {
        Some(value) if files.iter().any(|file| file.id == value) => Some(value),
        _ => files.first().map(|file| file.id.clone()),
    };

    AppStateWithContent {
        files,
        active_repo_id: state.active_repo_id,
        active_file_id,
    }
}

#[tauri::command]
pub(crate) fn save_app_state(app: tauri::AppHandle, state: AppState) -> SaveResult {
    let state_file = match app_state_path(&app) {
        Ok(path) => path,
        Err(error) => {
            return SaveResult {
                success: false,
                error: Some(error),
            };
        }
    };

    match crate::write_json_file(&state_file, &state) {
        Ok(()) => SaveResult {
            success: true,
            error: None,
        },
        Err(error) => SaveResult {
            success: false,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub(crate) fn rename_file(old_path: String, new_name: String) -> OperationResult {
    let normalized_old_path = match normalize_non_empty_path(&old_path) {
        Some(value) => value,
        None => {
            return OperationResult {
                success: false,
                new_path: None,
                new_name: None,
                error: Some("invalid-path".to_string()),
            };
        }
    };

    let trimmed_name = new_name.trim();
    if trimmed_name.is_empty() {
        return OperationResult {
            success: false,
            new_path: None,
            new_name: None,
            error: Some("invalid-name".to_string()),
        };
    }

    let new_path = match normalized_old_path.parent() {
        Some(parent) => parent.join(trimmed_name),
        None => {
            return OperationResult {
                success: false,
                new_path: None,
                new_name: None,
                error: Some("invalid-path".to_string()),
            };
        }
    };

    if new_path == normalized_old_path {
        return OperationResult {
            success: true,
            new_path: Some(new_path.to_string_lossy().to_string()),
            new_name: Some(trimmed_name.to_string()),
            error: None,
        };
    }

    if new_path.exists() {
        return OperationResult {
            success: false,
            new_path: None,
            new_name: None,
            error: Some("target-exists".to_string()),
        };
    }

    match rename_path(&normalized_old_path, &new_path) {
        Ok(()) => OperationResult {
            success: true,
            new_path: Some(new_path.to_string_lossy().to_string()),
            new_name: Some(trimmed_name.to_string()),
            error: None,
        },
        Err(error) => OperationResult {
            success: false,
            new_path: None,
            new_name: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub(crate) fn move_path(source_path: String, target_folder_path: String) -> OperationResult {
    let source = match normalize_non_empty_path(&source_path) {
        Some(value) => value,
        None => {
            return OperationResult {
                success: false,
                new_path: None,
                new_name: None,
                error: Some("invalid-path".to_string()),
            };
        }
    };

    let target_folder = match normalize_non_empty_path(&target_folder_path) {
        Some(value) => value,
        None => {
            return OperationResult {
                success: false,
                new_path: None,
                new_name: None,
                error: Some("invalid-path".to_string()),
            };
        }
    };

    if !source.exists() {
        return OperationResult {
            success: false,
            new_path: None,
            new_name: None,
            error: Some("source-not-found".to_string()),
        };
    }

    if !target_folder.exists() {
        return OperationResult {
            success: false,
            new_path: None,
            new_name: None,
            error: Some("target-not-found".to_string()),
        };
    }

    if !target_folder.is_dir() {
        return OperationResult {
            success: false,
            new_path: None,
            new_name: None,
            error: Some("target-not-folder".to_string()),
        };
    }

    if source.is_dir() {
        let source_with_sep = format!("{}{}", source.to_string_lossy(), std::path::MAIN_SEPARATOR);
        if target_folder
            .to_string_lossy()
            .starts_with(source_with_sep.as_str())
        {
            return OperationResult {
                success: false,
                new_path: None,
                new_name: None,
                error: Some("invalid-target".to_string()),
            };
        }
    }

    let source_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("moved")
        .to_string();
    let destination = target_folder.join(&source_name);

    if destination == source {
        return OperationResult {
            success: true,
            new_path: Some(destination.to_string_lossy().to_string()),
            new_name: Some(source_name),
            error: None,
        };
    }

    if destination.exists() {
        return OperationResult {
            success: false,
            new_path: None,
            new_name: None,
            error: Some("target-exists".to_string()),
        };
    }

    match rename_path(&source, &destination) {
        Ok(()) => OperationResult {
            success: true,
            new_path: Some(destination.to_string_lossy().to_string()),
            new_name: Some(source_name),
            error: None,
        },
        Err(error) => OperationResult {
            success: false,
            new_path: None,
            new_name: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub(crate) fn reveal_in_folder(file_path: String) -> BasicResult {
    let normalized_path = match normalize_non_empty_path(&file_path) {
        Some(value) => value,
        None => {
            return BasicResult {
                success: false,
                error: Some("invalid-path".to_string()),
            };
        }
    };

    if !normalized_path.exists() {
        return BasicResult {
            success: false,
            error: Some("path-not-found".to_string()),
        };
    }

    let result = if cfg!(target_os = "macos") {
        Command::new("open")
            .arg("-R")
            .arg(&normalized_path)
            .status()
            .map_err(to_error)
    } else if cfg!(target_os = "windows") {
        Command::new("explorer")
            .arg(format!("/select,{}", normalized_path.to_string_lossy()))
            .status()
            .map_err(to_error)
    } else {
        let target = normalized_path
            .parent()
            .map(PathBuf::from)
            .unwrap_or_else(|| normalized_path.clone());
        Command::new("xdg-open")
            .arg(target)
            .status()
            .map_err(to_error)
    };

    match result {
        Ok(status) if status.success() => BasicResult {
            success: true,
            error: None,
        },
        Ok(status) => BasicResult {
            success: false,
            error: Some(format!("command-exit-{}", status.code().unwrap_or(-1))),
        },
        Err(error) => BasicResult {
            success: false,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub(crate) fn read_asset(app: tauri::AppHandle, rel_path: String) -> Result<Vec<u8>, String> {
    let normalized = rel_path.trim_start_matches('/').to_string();
    if normalized.is_empty() {
        return Err("invalid-asset-path".to_string());
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    let virtual_paths = asset_virtual_path_candidates(&normalized);

    if let Ok(resource_dir) = app.path().resource_dir() {
        for virtual_path in &virtual_paths {
            candidates.push(resource_dir.join(virtual_path));
            candidates.push(resource_dir.join("dist").join(virtual_path));
        }
    }

    if let Ok(current_dir) = std::env::current_dir() {
        for virtual_path in &virtual_paths {
            candidates.push(current_dir.join(virtual_path));
            candidates.push(current_dir.join("public").join(virtual_path));
            candidates.push(current_dir.join("dist").join(virtual_path));
        }
    }

    for candidate in candidates {
        if candidate.exists() {
            return fs::read(candidate).map_err(to_error);
        }
    }

    Err(format!("Asset not found: {}", rel_path))
}

#[tauri::command]
pub(crate) fn read_file(file_path: String) -> ReadFileResponse {
    let normalized_path = match normalize_non_empty_path(&file_path) {
        Some(value) => value,
        None => {
            return ReadFileResponse {
                content: String::new(),
                error: Some("invalid-file-path".to_string()),
            };
        }
    };

    match fs::read_to_string(normalized_path) {
        Ok(content) => ReadFileResponse {
            content,
            error: None,
        },
        Err(error) => ReadFileResponse {
            content: String::new(),
            error: Some(to_error(error)),
        },
    }
}

#[tauri::command]
pub(crate) fn read_file_bytes(file_path: String) -> ReadFileBytesResponse {
    let normalized_path = match normalize_non_empty_path(&file_path) {
        Some(value) => value,
        None => {
            return ReadFileBytesResponse {
                data: None,
                error: Some("invalid-file-path".to_string()),
            };
        }
    };

    match fs::read(normalized_path) {
        Ok(data) => ReadFileBytesResponse {
            data: Some(data),
            error: None,
        },
        Err(error) => ReadFileBytesResponse {
            data: None,
            error: Some(to_error(error)),
        },
    }
}
