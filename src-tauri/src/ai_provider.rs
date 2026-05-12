use std::env;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::ipc::Channel;

use crate::to_error;

const DEFAULT_ENDPOINT: &str = "http://127.0.0.1:18089";
const DEFAULT_MODEL_NAME: &str = "tabst-omr";
const DEFAULT_OPENAI_PROMPT: &str =
    "Transcribe this guitar tablature image to alphaTex. Return only alphaTex.";
const DEFAULT_REQUEST_TIMEOUT_SECS: u64 = 300;
const MIN_REQUEST_TIMEOUT_SECS: u64 = 30;
const MAX_PROVIDER_ERROR_CHARS: usize = 240;

const ENV_ENDPOINT: &str = "TABST_OMR_ENDPOINT";
const ENV_API_KIND: &str = "TABST_OMR_API_KIND";
const ENV_MODEL: &str = "TABST_OMR_MODEL";
const ENV_PROMPT: &str = "TABST_OMR_PROMPT";
const ENV_REQUEST_TIMEOUT_SECS: &str = "TABST_OMR_REQUEST_TIMEOUT_SECS";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ModelStatus {
    pub(crate) version: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) active_model: Option<String>,
    pub(crate) downloaded: bool,
    pub(crate) downloaded_bytes: u64,
    pub(crate) total_bytes: u64,
    pub(crate) checksum_verified: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DownloadProgress {
    pub(crate) phase: String,
    pub(crate) downloaded_bytes: u64,
    pub(crate) total_bytes: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) speed_bps: Option<u64>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ProviderState {
    Ready,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProviderStatus {
    pub(crate) state: ProviderState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) current_job_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) last_error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) resource_usage: Option<ProviderResourceUsage>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProviderResourceUsage {
    pub(crate) pid: u32,
    pub(crate) cpu_percent: f32,
    pub(crate) memory_bytes: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OmrOptions {
    pub(crate) tuning: Option<String>,
    pub(crate) instrument: Option<String>,
    pub(crate) language: Option<String>,
    pub(crate) max_new_tokens: Option<u32>,
    pub(crate) preprocess: Option<String>,
    pub(crate) invert: Option<bool>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum ProviderKind {
    Tabst,
    OpenAi,
    LlamaCpp,
}

#[derive(Debug, Clone)]
pub(crate) struct ProviderConfig {
    endpoint: String,
    kind: ProviderKind,
    model: String,
    prompt: String,
    timeout: Duration,
}

#[derive(Debug, Clone)]
pub(crate) struct ProviderOmrResult {
    pub(crate) alpha_tex: String,
    pub(crate) raw_response: String,
    pub(crate) tokens_used: u64,
    pub(crate) duration_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TabstTranscribeResponse {
    alpha_tex: Option<String>,
    raw_response: Option<Value>,
    #[serde(alias = "tokensUsed")]
    tokens_used: Option<u64>,
    #[serde(alias = "durationMs")]
    duration_ms: Option<u64>,
}

#[derive(Debug, Clone)]
pub(crate) struct ProviderHealth {
    pub(crate) active_model: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TabstHealthResponse {
    ready: Option<bool>,
    active_model: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LlamaCompletionResponse {
    content: String,
    tokens_predicted: Option<u64>,
    tokens_evaluated: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct OpenAiChatResponse {
    choices: Vec<OpenAiChoice>,
    usage: Option<OpenAiUsage>,
}

#[derive(Debug, Deserialize)]
struct OpenAiChoice {
    message: OpenAiMessage,
}

#[derive(Debug, Deserialize)]
struct OpenAiMessage {
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OpenAiUsage {
    prompt_tokens: Option<u64>,
    completion_tokens: Option<u64>,
    total_tokens: Option<u64>,
}

pub(crate) fn provider_config() -> Result<ProviderConfig, String> {
    Ok(ProviderConfig {
        endpoint: env::var(ENV_ENDPOINT)
            .ok()
            .map(|value| value.trim().trim_end_matches('/').to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| DEFAULT_ENDPOINT.to_string()),
        kind: parse_provider_kind(env::var(ENV_API_KIND).ok().as_deref())?,
        model: env::var(ENV_MODEL)
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| DEFAULT_MODEL_NAME.to_string()),
        prompt: env::var(ENV_PROMPT)
            .ok()
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| DEFAULT_OPENAI_PROMPT.to_string()),
        timeout: request_timeout()?,
    })
}

pub(crate) async fn get_model_status() -> ModelStatus {
    let config = match provider_config() {
        Ok(config) => config,
        Err(error) => return provider_error_status(error),
    };
    match check_provider_health(&config).await {
        Ok(health) => ModelStatus {
            version: provider_version(&config),
            active_model: health.active_model.or_else(|| Some(config.model.clone())),
            downloaded: true,
            downloaded_bytes: 0,
            total_bytes: 0,
            checksum_verified: true,
            error: None,
        },
        Err(error) => provider_error_status(error),
    }
}

pub(crate) async fn download_model(
    _version: String,
    on_progress: Channel<DownloadProgress>,
) -> Result<(), String> {
    let _ = on_progress.send(DownloadProgress {
        phase: "complete".to_string(),
        downloaded_bytes: 0,
        total_bytes: 0,
        speed_bps: None,
    });
    let config = provider_config()?;
    check_provider_health(&config).await.map(|_| ())
}

pub(crate) async fn provider_status() -> ProviderStatus {
    let config = match provider_config() {
        Ok(config) => config,
        Err(error) => {
            return ProviderStatus {
                state: ProviderState::Failed,
                current_job_id: None,
                last_error: Some(error),
                resource_usage: None,
            }
        }
    };
    match check_provider_health(&config).await {
        Ok(_) => ProviderStatus {
            state: ProviderState::Ready,
            current_job_id: None,
            last_error: None,
            resource_usage: None,
        },
        Err(error) => ProviderStatus {
            state: ProviderState::Failed,
            current_job_id: None,
            last_error: Some(error),
            resource_usage: None,
        },
    }
}

pub(crate) async fn check_provider_health(
    config: &ProviderConfig,
) -> Result<ProviderHealth, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(to_error)?;
    let url = match config.kind {
        ProviderKind::Tabst | ProviderKind::LlamaCpp => {
            join_endpoint_url(&config.endpoint, "/health")
        }
        ProviderKind::OpenAi => join_endpoint_url(&config.endpoint, "/v1/models"),
    };
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|error| format!("provider-unavailable: {error}"))?;
    let status = response.status();
    let raw_response = response.text().await.map_err(to_error)?;
    if !status.is_success() {
        return Err(format!(
            "provider-unavailable: {status}: {}",
            truncate_for_error(&raw_response)
        ));
    }

    if config.kind == ProviderKind::Tabst {
        let health: TabstHealthResponse = serde_json::from_str(&raw_response)
            .map_err(|error| format!("provider-unavailable: invalid health response: {error}"))?;
        if health.ready != Some(true) {
            return Err("provider-unavailable: not ready".to_string());
        }
        return Ok(ProviderHealth {
            active_model: health
                .active_model
                .map(|model| model.trim().to_string())
                .filter(|model| !model.is_empty()),
        });
    }

    Ok(ProviderHealth {
        active_model: Some(config.model.clone()),
    })
}

pub(crate) async fn transcribe_with_provider(
    config: &ProviderConfig,
    image_base64: &str,
    options: Option<&OmrOptions>,
) -> Result<ProviderOmrResult, String> {
    match config.kind {
        ProviderKind::Tabst => transcribe_tabst(config, image_base64, options).await,
        ProviderKind::OpenAi => transcribe_openai(config, image_base64, options).await,
        ProviderKind::LlamaCpp => transcribe_llamacpp(config, image_base64).await,
    }
}

async fn transcribe_tabst(
    config: &ProviderConfig,
    image_base64: &str,
    options: Option<&OmrOptions>,
) -> Result<ProviderOmrResult, String> {
    let mut options_value = serde_json::to_value(options).map_err(to_error)?;
    if options_value.is_null() {
        options_value = json!({});
    }
    let body = json!({
        "imageBase64": image_base64,
        "options": options_value,
    });
    let raw_response = post_json(config, "/transcribe", body).await?;
    let parsed: TabstTranscribeResponse = serde_json::from_str(&raw_response)
        .map_err(|error| format!("provider-invalid-response: {error}"))?;
    let alpha_tex = parsed
        .alpha_tex
        .filter(|content| !content.trim().is_empty())
        .ok_or_else(|| "provider-invalid-response".to_string())?;
    Ok(ProviderOmrResult {
        alpha_tex,
        raw_response: parsed
            .raw_response
            .map(|value| value.to_string())
            .unwrap_or(raw_response),
        tokens_used: parsed.tokens_used.unwrap_or(0),
        duration_ms: parsed.duration_ms,
    })
}

async fn transcribe_openai(
    config: &ProviderConfig,
    image_base64: &str,
    _options: Option<&OmrOptions>,
) -> Result<ProviderOmrResult, String> {
    let body = json!({
        "model": config.model,
        "messages": [
            {
                "role": "user",
                "content": [
                    { "type": "text", "text": config.prompt },
                    {
                        "type": "image_url",
                        "image_url": { "url": format!("data:image/png;base64,{image_base64}") }
                    }
                ]
            }
        ],
        "temperature": 0,
        "stream": false
    });
    let raw_response = post_json(config, "/v1/chat/completions", body).await?;
    let parsed: OpenAiChatResponse = serde_json::from_str(&raw_response)
        .map_err(|error| format!("provider-invalid-response: {error}"))?;
    let alpha_tex = parsed
        .choices
        .first()
        .and_then(|choice| choice.message.content.clone())
        .filter(|content| !content.trim().is_empty())
        .ok_or_else(|| "provider-invalid-response".to_string())?;
    let tokens_used = parsed
        .usage
        .map(|usage| {
            usage.total_tokens.unwrap_or_else(|| {
                usage
                    .prompt_tokens
                    .unwrap_or(0)
                    .saturating_add(usage.completion_tokens.unwrap_or(0))
            })
        })
        .unwrap_or(0);
    Ok(ProviderOmrResult {
        alpha_tex,
        raw_response,
        tokens_used,
        duration_ms: None,
    })
}

async fn transcribe_llamacpp(
    config: &ProviderConfig,
    image_base64: &str,
) -> Result<ProviderOmrResult, String> {
    let raw_response = post_json(
        config,
        "/completions",
        json!({
            "prompt": {
                "prompt_string": "<__media__>",
                "multimodal_data": [image_base64]
            },
            "temperature": 0.1,
            "n_predict": 2048,
            "stream": false
        }),
    )
    .await?;
    let parsed: LlamaCompletionResponse =
        serde_json::from_str(&raw_response).map_err(|_| "provider-invalid-response".to_string())?;
    let alpha_tex = Some(parsed.content.clone())
        .filter(|content| !content.trim().is_empty())
        .ok_or_else(|| "provider-invalid-response".to_string())?;
    Ok(ProviderOmrResult {
        alpha_tex,
        raw_response,
        tokens_used: parsed
            .tokens_predicted
            .unwrap_or(0)
            .saturating_add(parsed.tokens_evaluated.unwrap_or(0)),
        duration_ms: None,
    })
}

async fn post_json(config: &ProviderConfig, path: &str, body: Value) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(config.timeout)
        .build()
        .map_err(to_error)?;
    let response = client
        .post(join_endpoint_url(&config.endpoint, path))
        .json(&body)
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                "omr-timeout".to_string()
            } else {
                format!("provider-request-failed: {error}")
            }
        })?;
    let status = response.status();
    let raw_response = response.text().await.map_err(to_error)?;
    if status.is_success() {
        Ok(raw_response)
    } else {
        Err(format!(
            "provider-request-failed: {status}: {}",
            truncate_for_error(&raw_response)
        ))
    }
}

