use std::net::{SocketAddr, TcpListener};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use tauri::Manager;
use tauri_plugin_shell::{process::CommandChild, ShellExt};

use crate::ai_model_manager::CachedModelPaths;

const IDLE_TIMEOUT: Duration = Duration::from_secs(5 * 60);

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum SidecarState {
    Stopped,
    Starting,
    Ready,
    Busy,
    Stopping,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SidecarStatus {
    pub(crate) state: SidecarState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) current_job_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) last_error: Option<String>,
}

#[derive(Default)]
pub(crate) struct LlamaServerState {
    inner: Mutex<LlamaServerInner>,
}

#[derive(Default)]
struct LlamaServerInner {
    state: Option<SidecarState>,
    port: Option<u16>,
    child: Option<CommandChild>,
    current_job_id: Option<String>,
    last_error: Option<String>,
    idle_token: u64,
}

impl LlamaServerState {
    pub(crate) fn status(&self) -> SidecarStatus {
        let Ok(inner) = self.inner.lock() else {
            return SidecarStatus {
                state: SidecarState::Failed,
                current_job_id: None,
                last_error: Some("sidecar-lock-failed".to_string()),
            };
        };
        SidecarStatus {
            state: inner.state.clone().unwrap_or(SidecarState::Stopped),
            current_job_id: inner.current_job_id.clone(),
            last_error: inner.last_error.clone(),
        }
    }

