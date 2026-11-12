#!/usr/bin/env python3
"""Render the timecoded English companion script with a configurable TTS engine."""
import array
import json
import math
import re
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def checked(args):
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr or result.stdout or str(args))
    return result.stdout


def seconds(value):
    minutes, rest = value.split(":")
    return int(minutes) * 60 + float(rest)


def read_pcm(path):
    with wave.open(str(path), "rb") as source:
        if source.getnchannels() != 1 or source.getsampwidth() != 2:
            raise RuntimeError("Expected mono 16-bit PCM: " + str(path))
        return source.getframerate(), source.readframes(source.getnframes())


def write_pcm(path, rate, pcm):
    with wave.open(str(path), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(rate)
        target.writeframes(pcm)


def trim_silence(rate, pcm):
    samples = array.array("h", pcm)
    if sys.byteorder != "little":
        samples.byteswap()
    active = [i for i, sample in enumerate(samples) if abs(sample) > 150]
    if not active or max(abs(sample) for sample in samples) < 1000:
        raise RuntimeError("Speech service produced empty or silent audio")
    margin = round(rate * 0.08)
    first, last = max(0, active[0] - margin), min(len(samples), active[-1] + 1 + margin)
    return pcm[first * 2:last * 2]


def main():
    config = json.loads((ROOT / "narration.config.json").read_text())
    engine = config.get("engine", "macos")
    if engine == "edge-tts":
        import edge_tts
    design = json.loads((ROOT / "docs/astra-human-video-data.json").read_text())
    text = (ROOT / "docs/astra-human-video-narration.md").read_text()
    pattern = r"^\| (\d+:\d+\.\d+)–(\d+:\d+\.\d+) \| ([^|]+) \| (.+) \|$"
    cues = [{"start": seconds(a), "end": seconds(b), "scene": label, "text": body}
            for a, b, label, body in re.findall(pattern, text, re.M)]
    if len(cues) != 2 + 2 * len(design["cases"]):
        raise RuntimeError("Expected opening, dimensions and two narration cues per case")
    if abs(cues[0]["start"]) > 0.001 or abs(cues[-1]["end"] - design["duration_seconds"]) > 0.001:
        raise RuntimeError("Narration timecodes do not cover the current video")
    for before, after in zip(cues, cues[1:]):
        if abs(before["end"] - after["start"]) > 0.001:
            raise RuntimeError("Narration cues have a gap or overlap")
    for index, case in enumerate(design["cases"]):
        for actual, expected in [(cues[2 + 2 * index]["start"], case["start_seconds"]),
                                 (cues[3 + 2 * index]["start"], case["answer_reveal_seconds"])]:
            if abs(actual - expected) > 0.001:
                raise RuntimeError("Narration answer reveal mismatch: " + case["key"])

    reuse = "--reuse" in sys.argv
    previous = None
    old_pcm = None
    if reuse:
        previous = json.loads((ROOT / "docs/astra-human-audio-timing.json").read_text())
        old_rate, old_pcm = read_pcm(ROOT / "outputs/astra-human/astra-human-narration.wav")
        if previous["voice"] != config["voice"] or old_rate != int(config["sample_rate"]) or [c["text"] for c in previous["cues"]] != [c["text"] for c in cues]:
            raise RuntimeError("Existing voice/text does not match; cannot reuse narration")

    sample_rate = int(config["sample_rate"])
    total_samples = round(design["duration_seconds"] * sample_rate)
    master = bytearray(total_samples * 2)
    report = []
    output = ROOT / "outputs/astra-human"
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="vistr-narration-") as directory:
        work = Path(directory)
        for index, cue in enumerate(cues):
            spoken = cue["text"]
            for original, replacement in config["pronunciations"].items():
                spoken = spoken.replace(original, replacement)
            phrase = work / f"{index:02d}.txt"
            phrase.write_text(spoken)
            native = work / f"{index:02d}-native.wav"
            clean = work / f"{index:02d}-clean.wav"
            ready = work / f"{index:02d}-48k.wav"
            lead = config.get("page_start_padding_seconds", config["cue_start_padding_seconds"]) if index < 2 or index % 2 == 0 else config["cue_start_padding_seconds"]
            tail = config.get("page_end_padding_seconds", config["cue_end_padding_seconds"]) if index < 2 or index % 2 == 1 else config["cue_end_padding_seconds"]
            start = round((cue["start"] + lead) * sample_rate)
            end = min(total_samples, round((cue["end"] - tail) * sample_rate))
            available = (end - start) / sample_rate
            if reuse:
                old = previous["cues"][index]
                first = round(old["speech_start"] * sample_rate)
                last = round(old["speech_end"] * sample_rate)
                clip = old_pcm[first * 2:last * 2]
                duration = len(clip) / (2 * sample_rate)
                rate = old["rate"]
                if duration > available:
                    raise RuntimeError(f"Cue {index + 1} needs a longer page to preserve its delivery")
            else:
                rate = 100 + int(config["rate_percent"]) if engine == "edge-tts" else int(config["rate"])
                max_rate = 100 + int(config["max_rate_percent"]) if engine == "edge-tts" else int(config["max_rate"])
                for attempt in range(5):
                    if engine == "edge-tts":
                        compressed = work / f"{index:02d}-neural.mp3"
                        edge_tts.Communicate(spoken, config["voice"], rate=f"{rate - 100:+d}%",
                                             pitch=f"{int(config['pitch_hz']):+d}Hz",
                                             connect_timeout=10, receive_timeout=45).save_sync(str(compressed))
                        checked(["ffmpeg", "-y", "-v", "error", "-i", str(compressed), "-ar",
                                 str(sample_rate), "-ac", "1", "-c:a", "pcm_s16le", str(native)])
                    else:
                        checked(["say", "-v", config["voice"], "-r", str(rate), "--file-format=WAVE",
                                 "--data-format=LEI16@22050", "-f", str(phrase), "-o", str(native)])
                    native_rate, pcm = read_pcm(native)
                    pcm = trim_silence(native_rate, pcm)
                    duration = len(pcm) / (2 * native_rate)
                    if duration <= available:
                        break
                    new_rate = max(rate + 1, math.ceil(rate * duration / available * 1.015))
                    if new_rate > max_rate or attempt == 4:
                        raise RuntimeError(f"Cue {index + 1} is too long; shorten its narration text")
                    rate = new_rate
                write_pcm(clean, native_rate, pcm)
                checked(["ffmpeg", "-y", "-v", "error", "-i", str(clean), "-af",
                         f"afade=t=in:d=0.012,afade=t=out:st={max(0, duration - 0.025):.6f}:d=0.025",
                         "-ar", str(sample_rate), "-ac", "1", "-c:a", "pcm_s16le", str(ready)])
                _, clip = read_pcm(ready)
            if start * 2 + len(clip) > end * 2:
                raise RuntimeError("Resampled narration would overlap the next cue")
            master[start * 2:start * 2 + len(clip)] = clip
            report.append({**cue, "speech_start": start / sample_rate,
                           "speech_end": (start + len(clip) // 2) / sample_rate,
                           "rate": rate, "rate_unit": "percent_of_default" if engine == "edge-tts" else "words_per_minute",
                           "voice": config["voice"]})
            rate_label = f"{rate - 100:+d}%" if engine == "edge-tts" else str(rate)
            print(f"Narration {index + 1}/{len(cues)}: {cue['scene']}, {duration:.2f}s, rate {rate_label}", flush=True)

        page_gaps = []
        for index in [1, *range(2, len(report), 2)]:
            gap = report[index]["speech_start"] - report[index - 1]["speech_end"]
            if gap + 0.001 < config.get("minimum_page_gap_seconds", 0):
                raise RuntimeError(f"Page {index + 1} has insufficient breathing space")
            page_gaps.append({"next_scene": report[index]["scene"], "silence_seconds": gap})

        raw = work / "assembled.wav"
        write_pcm(raw, sample_rate, master)
        wav = output / "astra-human-narration.wav"
        mp3 = output / "astra-human-narration.mp3"
        if reuse:
            write_pcm(wav, sample_rate, master)
        else:
            checked(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-af",
                     f"loudnorm=I={config['target_lufs']}:TP=-1.5:LRA=9,aresample={sample_rate},apad,atrim=end_sample={total_samples}",
                     "-ar", str(sample_rate), "-ac", "1", "-c:a", "pcm_s16le", str(wav)])
            actual_rate, actual_pcm = read_pcm(wav)
            # loudnorm internally resamples; enforce the exact video duration after conversion.
            normalized = (actual_pcm + bytes(max(0, total_samples * 2 - len(actual_pcm))))[:total_samples * 2]
            write_pcm(wav, actual_rate, normalized)
        checked(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-c:a", "libmp3lame",
                 "-b:a", "192k", "-metadata", "title=Astra and Human — English Narration", str(mp3)])
    document = {"engine": engine, "voice": config["voice"], "language": config.get("language", "en-GB"), "sample_rate": sample_rate,
                "duration_seconds": total_samples / sample_rate, "sample_count": total_samples,
                "alignment": "Each spoken cue fits within its video time window; no answer precedes its reveal",
                "cues": report, "reused_audio": reuse, "page_gaps": page_gaps, "minimum_page_gap_seconds": config.get("minimum_page_gap_seconds", 0)}
    (ROOT / "docs/astra-human-audio-timing.json").write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n")
    print(f"Verified narration: {len(report)} cues, {total_samples / sample_rate:.6f}s, {sample_rate} Hz mono")
    print(mp3)
    print(wav)


if __name__ == "__main__":
    main()
