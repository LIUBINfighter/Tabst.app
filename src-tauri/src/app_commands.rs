use std::time::Duration;

use crate::{to_error, BasicResult};

/// 重启应用：spawn 当前可执行文件的新实例，然后退出当前进程。
///
/// 用于恢复 macOS 显示器/系统睡眠后失效的 WKWebView 音频输出（页面内
/// 无法修复）。工作区状态由 autosave 与会话恢复机制还原。
#[tauri::command]
pub(crate) fn restart_app(app: tauri::AppHandle) -> BasicResult {
    let exe = match std::env::current_exe() {
        Ok(path) => path,
        Err(error) => {
            return BasicResult {
                success: false,
                error: Some(to_error(error)),
            };
        }
    };

    let args: Vec<String> = std::env::args().skip(1).collect();

    let child = std::process::Command::new(&exe).args(&args).spawn();
    match child {
        Ok(_) => {
            let handle = app.clone();
            std::thread::spawn(move || {
                // 给新实例一点启动时间，避免音频资源竞争
                std::thread::sleep(Duration::from_millis(400));
                handle.exit(0);
            });
            BasicResult {
                success: true,
                error: None,
            }
        }
        Err(error) => BasicResult {
            success: false,
            error: Some(to_error(error)),
        },
    }
}
