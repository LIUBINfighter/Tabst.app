use std::time::Duration;

use serde::Deserialize;
use serde_json::json;
use tauri::{ipc::Channel, AppHandle, Manager, State};

use crate::ai_job_manager::{OmrJob, OmrJobManager, OmrRawResult};
use crate::ai_model_manager::{self, DownloadProgress, ModelStatus};
use crate::ai_sidecar::{LlamaServerState, SidecarStatus};
use crate::{now_ms, to_error};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OmrOptions {}

#[derive(Debug, Deserialize)]
struct CompletionResponse {
    content: String,
    tokens_predicted: Option<u64>,
    tokens_evaluated: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct ErrorResponse {
    error: Option<ErrorDetail>,
}

#[derive(Debug, Deserialize)]
struct ErrorDetail {
    message: String,
}

#[tauri::command]
pub(crate) async fn get_model_status(app: AppHandle) -> Result<ModelStatus, String> {
    Ok(ai_model_manager::get_model_status(&app).await)
}

#[tauri::command]
pub(crate) async fn download_model(
    app: AppHandle,
    version: String,
    on_progress: Channel<DownloadProgress>,
) -> Result<(), String> {
    ai_model_manager::download_model(&app, version, on_progress).await
}

#[tauri::command]
pub(crate) async fn omr_transcribe(
    app: AppHandle,
    sidecar: State<'_, LlamaServerState>,
    jobs: State<'_, OmrJobManager>,
    image_base64: String,
    options: Option<OmrOptions>,
) -> Result<String, String> {
    if image_base64.trim().is_empty() {
        return Err("clipboard-no-image".to_string());
    }
    if image_base64.len() > 14 * 1024 * 1024 {
        return Err("image-too-large".to_string());
    }

    let model = ai_model_manager::ensure_model_cached(&app).await?;
    let job_id = jobs.start_job()?;
    sidecar.set_busy(Some(job_id.clone()));

    let app_for_task = app.clone();
    let job_id_for_task = job_id.clone();
    let image_for_task = image_base64.trim().to_string();
    let options_for_task = options.clone();
    tauri::async_runtime::spawn(async move {
        let sidecar_state = app_for_task.state::<LlamaServerState>();
        let job_state = app_for_task.state::<OmrJobManager>();
        let started_at = now_ms();

        let result = async {
            let port = sidecar_state
                .ensure_server_running(&app_for_task, &model)
                .await?;
            if job_state.is_cancelled(&job_id_for_task) {
                return Err("omr-cancelled".to_string());
            }
            request_omr(port, &image_for_task, options_for_task.as_ref(), started_at).await
        }
        .await;

        match result {
            Ok(raw_result) => {
                let _ = job_state.complete_job(&job_id_for_task, raw_result);
            }
            Err(error) => {
                let _ = job_state.fail_job(&job_id_for_task, error);
            }
        }
        sidecar_state.set_busy(None);
        sidecar_state.schedule_idle_shutdown(app_for_task.clone());
    });

    Ok(job_id)
}

#[tauri::command]
pub(crate) async fn get_omr_result(
    jobs: State<'_, OmrJobManager>,
    job_id: String,
) -> Result<OmrJob, String> {
    jobs.get_job(&job_id)
}

#[tauri::command]
pub(crate) async fn cancel_omr_job(
    jobs: State<'_, OmrJobManager>,
    sidecar: State<'_, LlamaServerState>,
    job_id: String,
) -> Result<(), String> {
    jobs.cancel_job(&job_id)?;
    sidecar.stop();
    Ok(())
}

#[tauri::command]
pub(crate) async fn get_sidecar_status(
    sidecar: State<'_, LlamaServerState>,
) -> Result<SidecarStatus, String> {
    Ok(sidecar.status())
}

#[tauri::command]
pub(crate) async fn stop_sidecar(sidecar: State<'_, LlamaServerState>) -> Result<(), String> {
    sidecar.stop_when_idle()
}

#[tauri::command]
pub(crate) async fn restart_sidecar(
    app: AppHandle,
    sidecar: State<'_, LlamaServerState>,
) -> Result<(), String> {
    sidecar.stop_when_idle()?;
    let model = ai_model_manager::ensure_model_cached(&app).await?;
    sidecar
        .ensure_server_running(&app, &model)
        .await
        .map(|_| ())?;
    sidecar.schedule_idle_shutdown(app);
    Ok(())
}

async fn request_omr(
    port: u16,
    image_base64: &str,
    _options: Option<&OmrOptions>,
    started_at: u64,
) -> Result<OmrRawResult, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(to_error)?;
    let response = client
        .post(format!("http://127.0.0.1:{port}/completions"))
        .json(&json!({
            "prompt": {
                "prompt_string": "<__media__>",
                "multimodal_data": [image_base64]
            },
            "temperature": 0.1,
            "n_predict": 2048,
            "stream": false
        }))
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                "omr-timeout".to_string()
            } else {
                format!("omr-request-failed: {error}")
            }
        })?;

    let status = response.status();
    let raw_response = response.text().await.map_err(to_error)?;
    if !status.is_success() {
        return Err(format!(
            "omr-request-failed: {status}: {}",
            parse_error_message(&raw_response)
        ));
    }

    let parsed: CompletionResponse =
        serde_json::from_str(&raw_response).map_err(|_| "omr-invalid-response".to_string())?;
    let alpha_tex = Some(parsed.content.clone())
        .filter(|content| !content.trim().is_empty())
        .ok_or_else(|| "omr-invalid-response".to_string())?;

    Ok(OmrRawResult {
        alpha_tex,
        raw_response,
        tokens_used: parsed
            .tokens_predicted
            .unwrap_or(0)
            .saturating_add(parsed.tokens_evaluated.unwrap_or(0)),
        duration_ms: now_ms().saturating_sub(started_at),
    })
}

fn parse_error_message(raw_response: &str) -> String {
    let message = serde_json::from_str::<ErrorResponse>(raw_response)
        .ok()
        .and_then(|response| response.error.map(|error| error.message))
        .unwrap_or_else(|| raw_response.trim().to_string());
    message.chars().take(240).collect()
}
