#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINARY_DIR="${ROOT_DIR}/src-tauri/binaries"
BACKUP_DIR="$(mktemp -d)"
BACKUP_LIST="${BACKUP_DIR}/files.txt"

host_triple() {
	case "$(uname -m)" in
		arm64) echo "aarch64-apple-darwin" ;;
		x86_64) echo "x86_64-apple-darwin" ;;
		*)
			echo "Unsupported macOS architecture: $(uname -m)" >&2
			exit 1
			;;
	esac
}

install_runtime_files() {
	local destination="$1"
	local target
	target="$(host_triple)"
	mkdir -p "${destination}"
	shopt -s nullglob
	for binary in "${BINARY_DIR}"/*-"${target}"; do
		local runtime_name
		runtime_name="$(basename "${binary}" "-${target}")"
		cp "${binary}" "${destination}/${runtime_name}"
		chmod +x "${destination}/${runtime_name}"
	done
	shopt -u nullglob
}

restore_placeholders() {
	shopt -s nullglob
	rm -f "${BINARY_DIR}"/*-apple-darwin
	while IFS= read -r target; do
		[[ -z "${target}" ]] && continue
		cp "${BACKUP_DIR}/${target}" "${BINARY_DIR}/${target}"
	done < "${BACKUP_LIST}"
	shopt -u nullglob
	rm -rf "${BACKUP_DIR}"
}

trap restore_placeholders EXIT

mkdir -p "${BINARY_DIR}"
touch "${BACKUP_LIST}"
shopt -s nullglob
for binary in "${BINARY_DIR}"/*-apple-darwin; do
	target="$(basename "${binary}")"
	cp "${binary}" "${BACKUP_DIR}/${target}"
	printf '%s\n' "${target}" >> "${BACKUP_LIST}"
done
shopt -u nullglob

"${ROOT_DIR}/scripts/fetch-llama-server.sh"
install_runtime_files "${ROOT_DIR}/src-tauri/target/debug"
(cd "${ROOT_DIR}" && pnpm tauri dev "$@")
