"""Voice pipeline for the Firelight player.

The app records the user's voice while Enter is held on the remote and POSTs the
audio here as multipart/form-data (field name "audio"). This server transcribes it
with faster-whisper and returns {"text": "..."}. The app turns the text into a
player action with its own keyword rules (components/voiceCommands.ts).

Run:
    python voice_pipeline.py

Environment variables (all optional):
    WHISPER_MODEL     faster-whisper model name (default: base.en)
    WHISPER_DEVICE    cpu or cuda (default: cpu)
    WHISPER_COMPUTE   compute type (default: int8)
    VOICE_PORT        port to listen on (default: 8765)
"""

import io
import json
import os
import time
from email import policy
from email.parser import BytesParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import av
import numpy as np
from faster_whisper import WhisperModel

MODEL_NAME = os.environ.get("WHISPER_MODEL", "base.en")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE", "int8")
PORT = int(os.environ.get("VOICE_PORT", "8765"))
MAX_UPLOAD_BYTES = 10 * 1024 * 1024

# Biases recognition toward the words the player understands.
COMMAND_PROMPT = (
    "Pause. Play. Resume. Volume up. Volume down. Louder. Quieter. Mute. Unmute. "
    "Skip forward 30 seconds. Rewind 10 seconds. Speed up. Slow down. Normal speed. "
    "Restart. Exit."
)

print(f"Loading faster-whisper model '{MODEL_NAME}' on {DEVICE} ({COMPUTE_TYPE})...")
model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)
print("Model loaded.")


def extract_audio(content_type: str, body: bytes) -> bytes | None:
    """Returns the bytes of the "audio" field from a multipart/form-data body."""
    message = BytesParser(policy=policy.default).parsebytes(
        b"Content-Type: " + content_type.encode() + b"\r\n\r\n" + body
    )
    if not message.is_multipart():
        return None
    for part in message.iter_parts():
        if part.get_param("name", header="content-disposition") == "audio":
            return part.get_payload(decode=True)
    return None


def decode_audio(audio: bytes) -> np.ndarray:
    """Decodes any audio file (m4a/aac from the app, wav, ...) to 16 kHz mono float32.

    Done here instead of by faster-whisper because faster-whisper 1.2.1 passes an
    option to av.open() that PyAV 16+ no longer accepts.
    """
    resampler = av.audio.resampler.AudioResampler(format="s16", layout="mono", rate=16000)
    chunks = []
    with av.open(io.BytesIO(audio), mode="r") as container:
        for frame in container.decode(audio=0):
            for resampled in resampler.resample(frame):
                chunks.append(resampled.to_ndarray().reshape(-1))
        for resampled in resampler.resample(None):  # flush
            chunks.append(resampled.to_ndarray().reshape(-1))
    if not chunks:
        return np.zeros(0, dtype=np.float32)
    return np.concatenate(chunks).astype(np.float32) / 32768.0


def transcribe(audio: bytes) -> str:
    samples = decode_audio(audio)
    if samples.size == 0:
        return ""
    segments, _ = model.transcribe(
        samples,
        language="en",
        beam_size=1,
        vad_filter=True,
        initial_prompt=COMMAND_PROMPT,
    )
    return " ".join(segment.text.strip() for segment in segments).strip()


class Handler(BaseHTTPRequestHandler):
    def send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self.send_json(200, {"status": "ok", "model": MODEL_NAME})
        else:
            self.send_json(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/transcribe":
            self.send_json(404, {"error": "Not found"})
            return

        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > MAX_UPLOAD_BYTES:
            self.send_json(400, {"error": "Missing or too-large audio upload."})
            return

        content_type = self.headers.get("Content-Type", "")
        if not content_type.startswith("multipart/form-data"):
            self.send_json(400, {"error": "Expected multipart/form-data."})
            return

        audio = extract_audio(content_type, self.rfile.read(length))
        if not audio:
            self.send_json(400, {"error": "No 'audio' field in upload."})
            return

        started = time.perf_counter()
        try:
            text = transcribe(audio)
        except Exception as error:  # Bad audio should not take the server down.
            self.send_json(500, {"error": f"Transcription failed: {error}"})
            return

        elapsed = time.perf_counter() - started
        print(f"Heard: {text!r} ({elapsed:.2f}s)")
        self.send_json(200, {"text": text})


if __name__ == "__main__":
    # 0.0.0.0 so the emulator (10.0.2.2) and real devices on the LAN can reach it.
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Voice pipeline listening on http://localhost:{PORT} (POST /transcribe)")
    server.serve_forever()
