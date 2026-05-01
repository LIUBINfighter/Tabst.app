#!/bin/bash
set -euo pipefail

VERSION="${LLAMA_CPP_VERSION:-b8989}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BINARY_DIR="${ROOT_DIR}/src-tauri/binaries"
RUNTIME_LIBS=(
	"libggml-base.dylib"
	"libggml-base.0.dylib"
	"libggml-base.0.10.1.dylib"
	"libggml-blas.dylib"
	"libggml-blas.0.dylib"
	"libggml-blas.0.10.1.dylib"
	"libggml-cpu.dylib"
	"libggml-cpu.0.dylib"
	"libggml-cpu.0.10.1.dylib"
	"libggml-metal.dylib"
	"libggml-metal.0.dylib"
	"libggml-metal.0.10.1.dylib"
	"libggml-rpc.dylib"
	"libggml-rpc.0.dylib"
	"libggml-rpc.0.10.1.dylib"
	"libggml.dylib"
	"libggml.0.dylib"
	"libggml.0.10.1.dylib"
	"libllama-common.dylib"
	"libllama-common.0.dylib"
	"libllama-common.0.0.8989.dylib"
	"libllama.dylib"
	"libllama.0.dylib"
	"libllama.0.0.8989.dylib"
	"libmtmd.dylib"
	"libmtmd.0.dylib"
	"libmtmd.0.0.8989.dylib"
)

if [[ "$(uname -s)" != "Darwin" ]]; then
	echo "OMR Lab llama-server sidecar packaging is macOS-only for this release." >&2
	echo "Run this script on macOS, or use build:web for non-desktop targets." >&2
	exit 1
fi

mkdir -p "${BINARY_DIR}"

binary_set_ready() {
	local target="$1"
	if ! mach_o_file_ready "${BINARY_DIR}/llama-server-${target}"; then
		return 1
	fi
	for runtime_lib in "${RUNTIME_LIBS[@]}"; do
		if ! mach_o_file_ready "${BINARY_DIR}/${runtime_lib}-${target}"; then
			return 1
		fi
	done
	return 0
}

mach_o_file_ready() {
	local file_path="$1"
	[[ -f "${file_path}" && -x "${file_path}" ]] || return 1
	file "${file_path}" | grep -q "Mach-O"
}

download_and_extract() {
	local arch="$1"
	local target="$2"
	if binary_set_ready "${target}"; then
		echo "llama-server sidecar already prepared for ${target}."
		return
	fi
	local archive="/tmp/llama-${VERSION}-${arch}.tar.gz"
	local url="https://github.com/ggml-org/llama.cpp/releases/download/${VERSION}/llama-${VERSION}-bin-macos-${arch}.tar.gz"
	local extract_dir="/tmp/tabst-llama-${VERSION}-${arch}"

	rm -rf "${extract_dir}"
	mkdir -p "${extract_dir}"
	curl --fail -L "${url}" -o "${archive}"
	tar -xzf "${archive}" -C "${extract_dir}"
	local server
	server="$(find "${extract_dir}" -type f -name llama-server -perm -111 | head -n 1)"
	if [[ -z "${server}" ]]; then
		server="$(find "${extract_dir}" -type f -name llama-server | head -n 1)"
	fi
	if [[ -z "${server}" ]]; then
		echo "llama-server not found in ${archive}" >&2
		exit 1
	fi
	cp "${server}" "${BINARY_DIR}/llama-server-${target}"
	chmod +x "${BINARY_DIR}/llama-server-${target}"
	for runtime_lib in "${RUNTIME_LIBS[@]}"; do
		local lib_path
		lib_path="$(find "${extract_dir}" -name "${runtime_lib}" | head -n 1)"
		if [[ -f "${lib_path}" ]]; then
			cp "${lib_path}" "${BINARY_DIR}/${runtime_lib}-${target}"
			chmod +x "${BINARY_DIR}/${runtime_lib}-${target}"
		fi
	done
	if [[ ! -f "${BINARY_DIR}/libggml-metal.dylib-${target}" ]]; then
		cp "${BINARY_DIR}/libggml-base.dylib-${target}" "${BINARY_DIR}/libggml-metal.dylib-${target}"
		chmod +x "${BINARY_DIR}/libggml-metal.dylib-${target}"
	fi
	if [[ ! -f "${BINARY_DIR}/libggml-metal.0.dylib-${target}" ]]; then
		cp "${BINARY_DIR}/libggml-base.0.dylib-${target}" "${BINARY_DIR}/libggml-metal.0.dylib-${target}"
		chmod +x "${BINARY_DIR}/libggml-metal.0.dylib-${target}"
	fi
	if [[ ! -f "${BINARY_DIR}/libggml-metal.0.10.1.dylib-${target}" ]]; then
		cp "${BINARY_DIR}/libggml-base.0.10.1.dylib-${target}" "${BINARY_DIR}/libggml-metal.0.10.1.dylib-${target}"
		chmod +x "${BINARY_DIR}/libggml-metal.0.10.1.dylib-${target}"
	fi
}

download_and_extract "arm64" "aarch64-apple-darwin"
download_and_extract "x64" "x86_64-apple-darwin"

ls -la "${BINARY_DIR}"/llama-server-*
file "${BINARY_DIR}"/llama-server-*
