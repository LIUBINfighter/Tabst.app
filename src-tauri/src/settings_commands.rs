use serde_json::Value;

use crate::{
    global_metadata_dir, read_json_file, write_json_file, GlobalSettingsLoadResponse, SaveResult,
};

#[tauri::command]
pub(crate) fn load_global_settings() -> GlobalSettingsLoadResponse {
    let metadata_dir = match global_metadata_dir() {
        Ok(value) => value,
        Err(error) => {
            return GlobalSettingsLoadResponse {
                success: false,
                data: None,
                error: Some(error),
            };
        }
    };

    let settings_path = metadata_dir.join("settings.json");
    match read_json_file::<Value>(&settings_path) {
        Ok(Some(data)) => GlobalSettingsLoadResponse {
            success: true,
            data: Some(data),
            error: None,
        },
        Ok(None) => GlobalSettingsLoadResponse {
            success: true,
            data: Some(Value::Object(Default::default())),
            error: None,
        },
        Err(error) => GlobalSettingsLoadResponse {
            success: false,
            data: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub(crate) fn save_global_settings(settings: Value) -> SaveResult {
    let metadata_dir = match global_metadata_dir() {
        Ok(value) => value,
        Err(error) => {
            return SaveResult {
                success: false,
                error: Some(error),
            };
        }
    };

    let settings_path = metadata_dir.join("settings.json");
    match write_json_file(&settings_path, &settings) {
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
