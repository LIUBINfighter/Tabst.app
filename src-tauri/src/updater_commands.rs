use tauri::Emitter;
use tauri_plugin_updater::UpdaterExt;

use crate::{
    to_error, update_check_unsupported_message, update_install_unsupported_message,
    CheckUpdateResponse, FeedResponse, InstallUpdateResponse, RELEASES_FEED_URL,
};

#[tauri::command]
pub(crate) async fn check_for_updates(app: tauri::AppHandle) -> CheckUpdateResponse {
    let platform = std::env::consts::OS;
    let is_debug_build = cfg!(debug_assertions);
    if !crate::is_update_supported_runtime(platform, is_debug_build) {
        return CheckUpdateResponse {
            supported: false,
            message: Some(update_check_unsupported_message()),
        };
    }

    let _ = app.emit("update-event", serde_json::json!({ "type": "checking" }));

    let updater = match app.updater() {
        Ok(value) => value,
        Err(error) => {
            let message = to_error(error);
            let _ = app.emit(
                "update-event",
                serde_json::json!({ "type": "error", "message": message.clone() }),
            );
            return CheckUpdateResponse {
                supported: false,
                message: Some(message),
            };
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            let _ = app.emit(
                "update-event",
                serde_json::json!({ "type": "available", "version": update.version }),
            );
            CheckUpdateResponse {
                supported: true,
                message: None,
            }
        }
        Ok(None) => {
            let _ = app.emit(
                "update-event",
                serde_json::json!({
                    "type": "not-available",
                    "version": app.package_info().version.to_string()
                }),
            );
            CheckUpdateResponse {
                supported: true,
                message: None,
            }
        }
        Err(error) => {
            let message = to_error(error);
            let _ = app.emit(
                "update-event",
                serde_json::json!({ "type": "error", "message": message.clone() }),
            );
            CheckUpdateResponse {
                supported: false,
                message: Some(message),
            }
        }
    }
}

#[tauri::command]
pub(crate) async fn install_update(app: tauri::AppHandle) -> InstallUpdateResponse {
    let platform = std::env::consts::OS;
    let is_debug_build = cfg!(debug_assertions);
    if !crate::is_update_supported_runtime(platform, is_debug_build) {
        return InstallUpdateResponse {
            ok: false,
            message: Some(update_install_unsupported_message()),
        };
    }

    let _ = app.emit("update-event", serde_json::json!({ "type": "checking" }));

    let updater = match app.updater() {
        Ok(value) => value,
        Err(error) => {
            let message = to_error(error);
            let _ = app.emit(
                "update-event",
                serde_json::json!({ "type": "error", "message": message.clone() }),
            );
            return InstallUpdateResponse {
                ok: false,
                message: Some(message),
            };
        }
    };

    let update = match updater.check().await {
        Ok(Some(value)) => value,
        Ok(None) => {
            return InstallUpdateResponse {
                ok: false,
                message: Some("当前已是最新版本".to_string()),
            };
        }
        Err(error) => {
            let message = to_error(error);
            let _ = app.emit(
                "update-event",
                serde_json::json!({ "type": "error", "message": message.clone() }),
            );
            return InstallUpdateResponse {
                ok: false,
                message: Some(message),
            };
        }
    };

    let next_version = update.version.clone();
    let app_for_progress = app.clone();
    let app_for_finished = app.clone();
    let mut downloaded_bytes: u64 = 0;

    match update
        .download_and_install(
            move |chunk_length, content_length| {
                downloaded_bytes = downloaded_bytes.saturating_add(chunk_length as u64);
                let total = content_length.unwrap_or(0);
                let percent = if total == 0 {
                    0.0
                } else {
                    (downloaded_bytes as f64 / total as f64) * 100.0
                };

                let _ = app_for_progress.emit(
                    "update-event",
                    serde_json::json!({
                        "type": "progress",
                        "percent": percent,
                        "transferred": downloaded_bytes,
                        "total": total
                    }),
                );
            },
            move || {
                let _ = app_for_finished.emit(
                    "update-event",
                    serde_json::json!({ "type": "downloaded", "version": next_version }),
                );
            },
        )
        .await
    {
        Ok(()) => InstallUpdateResponse {
            ok: true,
            message: None,
        },
        Err(error) => {
            let message = to_error(error);
            let _ = app.emit(
                "update-event",
                serde_json::json!({ "type": "error", "message": message.clone() }),
            );
            InstallUpdateResponse {
                ok: false,
                message: Some(message),
            }
        }
    }
}

#[tauri::command]
pub(crate) fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
pub(crate) async fn fetch_releases_feed() -> FeedResponse {
    match reqwest::get(RELEASES_FEED_URL).await {
        Ok(response) => {
            if !response.status().is_success() {
                return FeedResponse {
                    success: false,
                    data: None,
                    error: Some(format!("HTTP {}", response.status())),
                };
            }

            match response.bytes().await {
                Ok(bytes) => FeedResponse {
                    success: true,
                    data: Some(String::from_utf8_lossy(&bytes).to_string()),
                    error: None,
                },
                Err(error) => FeedResponse {
                    success: false,
                    data: None,
                    error: Some(to_error(error)),
                },
            }
        }
        Err(error) => FeedResponse {
            success: false,
            data: None,
            error: Some(to_error(error)),
        },
    }
}
