use std::sync::Mutex;

use notify::RecommendedWatcher;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FileResult {
    pub(crate) path: String,
    pub(crate) name: String,
    pub(crate) content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SaveResult {
    pub(crate) success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OperationResult {
    pub(crate) success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) new_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) new_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BasicResult {
    pub(crate) success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct BasicSuccess {
    pub(crate) success: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FolderResult {
    pub(crate) path: String,
    pub(crate) name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReadFileResponse {
    pub(crate) content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ReadFileBytesResponse {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) data: Option<Vec<u8>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Repo {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) last_opened_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepoMetadata {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) opened_at: u64,
    pub(crate) expanded_folders: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) preferences: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) active_file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) workspace_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) active_settings_page_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) active_tutorial_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) tutorial_audience: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FileNode {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) path: String,
    #[serde(rename = "type")]
    pub(crate) node_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) mtime_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) children: Option<Vec<FileNode>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) is_expanded: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ScanDirectoryResult {
    pub(crate) nodes: Vec<FileNode>,
    pub(crate) expanded_folders: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppStateFile {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppState {
    #[serde(default)]
    pub(crate) files: Vec<AppStateFile>,
    #[serde(default)]
    pub(crate) active_repo_id: Option<String>,
    #[serde(default)]
    pub(crate) active_file_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppStateWithContentFile {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) path: String,
    pub(crate) content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AppStateWithContent {
    pub(crate) files: Vec<AppStateWithContentFile>,
    pub(crate) active_repo_id: Option<String>,
    pub(crate) active_file_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitChangeEntry {
    pub(crate) path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) from_path: Option<String>,
    pub(crate) x: String,
    pub(crate) y: String,
    pub(crate) order: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitStatusSummary {
    pub(crate) branch: Option<String>,
    pub(crate) tracking: Option<String>,
    pub(crate) ahead: u64,
    pub(crate) behind: u64,
    pub(crate) detached: bool,
    pub(crate) staged: Vec<GitChangeEntry>,
    pub(crate) unstaged: Vec<GitChangeEntry>,
    pub(crate) untracked: Vec<GitChangeEntry>,
    pub(crate) conflicted: Vec<GitChangeEntry>,
    pub(crate) clean: bool,
    pub(crate) generated_at: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitDiffResult {
    pub(crate) path: String,
    pub(crate) group: String,
    pub(crate) mode: String,
    pub(crate) binary: bool,
    pub(crate) content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) notice: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitStatusResponse {
    pub(crate) success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) data: Option<GitStatusSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GitDiffResponse {
    pub(crate) success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) data: Option<GitDiffResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CheckUpdateResponse {
    pub(crate) supported: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InstallUpdateResponse {
    pub(crate) ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FeedResponse {
    pub(crate) success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) data: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct GlobalSettingsLoadResponse {
    pub(crate) success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) data: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RepoFsChangedEvent {
    pub(crate) repo_path: String,
    pub(crate) event_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) changed_path: Option<String>,
}

pub(crate) struct RepoWatcherState {
    pub(crate) repo_path: String,
    pub(crate) _watcher: RecommendedWatcher,
}

#[derive(Default)]
pub(crate) struct RepoWatchManager {
    pub(crate) active: Mutex<Option<RepoWatcherState>>,
}

pub(crate) struct GitCommandOutput {
    pub(crate) stdout: String,
    pub(crate) stderr: String,
    pub(crate) code: i32,
}
