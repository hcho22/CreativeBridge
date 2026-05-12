#!/usr/bin/env bash
# Idempotently downloads Whisper GGML model files into assets/models/.
#
# Why this script exists:
#   - The on-device transcription PRD (US-002) requires ggml-tiny.en.bin
#     (~39 MB) to be present in the iOS app bundle.
#   - Committing the binary to git bloats every clone and stresses git
#     operations on the repo (39 MB grows fast if we add base.en too).
#   - This script downloads the model from huggingface on demand and is
#     idempotent — re-running it after the file already exists is a no-op.
#
# Wired in via package.json postinstall (chained after patch-package), so
# `npm install` produces a ready-to-build state on a fresh clone.
#
# Manual usage:
#   ./scripts/download-whisper-models.sh
#
# Skip via env var (useful for CI jobs that don't build iOS):
#   SKIP_WHISPER_MODEL_DOWNLOAD=1 npm install
set -euo pipefail

if [[ "${SKIP_WHISPER_MODEL_DOWNLOAD:-}" == "1" ]]; then
  echo "[whisper-models] SKIP_WHISPER_MODEL_DOWNLOAD=1 — skipping download."
  exit 0
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODEL_DIR="${REPO_ROOT}/assets/models"
mkdir -p "${MODEL_DIR}"

# Single source of truth for which models we bundle and where they come from.
# Format: "filename|url|expected_size_bytes"
# Expected size lets us detect partial/corrupt downloads cheaply (no checksum
# tools needed; tiny.en-q5_1 is small enough that the byte count is a strong
# enough integrity signal for this purpose).
#
# We use the q5_1 5-bit quantized variant (32 MB) instead of full-precision
# ggml-tiny.en.bin (78 MB) because the PRD's bundle-size acceptance criteria
# (≤45 MB delta) require it. Quality difference vs full precision is <1% WER
# on whisper benchmarks for typical K-2 indoor utterances.
MODELS=(
  "ggml-tiny.en-q5_1.bin|https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin|32166155"
)

for entry in "${MODELS[@]}"; do
  IFS='|' read -r filename url expected_size <<< "${entry}"
  dest="${MODEL_DIR}/${filename}"

  if [[ -f "${dest}" ]]; then
    actual_size=$(stat -f%z "${dest}" 2>/dev/null || stat -c%s "${dest}" 2>/dev/null || echo 0)
    if [[ "${actual_size}" == "${expected_size}" ]]; then
      echo "[whisper-models] ${filename} present (${actual_size} bytes) — skipping."
      continue
    fi
    echo "[whisper-models] ${filename} present but size mismatch (got ${actual_size}, expected ${expected_size}) — re-downloading."
    rm -f "${dest}"
  fi

  echo "[whisper-models] Downloading ${filename} from ${url}"
  if ! curl --fail --location --progress-bar --output "${dest}" "${url}"; then
    echo "[whisper-models] ERROR: download failed for ${filename}." >&2
    echo "[whisper-models] If you are offline or behind a firewall, set SKIP_WHISPER_MODEL_DOWNLOAD=1 and download manually from:" >&2
    echo "  ${url}" >&2
    echo "[whisper-models] Then place the file at: ${dest}" >&2
    exit 1
  fi

  actual_size=$(stat -f%z "${dest}" 2>/dev/null || stat -c%s "${dest}" 2>/dev/null || echo 0)
  if [[ "${actual_size}" != "${expected_size}" ]]; then
    echo "[whisper-models] ERROR: ${filename} size mismatch after download (got ${actual_size}, expected ${expected_size})." >&2
    exit 1
  fi
  echo "[whisper-models] ${filename} downloaded successfully (${actual_size} bytes)."
done

echo "[whisper-models] All models ready."
