#!/usr/bin/env python3
"""Build the Turkish narration track + caption timeline for the project.

Voice backends, in order of preference:
  1. ema      - EMA Lightning (github.com/canberk7/ema-lightning): a Turkish TTS
                model that runs locally, no API key. `pip install ema-lightning`.
                It fetches ~34 MB of weights from Hugging Face on first use, so
                either huggingface.co must be reachable or the three files
                (config.json, ema.pt, decoder.pt) must sit in a directory named
                by EMA_WEIGHTS_DIR. Gives real word-level timings, which the
                caption boundaries are snapped to.
  2. google   - Google Cloud Text-to-Speech (needs GOOGLE_API_KEY; natural voice)
  3. elevenlabs - ElevenLabs (needs ELEVENLABS_API_KEY and network access to
                  api.elevenlabs.io, which the default cloud policy blocks)
  4. espeak   - espeak-ng via the `espeakng-loader` wheel: free, offline, no key.
                Robotic but fully intelligible Turkish. The fallback.

Usage:
    python scripts/build_narration.py [--voice ema|espeak|google|elevenlabs] [--rate 170]

Outputs:
    audio/seg_<id>.wav      per-segment speech
    audio/narration.wav     concatenated narration with inter-segment pauses
    build/timeline.json     segment + caption timings for the Remotion composition
"""
from __future__ import annotations

import argparse
import array
import base64
import ctypes
import json
import os
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "script" / "narration.json"
AUDIO = ROOT / "audio"
BUILD = ROOT / "build"

GAP_SECONDS = 0.32          # silence between segments
LEAD_IN_SECONDS = 0.6       # silence before the first word
TAIL_SECONDS = 1.2          # silence after the last word
TARGET_SR = 48000


# --------------------------------------------------------------------------- #
# espeak-ng (offline, no API key)
# --------------------------------------------------------------------------- #
class EspeakVoice:
    """Minimal ctypes binding for libespeak-ng synchronous synthesis."""

    AUDIO_OUTPUT_RETRIEVAL = 1
    CHARS_UTF8 = 1
    RATE, VOLUME, PITCH, RANGE = 1, 2, 3, 4

    def __init__(self, rate: int = 170, pitch: int = 48, voice: str = "tr") -> None:
        import espeakng_loader  # provided by the `espeakng-loader` wheel

        self.lib = ctypes.CDLL(str(espeakng_loader.get_library_path()))
        self.lib.espeak_Initialize.restype = ctypes.c_int
        self.sample_rate = self.lib.espeak_Initialize(
            self.AUDIO_OUTPUT_RETRIEVAL, 0, str(espeakng_loader.get_data_path()).encode(), 0
        )
        if self.sample_rate <= 0:
            raise RuntimeError("espeak_Initialize failed")

        self._buf: list[int] = []
        cb_type = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p)

        def _cb(wav, n, _events):  # noqa: ANN001
            if wav and n > 0:
                self._buf.extend(wav[i] for i in range(n))
            return 0

        self._cb = cb_type(_cb)                     # keep a reference alive
        self.lib.espeak_SetSynthCallback(self._cb)
        if self.lib.espeak_SetVoiceByName(voice.encode()) != 0:
            raise RuntimeError(f"espeak voice {voice!r} unavailable")
        self.lib.espeak_SetParameter(self.RATE, rate, 0)
        self.lib.espeak_SetParameter(self.PITCH, pitch, 0)
        self.lib.espeak_SetParameter(self.RANGE, 60, 0)
        self.lib.espeak_SetParameter(self.VOLUME, 170, 0)

    def say(self, text: str) -> bytes:
        self._buf.clear()
        raw = text.encode("utf-8")
        rc = self.lib.espeak_Synth(raw, len(raw) + 1, 0, 0, 0, self.CHARS_UTF8, None, None)
        self.lib.espeak_Synchronize()
        if rc != 0:
            raise RuntimeError(f"espeak_Synth returned {rc}")
        return array.array("h", self._buf).tobytes()


