mod settings_commands;
mod updater_commands;

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use dirs::{document_dir, home_dir};
use notify::event::{EventKind, ModifyKind};
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use rfd::FileDialog;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use tauri::{Emitter, Manager};

use settings_commands::{load_global_settings, save_global_settings};
use updater_commands::{check_for_updates, fetch_releases_feed, get_app_version, install_update};

const SUPPORTED_EXTENSIONS: [&str; 7] = [".md", ".atex", ".gp", ".gp3", ".gp4", ".gp5", ".gpx"];
const RELEASES_FEED_URL: &str = "https://github.com/LIUBINfighter/Tabst.app/releases.atom";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileResult {
    path: String,
    name: String,
    content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveResult {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct OperationResult {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    new_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    new_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct BasicResult {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct BasicSuccess {
    success: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FolderResult {
    path: String,
    name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReadFileResponse {
    content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReadFileBytesResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Vec<u8>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Repo {
    id: String,
    name: String,
    path: String,
    last_opened_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RepoMetadata {
    id: String,
    name: String,
    opened_at: u64,
    expanded_folders: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    preferences: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    active_file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    workspace_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    active_settings_page_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    active_tutorial_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tutorial_audience: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileNode {
    id: String,
    name: String,
    path: String,
    #[serde(rename = "type")]
    node_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    mtime_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<FileNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    is_expanded: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanDirectoryResult {
    nodes: Vec<FileNode>,
    expanded_folders: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppStateFile {
    id: String,
    name: String,
    path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AppState {
    #[serde(default)]
    files: Vec<AppStateFile>,
    #[serde(default)]
    active_repo_id: Option<String>,
    #[serde(default)]
    active_file_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppStateWithContentFile {
    id: String,
    name: String,
    path: String,
    content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppStateWithContent {
    files: Vec<AppStateWithContentFile>,
    active_repo_id: Option<String>,
    active_file_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitChangeEntry {
    path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    from_path: Option<String>,
    x: String,
    y: String,
    order: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitStatusSummary {
    branch: Option<String>,
    tracking: Option<String>,
    ahead: u64,
    behind: u64,
    detached: bool,
    staged: Vec<GitChangeEntry>,
    unstaged: Vec<GitChangeEntry>,
    untracked: Vec<GitChangeEntry>,
    conflicted: Vec<GitChangeEntry>,
    clean: bool,
    generated_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitDiffResult {
    path: String,
    group: String,
    mode: String,
    binary: bool,
    content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    notice: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitStatusResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<GitStatusSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GitDiffResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<GitDiffResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CheckUpdateResponse {
    supported: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallUpdateResponse {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FeedResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GlobalSettingsLoadResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct RepoFsChangedEvent {
    repo_path: String,
    event_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    changed_path: Option<String>,
}

struct RepoWatcherState {
    repo_path: String,
    _watcher: RecommendedWatcher,
}

#[derive(Default)]
struct RepoWatchManager {
    active: Mutex<Option<RepoWatcherState>>,
}

struct GitCommandOutput {
    stdout: String,
    stderr: String,
    code: i32,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis() as u64)
        .unwrap_or(0)
}

fn to_error(error: impl ToString) -> String {
    error.to_string()
}

fn asset_virtual_path_candidates(rel_path: &str) -> Vec<String> {
    let normalized = rel_path.trim_start_matches('/').to_string();
    let mut candidates = vec![normalized.clone()];

    match normalized.as_str() {
        "docs/README.md" => candidates.push("README.md".to_string()),
        "docs/ROADMAP.md" => candidates.push("ROADMAP.md".to_string()),
        _ => {}
    }

    candidates
}

fn is_update_supported_runtime(platform: &str, is_debug_build: bool) -> bool {
    !is_debug_build && matches!(platform, "windows" | "macos" | "linux")
}

fn update_check_unsupported_message() -> String {
    "仅支持正式打包版本的更新检查（开发调试构建不可用）".to_string()
}

fn update_install_unsupported_message() -> String {
    "仅支持正式打包版本安装更新（开发调试构建不可用）".to_string()
}

fn map_notify_event_type(kind: &EventKind) -> &'static str {
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

fn create_repo_watcher<F>(repo_path: PathBuf, on_event: F) -> Result<RecommendedWatcher, String>
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
            Err(_error) => {
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

fn normalize_non_empty_path(path: &str) -> Option<PathBuf> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(PathBuf::from(trimmed))
}

fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|ch| match ch {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            other => other,
        })
        .collect()
}

fn default_save_dir() -> PathBuf {
    let base = document_dir()
        .or_else(home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("tabst")
}

fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(to_error)?;
    }
    Ok(())
}

fn write_json_file<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
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

fn read_json_file<T: DeserializeOwned>(path: &Path) -> Result<Option<T>, String> {
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

fn global_metadata_dir() -> Result<PathBuf, String> {
    let base = home_dir().unwrap_or_else(|| PathBuf::from("."));
    let metadata_dir = base.join(".tabst");
    fs::create_dir_all(&metadata_dir).map_err(to_error)?;
    Ok(metadata_dir)
}

fn app_state_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(to_error)?;
    fs::create_dir_all(&app_data).map_err(to_error)?;
    Ok(app_data.join("app-state.json"))
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

fn rename_path(source_path: &Path, target_path: &Path) -> Result<(), String> {
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

fn format_git_error(output: &GitCommandOutput) -> String {
    let stderr = output.stderr.trim();
    if !stderr.is_empty() {
        return stderr.to_string();
    }

    let stdout = output.stdout.trim();
    if !stdout.is_empty() {
        return stdout.to_string();
    }

    format!("git command failed with code {}", output.code)
}

fn run_git(repo_path: &Path, args: &[&str]) -> Result<GitCommandOutput, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(to_error)?;

    let result = GitCommandOutput {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        code: output.status.code().unwrap_or(-1),
    };

    if output.status.success() {
        return Ok(result);
    }

    Err(format_git_error(&result))
}

fn assert_git_repository(repo_path: &Path) -> Result<(), String> {
    let output = run_git(repo_path, &["rev-parse", "--is-inside-work-tree"])?;
    if output.stdout.trim() == "true" {
        return Ok(());
    }
    Err("not-a-git-repository".to_string())
}

fn has_head_commit(repo_path: &Path) -> bool {
    run_git(repo_path, &["rev-parse", "--verify", "HEAD"]).is_ok()
}

fn is_conflict_code(x: &str, y: &str) -> bool {
    matches!(
        format!("{}{}", x, y).as_str(),
        "DD" | "AU" | "UD" | "UA" | "DU" | "AA" | "UU"
    ) || x == "U"
        || y == "U"
}

fn parse_branch_header(line: &str) -> (Option<String>, Option<String>, u64, u64, bool) {
    let header = line.trim_start_matches("##").trim();

    if let Some(branch) = header.strip_prefix("No commits yet on ") {
        return (Some(branch.trim().to_string()), None, 0, 0, false);
    }

    if let Some(branch) = header.strip_prefix("Initial commit on ") {
        return (Some(branch.trim().to_string()), None, 0, 0, false);
    }

    if header.starts_with("HEAD") {
        return (None, None, 0, 0, true);
    }

    let mut relation = header.to_string();
    let mut ahead = 0;
    let mut behind = 0;

    if let Some((left, right)) = header.rsplit_once(" [") {
        if right.ends_with(']') {
            relation = left.to_string();
            let relation_items = right.trim_end_matches(']');
            for item in relation_items.split(',') {
                let piece = item.trim();
                if let Some(value) = piece.strip_prefix("ahead ") {
                    ahead = value.trim().parse::<u64>().unwrap_or(0);
                    continue;
                }
                if let Some(value) = piece.strip_prefix("behind ") {
                    behind = value.trim().parse::<u64>().unwrap_or(0);
                }
            }
        }
    }

    if let Some((branch, tracking)) = relation.split_once("...") {
        return (
            Some(branch.trim().to_string()),
            Some(tracking.trim().to_string()),
            ahead,
            behind,
            false,
        );
    }

    (
        Some(relation.trim().to_string()),
        None,
        ahead,
        behind,
        false,
    )
}

fn parse_status_line(line: &str, order: u64) -> Option<GitChangeEntry> {
    if line.len() < 3 {
        return None;
    }

    let x = line.chars().next()?.to_string();
    let y = line.chars().nth(1)?.to_string();
    if x == "!" && y == "!" {
        return None;
    }

    let remainder = line.get(3..)?.trim();
    if remainder.is_empty() {
        return None;
    }

    if let Some(marker) = remainder.find(" -> ") {
        let from_path = remainder.get(..marker)?.trim().to_string();
        let to_path = remainder.get(marker + 4..)?.trim().to_string();
        if to_path.is_empty() {
            return None;
        }
        return Some(GitChangeEntry {
            path: to_path,
            from_path: if from_path.is_empty() {
                None
            } else {
                Some(from_path)
            },
            x,
            y,
            order,
        });
    }

    Some(GitChangeEntry {
        path: remainder.to_string(),
        from_path: None,
        x,
        y,
        order,
    })
}

fn sorted_changes(values: HashMap<String, GitChangeEntry>) -> Vec<GitChangeEntry> {
    let mut entries = values.into_values().collect::<Vec<_>>();
    entries.sort_by_key(|entry| entry.order);
    entries
}

fn parse_status_output(stdout: &str) -> GitStatusSummary {
    let mut staged_map: HashMap<String, GitChangeEntry> = HashMap::new();
    let mut unstaged_map: HashMap<String, GitChangeEntry> = HashMap::new();
    let mut untracked_map: HashMap<String, GitChangeEntry> = HashMap::new();
    let mut conflicted_map: HashMap<String, GitChangeEntry> = HashMap::new();

    let mut branch: Option<String> = None;
    let mut tracking: Option<String> = None;
    let mut ahead = 0;
    let mut behind = 0;
    let mut detached = false;

    let mut entry_order = 0;
    for line in stdout.replace("\r\n", "\n").lines() {
        if line.is_empty() {
            continue;
        }

        if line.starts_with("## ") {
            let (next_branch, next_tracking, next_ahead, next_behind, next_detached) =
                parse_branch_header(line);
            branch = next_branch;
            tracking = next_tracking;
            ahead = next_ahead;
            behind = next_behind;
            detached = next_detached;
            continue;
        }

        let entry = match parse_status_line(line, entry_order) {
            Some(value) => value,
            None => continue,
        };
        entry_order += 1;

        let key = format!(
            "{}::{}",
            entry.path,
            entry.from_path.clone().unwrap_or_default()
        );

        if entry.x == "?" && entry.y == "?" {
            untracked_map.insert(key, entry);
            continue;
        }

        if is_conflict_code(&entry.x, &entry.y) {
            conflicted_map.insert(key.clone(), entry.clone());
        }

        if entry.x != " " && entry.x != "?" {
            staged_map.insert(key.clone(), entry.clone());
        }

        if entry.y != " " && entry.y != "?" {
            unstaged_map.insert(key, entry);
        }
    }

    let staged = sorted_changes(staged_map);
    let unstaged = sorted_changes(unstaged_map);
    let untracked = sorted_changes(untracked_map);
    let conflicted = sorted_changes(conflicted_map);

    let clean =
        staged.is_empty() && unstaged.is_empty() && untracked.is_empty() && conflicted.is_empty();

    GitStatusSummary {
        branch,
        tracking,
        ahead,
        behind,
        detached,
        staged,
        unstaged,
        untracked,
        conflicted,
        clean,
        generated_at: now_ms(),
    }
}

fn is_probably_binary(buffer: &[u8]) -> bool {
    let max_inspect = buffer.len().min(4096);
    buffer.iter().take(max_inspect).any(|byte| *byte == 0)
}

fn build_untracked_patch(repo_path: &Path, relative_path: &str) -> Result<GitDiffResult, String> {
    let absolute_path = repo_path.join(relative_path);
    let file_buffer = fs::read(&absolute_path).map_err(to_error)?;

    if is_probably_binary(&file_buffer) {
        return Ok(GitDiffResult {
            path: relative_path.to_string(),
            group: "untracked".to_string(),
            mode: "binary".to_string(),
            binary: true,
            content: String::new(),
            notice: Some("Binary file changed. Text diff is unavailable.".to_string()),
        });
    }

    let normalized_path = relative_path.replace('\\', "/");
    let text = String::from_utf8_lossy(&file_buffer).replace("\r\n", "\n");
    let lines = if text.is_empty() {
        Vec::new()
    } else {
        text.split('\n').collect::<Vec<_>>()
    };

    let has_trailing_newline = text.ends_with('\n');
    let line_count = if text.is_empty() {
        0
    } else if has_trailing_newline {
        lines.len().saturating_sub(1)
    } else {
        lines.len()
    };

    let hunk_header = if line_count > 0 {
        format!("@@ -0,0 +1,{} @@", line_count)
    } else {
        "@@ -0,0 +0,0 @@".to_string()
    };

    let body = if lines.is_empty() {
        "+".to_string()
    } else {
        lines
            .iter()
            .map(|line| format!("+{}", line))
            .collect::<Vec<_>>()
            .join("\n")
    };

    let content = [
        format!("diff --git a/{0} b/{0}", normalized_path),
        "new file mode 100644".to_string(),
        "--- /dev/null".to_string(),
        format!("+++ b/{}", normalized_path),
        hunk_header,
        body,
    ]
    .join("\n");

    Ok(GitDiffResult {
        path: relative_path.to_string(),
        group: "untracked".to_string(),
        mode: "patch".to_string(),
        binary: false,
        content,
        notice: None,
    })
}

#[tauri::command]
fn open_file(extensions: Vec<String>) -> Option<FileResult> {
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
fn select_folder() -> Option<String> {
    FileDialog::new()
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
fn create_file(ext: Option<String>, preferred_dir: Option<String>) -> Option<FileResult> {
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
fn create_folder(
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
fn save_file(file_path: String, content: String) -> SaveResult {
    let normalized_path = match normalize_non_empty_path(&file_path) {
        Some(value) => value,
        None => {
            return SaveResult {
                success: false,
                error: Some("invalid-file-path".to_string()),
            }
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
fn load_app_state(app: tauri::AppHandle) -> AppStateWithContent {
    let state_file = match app_state_path(&app) {
        Ok(path) => path,
        Err(_) => {
            return AppStateWithContent {
                files: Vec::new(),
                active_repo_id: None,
                active_file_id: None,
            }
        }
    };

    let state = read_json_file::<AppState>(&state_file)
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
fn save_app_state(app: tauri::AppHandle, state: AppState) -> SaveResult {
    let state_file = match app_state_path(&app) {
        Ok(path) => path,
        Err(error) => {
            return SaveResult {
                success: false,
                error: Some(error),
            }
        }
    };

    match write_json_file(&state_file, &state) {
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
fn rename_file(old_path: String, new_name: String) -> OperationResult {
    let normalized_old_path = match normalize_non_empty_path(&old_path) {
        Some(value) => value,
        None => {
            return OperationResult {
                success: false,
                new_path: None,
                new_name: None,
                error: Some("invalid-path".to_string()),
            }
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
            }
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
fn move_path(source_path: String, target_folder_path: String) -> OperationResult {
    let source = match normalize_non_empty_path(&source_path) {
        Some(value) => value,
        None => {
            return OperationResult {
                success: false,
                new_path: None,
                new_name: None,
                error: Some("invalid-path".to_string()),
            }
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
            }
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
fn reveal_in_folder(file_path: String) -> BasicResult {
    let normalized_path = match normalize_non_empty_path(&file_path) {
        Some(value) => value,
        None => {
            return BasicResult {
                success: false,
                error: Some("invalid-path".to_string()),
            }
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
fn read_asset(app: tauri::AppHandle, rel_path: String) -> Result<Vec<u8>, String> {
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
fn read_file(file_path: String) -> ReadFileResponse {
    let normalized_path = match normalize_non_empty_path(&file_path) {
        Some(value) => value,
        None => {
            return ReadFileResponse {
                content: String::new(),
                error: Some("invalid-file-path".to_string()),
            }
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
fn read_file_bytes(file_path: String) -> ReadFileBytesResponse {
    let normalized_path = match normalize_non_empty_path(&file_path) {
        Some(value) => value,
        None => {
            return ReadFileBytesResponse {
                data: None,
                error: Some("invalid-file-path".to_string()),
            }
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

#[tauri::command]
fn scan_directory(dir_path: String) -> Option<ScanDirectoryResult> {
    let normalized_path = normalize_non_empty_path(&dir_path)?;
    let nodes = scan_directory_recursive(&normalized_path).ok()?;

    Some(ScanDirectoryResult {
        nodes,
        expanded_folders: Vec::new(),
    })
}

#[tauri::command]
fn load_repos() -> Vec<Repo> {
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
fn save_repos(repos: Vec<Repo>) {
    if let Ok(metadata_dir) = global_metadata_dir() {
        let repos_path = metadata_dir.join("repos.json");
        let _ = write_json_file(&repos_path, &repos);
    }
}

#[tauri::command]
fn load_workspace_metadata(repo_path: String) -> Option<RepoMetadata> {
    let normalized_path = normalize_non_empty_path(&repo_path)?;
    let metadata_path = normalized_path.join(".tabst").join("workspace.json");

    read_json_file::<RepoMetadata>(&metadata_path)
        .ok()
        .flatten()
}

#[tauri::command]
fn save_workspace_metadata(repo_path: String, metadata: RepoMetadata) {
    if let Some(normalized_path) = normalize_non_empty_path(&repo_path) {
        let workspace_dir = normalized_path.join(".tabst");
        let metadata_path = workspace_dir.join("workspace.json");
        let _ = write_json_file(&metadata_path, &metadata);
    }
}

#[tauri::command]
fn delete_file(file_path: String, behavior: String, repo_path: Option<String>) -> BasicResult {
    let normalized_file_path = match normalize_non_empty_path(&file_path) {
        Some(value) => value,
        None => {
            return BasicResult {
                success: false,
                error: Some("invalid-file-path".to_string()),
            }
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
                    }
                }
            };

        let metadata_dir = match global_metadata_dir() {
            Ok(value) => value,
            Err(error) => {
                return BasicResult {
                    success: false,
                    error: Some(error),
                }
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
fn start_repo_watch(
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
            }
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
                }
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
            }
        }
    };

    let mut guard = match watch_manager.active.lock() {
        Ok(value) => value,
        Err(_) => {
            return BasicResult {
                success: false,
                error: Some("repo-watch-lock-failed".to_string()),
            }
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
fn stop_repo_watch(watch_manager: tauri::State<'_, RepoWatchManager>) -> BasicSuccess {
    if let Ok(mut guard) = watch_manager.active.lock() {
        *guard = None;
    }

    BasicSuccess { success: true }
}

#[tauri::command]
fn get_git_status(repo_path: String) -> GitStatusResponse {
    let normalized_repo_path = match normalize_non_empty_path(&repo_path) {
        Some(value) => value,
        None => {
            return GitStatusResponse {
                success: false,
                data: None,
                error: Some("invalid-repo-path".to_string()),
            }
        }
    };

    if !normalized_repo_path.exists() {
        return GitStatusResponse {
            success: false,
            data: None,
            error: Some("repo-path-not-found".to_string()),
        };
    }

    if let Err(error) = assert_git_repository(&normalized_repo_path) {
        return GitStatusResponse {
            success: false,
            data: None,
            error: Some(error),
        };
    }

    match run_git(
        &normalized_repo_path,
        &[
            "-c",
            "core.quotepath=false",
            "status",
            "--porcelain=v1",
            "--branch",
        ],
    ) {
        Ok(output) => GitStatusResponse {
            success: true,
            data: Some(parse_status_output(&output.stdout)),
            error: None,
        },
        Err(error) => GitStatusResponse {
            success: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn get_git_diff(repo_path: String, file_path: String, group: String) -> GitDiffResponse {
    let normalized_repo_path = match normalize_non_empty_path(&repo_path) {
        Some(value) => value,
        None => {
            return GitDiffResponse {
                success: false,
                data: None,
                error: Some("invalid-repo-path".to_string()),
            }
        }
    };

    let normalized_file_path = file_path.trim();
    if normalized_file_path.is_empty() {
        return GitDiffResponse {
            success: false,
            data: None,
            error: Some("invalid-file-path".to_string()),
        };
    }

    if let Err(error) = assert_git_repository(&normalized_repo_path) {
        return GitDiffResponse {
            success: false,
            data: None,
            error: Some(error),
        };
    }

    if group == "untracked" {
        return match build_untracked_patch(&normalized_repo_path, normalized_file_path) {
            Ok(result) => GitDiffResponse {
                success: true,
                data: Some(result),
                error: None,
            },
            Err(error) => GitDiffResponse {
                success: false,
                data: None,
                error: Some(error),
            },
        };
    }

    let args = if group == "staged" {
        vec![
            "-c",
            "core.quotepath=false",
            "diff",
            "--staged",
            "--binary",
            "--",
            normalized_file_path,
        ]
    } else {
        vec![
            "-c",
            "core.quotepath=false",
            "diff",
            "--binary",
            "--",
            normalized_file_path,
        ]
    };

    match run_git(&normalized_repo_path, &args) {
        Ok(output) => {
            let patch = output.stdout;
            let binary = patch.contains("GIT binary patch")
                || patch.contains("Binary files") && patch.contains("differ");
            let has_patch = !patch.trim().is_empty();

            GitDiffResponse {
                success: true,
                data: Some(GitDiffResult {
                    path: normalized_file_path.to_string(),
                    group,
                    mode: if binary {
                        "binary".to_string()
                    } else if has_patch {
                        "patch".to_string()
                    } else {
                        "text".to_string()
                    },
                    binary,
                    content: patch,
                    notice: if has_patch {
                        None
                    } else {
                        Some(
                            "No diff output for this change. The file may have changed mode only."
                                .to_string(),
                        )
                    },
                }),
                error: None,
            }
        }
        Err(error) => GitDiffResponse {
            success: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn stage_git_file(repo_path: String, file_path: String) -> BasicResult {
    let normalized_repo_path = match normalize_non_empty_path(&repo_path) {
        Some(value) => value,
        None => {
            return BasicResult {
                success: false,
                error: Some("invalid-repo-path".to_string()),
            }
        }
    };

    let normalized_path = file_path.trim().to_string();
    if normalized_path.is_empty() {
        return BasicResult {
            success: false,
            error: Some("invalid-file-path".to_string()),
        };
    }

    if let Err(error) = assert_git_repository(&normalized_repo_path) {
        return BasicResult {
            success: false,
            error: Some(error),
        };
    }

    match run_git(
        &normalized_repo_path,
        &["add", "--", normalized_path.as_str()],
    ) {
        Ok(_) => BasicResult {
            success: true,
            error: None,
        },
        Err(error) => BasicResult {
            success: false,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn unstage_git_file(repo_path: String, file_path: String) -> BasicResult {
    let normalized_repo_path = match normalize_non_empty_path(&repo_path) {
        Some(value) => value,
        None => {
            return BasicResult {
                success: false,
                error: Some("invalid-repo-path".to_string()),
            }
        }
    };

    let normalized_path = file_path.trim().to_string();
    if normalized_path.is_empty() {
        return BasicResult {
            success: false,
            error: Some("invalid-file-path".to_string()),
        };
    }

    if let Err(error) = assert_git_repository(&normalized_repo_path) {
        return BasicResult {
            success: false,
            error: Some(error),
        };
    }

    if !has_head_commit(&normalized_repo_path) {
        return match run_git(
            &normalized_repo_path,
            &["rm", "--cached", "--", normalized_path.as_str()],
        ) {
            Ok(_) => BasicResult {
                success: true,
                error: None,
            },
            Err(error) => BasicResult {
                success: false,
                error: Some(error),
            },
        };
    }

    match run_git(
        &normalized_repo_path,
        &["restore", "--staged", "--", normalized_path.as_str()],
    ) {
        Ok(_) => BasicResult {
            success: true,
            error: None,
        },
        Err(error) => {
            let lower = error.to_lowercase();
            if lower.contains("could not resolve") && lower.contains("head") {
                return match run_git(
                    &normalized_repo_path,
                    &["rm", "--cached", "--", normalized_path.as_str()],
                ) {
                    Ok(_) => BasicResult {
                        success: true,
                        error: None,
                    },
                    Err(fallback_error) => BasicResult {
                        success: false,
                        error: Some(fallback_error),
                    },
                };
            }

            BasicResult {
                success: false,
                error: Some(error),
            }
        }
    }
}

#[tauri::command]
fn stage_all_git_changes(repo_path: String) -> BasicResult {
    let normalized_repo_path = match normalize_non_empty_path(&repo_path) {
        Some(value) => value,
        None => {
            return BasicResult {
                success: false,
                error: Some("invalid-repo-path".to_string()),
            }
        }
    };

    if let Err(error) = assert_git_repository(&normalized_repo_path) {
        return BasicResult {
            success: false,
            error: Some(error),
        };
    }

    match run_git(&normalized_repo_path, &["add", "."]) {
        Ok(_) => BasicResult {
            success: true,
            error: None,
        },
        Err(error) => BasicResult {
            success: false,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn sync_git_pull(repo_path: String, remote_name: Option<String>) -> BasicResult {
    let normalized_repo_path = match normalize_non_empty_path(&repo_path) {
        Some(value) => value,
        None => {
            return BasicResult {
                success: false,
                error: Some("invalid-repo-path".to_string()),
            }
        }
    };

    if let Err(error) = assert_git_repository(&normalized_repo_path) {
        return BasicResult {
            success: false,
            error: Some(error),
        };
    }

    let normalized_remote_name = remote_name
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());

    let mut args = vec!["pull", "--ff-only"];
    if let Some(ref remote) = normalized_remote_name {
        args.push(remote.as_str());
    }

    match run_git(&normalized_repo_path, &args) {
        Ok(_) => BasicResult {
            success: true,
            error: None,
        },
        Err(error) => BasicResult {
            success: false,
            error: Some(error),
        },
    }
}

#[tauri::command]
fn commit_git_changes(repo_path: String, message: String) -> BasicResult {
    let normalized_repo_path = match normalize_non_empty_path(&repo_path) {
        Some(value) => value,
        None => {
            return BasicResult {
                success: false,
                error: Some("invalid-repo-path".to_string()),
            }
        }
    };

    let normalized_message = message.trim().to_string();
    if normalized_message.is_empty() {
        return BasicResult {
            success: false,
            error: Some("empty-commit-message".to_string()),
        };
    }

    if let Err(error) = assert_git_repository(&normalized_repo_path) {
        return BasicResult {
            success: false,
            error: Some(error),
        };
    }

    match run_git(
        &normalized_repo_path,
        &["commit", "-m", normalized_message.as_str()],
    ) {
        Ok(_) => BasicResult {
            success: true,
            error: None,
        },
        Err(error) => BasicResult {
            success: false,
            error: Some(error),
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    with_optional_updater_plugin(tauri::Builder::default())
        .manage(RepoWatchManager::default())
        .invoke_handler(tauri::generate_handler![
            open_file,
            select_folder,
            create_file,
            create_folder,
            save_file,
            load_app_state,
            save_app_state,
            rename_file,
            move_path,
            reveal_in_folder,
            read_asset,
            read_file,
            read_file_bytes,
            scan_directory,
            load_repos,
            save_repos,
            load_workspace_metadata,
            save_workspace_metadata,
            delete_file,
            start_repo_watch,
            stop_repo_watch,
            get_git_status,
            get_git_diff,
            stage_git_file,
            stage_all_git_changes,
            unstage_git_file,
            sync_git_pull,
            commit_git_changes,
            check_for_updates,
            install_update,
            get_app_version,
            fetch_releases_feed,
            load_global_settings,
            save_global_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(not(debug_assertions))]
fn with_optional_updater_plugin(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder.plugin(tauri_plugin_updater::Builder::new().build())
}

#[cfg(debug_assertions)]
fn with_optional_updater_plugin(builder: tauri::Builder<tauri::Wry>) -> tauri::Builder<tauri::Wry> {
    builder
}

#[cfg(test)]
mod tests {
    use super::*;
    use notify::event::{CreateKind, DataChange, EventKind, ModifyKind, RemoveKind};
    use serde_json::json;
    use std::fs;
    use std::path::PathBuf;
    use std::sync::mpsc;
    use std::time::{Duration, Instant};

    fn temp_dir_for(test_name: &str) -> PathBuf {
        let mut dir = std::env::temp_dir();
        dir.push(format!(
            "tabst-tauri-parity-{}-{}-{}",
            test_name,
            std::process::id(),
            now_ms()
        ));
        fs::create_dir_all(&dir).expect("failed to create temp test directory");
        dir
    }

    #[test]
    fn update_support_matrix_matches_tauri_release_policy() {
        assert!(is_update_supported_runtime("macos", false));
        assert!(is_update_supported_runtime("linux", false));
        assert!(is_update_supported_runtime("windows", false));
        assert!(!is_update_supported_runtime("windows", true));
        assert!(!is_update_supported_runtime("linux", true));
        assert!(!is_update_supported_runtime("macos", true));
    }

    #[test]
    fn notify_kind_mapping_matches_legacy_watch_contract() {
        assert_eq!(
            map_notify_event_type(&EventKind::Create(CreateKind::Any)),
            "rename"
        );
        assert_eq!(
            map_notify_event_type(&EventKind::Modify(ModifyKind::Data(DataChange::Any))),
            "change"
        );
        assert_eq!(
            map_notify_event_type(&EventKind::Remove(RemoveKind::Any)),
            "rename"
        );
    }

    #[test]
    fn asset_path_aliases_include_root_docs_files() {
        assert_eq!(
            asset_virtual_path_candidates("docs/README.md"),
            vec!["docs/README.md".to_string(), "README.md".to_string()]
        );
        assert_eq!(
            asset_virtual_path_candidates("docs/ROADMAP.md"),
            vec!["docs/ROADMAP.md".to_string(), "ROADMAP.md".to_string()]
        );
        assert_eq!(
            asset_virtual_path_candidates("docs/dev/README.md"),
            vec!["docs/dev/README.md".to_string()]
        );
    }

    #[test]
    fn repo_metadata_roundtrip_preserves_workspace_session_fields() {
        let original = RepoMetadata {
            id: "repo-1".to_string(),
            name: "Workspace".to_string(),
            opened_at: 100,
            expanded_folders: vec!["/tmp/workspace/docs".to_string()],
            preferences: Some(json!({
                "locale": "en",
                "deleteBehavior": "repo-trash",
                "theme": {
                    "uiThemeId": "github",
                    "editorThemeId": "github",
                    "mode": "dark"
                }
            })),
            active_file_path: Some("/tmp/workspace/song.atex".to_string()),
            workspace_mode: Some("editor".to_string()),
            active_settings_page_id: Some("playback".to_string()),
            active_tutorial_id: Some("user-readme".to_string()),
            tutorial_audience: Some("user".to_string()),
        };

        let encoded = serde_json::to_string(&original).expect("encode repo metadata");
        let decoded: RepoMetadata = serde_json::from_str(&encoded).expect("decode repo metadata");

        assert_eq!(decoded.active_file_path, original.active_file_path);
        assert_eq!(decoded.workspace_mode, original.workspace_mode);
        assert_eq!(
            decoded.active_settings_page_id,
            original.active_settings_page_id
        );
        assert_eq!(decoded.active_tutorial_id, original.active_tutorial_id);
        assert_eq!(decoded.tutorial_audience, original.tutorial_audience);
    }

    #[test]
    fn repo_watcher_emits_events_for_fs_changes() {
        let repo_dir = temp_dir_for("repo-watch");
        let watched_file = repo_dir.join("watched.atex");

        let (tx, rx) = mpsc::channel::<RepoFsChangedEvent>();
        let watcher = create_repo_watcher(repo_dir.clone(), move |event| {
            let _ = tx.send(event);
        })
        .expect("failed to create watcher");

        fs::write(&watched_file, "sync").expect("failed to write watched file");

        let deadline = Instant::now() + Duration::from_secs(5);
        let mut seen = false;

        while Instant::now() < deadline {
            match rx.recv_timeout(Duration::from_millis(250)) {
                Ok(event) => {
                    let is_expected_type =
                        event.event_type == "rename" || event.event_type == "change";
                    let is_expected_path = event
                        .changed_path
                        .as_deref()
                        .map(|value| value.ends_with("watched.atex"))
                        .unwrap_or(false);

                    if is_expected_type && is_expected_path {
                        seen = true;
                        break;
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }

        drop(watcher);
        let _ = fs::remove_dir_all(&repo_dir);
        assert!(
            seen,
            "expected repo watcher to emit at least one fs change event"
        );
    }
}
