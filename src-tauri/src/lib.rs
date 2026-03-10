mod fs_commands;
mod git_commands;
mod models;
mod repo_commands;
mod settings_commands;
mod support;
mod updater_commands;

use fs_commands::{
	create_file, create_folder, load_app_state, move_path, open_file, read_asset, read_file,
	read_file_bytes, rename_file, reveal_in_folder, save_app_state, save_file, select_folder,
};
use git_commands::{
	commit_git_changes, get_git_diff, get_git_status, stage_all_git_changes, stage_git_file,
	sync_git_pull, unstage_git_file,
};
pub(crate) use models::*;
use repo_commands::{
	delete_file, load_repos, load_workspace_metadata, save_repos, save_workspace_metadata,
	scan_directory, start_repo_watch, stop_repo_watch,
};
#[cfg(test)]
pub(crate) use repo_commands::{create_repo_watcher, map_notify_event_type};
use settings_commands::{load_global_settings, save_global_settings};
pub(crate) use support::*;
use updater_commands::{check_for_updates, fetch_releases_feed, get_app_version, install_update};

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
		assert_eq!(map_notify_event_type(&EventKind::Create(CreateKind::Any)), "rename");
		assert_eq!(
			map_notify_event_type(&EventKind::Modify(ModifyKind::Data(DataChange::Any))),
			"change"
		);
		assert_eq!(map_notify_event_type(&EventKind::Remove(RemoveKind::Any)), "rename");
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
		assert!(seen, "expected repo watcher to emit at least one fs change event");
	}
}
