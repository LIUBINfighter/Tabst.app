use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};

use rfd::FileDialog;
use serde_json::{Map, Value};
use tauri::{AppHandle, Manager};

use crate::{
    load_settings_json, normalize_non_empty_path, register_allowed_file, save_settings_json,
    ExternalSoundFontSelection, ExternalSoundFontSettingsResponse, SaveResult,
};

const EXTERNAL_TOOLS_KEY: &str = "externalTools";
const EXTERNAL_SOUNDFONT_PATH_KEY: &str = "externalSoundFontPath";
const MAX_SOUNDFONT_BYTES: u64 = 512 * 1024 * 1024;
const RIFF_MAGIC: &[u8; 4] = b"RIFF";
const SFBK_MAGIC: &[u8; 4] = b"sfbk";

#[derive(Debug)]
struct SoundFontFileMeta {
    canonical: PathBuf,
    name: String,
    size: u64,
    format: String,
}

fn soundfont_format(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_str()?;
    let lower = extension.to_ascii_lowercase();
    if lower == "sf2" || lower == "sf3" {
        Some(lower)
    } else {
        None
    }
}

fn exceeds_max_size(size: u64) -> bool {
    size > MAX_SOUNDFONT_BYTES
}

fn validate_soundfont_file(path: &Path) -> Result<SoundFontFileMeta, String> {
    let canonical = fs::canonicalize(path).map_err(|_| "soundfont-not-found".to_string())?;
    if !canonical.is_file() {
        return Err("soundfont-not-a-file".to_string());
    }
    let format =
        soundfont_format(&canonical).ok_or_else(|| "soundfont-unsupported-format".to_string())?;
    let size = fs::metadata(&canonical)
        .map_err(|_| "soundfont-unreadable".to_string())?
        .len();
    if exceeds_max_size(size) {
        return Err("soundfont-too-large".to_string());
    }

    let mut file = fs::File::open(&canonical).map_err(|_| "soundfont-unreadable".to_string())?;
    let mut header = [0u8; 12];
    file.read_exact(&mut header)
        .map_err(|_| "soundfont-invalid-header".to_string())?;
    if &header[0..4] != RIFF_MAGIC || &header[8..12] != SFBK_MAGIC {
        return Err("soundfont-invalid-header".to_string());
    }

    let name = canonical
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| canonical.to_string_lossy().to_string());
    Ok(SoundFontFileMeta {
        canonical,
        name,
        size,
        format,
    })
}

fn authorize_soundfont(app: &AppHandle, canonical: &Path) {
    let _ = register_allowed_file(canonical);
    #[cfg(any(target_os = "macos", target_os = "windows", target_os = "linux"))]
    {
        let _ = app.asset_protocol_scope().allow_file(canonical);
    }
}

fn configured_external_soundfont_path() -> Result<Option<String>, String> {
    let settings = load_settings_json()?;
    Ok(settings
        .get(EXTERNAL_TOOLS_KEY)
        .and_then(Value::as_object)
        .and_then(|tools| tools.get(EXTERNAL_SOUNDFONT_PATH_KEY))
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|path| !path.is_empty())
        .map(ToOwned::to_owned))
}

fn save_configured_external_soundfont(path: Option<&str>) -> Result<(), String> {
    let mut settings = load_settings_json()?;
    let tools = settings
        .entry(EXTERNAL_TOOLS_KEY.to_string())
        .or_insert_with(|| Value::Object(Map::new()));
    if !tools.is_object() {
        *tools = Value::Object(Map::new());
    }

    let tools = tools
        .as_object_mut()
        .ok_or_else(|| "invalid-external-tools-settings".to_string())?;
    match path.map(str::trim).filter(|path| !path.is_empty()) {
        Some(value) => {
            tools.insert(
                EXTERNAL_SOUNDFONT_PATH_KEY.to_string(),
                Value::String(value.to_string()),
            );
        }
        None => {
            tools.remove(EXTERNAL_SOUNDFONT_PATH_KEY);
        }
    }

    save_settings_json(&settings)
}

fn settings_response(
    success: bool,
    configured: bool,
    valid: bool,
    error: Option<String>,
) -> ExternalSoundFontSettingsResponse {
    ExternalSoundFontSettingsResponse {
        success,
        configured,
        valid,
        path: None,
        name: None,
        size: None,
        format: None,
        error,
    }
}

fn settings_response_for_meta(meta: SoundFontFileMeta) -> ExternalSoundFontSettingsResponse {
    ExternalSoundFontSettingsResponse {
        success: true,
        configured: true,
        valid: true,
        path: Some(meta.canonical.to_string_lossy().into_owned()),
        name: Some(meta.name),
        size: Some(meta.size),
        format: Some(meta.format),
        error: None,
    }
}

#[tauri::command]
pub(crate) fn select_soundfont_file(app: AppHandle) -> Option<ExternalSoundFontSelection> {
    let selected = FileDialog::new()
        .add_filter("SoundFont", &["sf2", "sf3"])
        .pick_file()?;

    match validate_soundfont_file(&selected) {
        Ok(meta) => {
            authorize_soundfont(&app, &meta.canonical);
            Some(ExternalSoundFontSelection {
                path: meta.canonical.to_string_lossy().into_owned(),
                name: meta.name,
                size: meta.size,
                format: meta.format,
                valid: true,
                error: None,
            })
        }
        Err(error) => {
            let canonical = fs::canonicalize(&selected).unwrap_or(selected);
            let name = canonical
                .file_name()
                .map(|value| value.to_string_lossy().to_string())
                .unwrap_or_else(|| canonical.to_string_lossy().to_string());
            Some(ExternalSoundFontSelection {
                path: canonical.to_string_lossy().into_owned(),
                name,
                size: fs::metadata(&canonical).map(|meta| meta.len()).unwrap_or(0),
                format: soundfont_format(&canonical).unwrap_or_else(|| "unknown".to_string()),
                valid: false,
                error: Some(error),
            })
        }
    }
}

