use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::process::Command;

use crate::{
    normalize_non_empty_path, now_ms, to_error, BasicResult, GitChangeEntry, GitCommandOutput,
    GitDiffResponse, GitDiffResult, GitStatusResponse, GitStatusSummary,
};

pub(crate) fn format_git_error(output: &GitCommandOutput) -> String {
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

pub(crate) fn run_git(repo_path: &Path, args: &[&str]) -> Result<GitCommandOutput, String> {
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

pub(crate) fn assert_git_repository(repo_path: &Path) -> Result<(), String> {
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
pub(crate) fn get_git_status(repo_path: String) -> GitStatusResponse {
    let normalized_repo_path = match normalize_non_empty_path(&repo_path) {
        Some(value) => value,
        None => {
            return GitStatusResponse {
                success: false,
                data: None,
                error: Some("invalid-repo-path".to_string()),
            };
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
pub(crate) fn get_git_diff(repo_path: String, file_path: String, group: String) -> GitDiffResponse {
    let normalized_repo_path = match normalize_non_empty_path(&repo_path) {
        Some(value) => value,
        None => {
            return GitDiffResponse {
                success: false,
                data: None,
                error: Some("invalid-repo-path".to_string()),
            };
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
pub(crate) fn stage_git_file(repo_path: String, file_path: String) -> BasicResult {
    let normalized_repo_path = match normalize_non_empty_path(&repo_path) {
        Some(value) => value,
        None => {
            return BasicResult {
                success: false,
                error: Some("invalid-repo-path".to_string()),
            };
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
pub(crate) fn unstage_git_file(repo_path: String, file_path: String) -> BasicResult {
    let normalized_repo_path = match normalize_non_empty_path(&repo_path) {
        Some(value) => value,
        None => {
            return BasicResult {
                success: false,
                error: Some("invalid-repo-path".to_string()),
            };
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
pub(crate) fn stage_all_git_changes(repo_path: String) -> BasicResult {
    let normalized_repo_path = match normalize_non_empty_path(&repo_path) {
        Some(value) => value,
        None => {
            return BasicResult {
                success: false,
                error: Some("invalid-repo-path".to_string()),
            };
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
pub(crate) fn sync_git_pull(repo_path: String, remote_name: Option<String>) -> BasicResult {
    let normalized_repo_path = match normalize_non_empty_path(&repo_path) {
        Some(value) => value,
        None => {
            return BasicResult {
                success: false,
                error: Some("invalid-repo-path".to_string()),
            };
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
pub(crate) fn commit_git_changes(repo_path: String, message: String) -> BasicResult {
    let normalized_repo_path = match normalize_non_empty_path(&repo_path) {
        Some(value) => value,
        None => {
            return BasicResult {
                success: false,
                error: Some("invalid-repo-path".to_string()),
            };
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
