#!/usr/bin/env python3
"""Lightweight HTTP OMR provider for Tabst ONNX smoke tests.

This script intentionally lives outside the Tauri runtime. It lets Tabst verify
the image -> HTTP provider -> alphaTex path without bundling Python, ONNX
Runtime, or model files into the desktop app.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import sys
import time
from contextlib import redirect_stdout
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image


TARGET_WIDTH = 800
TARGET_HEIGHT = 320
DEFAULT_MAX_NEW_TOKENS = 160


def _load_runtime(onnx_export_dir: Path, weights_dir: Path):
    sys.path.insert(0, str(onnx_export_dir.resolve()))
    from runtime import ONNXOMRRuntime
    from tokenizer_wrapper import TaboxTokenizerWrapper

    with redirect_stdout(io.StringIO()):
        runtime = ONNXOMRRuntime(
            weights_dir / "encoder.onnx",
            weights_dir / "decoder.onnx",
            weights_dir / "metadata.json",
        )
    tokenizer = TaboxTokenizerWrapper(weights_dir / "vocab_v2.json")
    return runtime, tokenizer


def _decode_image(image_base64: str) -> Image.Image:
    payload = image_base64.split(",", 1)[1] if "," in image_base64[:80] else image_base64
    raw = base64.b64decode(payload, validate=True)
    with Image.open(io.BytesIO(raw)) as image:
        rgba = image.convert("RGBA")
        white = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        return Image.alpha_composite(white, rgba).convert("RGB")


def _to_tensor(image: Image.Image, *, invert: bool, mask: np.ndarray | None = None):
    pixels = np.asarray(image).astype(np.float32) / 255.0
    if invert:
        pixels = 1.0 - pixels
    images = np.transpose(pixels, (2, 0, 1))[None, :, :, :].astype(np.float32)
    if mask is None:
        pixel_masks = np.ones((1, image.height, image.width), dtype=bool)
    else:
        pixel_masks = mask[None, :, :]
    return images, pixel_masks


def _preprocess(image: Image.Image, options: dict[str, Any]):
    mode = str(options.get("preprocess") or "fit-pad-800x320")
    invert = bool(options.get("invert", False))
    if mode == "native":
        images, pixel_masks = _to_tensor(image, invert=invert)
        info = {"mode": mode, "originalSize": list(image.size), "inputShape": list(images.shape)}
        return images, pixel_masks, info

    if mode == "stretch-800x320":
        resized = image.resize((TARGET_WIDTH, TARGET_HEIGHT), Image.Resampling.LANCZOS)
        images, pixel_masks = _to_tensor(resized, invert=invert)
        info = {
            "mode": mode,
            "originalSize": list(image.size),
            "resizedSize": [TARGET_WIDTH, TARGET_HEIGHT],
            "inputShape": list(images.shape),
        }
        return images, pixel_masks, info

    if mode != "fit-pad-800x320":
        raise ValueError(f"unsupported preprocess mode: {mode}")

    scale = min(TARGET_WIDTH / image.width, TARGET_HEIGHT / image.height)
    width = max(1, round(image.width * scale))
    height = max(1, round(image.height * scale))
    resized = image.resize((width, height), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (TARGET_WIDTH, TARGET_HEIGHT), (255, 255, 255))
    x = (TARGET_WIDTH - width) // 2
    y = (TARGET_HEIGHT - height) // 2
    canvas.paste(resized, (x, y))
    mask = np.zeros((TARGET_HEIGHT, TARGET_WIDTH), dtype=bool)
    mask[y : y + height, x : x + width] = True
    images, pixel_masks = _to_tensor(canvas, invert=invert, mask=mask)
    info = {
        "mode": mode,
        "originalSize": list(image.size),
        "resizedSize": [width, height],
        "offset": [x, y],
        "inputShape": list(images.shape),
    }
    return images, pixel_masks, info


class OmrProviderHandler(BaseHTTPRequestHandler):
    runtime = None
    tokenizer = None

    def do_GET(self) -> None:
        if self.path.rstrip("/") != "/health":
            self._send_json({"error": "not-found"}, HTTPStatus.NOT_FOUND)
            return
        self._send_json({"status": "ok", "runtime": "onnx", "ready": True})

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/transcribe":
            self._send_json({"error": "not-found"}, HTTPStatus.NOT_FOUND)
            return
        try:
            request = self._read_json()
            image_base64 = request.get("imageBase64")
            if not isinstance(image_base64, str) or not image_base64.strip():
                raise ValueError("imageBase64 is required")
            options = request.get("options") if isinstance(request.get("options"), dict) else {}
            max_new_tokens = int(options.get("maxNewTokens") or DEFAULT_MAX_NEW_TOKENS)
            image = _decode_image(image_base64)
            images, pixel_masks, preprocess_info = _preprocess(image, options)
            started_at = time.perf_counter()
            token_ids = self.runtime.generate(
                images,
                pixel_masks,
                max_new_tokens=max_new_tokens,
                temperature=0.0,
            )[0]
            duration_ms = round((time.perf_counter() - started_at) * 1000)
            alpha_tex = self.tokenizer.decode(token_ids, skip_special_tokens=True)
            eos = token_ids[-1] == self.tokenizer.eos_token_id if token_ids else False
            self._send_json(
                {
                    "alphaTex": alpha_tex,
                    "rawResponse": {
                        "tokenIds": token_ids,
                        "tokenString": self.tokenizer.decode_token_string(token_ids),
                        "eos": eos,
                        "preprocess": preprocess_info,
                    },
                    "tokensUsed": len(token_ids),
                    "durationMs": duration_ms,
                }
            )
        except Exception as error:
            self._send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)

    def log_message(self, format: str, *args: object) -> None:
        print(f"[omr-provider] {self.address_string()} - {format % args}")

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("content-length", "0"))
        if length <= 0:
            return {}
        payload = self.rfile.read(length)
        decoded = json.loads(payload.decode("utf-8"))
        if not isinstance(decoded, dict):
            raise ValueError("request body must be a JSON object")
        return decoded

    def _send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a Tabst-compatible ONNX OMR HTTP provider")
    parser.add_argument("--onnx-export-dir", type=Path, default=Path("tmp/onnx_export"))
    parser.add_argument("--weights-dir", type=Path, default=None)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=18089)
    args = parser.parse_args()

    onnx_export_dir = args.onnx_export_dir.resolve()
    weights_dir = (args.weights_dir or (onnx_export_dir / "weights")).resolve()
    print(f"Loading ONNX OMR provider from {weights_dir}...")
    OmrProviderHandler.runtime, OmrProviderHandler.tokenizer = _load_runtime(
        onnx_export_dir,
        weights_dir,
    )
    server = ThreadingHTTPServer((args.host, args.port), OmrProviderHandler)
    print(f"ONNX OMR provider listening on http://{args.host}:{args.port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
