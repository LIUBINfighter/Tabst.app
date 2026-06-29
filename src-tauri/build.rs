use std::env;
use std::fs;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=tauri.conf.json");

    if cfg!(target_os = "windows") {
        let manifest_dir = env::var("CARGO_MANIFEST_DIR").expect("manifest dir");
        let frontend_dist = Path::new(&manifest_dir)
            .parent()
            .expect("workspace root")
            .join("dist");
        let _ = fs::create_dir_all(&frontend_dist);

        env::set_var(
            "TAURI_CONFIG",
            serde_json::json!({
                "bundle": {
                    "externalBin": null
                }
            })
            .to_string(),
        );
    }

    tauri_build::build();
}
