#!/usr/bin/env python3
"""Synthesize a calm ambient music bed locally (no API, no stock library).

The cloud sandbox has no access to stock-music hosts, so the bed is generated
from scratch: a slow four-chord pad, a low drone, and soft bell accents placed
on segment starts. FFmpeg then adds air (reverb/低pass) and the mix is ducked
under the narration with a sidechain compressor.

Outputs:
    audio/music.wav      the bed alone
    audio/mix.wav        narration + ducked bed (what the video uses)
"""
from __future__ import annotations

import json
import math
import subprocess
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "audio"
BUILD = ROOT / "build"
SR = 48000

# Dm - Bb(maj7) - F - C : calm, reverent, no resolution hurry.
PROGRESSION = [
    (146.83, 220.00, 293.66),   # D4 A4 D5
    (116.54, 174.61, 233.08),   # Bb2-ish stack
    (174.61, 261.63, 349.23),   # F A C
    (130.81, 196.00, 329.63),   # C G E
]
CHORD_SECONDS = 11.0


def adsr(n: int, attack: float, release: float) -> np.ndarray:
    env = np.ones(n)
    a = min(int(attack * SR), n // 2)
    r = min(int(release * SR), n // 2)
    if a:
        env[:a] = np.linspace(0.0, 1.0, a) ** 1.6
    if r:
        env[-r:] = np.linspace(1.0, 0.0, r) ** 1.6
    return env


def pad(duration: float) -> np.ndarray:
    n = int(duration * SR)
    out = np.zeros(n)
    t_chord = int(CHORD_SECONDS * SR)
    overlap = int(2.5 * SR)
    pos, idx = 0, 0
    while pos < n:
        chord = PROGRESSION[idx % len(PROGRESSION)]
        length = min(t_chord + overlap, n - pos)
        t = np.arange(length) / SR
        voice = np.zeros(length)
        for base in chord:
            for partial, gain in ((1, 1.0), (2, 0.22), (3, 0.09), (4, 0.04)):
                detune = 1.0 + (0.0012 * ((partial % 2) * 2 - 1))
                voice += gain * np.sin(2 * math.pi * base * partial * detune * t)
            # slow chorus shimmer
            voice += 0.30 * np.sin(2 * math.pi * base * t + 0.6 * np.sin(2 * math.pi * 0.07 * t))
        voice /= len(chord) * 2.2
        out[pos:pos + length] += voice * adsr(length, 3.2, 3.4)
        pos += t_chord
        idx += 1

    # low drone (D1/D2) for weight
    t = np.arange(n) / SR
    drone = 0.20 * np.sin(2 * math.pi * 73.42 * t) + 0.10 * np.sin(2 * math.pi * 36.71 * t)
    drone *= 0.55 + 0.45 * np.sin(2 * math.pi * 0.035 * t) ** 2
    out += drone * adsr(n, 4.0, 5.0)
    return out


def bells(duration: float, starts: list[float]) -> np.ndarray:
    n = int(duration * SR)
    out = np.zeros(n)
    notes = [587.33, 880.00, 698.46, 1174.66]   # D5 A5 F5 D6
    for i, start in enumerate(starts):
        pos = int(start * SR)
        length = min(int(3.0 * SR), n - pos)
        if length <= 0:
            continue
        t = np.arange(length) / SR
        f = notes[i % len(notes)]
        tone = (
            np.sin(2 * math.pi * f * t)
            + 0.35 * np.sin(2 * math.pi * f * 2.01 * t)
            + 0.12 * np.sin(2 * math.pi * f * 3.02 * t)
        )
        out[pos:pos + length] += 0.16 * tone * np.exp(-2.6 * t)
    return out


def write_wav(path: Path, data: np.ndarray) -> None:
    peak = float(np.max(np.abs(data))) or 1.0
    pcm = np.clip(data / peak * 0.85, -1, 1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((pcm * 32767).astype("<i2").tobytes())


def main() -> None:
    timeline = json.loads((BUILD / "timeline.json").read_text(encoding="utf-8"))
    duration = timeline["duration_seconds"]
    accents = [s["start"] for s in timeline["segments"] if s["scene"] in
               ("title", "pharmacy", "chemist", "fruits", "city", "sun", "closing")]

    dry = pad(duration) + bells(duration, accents)
    write_wav(AUDIO / "music_dry.wav", dry)

    # Air + width + headroom.
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(AUDIO / "music_dry.wav"),
         "-af", "lowpass=f=5200,highpass=f=45,aecho=0.8:0.9:140|320|520:0.35|0.22|0.12,"
                "aresample=48000,loudnorm=I=-29:TP=-6:LRA=8",
         "-ar", "48000", "-ac", "2", str(AUDIO / "music.wav")],
        check=True,
    )

    # Narration stays in front: the bed is ducked by a sidechain compressor.
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error",
         "-i", str(AUDIO / "narration.wav"), "-i", str(AUDIO / "music.wav"),
         "-filter_complex",
         "[0:a]aformat=channel_layouts=stereo,volume=1.0[voice];"
         "[1:a]aformat=channel_layouts=stereo[bed];"
         "[voice]asplit=2[voice_out][key];"
         "[bed][key]sidechaincompress=threshold=0.05:ratio=6:attack=25:release=420:makeup=1[bed_duck];"
         "[voice_out][bed_duck]amix=inputs=2:duration=longest:dropout_transition=0:weights=1 0.55[mix];"
         "[mix]loudnorm=I=-15:TP=-1.2:LRA=11[out]",
         "-map", "[out]", "-ar", "48000", "-ac", "2", str(AUDIO / "mix.wav")],
        check=True,
    )
    print(f"[music] bed + mix written ({duration:.2f}s)")


if __name__ == "__main__":
    main()