def synth_espeak(segments, rate: int) -> int:
    voice = EspeakVoice(rate=rate)
    for seg in segments:
        pcm = voice.say(seg["text"])
        path = AUDIO / f"seg_{seg['id']}.wav"
        with wave.open(str(path), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(voice.sample_rate)
            w.writeframes(pcm)
    return voice.sample_rate



# --------------------------------------------------------------------------- #
# EMA Lightning (local Turkish TTS, no API key)
# --------------------------------------------------------------------------- #
def ema_available() -> bool:
    try:
        import ema_lightning  # noqa: F401
    except Exception:
        return False
    return True


def synth_ema(segments, speed: float, seed: int | None):
    """Synthesize with EMA Lightning; returns (sample_rate, word timings per segment).

    EMA_WEIGHTS_DIR lets the model load from local files instead of the Hub, for
    sandboxes where huggingface.co is not reachable.
    """
    # The Xet transfer path needs extra hosts; the classic CDN keeps the
    # allow-list down to huggingface.co + cdn-lfs*.huggingface.co.
    os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

    local = os.environ.get("EMA_WEIGHTS_DIR")
    if local:
        import ema_lightning.api as ema_api

        root = Path(local)
        missing = [f for f in ("config.json", "ema.pt", "decoder.pt") if not (root / f).is_file()]
        if missing:
            raise SystemExit(f"EMA_WEIGHTS_DIR={root} is missing: {', '.join(missing)}")
        ema_api.hf_hub_download = lambda repo, filename, *a, **k: str(root / filename)

    from ema_lightning import EMA

    try:
        tts = EMA()
    except Exception as exc:  # the weights could not be fetched
        raise SystemExit(
            "EMA could not load its weights: "
            f"{exc}\n"
            "Either allow huggingface.co (and cdn-lfs.huggingface.co) in the environment's "
            "network policy, or download config.json, ema.pt and decoder.pt from "
            "https://huggingface.co/canberkkkkkk/ema-lightning and point EMA_WEIGHTS_DIR at them."
        ) from exc
    words: dict[str, list[dict]] = {}
    sr = 0
    for seg in segments:
        speech = tts.say(seg["text"], speed=speed, seed=seed, path=str(AUDIO / f"seg_{seg['id']}.wav"))
        sr = speech.sample_rate
        words[seg["id"]] = [{"text": w.text, "start": w.start, "end": w.end} for w in speech.words]
    (BUILD / "words.json").write_text(json.dumps(words, ensure_ascii=False, indent=2), encoding="utf-8")
    return sr, words


# --------------------------------------------------------------------------- #
# Google Cloud TTS (natural Turkish; needs GOOGLE_API_KEY)
# --------------------------------------------------------------------------- #
def synth_google(segments, voice_name: str, speaking_rate: float) -> int:
    import urllib.request

    key = os.environ["GOOGLE_API_KEY"]
    url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={key}"
    for seg in segments:
        body = json.dumps(
            {
                "input": {"text": seg["text"]},
                "voice": {"languageCode": "tr-TR", "name": voice_name},
                "audioConfig": {
                    "audioEncoding": "LINEAR16",
                    "sampleRateHertz": 24000,
                    "speakingRate": speaking_rate,
                },
            }
        ).encode()
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            payload = json.load(resp)
        pcm = base64.b64decode(payload["audioContent"])
        (AUDIO / f"seg_{seg['id']}.wav").write_bytes(pcm)   # LINEAR16 comes back as a WAV
    return 24000


# --------------------------------------------------------------------------- #
# ElevenLabs (natural Turkish; needs ELEVENLABS_API_KEY + egress to the host)
# --------------------------------------------------------------------------- #
def synth_elevenlabs(segments, voice_id: str) -> int:
    import urllib.request

    key = os.environ["ELEVENLABS_API_KEY"]
    for seg in segments:
        url = (
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
            "?output_format=pcm_24000"
        )
        body = json.dumps(
            {
                "text": seg["text"],
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {"stability": 0.45, "similarity_boost": 0.75, "style": 0.3},
            }
        ).encode()
        req = urllib.request.Request(
            url, data=body, headers={"xi-api-key": key, "Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=180) as resp:
            pcm = resp.read()
        with wave.open(str(AUDIO / f"seg_{seg['id']}.wav"), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(24000)
            w.writeframes(pcm)
    return 24000


# --------------------------------------------------------------------------- #
def wav_duration(path: Path) -> float:
    with wave.open(str(path), "rb") as w:
        return w.getnframes() / w.getframerate()


def caption_timings(seg: dict, start: float, duration: float, words: list[dict] | None = None) -> list[dict]:
    """Spread a segment's caption chunks over its audio, weighted by length.

    With word timings from the TTS backend, each boundary is snapped to the
    nearest spoken word start so captions flip on a word, not mid-syllable.
    """
    chunks = seg.get("captions") or [seg["text"]]
    weights = [max(len(c), 6) for c in chunks]
    total = sum(weights)

    edges, cursor = [0.0], 0.0
    for weight in weights:
        cursor += duration * weight / total
        edges.append(cursor)

    if words:
        starts = [w["start"] for w in words]
        for i in range(1, len(edges) - 1):
            edges[i] = min(starts, key=lambda s: abs(s - edges[i]))
        for i in range(1, len(edges)):            # keep them ordered and non-empty
            edges[i] = max(edges[i], edges[i - 1] + 0.25)
        edges[-1] = duration

    return [
        {
            "text": chunk,
            "start": round(start + edges[i], 3),
            "duration": round(max(edges[i + 1] - edges[i], 0.25), 3),
        }
        for i, chunk in enumerate(chunks)
    ]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default=os.environ.get("NARRATION_VOICE", "auto"),
                    choices=["auto", "ema", "espeak", "google", "elevenlabs"])
    ap.add_argument("--rate", type=int, default=170, help="espeak words per minute")
    ap.add_argument("--ema-speed", type=float, default=1.0, help="EMA speaking speed")
    ap.add_argument("--ema-seed", type=int, default=7, help="EMA seed (same seed = same audio)")
    ap.add_argument("--google-voice", default="tr-TR-Chirp3-HD-Alnilam")
    ap.add_argument("--google-rate", type=float, default=1.0)
    ap.add_argument("--elevenlabs-voice", default="onwK4e9ZLuTAKqWW03F9")
    args = ap.parse_args()

    AUDIO.mkdir(exist_ok=True)
    BUILD.mkdir(exist_ok=True)
    doc = json.loads(SCRIPT.read_text(encoding="utf-8"))
    segments = doc["segments"]

    backend = args.voice
    if backend == "auto":
        if ema_available():
            backend = "ema"
        elif os.environ.get("GOOGLE_API_KEY"):
            backend = "google"
        elif os.environ.get("ELEVENLABS_API_KEY"):
            backend = "elevenlabs"
        else:
            backend = "espeak"

    print(f"[narration] backend={backend} segments={len(segments)}")
    words: dict[str, list[dict]] = {}
    if backend == "ema":
        sr, words = synth_ema(segments, args.ema_speed, args.ema_seed)
    elif backend == "espeak":
        sr = synth_espeak(segments, args.rate)
    elif backend == "google":
        sr = synth_google(segments, args.google_voice, args.google_rate)
    else:
        sr = synth_elevenlabs(segments, args.elevenlabs_voice)

    # ---- concatenate with pauses, upsample, light voice polish --------------
    parts = []
    timeline, cursor = [], LEAD_IN_SECONDS
    for seg in segments:
        path = AUDIO / f"seg_{seg['id']}.wav"
        dur = wav_duration(path)
        timeline.append(
            {
                "id": seg["id"],
                "scene": seg["scene"],
                "text": seg["text"],
                "start": round(cursor, 3),
                "duration": round(dur, 3),
                "captions": caption_timings(seg, cursor, dur, words.get(seg["id"])),
            }
        )
        parts.append(path)
        cursor += dur + GAP_SECONDS

    total = round(cursor - GAP_SECONDS + TAIL_SECONDS, 3)

    concat_list = BUILD / "concat.txt"
    silence = AUDIO / "_gap.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
         f"anullsrc=r={sr}:cl=mono", "-t", str(GAP_SECONDS), str(silence)],
        check=True,
    )
    lead = AUDIO / "_lead.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
         f"anullsrc=r={sr}:cl=mono", "-t", str(LEAD_IN_SECONDS), str(lead)],
        check=True,
    )
    tail = AUDIO / "_tail.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
         f"anullsrc=r={sr}:cl=mono", "-t", str(TAIL_SECONDS), str(tail)],
        check=True,
    )
    lines = [f"file '{lead}'"]
    for i, p in enumerate(parts):
        lines.append(f"file '{p}'")
        if i < len(parts) - 1:
            lines.append(f"file '{silence}'")
    lines.append(f"file '{tail}'")
    concat_list.write_text("\n".join(lines) + "\n", encoding="utf-8")

    # Voice chain. A formant synth needs the presence lift, the de-harsh and a
    # little room to sit in a mix; a neural voice already has all three, so it
    # only gets de-rumble and gentle levelling.
    if backend == "espeak":
        chain = (
            "highpass=f=85,"
            "equalizer=f=220:t=q:w=1.0:g=-2,"
            "equalizer=f=1800:t=q:w=1.4:g=3,"
            "equalizer=f=3600:t=q:w=1.6:g=-3,"
            "acompressor=threshold=-18dB:ratio=3:attack=12:release=180:makeup=2,"
            "aecho=0.86:0.9:38:0.12,"
            f"aresample={TARGET_SR},"
            "loudnorm=I=-17:TP=-1.5:LRA=11"
        )
    else:
        chain = (
            "highpass=f=70,"
            "acompressor=threshold=-20dB:ratio=2.4:attack=18:release=240:makeup=1.5,"
            f"aresample={TARGET_SR},"
            "loudnorm=I=-17:TP=-1.5:LRA=11"
        )
    narration = AUDIO / "narration.wav"
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(concat_list),
         "-af", chain, "-ar", str(TARGET_SR), "-ac", "1", str(narration)],
        check=True,
    )

    out = {
        "project": doc["project"],
        "title": doc["title"],
        "voice_backend": backend,
        "fps": doc["fps"],
        "width": doc["width"],
        "height": doc["height"],
        "duration_seconds": total,
        "narration_sample_rate": TARGET_SR,
        "segments": timeline,
    }
    (BUILD / "timeline.json").write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[narration] total={total:.2f}s -> {narration}")
    print(f"[narration] timeline -> {BUILD / 'timeline.json'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
