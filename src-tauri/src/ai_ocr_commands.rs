use serde::Deserialize;
use tauri::{ipc::Channel, AppHandle, Manager, State};

use crate::ai_job_manager::{OmrJob, OmrJobManager, OmrRawResult};
use crate::ai_provider::{self, DownloadProgress, ModelStatus, ProviderStatus};
use crate::now_ms;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OmrOptions {
    tuning: Option<String>,
    instrument: Option<String>,
    language: Option<String>,
    max_new_tokens: Option<u32>,
    preprocess: Option<String>,
    invert: Option<bool>,
}

impl From<&OmrOptions> for ai_provider::OmrOptions {
    fn from(options: &OmrOptions) -> Self {
        Self {
            tuning: options.tuning.clone(),
            instrument: options.instrument.clone(),
            language: options.language.clone(),
            max_new_tokens: options.max_new_tokens,
            preprocess: options.preprocess.clone(),
            invert: options.invert,
        }
    }
}

#[tauri::command]
pub(crate) async fn get_model_status(app: AppHandle) -> Result<ModelStatus, String> {
    let _ = app;
    Ok(ai_provider::get_model_status().await)
}

#[tauri::command]
pub(crate) async fn download_model(
    app: AppHandle,
    version: String,
    on_progress: Channel<DownloadProgress>,
) -> Result<(), String> {
    let _ = app;
    ai_provider::download_model(version, on_progress).await
}

#[tauri::command]
pub(crate) async fn omr_transcribe(
    app: AppHandle,
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

    let job_id = jobs.start_job()?;

    let app_for_task = app.clone();
    let job_id_for_task = job_id.clone();
    let image_for_task = image_base64.trim().to_string();
    let options_for_task = options.clone();
    tauri::async_runtime::spawn(async move {
        let job_state = app_for_task.state::<OmrJobManager>();
        let started_at = now_ms();

        let result = async {
            if job_state.is_cancelled(&job_id_for_task) {
                return Err("omr-cancelled".to_string());
            }
            request_omr(&image_for_task, options_for_task.as_ref(), started_at).await
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
    job_id: String,
) -> Result<(), String> {
    jobs.cancel_job(&job_id)?;
    Ok(())
}

#[tauri::command]
pub(crate) async fn get_sidecar_status() -> Result<ProviderStatus, String> {
    Ok(ai_provider::provider_status().await)
}

#[tauri::command]
pub(crate) async fn stop_sidecar() -> Result<(), String> {
    Err("provider-managed-externally".to_string())
}

#[tauri::command]
pub(crate) async fn restart_sidecar() -> Result<(), String> {
    let config = ai_provider::provider_config()?;
    ai_provider::check_provider_health(&config)
        .await
        .map(|_| ())
}

async fn request_omr(
    image_base64: &str,
    options: Option<&OmrOptions>,
    started_at: u64,
) -> Result<OmrRawResult, String> {
    let config = ai_provider::provider_config()?;
    let provider_options = options.map(ai_provider::OmrOptions::from);
    let provider_result =
        ai_provider::transcribe_with_provider(&config, image_base64, provider_options.as_ref())
            .await?;

    Ok(OmrRawResult {
        alpha_tex: provider_result.alpha_tex,
        raw_response: provider_result.raw_response,
        tokens_used: provider_result.tokens_used,
        duration_ms: provider_result
            .duration_ms
            .unwrap_or_else(|| now_ms().saturating_sub(started_at)),
    })
}