#[tauri::command]
pub(crate) fn save_external_soundfont_path(
    app: AppHandle,
    path: String,
) -> ExternalSoundFontSettingsResponse {
    let Some(normalized) = normalize_non_empty_path(&path) else {
        return settings_response(false, false, false, Some("invalid-path".to_string()));
    };

    match validate_soundfont_file(&normalized) {
        Ok(meta) => {
            authorize_soundfont(&app, &meta.canonical);
            match save_configured_external_soundfont(Some(
                meta.canonical.to_string_lossy().as_ref(),
            )) {
                Ok(()) => settings_response_for_meta(meta),
                Err(error) => settings_response(false, false, false, Some(error)),
            }
        }
        Err(error) => settings_response(false, false, false, Some(error)),
    }
}

#[tauri::command]
pub(crate) fn load_external_soundfont_settings(
    app: AppHandle,
) -> ExternalSoundFontSettingsResponse {
    let configured_path = match configured_external_soundfont_path() {
        Ok(value) => value,
        Err(error) => return settings_response(false, false, false, Some(error)),
    };

    let Some(path) = configured_path else {
        return settings_response(true, false, false, None);
    };

    match validate_soundfont_file(&PathBuf::from(&path)) {
        Ok(meta) => {
            authorize_soundfont(&app, &meta.canonical);
            settings_response_for_meta(meta)
        }
        Err(error) => ExternalSoundFontSettingsResponse {
            success: true,
            configured: true,
            valid: false,
            path: Some(path),
            error: Some(error),
            ..settings_response(false, false, false, None)
        },
    }
}

#[tauri::command]
pub(crate) fn clear_external_soundfont() -> SaveResult {
    match save_configured_external_soundfont(None) {
        Ok(()) => SaveResult {
            success: true,
            error: None,
        },
        Err(error) => SaveResult {
            success: false,
            error: Some(error),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_helpers::{temp_dir_for, with_temp_home};

    fn write_soundfont(path: &Path) {
        fs::write(path, b"RIFF\x00\x00\x00\x00sfbk").expect("write soundfont header");
    }

    #[test]
    fn rejects_files_without_sfbk_header() {
        let dir = temp_dir_for("soundfont", "bad-header");
        let file = dir.join("fake.sf2");
        fs::write(&file, b"NOT a soundfont at all").expect("write file");

        let result = validate_soundfont_file(&file);
        assert_eq!(result.unwrap_err(), "soundfont-invalid-header");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_unsupported_extensions() {
        let dir = temp_dir_for("soundfont", "bad-extension");
        let file = dir.join("notes.txt");
        write_soundfont(&file);

        let result = validate_soundfont_file(&file);
        assert_eq!(result.unwrap_err(), "soundfont-unsupported-format");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_missing_files() {
        let dir = temp_dir_for("soundfont", "missing");
        let file = dir.join("gone.sf2");

        let result = validate_soundfont_file(&file);
        assert_eq!(result.unwrap_err(), "soundfont-not-found");
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn accepts_sf2_and_sf3_with_riff_sfbk_header() {
        for extension in ["sf2", "sf3"] {
            let dir = temp_dir_for("soundfont", &format!("valid-{extension}"));
            let file = dir.join(format!("sample.{extension}"));
            write_soundfont(&file);

            let meta = validate_soundfont_file(&file).expect("should validate");
            assert_eq!(meta.format, extension);
            assert_eq!(meta.size, 12);
            assert!(meta.canonical.is_file());
            let _ = fs::remove_dir_all(&dir);
        }
    }

    #[test]
    fn soundfont_settings_round_trip_with_configured_and_cleared() {
        with_temp_home("soundfont", "round-trip", |home_dir| {
            let font_dir = home_dir.join("fonts");
            fs::create_dir_all(&font_dir).expect("create fonts dir");
            let font_file = font_dir.join("external.sf2");
            write_soundfont(&font_file);

            let configured = validate_soundfont_file(&font_file).expect("validate");
            save_configured_external_soundfont(Some(configured.canonical.to_str().unwrap()))
                .expect("save should succeed");

            let loaded = configured_external_soundfont_path()
                .expect("load settings")
                .expect("path should be configured");
            assert_eq!(loaded, configured.canonical.to_str().unwrap());

            save_configured_external_soundfont(None).expect("clear should succeed");
            assert!(configured_external_soundfont_path()
                .expect("load settings")
                .is_none());
        });
    }

    #[test]
    fn missing_configured_file_reports_unreadable_configuration() {
        with_temp_home("soundfont", "missing-configured", |home_dir| {
            let missing = home_dir.join("deleted.sf2");
            save_configured_external_soundfont(Some(missing.to_str().unwrap()))
                .expect("save should succeed");

            let result = validate_soundfont_file(&PathBuf::from(
                configured_external_soundfont_path()
                    .expect("load settings")
                    .expect("path configured"),
            ));
            assert_eq!(result.unwrap_err(), "soundfont-not-found");
        });
    }

    #[test]
    fn too_large_soundfont_is_rejected_by_size_limit() {
        assert!(!exceeds_max_size(MAX_SOUNDFONT_BYTES));
        assert!(exceeds_max_size(MAX_SOUNDFONT_BYTES + 1));
        assert!(exceeds_max_size(u64::MAX));
    }
}