    pub(crate) fn set_busy(&self, job_id: Option<String>) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.current_job_id = job_id.clone();
            if job_id.is_none() && matches!(inner.state, Some(SidecarState::Failed)) {
                return;
            }
            inner.state = Some(if job_id.is_some() {
                SidecarState::Busy
            } else if inner.child.is_some() {
                SidecarState::Ready
            } else {
                SidecarState::Stopped
            });
        }
    }

    pub(crate) async fn ensure_server_running<R: tauri::Runtime>(
        &self,
        app: &tauri::AppHandle<R>,
        model: &CachedModelPaths,
    ) -> Result<u16, String> {
        if let Some(port) = self.ready_port()? {
            return Ok(port);
        }

        let port = random_local_port()?;
        {
            let mut inner = self
                .inner
                .lock()
                .map_err(|_| "sidecar-lock-failed".to_string())?;
            inner.state = Some(SidecarState::Starting);
            inner.last_error = None;
        }

        let mut command = app
            .shell()
            .sidecar("llama-server")
            .map_err(|error| format!("sidecar-start-failed: {error}"))?
            .env("LLAMA_MEDIA_MARKER", "<__media__>")
            .args([
                "-m".to_string(),
                model.model_path.to_string_lossy().to_string(),
                "--port".to_string(),
                port.to_string(),
                "--host".to_string(),
                "127.0.0.1".to_string(),
                "-np".to_string(),
                model
                    .manifest
                    .llama_server_args
                    .as_ref()
                    .and_then(|args| args.np)
                    .unwrap_or(1)
                    .to_string(),
                "--ctx-size".to_string(),
                model
                    .manifest
                    .llama_server_args
                    .as_ref()
                    .and_then(|args| args.ctx_size)
                    .unwrap_or(4096)
                    .to_string(),
            ]);
        command = command.args([
            "--mmproj".to_string(),
            model.mmproj_path.to_string_lossy().to_string(),
        ]);

        let (mut rx, child) = command
            .spawn()
            .map_err(|error| format!("sidecar-start-failed: {error}"))?;
        let pid = child.pid();
        {
            let mut inner = self
                .inner
                .lock()
                .map_err(|_| "sidecar-lock-failed".to_string())?;
            inner.child = Some(child);
            inner.port = Some(port);
        }

        let app_for_monitor = app.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                if matches!(
                    event,
                    tauri_plugin_shell::process::CommandEvent::Terminated(_)
                ) {
                    app_for_monitor
                        .state::<LlamaServerState>()
                        .mark_failed(pid, "sidecar-crashed".to_string());
                    break;
                }
            }
        });

        if health_check(port, Duration::from_secs(30)).await {
            let mut inner = self
                .inner
                .lock()
                .map_err(|_| "sidecar-lock-failed".to_string())?;
            inner.state = Some(if inner.current_job_id.is_some() {
                SidecarState::Busy
            } else {
                SidecarState::Ready
            });
            return Ok(port);
        }

        self.stop();
        self.set_failed("sidecar-timeout".to_string());
        Err("sidecar-timeout".to_string())
    }

    pub(crate) fn stop(&self) {
        let child = {
            let Ok(mut inner) = self.inner.lock() else {
                return;
            };
            inner.state = Some(SidecarState::Stopping);
            inner.port = None;
            inner.current_job_id = None;
            inner.idle_token = inner.idle_token.saturating_add(1);
            inner.child.take()
        };
        if let Some(child) = child {
            let _ = child.kill();
        }
        if let Ok(mut inner) = self.inner.lock() {
            inner.state = Some(SidecarState::Stopped);
        }
    }

    pub(crate) fn schedule_idle_shutdown<R: tauri::Runtime>(&self, app: tauri::AppHandle<R>) {
        let token = {
            let Ok(mut inner) = self.inner.lock() else {
                return;
            };
            if inner.child.is_none() || inner.current_job_id.is_some() {
                return;
            }
            inner.state = Some(SidecarState::Ready);
            inner.idle_token = inner.idle_token.saturating_add(1);
            inner.idle_token
        };

        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(IDLE_TIMEOUT).await;
            app.state::<LlamaServerState>().stop_if_idle(token);
        });
    }

    fn ready_port(&self) -> Result<Option<u16>, String> {
        let inner = self
            .inner
            .lock()
            .map_err(|_| "sidecar-lock-failed".to_string())?;
        if inner.child.is_some()
            && matches!(
                inner.state,
                Some(SidecarState::Ready) | Some(SidecarState::Busy)
            )
        {
            return Ok(inner.port);
        }
        Ok(None)
    }

    fn mark_failed(&self, pid: u32, error: String) {
        let Ok(mut inner) = self.inner.lock() else {
            return;
        };
        let child_matches = inner.child.as_ref().map(|child| child.pid()) == Some(pid);
        if child_matches {
            inner.state = Some(SidecarState::Failed);
            inner.port = None;
            inner.child = None;
            inner.current_job_id = None;
            inner.idle_token = inner.idle_token.saturating_add(1);
            inner.last_error = Some(error);
        }
    }

    fn set_failed(&self, error: String) {
        let Ok(mut inner) = self.inner.lock() else {
            return;
        };
        inner.state = Some(SidecarState::Failed);
        inner.port = None;
        inner.child = None;
        inner.current_job_id = None;
        inner.idle_token = inner.idle_token.saturating_add(1);
        inner.last_error = Some(error);
    }

    fn stop_if_idle(&self, token: u64) {
        let should_stop = {
            let Ok(inner) = self.inner.lock() else {
                return;
            };
            inner.idle_token == token
                && inner.child.is_some()
                && inner.current_job_id.is_none()
                && matches!(inner.state, Some(SidecarState::Ready))
        };
        if should_stop {
            self.stop();
        }
    }
}

impl Drop for LlamaServerState {
    fn drop(&mut self) {
        if let Ok(mut inner) = self.inner.lock() {
            if let Some(child) = inner.child.take() {
                let _ = child.kill();
            }
        }
    }
}

fn random_local_port() -> Result<u16, String> {
    let listener = TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
        .map_err(|error| format!("sidecar-start-failed: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("sidecar-start-failed: {error}"))?
        .port();
    Ok(port)
}

async fn health_check(port: u16, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;
    let client = reqwest::Client::new();
    let url = format!("http://127.0.0.1:{port}/health");

    while Instant::now() < deadline {
        if let Ok(response) = client.get(&url).send().await {
            if response.status().is_success() {
                return true;
            }
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    false
}