fn truncate_for_error(raw_response: &str) -> String {
    let message = raw_response.trim();
    let mut truncated = message
        .chars()
        .take(MAX_PROVIDER_ERROR_CHARS)
        .collect::<String>();
    if message.chars().count() > MAX_PROVIDER_ERROR_CHARS {
        truncated.push('…');
    }
    truncated
}

fn provider_error_status(error: String) -> ModelStatus {
    ModelStatus {
        version: provider_version_from_env(),
        active_model: None,
        downloaded: false,
        downloaded_bytes: 0,
        total_bytes: 0,
        checksum_verified: false,
        error: Some(error),
    }
}

fn provider_version(config: &ProviderConfig) -> String {
    format!("{}@{}", provider_kind_name(&config.kind), config.endpoint)
}

fn provider_version_from_env() -> String {
    provider_config()
        .map(|config| provider_version(&config))
        .unwrap_or_else(|_| "http-provider".to_string())
}

fn provider_kind_name(kind: &ProviderKind) -> &'static str {
    match kind {
        ProviderKind::Tabst => "tabst-http",
        ProviderKind::OpenAi => "openai-http",
        ProviderKind::LlamaCpp => "llamacpp-http",
    }
}

fn parse_provider_kind(value: Option<&str>) -> Result<ProviderKind, String> {
    match value.unwrap_or("tabst").trim().to_lowercase().as_str() {
        "" | "tabst" | "tabst-http" | "http" => Ok(ProviderKind::Tabst),
        "openai" | "openai-http" | "lmstudio" | "lm-studio" => Ok(ProviderKind::OpenAi),
        "llamacpp" | "llama.cpp" | "llama" => Ok(ProviderKind::LlamaCpp),
        _ => Err("provider-kind-invalid".to_string()),
    }
}

