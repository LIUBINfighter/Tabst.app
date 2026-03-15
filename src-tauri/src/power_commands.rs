use std::io::ErrorKind;

#[cfg(target_os = "macos")]
use std::process::{Command, Stdio};

#[cfg(target_os = "macos")]
use crate::to_error;
use crate::{BasicResult, KeepAwakeManager};

#[cfg(target_os = "macos")]
fn stop_keep_awake_process(process: &mut std::process::Child) -> Result<(), std::io::Error> {
    match process.kill() {
        Ok(()) => {}
        Err(error) if error.kind() == ErrorKind::InvalidInput => {}
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => return Err(error),
    }

    let _ = process.wait();
    Ok(())
}

#[tauri::command]
pub(crate) fn set_keep_awake(
    keep_awake_manager: tauri::State<'_, KeepAwakeManager>,
    enabled: bool,
) -> BasicResult {
    #[cfg(target_os = "macos")]
    {
        let mut guard = match keep_awake_manager.active_process.lock() {
            Ok(value) => value,
            Err(_) => {
                return BasicResult {
                    success: false,
                    error: Some("keep-awake-lock-failed".to_string()),
                };
            }
        };

        if !enabled {
            if let Some(mut process) = guard.take() {
                if let Err(error) = stop_keep_awake_process(&mut process) {
                    return BasicResult {
                        success: false,
                        error: Some(to_error(error)),
                    };
                }
            }

            return BasicResult {
                success: true,
                error: None,
            };
        }

        if let Some(process) = guard.as_mut() {
            match process.try_wait() {
                Ok(None) => {
                    return BasicResult {
                        success: true,
                        error: None,
                    };
                }
                Ok(Some(_)) => {
                    *guard = None;
                }
                Err(error) => {
                    return BasicResult {
                        success: false,
                        error: Some(to_error(error)),
                    };
                }
            }
        }

        let process_id = std::process::id().to_string();
        let child = match Command::new("/usr/bin/caffeinate")
            .args(["-d", "-w", process_id.as_str()])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
        {
            Ok(value) => value,
            Err(error) => {
                return BasicResult {
                    success: false,
                    error: Some(to_error(error)),
                };
            }
        };

        *guard = Some(child);

        return BasicResult {
            success: true,
            error: None,
        };
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = keep_awake_manager;
        let _ = enabled;
        BasicResult {
            success: true,
            error: None,
        }
    }
}
