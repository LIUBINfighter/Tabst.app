mod fs_commands;
mod git_commands;
mod models;
mod power_commands;
mod repo_commands;
mod settings_commands;
mod support;
mod updater_commands;

use fs_commands::{
    create_file, create_folder, load_app_state, move_path, open_external, open_file, read_asset,
    read_file, read_file_bytes, rename_file, reveal_in_folder, save_app_state, save_file,
    select_folder,
};
use git_commands::{
    commit_git_changes, get_git_diff, get_git_status, stage_all_git_changes, stage_git_file,
    sync_git_pull, unstage_git_file,
};
pub(crate) use models::*;
use power_commands::set_keep_awake;
#[cfg(test)]
pub(crate) use repo_commands::{create_repo_watcher, map_notify_event_type};
use repo_commands::{
    delete_file, load_repos, load_workspace_metadata, save_repos, save_workspace_metadata,
    scan_directory, start_repo_watch, stop_repo_watch,
};
use settings_commands::{load_global_settings, save_global_settings};
pub(crate) use support::*;
use updater_commands::{check_for_updates, fetch_releases_feed, get_app_version, install_update};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    with_optional_updater_plugin(tauri::Builder::default())
        .manage(RepoWatchManager::default())
        .manage(KeepAwakeManager::default())
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
            open_external,
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
            save_global_settings,
            set_keep_awake
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
    use std::env;
    use std::fs;
    use std::path::PathBuf;
    use std::process::Command;
    use std::sync::mpsc;
    use std::sync::{Mutex, OnceLock};
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

    fn init_git_repo(dir: &PathBuf) {
        let status = Command::new("git")
            .arg("init")
            .current_dir(dir)
            .status()
            .expect("failed to run git init");
        assert!(status.success(), "git init should succeed in test repo");
    }

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn with_temp_home<T>(test_name: &str, run: impl FnOnce(PathBuf) -> T) -> T {
        let _guard = env_lock().lock().expect("failed to lock env mutex");
        let home_dir = temp_dir_for(test_name);
        let previous_home = env::var_os("HOME");

        unsafe {
            env::set_var("HOME", &home_dir);
        }

        let result = run(home_dir.clone());

        match previous_home {
            Some(value) => unsafe {
                env::set_var("HOME", value);
            },
            None => unsafe {
                env::remove_var("HOME");
            },
        }

        let _ = fs::remove_dir_all(&home_dir);
        result
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

    #[test]
    fn rename_file_rejects_names_that_escape_the_parent_directory() {
        let repo_dir = temp_dir_for("rename-scope");
        let nested_dir = repo_dir.join("nested");
        fs::create_dir_all(&nested_dir).expect("failed to create nested dir");
        let source_path = nested_dir.join("song.atex");
        fs::write(&source_path, "content").expect("failed to write source file");

        let result = rename_file(
            source_path.to_string_lossy().to_string(),
            "../escaped.atex".to_string(),
        );

        assert!(
            !result.success,
            "expected rename to reject parent-directory escape"
        );
        assert_eq!(result.error.as_deref(), Some("path-outside-workspace"));
        assert!(
            !repo_dir.join("escaped.atex").exists(),
            "rename should not create a file outside the original parent directory"
        );

        let _ = fs::remove_dir_all(&repo_dir);
    }

    #[test]
    fn move_path_rejects_cross_workspace_moves() {
        let repo_dir = temp_dir_for("move-scope-repo");
        let outside_dir = temp_dir_for("move-scope-outside");
        let source_path = repo_dir.join("song.atex");
        fs::write(&source_path, "content").expect("failed to write source file");

        let result = move_path(
            source_path.to_string_lossy().to_string(),
            outside_dir.to_string_lossy().to_string(),
        );

        assert!(
            !result.success,
            "expected move_path to reject moving files outside the workspace root"
        );
        assert_eq!(result.error.as_deref(), Some("path-outside-workspace"));
        assert!(
            source_path.exists(),
            "source file should remain in place after a rejected move"
        );

        let _ = fs::remove_dir_all(&repo_dir);
        let _ = fs::remove_dir_all(&outside_dir);
    }

    #[test]
    fn delete_file_repo_trash_rejects_paths_outside_the_repo_root() {
        let repo_dir = temp_dir_for("delete-scope-repo");
        let outside_dir = temp_dir_for("delete-scope-outside");
        let outside_file = outside_dir.join("outside.atex");
        fs::write(&outside_file, "content").expect("failed to write outside file");

        let result = delete_file(
            outside_file.to_string_lossy().to_string(),
            "repo-trash".to_string(),
            Some(repo_dir.to_string_lossy().to_string()),
        );

        assert!(
            !result.success,
            "expected repo-trash deletion to reject files outside the repo root"
        );
        assert_eq!(result.error.as_deref(), Some("path-outside-workspace"));
        assert!(
            outside_file.exists(),
            "outside file should remain in place after a rejected delete"
        );

        let _ = fs::remove_dir_all(&repo_dir);
        let _ = fs::remove_dir_all(&outside_dir);
    }

    #[test]
    fn stage_git_file_rejects_parent_directory_pathspecs() {
        let repo_dir = temp_dir_for("git-pathspec-scope");
        init_git_repo(&repo_dir);
        register_allowed_root(&repo_dir).expect("failed to register allowed repo root");
        let outside_file = repo_dir
            .parent()
            .expect("repo temp dir should have a parent")
            .join(format!("outside-{}.atex", now_ms()));
        fs::write(&outside_file, "content").expect("failed to write outside file");

        let result = stage_git_file(
            repo_dir.to_string_lossy().to_string(),
            format!("../{}", outside_file.file_name().unwrap().to_string_lossy()),
        );

        assert!(
            !result.success,
            "expected git staging to reject parent-directory pathspecs"
        );
        assert_eq!(result.error.as_deref(), Some("invalid-file-path"));

        let _ = fs::remove_file(&outside_file);
        let _ = fs::remove_dir_all(&repo_dir);
    }

    #[test]
    fn save_repos_preserves_temporarily_unavailable_entries() {
        with_temp_home("save-repos-preserve-unavailable", |_home_dir| {
            let repo_one_dir = temp_dir_for("saved-repo-one");
            let repo_two_dir = temp_dir_for("saved-repo-two");
            register_allowed_root(&repo_one_dir).expect("register repo one");
            register_allowed_root(&repo_two_dir).expect("register repo two");

            let repo_one = Repo {
                id: "repo-1".to_string(),
                name: "Repo One".to_string(),
                path: repo_one_dir.to_string_lossy().to_string(),
                last_opened_at: 1,
            };
            let repo_two = Repo {
                id: "repo-2".to_string(),
                name: "Repo Two".to_string(),
                path: repo_two_dir.to_string_lossy().to_string(),
                last_opened_at: 2,
            };

            save_repos(vec![repo_one.clone(), repo_two.clone()]);

            fs::remove_dir_all(&repo_one_dir).expect("remove repo one to simulate offline repo");

            save_repos(vec![
                Repo {
                    last_opened_at: 10,
                    ..repo_one.clone()
                },
                Repo {
                    last_opened_at: 20,
                    ..repo_two.clone()
                },
            ]);

            let persisted = load_repos();
            assert_eq!(
                persisted.len(),
                2,
                "saving repos should not drop previously known repos that are temporarily unavailable"
            );
            assert!(
                persisted.iter().any(|repo| repo.id == repo_one.id),
                "offline repo entry should still be present after save"
            );

            let _ = fs::remove_dir_all(&repo_two_dir);
        });
    }

    #[test]
    fn load_repos_returns_canonical_paths_for_accessible_entries() {
        with_temp_home("load-repos-canonical-paths", |_home_dir| {
            let repo_parent = temp_dir_for("canonical-repo-parent");
            let alias_dir = repo_parent.join("alias");
            let repo_dir = repo_parent.join("repo");
            fs::create_dir_all(&alias_dir).expect("create alias dir");
            fs::create_dir_all(&repo_dir).expect("create repo dir");

            let alias_path = alias_dir.join("..").join("repo");
            let metadata_dir = global_metadata_dir().expect("global metadata dir");
            let repos_path = metadata_dir.join("repos.json");
            write_json_file(
                &repos_path,
                &vec![Repo {
                    id: "repo-1".to_string(),
                    name: "Repo".to_string(),
                    path: alias_path.to_string_lossy().to_string(),
                    last_opened_at: 1,
                }],
            )
            .expect("write repos");

            let loaded = load_repos();
            assert_eq!(loaded.len(), 1);
            assert_eq!(
                loaded[0].path,
                fs::canonicalize(&repo_dir)
                    .expect("canonical repo path")
                    .to_string_lossy()
                    .to_string()
            );

            let _ = fs::remove_dir_all(&repo_parent);
        });
    }

    #[test]
    fn rename_file_keeps_exact_file_registration_in_sync() {
        let standalone_dir = temp_dir_for("exact-file-rename");
        let source_path = standalone_dir.join("standalone.atex");
        fs::write(&source_path, "content").expect("write standalone file");
        register_allowed_file(&source_path).expect("register standalone file");

        let result = rename_file(
            source_path.to_string_lossy().to_string(),
            "renamed.atex".to_string(),
        );

        assert!(result.success, "expected standalone rename to succeed");
        let new_path = PathBuf::from(
            result
                .new_path
                .clone()
                .expect("rename should return new path for standalone file"),
        );
        let read_result = read_file(new_path.to_string_lossy().to_string());
        assert_eq!(read_result.error, None);
        assert_eq!(read_result.content, "content");

        let _ = fs::remove_dir_all(&standalone_dir);
    }
}
