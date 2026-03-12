# Tauri Auto Update Operations

## Current release/update policy

Tabst now uses the Tauri updater on desktop platforms.

### Release creation flow

1. Push a release tag using the semver scheme without a `v` prefix:
   - stable: `0.6.8`
   - beta: `0.6.8-beta.1`
   - rc: `0.6.8-rc.1`
2. The Windows, macOS, and Linux release workflows run in parallel.
3. Each workflow builds platform artifacts and uploads them to the **same GitHub draft release**.
4. After all platform assets are present, a maintainer manually publishes the draft release.

### Why draft release is required

The three platform workflows all call `softprops/action-gh-release` independently.
If the first workflow publishes the release immediately, later workflows can fail to add their platform assets because the published release is treated as immutable in the current GitHub release flow.

Using `draft: true` allows all three workflows to keep uploading assets to the same release until the maintainer confirms that the release is complete.

## Important updater behavior

### Updater checks do **not** work against draft releases

The current updater endpoints use GitHub `releases/latest/download/...` URLs:

- `latest-{{target}}-{{arch}}-{{bundle_type}}.json`
- `latest-{{target}}-{{arch}}.json`

GitHub does not expose draft releases through the `latest` download endpoint.
That means updater checks on macOS, Windows, and Linux are expected to fail until the draft release is manually published.

This is intentional with the current workflow design.

## Manifest naming contract

The generated updater manifests use the Tauri platform-and-architecture naming scheme:

- macOS Apple Silicon: `latest-darwin-aarch64-app.json`
- Windows x64: `latest-windows-x86_64-nsis.json`, `latest-windows-x86_64-msi.json`, `latest-windows-x86_64.json`
- Linux x64: `latest-linux-x86_64-appimage.json`, `latest-linux-x86_64-deb.json`, `latest-linux-x86_64-rpm.json`, `latest-linux-x86_64.json`

The updater endpoints in `src-tauri/tauri.conf.json` must stay aligned with that scheme.

## Maintainer checklist

- [ ] Push a semver tag without `v`
- [ ] Wait for Windows/macOS/Linux release workflows to finish
- [ ] Confirm the draft release contains all expected bundles, signatures, and updater JSON files
- [ ] Publish the draft release manually
- [ ] Only then test in-app updater checks on packaged builds