fn request_timeout() -> Result<Duration, String> {
    let Ok(value) = env::var(ENV_REQUEST_TIMEOUT_SECS) else {
        return Ok(Duration::from_secs(DEFAULT_REQUEST_TIMEOUT_SECS));
    };
    let seconds = value
        .trim()
        .parse::<u64>()
        .map_err(|_| "omr-timeout-config-invalid".to_string())?;
    if seconds < MIN_REQUEST_TIMEOUT_SECS {
        return Err("omr-timeout-config-invalid".to_string());
    }
    Ok(Duration::from_secs(seconds))
}

fn join_endpoint_url(endpoint: &str, path: &str) -> String {
    format!("{}{}", endpoint.trim_end_matches('/'), path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_provider_kind_aliases() {
        assert_eq!(parse_provider_kind(None).unwrap(), ProviderKind::Tabst);
        assert_eq!(
            parse_provider_kind(Some("lm-studio")).unwrap(),
            ProviderKind::OpenAi
        );
        assert_eq!(
            parse_provider_kind(Some("llama.cpp")).unwrap(),
            ProviderKind::LlamaCpp
        );
        assert!(parse_provider_kind(Some("bad-kind")).is_err());
    }

    #[test]
    fn joins_endpoint_urls_without_double_slashes() {
        assert_eq!(
            join_endpoint_url("http://127.0.0.1:18089/", "/transcribe"),
            "http://127.0.0.1:18089/transcribe"
        );
        assert_eq!(
            join_endpoint_url("http://127.0.0.1:18089", "/health"),
            "http://127.0.0.1:18089/health"
        );
    }

    #[test]
    fn truncates_provider_errors() {
        let raw = "x".repeat(MAX_PROVIDER_ERROR_CHARS + 10);
        let truncated = truncate_for_error(&raw);
        assert_eq!(truncated.chars().count(), MAX_PROVIDER_ERROR_CHARS + 1);
        assert!(truncated.ends_with('…'));
    }
}
