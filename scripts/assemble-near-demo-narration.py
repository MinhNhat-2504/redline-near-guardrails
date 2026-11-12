"""Combine owner-public narration segments and produce sentence-aligned subtitles; stdlib only."""
import json
from pathlib import Path
import sys
import textwrap
import wave


def timestamp(seconds):
    milliseconds = round(seconds * 1000)
    hours, milliseconds = divmod(milliseconds, 3600000)
    minutes, milliseconds = divmod(milliseconds, 60000)
    seconds, milliseconds = divmod(milliseconds, 1000)
    return f"{hours:02}:{minutes:02}:{seconds:02},{milliseconds:03}"


def assemble(folder):
    metadata = json.loads((folder / "segments.json").read_text(encoding="utf-8-sig"))
    cues, timeline, frame_count = [], [], 0
    audio_format = None
    with wave.open(str(folder / "redline-demo-voiceover-en.wav"), "wb") as output:
        for index, segment in enumerate(metadata["segments"], 1):
            with wave.open(str(folder / segment["file"]), "rb") as source:
                current_format = (source.getnchannels(), source.getsampwidth(), source.getframerate())
                if audio_format is None:
                    audio_format = current_format
                    output.setnchannels(audio_format[0])
                    output.setsampwidth(audio_format[1])
                    output.setframerate(audio_format[2])
                if current_format != audio_format or audio_format[1] != 2:
                    raise ValueError("Expected consistent signed 16-bit PCM")
                frames = source.getnframes()
                start, end = frame_count / audio_format[2], (frame_count + frames) / audio_format[2]
                output.writeframes(source.readframes(frames))
                gap = round(audio_format[2] * 0.35)
                output.writeframes(b"\x00" * gap * audio_format[0] * audio_format[1])
                frame_count += frames + gap
                cues.append(f"{index}\n{timestamp(start)} --> {timestamp(end)}\n{textwrap.fill(segment['text'], width=62)}\n")
                timeline.append({"startSeconds": round(start, 3), "endSeconds": round(end, 3), "scene": segment["scene"], "text": segment["text"]})
    if not audio_format or frame_count <= 0:
        raise ValueError("Empty narration")
    (folder / "redline-demo-subtitles-en.srt").write_text("\n".join(cues), encoding="utf-8")
    report = {"kind": "offline synthetic narration, not screen recording", "voice": metadata["voice"], "durationSeconds": round(frame_count / audio_format[2], 3), "sampleRate": audio_format[2], "channels": audio_format[0], "segments": timeline}
    (folder / "redline-demo-timeline.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(folder), "durationSeconds": report["durationSeconds"], "sentences": len(timeline), "videoGenerated": False}))


if __name__ == "__main__":
    assemble(Path(sys.argv[1]).resolve())
