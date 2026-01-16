"""
Audio analysis service for Beatly.

Provides BPM detection, key estimation, energy analysis, and stem separation.
Uses librosa for audio analysis and optionally Demucs for stem separation.
"""

import json
import hashlib
from pathlib import Path
from typing import Optional
import asyncio

import httpx
import numpy as np

from app.config import get_settings

settings = get_settings()

# Camelot wheel mapping for key compatibility
CAMELOT_MAP = {
    # Minor keys (A)
    "A minor": (8, "A"), "A# minor": (3, "A"), "Bb minor": (3, "A"),
    "B minor": (10, "A"),
    "C minor": (5, "A"),
    "C# minor": (12, "A"), "Db minor": (12, "A"),
    "D minor": (7, "A"),
    "D# minor": (2, "A"), "Eb minor": (2, "A"),
    "E minor": (9, "A"),
    "F minor": (4, "A"),
    "F# minor": (11, "A"), "Gb minor": (11, "A"),
    "G minor": (6, "A"),
    "G# minor": (1, "A"), "Ab minor": (1, "A"),
    # Major keys (B)
    "A major": (11, "B"),
    "A# major": (6, "B"), "Bb major": (6, "B"),
    "B major": (1, "B"),
    "C major": (8, "B"),
    "C# major": (3, "B"), "Db major": (3, "B"),
    "D major": (10, "B"),
    "D# major": (5, "B"), "Eb major": (5, "B"),
    "E major": (12, "B"),
    "F major": (7, "B"),
    "F# major": (4, "B"), "Gb major": (4, "B"),
    "G major": (9, "B"),
    "G# major": (2, "B"), "Ab major": (2, "B"),
}

# Key name to short form
KEY_SHORT_NAMES = {
    "A minor": "Am", "A# minor": "A#m", "Bb minor": "Bbm",
    "B minor": "Bm", "C minor": "Cm", "C# minor": "C#m",
    "Db minor": "Dbm", "D minor": "Dm", "D# minor": "D#m",
    "Eb minor": "Ebm", "E minor": "Em", "F minor": "Fm",
    "F# minor": "F#m", "Gb minor": "Gbm", "G minor": "Gm",
    "G# minor": "G#m", "Ab minor": "Abm",
    "A major": "A", "A# major": "A#", "Bb major": "Bb",
    "B major": "B", "C major": "C", "C# major": "C#",
    "Db major": "Db", "D major": "D", "D# major": "D#",
    "Eb major": "Eb", "E major": "E", "F major": "F",
    "F# major": "F#", "Gb major": "Gb", "G major": "G",
    "G# major": "G#", "Ab major": "Ab",
}


async def download_audio_for_analysis(track_id: int, token: str) -> Optional[Path]:
    """
    Download audio from SoundCloud for analysis.

    Returns path to downloaded file, or None if download fails.
    Files are cached to avoid re-downloading.
    """
    audio_dir = settings.cache_dir / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    audio_path = audio_dir / f"{track_id}.mp3"

    # Return cached file if exists
    if audio_path.exists():
        return audio_path

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
            # Get track info
            track_response = await client.get(
                f"https://api.soundcloud.com/tracks/{track_id}",
                headers={"Authorization": f"OAuth {token}"},
            )

            if track_response.status_code != 200:
                return None

            track_data = track_response.json()

            # Try to get stream URL
            stream_url = track_data.get("stream_url")
            if not stream_url:
                # Try streams endpoint
                streams_response = await client.get(
                    f"https://api.soundcloud.com/tracks/{track_id}/streams",
                    headers={"Authorization": f"OAuth {token}"},
                )

                if streams_response.status_code == 200:
                    streams_data = streams_response.json()
                    stream_url = streams_data.get(
                        "http_mp3_128_url",
                        streams_data.get("progressive_url"),
                    )

            if not stream_url:
                return None

            # Download audio
            audio_response = await client.get(
                stream_url,
                headers={"Authorization": f"OAuth {token}"},
            )

            if audio_response.status_code != 200:
                return None

            # Save to file
            with open(audio_path, "wb") as f:
                f.write(audio_response.content)

            return audio_path

    except Exception as e:
        print(f"Error downloading audio: {e}")
        return None


def analyze_audio(track_id: int, audio_path: Path) -> dict:
    """
    Perform full audio analysis using librosa.

    Returns analysis dict with BPM, key, energy, beat grid, etc.
    """
    import librosa

    # Load audio
    y, sr = librosa.load(str(audio_path), sr=22050, mono=True)
    duration = len(y) / sr

    # BPM and beat detection
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    # Handle both scalar and array returns from librosa
    if hasattr(tempo, '__len__'):
        bpm = float(tempo[0]) if len(tempo) > 0 else 120.0
    else:
        bpm = float(tempo)

    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()

    # Downbeat detection (estimate every 4 beats)
    downbeats = beat_times[::4] if len(beat_times) >= 4 else beat_times

    # Key detection using chroma features
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_avg = np.mean(chroma, axis=1)

    # Simple key detection: find strongest pitch class
    key_index = int(np.argmax(chroma_avg))
    pitch_classes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

    # Estimate major/minor using correlation with typical profiles
    major_profile = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
    minor_profile = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

    # Rotate profiles to match detected key
    major_corr = np.corrcoef(np.roll(major_profile, key_index), chroma_avg)[0, 1]
    minor_corr = np.corrcoef(np.roll(minor_profile, key_index), chroma_avg)[0, 1]

    key_mode = "major" if major_corr > minor_corr else "minor"
    key_name = f"{pitch_classes[key_index]} {key_mode}"
    key_short = KEY_SHORT_NAMES.get(key_name, pitch_classes[key_index])

    # Get Camelot number
    camelot = CAMELOT_MAP.get(key_name, (8, "A"))
    key_number = camelot[0]

    # Energy analysis (RMS)
    rms = librosa.feature.rms(y=y)[0]
    energy = float(np.mean(rms))
    # Normalize energy to 0-1
    energy = min(1.0, energy / 0.1)

    # Energy curve (downsample for frontend)
    energy_curve = []
    chunk_size = len(rms) // 100
    if chunk_size > 0:
        for i in range(0, len(rms), chunk_size):
            chunk = rms[i:i + chunk_size]
            energy_curve.append(float(np.mean(chunk)))
    else:
        energy_curve = rms.tolist()

    # Normalize energy curve
    max_energy = max(energy_curve) if energy_curve else 1
    energy_curve = [e / max_energy for e in energy_curve]

    # Detect peaks/drops using onset strength
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    peaks_frames = librosa.util.peak_pick(onset_env, pre_max=3, post_max=3, pre_avg=3, post_avg=5, delta=0.5, wait=10)
    peaks = librosa.frames_to_time(peaks_frames, sr=sr).tolist()

    # Filter to significant peaks only
    if len(peaks) > 20:
        # Keep only top 20 peaks by onset strength
        peak_strengths = [onset_env[int(f)] for f in peaks_frames if int(f) < len(onset_env)]
        sorted_indices = np.argsort(peak_strengths)[-20:]
        peaks = [peaks[i] for i in sorted_indices if i < len(peaks)]
        peaks.sort()

    # Detect drops (sudden energy increases after low energy)
    drops = []
    for i in range(1, len(energy_curve) - 1):
        if energy_curve[i] < 0.3 and energy_curve[i + 1] > 0.6:
            drop_time = (i / len(energy_curve)) * duration
            drops.append(drop_time)

    # Calculate phrase markers (every 8 or 16 bars)
    if bpm > 0 and len(beat_times) > 0:
        bar_duration = (60 / bpm) * 4  # 4 beats per bar
        phrase_duration = bar_duration * 16  # 16-bar phrases

        phrase_markers = []
        current = beat_times[0] if beat_times else 0
        while current < duration:
            phrase_markers.append(current)
            current += phrase_duration
    else:
        phrase_markers = []

    return {
        "trackId": track_id,
        "bpm": round(bpm, 1),
        "key": key_short,
        "keyNumber": key_number,
        "keyMode": key_mode,
        "energy": round(energy, 3),
        "energyCurve": [round(e, 3) for e in energy_curve[:100]],
        "beatGrid": {
            "bpm": round(bpm, 1),
            "downbeats": [round(d, 3) for d in downbeats[:50]],
            "beats": [round(b, 3) for b in beat_times[:200]],
            "barLength": 4,
        },
        "drops": [round(d, 3) for d in drops[:10]],
        "peaks": [round(p, 3) for p in peaks[:20]],
        "phraseMarkers": [round(m, 3) for m in phrase_markers[:20]],
    }


def cache_analysis(track_id: int, analysis: dict) -> None:
    """Save analysis to disk cache."""
    cache_path = settings.analysis_dir / f"{track_id}.json"
    with open(cache_path, "w") as f:
        json.dump(analysis, f)


def get_cached_analysis(track_id: int) -> Optional[dict]:
    """Load analysis from disk cache."""
    cache_path = settings.analysis_dir / f"{track_id}.json"
    if cache_path.exists():
        with open(cache_path, "r") as f:
            return json.load(f)
    return None


async def separate_stems(track_id: int, audio_path: Path) -> dict:
    """
    Separate audio into stems using Demucs.

    Returns dict with stem URLs/paths and status.
    """
    stem_dir = settings.stems_dir / str(track_id)
    stem_dir.mkdir(parents=True, exist_ok=True)

    status_file = stem_dir / "status.json"

    # Check if already done
    if (stem_dir / "drums.wav").exists():
        return get_stem_status(track_id)

    # Update status to processing
    status = {
        "trackId": track_id,
        "status": "processing",
    }
    with open(status_file, "w") as f:
        json.dump(status, f)

    try:
        # Try to import demucs
        try:
            import demucs.separate
            import torch

            # Run demucs separation
            # Use htdemucs model (4 stems: drums, bass, vocals, other)
            device = settings.demucs_device
            if device == "cuda" and not torch.cuda.is_available():
                device = "cpu"

            # Run in separate process to avoid blocking
            import sys
            cmd = [
                sys.executable, "-m", "demucs.separate",
                "-n", settings.demucs_model,
                "-d", device,
                "-o", str(stem_dir.parent),
                str(audio_path)
            ]

            import subprocess
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

            if result.returncode != 0:
                raise Exception(f"Demucs failed: {result.stderr}")

            # Move stems to correct location
            demucs_output = stem_dir.parent / settings.demucs_model / audio_path.stem
            for stem_name in ["drums", "bass", "vocals", "other"]:
                src = demucs_output / f"{stem_name}.wav"
                dst = stem_dir / f"{stem_name}.wav"
                if src.exists():
                    src.rename(dst)

        except ImportError:
            # Demucs not installed, use fallback pseudo-stems
            await create_pseudo_stems(audio_path, stem_dir)

        # Update status to ready
        status = {
            "trackId": track_id,
            "status": "ready",
            "drums": f"/api/tracks/{track_id}/stems/drums",
            "bass": f"/api/tracks/{track_id}/stems/bass",
            "vocals": f"/api/tracks/{track_id}/stems/vocals",
            "other": f"/api/tracks/{track_id}/stems/other",
        }
        with open(status_file, "w") as f:
            json.dump(status, f)

        return status

    except Exception as e:
        status = {
            "trackId": track_id,
            "status": "error",
            "error": str(e),
        }
        with open(status_file, "w") as f:
            json.dump(status, f)
        return status


async def create_pseudo_stems(audio_path: Path, output_dir: Path) -> None:
    """
    Create pseudo-stems using EQ/filtering when Demucs is not available.

    This is a fallback that uses spectral filtering to approximate stems:
    - Drums: High-pass + transient emphasis
    - Bass: Low-pass filter
    - Vocals: Mid-range band-pass
    - Other: Inverse of above
    """
    import librosa
    import soundfile as sf

    # Load audio
    y, sr = librosa.load(str(audio_path), sr=44100, mono=False)
    if y.ndim == 1:
        y = np.stack([y, y])

    # Convert to mono for processing
    y_mono = librosa.to_mono(y)

    # Drums: Emphasize transients and high frequencies
    # Use harmonic-percussive separation
    y_harmonic, y_percussive = librosa.effects.hpss(y_mono)
    drums = y_percussive

    # Bass: Low-pass filter below 200Hz
    bass = librosa.effects.preemphasis(y_mono, coef=-0.97)
    # Simple low-pass using FFT
    stft = librosa.stft(y_mono)
    freqs = librosa.fft_frequencies(sr=sr)
    bass_mask = freqs < 200
    stft_bass = stft.copy()
    stft_bass[~bass_mask, :] = 0
    bass = librosa.istft(stft_bass)

    # Vocals: Band-pass 300Hz - 4kHz
    vocal_mask = (freqs > 300) & (freqs < 4000)
    stft_vocals = stft.copy()
    stft_vocals[~vocal_mask, :] = 0
    vocals = librosa.istft(stft_vocals)

    # Other: Everything else (harmonic content)
    other = y_harmonic

    # Normalize and save
    for name, stem in [("drums", drums), ("bass", bass), ("vocals", vocals), ("other", other)]:
        # Normalize
        max_val = np.max(np.abs(stem))
        if max_val > 0:
            stem = stem / max_val * 0.9

        # Ensure same length as original
        if len(stem) < len(y_mono):
            stem = np.pad(stem, (0, len(y_mono) - len(stem)))
        else:
            stem = stem[:len(y_mono)]

        # Save as wav
        output_path = output_dir / f"{name}.wav"
        sf.write(str(output_path), stem, sr)


def get_stem_status(track_id: int) -> Optional[dict]:
    """Get stem separation status for a track."""
    status_file = settings.stems_dir / str(track_id) / "status.json"
    if status_file.exists():
        with open(status_file, "r") as f:
            return json.load(f)
    return None


def calculate_compatibility_score(analysis_a: dict, analysis_b: dict) -> int:
    """
    Calculate mix compatibility score between two tracks.

    Returns score 0-100 based on BPM, key, and energy compatibility.
    """
    # BPM compatibility (40% weight)
    bpm_a = analysis_a["bpm"]
    bpm_b = analysis_b["bpm"]
    bpm_ratio = bpm_a / bpm_b if bpm_b > 0 else 1

    bpm_diff = abs(1 - bpm_ratio) * 100
    if bpm_diff < 1:
        bpm_score = 100
    elif bpm_diff < 3:
        bpm_score = 95
    elif bpm_diff < 6:
        bpm_score = 85
    elif bpm_diff < 10:
        bpm_score = 70
    else:
        # Check double/half time
        double_diff = abs(1 - bpm_ratio * 2) * 100
        half_diff = abs(1 - bpm_ratio / 2) * 100
        if min(double_diff, half_diff) < 6:
            bpm_score = 80
        else:
            bpm_score = max(10, 50 - bpm_diff)

    # Key compatibility (35% weight)
    key_a = f"{analysis_a['key'].replace('m', ' minor') if 'm' in analysis_a['key'] else analysis_a['key'] + ' major'}"
    key_b = f"{analysis_b['key'].replace('m', ' minor') if 'm' in analysis_b['key'] else analysis_b['key'] + ' major'}"

    # Normalize key names
    def normalize_key(key: str) -> str:
        key = key.strip()
        # Handle short forms
        if key.endswith("m") and " " not in key:
            return key[:-1] + " minor"
        if " " not in key:
            return key + " major"
        return key

    key_a = normalize_key(analysis_a["key"])
    key_b = normalize_key(analysis_b["key"])

    camelot_a = CAMELOT_MAP.get(key_a, (8, "A"))
    camelot_b = CAMELOT_MAP.get(key_b, (8, "A"))

    num_a, mode_a = camelot_a
    num_b, mode_b = camelot_b

    if num_a == num_b and mode_a == mode_b:
        key_score = 100  # Perfect match
    elif num_a == num_b:
        key_score = 80  # Relative major/minor
    else:
        distance = min(abs(num_a - num_b), 12 - abs(num_a - num_b))
        if distance == 1 and mode_a == mode_b:
            key_score = 90  # Adjacent
        elif distance == 1:
            key_score = 65  # Adjacent different mode
        elif distance <= 2:
            key_score = 55
        else:
            key_score = max(20, 50 - distance * 5)

    # Energy flow (25% weight)
    energy_a = analysis_a["energy"]
    energy_b = analysis_b["energy"]
    energy_diff = energy_b - energy_a

    if 0 <= energy_diff < 0.15:
        energy_score = 100  # Slight increase is ideal
    elif abs(energy_diff) < 0.1:
        energy_score = 95  # Similar energy
    elif 0.15 <= energy_diff < 0.3:
        energy_score = 85  # Moderate increase
    elif -0.15 <= energy_diff < 0:
        energy_score = 80  # Slight decrease
    elif abs(energy_diff) < 0.3:
        energy_score = 70
    elif abs(energy_diff) < 0.5:
        energy_score = 55
    else:
        energy_score = 40

    # Weighted average
    total_score = int(bpm_score * 0.4 + key_score * 0.35 + energy_score * 0.25)

    return total_score


def calculate_mix_compatibility(analysis_a: dict, analysis_b: dict) -> dict:
    """
    Calculate detailed mix compatibility between two tracks.

    Returns dict with overall score and breakdown.
    """
    # Calculate individual scores
    bpm_a = analysis_a["bpm"]
    bpm_b = analysis_b["bpm"]
    bpm_ratio = bpm_a / bpm_b if bpm_b > 0 else 1
    bpm_diff = abs(1 - bpm_ratio) * 100

    if bpm_diff < 1:
        bpm_score = 100
    elif bpm_diff < 3:
        bpm_score = 95
    elif bpm_diff < 6:
        bpm_score = 85
    elif bpm_diff < 10:
        bpm_score = 70
    else:
        double_diff = abs(1 - bpm_ratio * 2) * 100
        half_diff = abs(1 - bpm_ratio / 2) * 100
        if min(double_diff, half_diff) < 6:
            bpm_score = 80
        else:
            bpm_score = max(10, 50 - int(bpm_diff))

    # Key score (reuse logic from above)
    def normalize_key(key: str) -> str:
        key = key.strip()
        if key.endswith("m") and " " not in key:
            return key[:-1] + " minor"
        if " " not in key:
            return key + " major"
        return key

    key_a = normalize_key(analysis_a["key"])
    key_b = normalize_key(analysis_b["key"])

    camelot_a = CAMELOT_MAP.get(key_a, (8, "A"))
    camelot_b = CAMELOT_MAP.get(key_b, (8, "A"))

    num_a, mode_a = camelot_a
    num_b, mode_b = camelot_b

    if num_a == num_b and mode_a == mode_b:
        key_score = 100
    elif num_a == num_b:
        key_score = 80
    else:
        distance = min(abs(num_a - num_b), 12 - abs(num_a - num_b))
        if distance == 1 and mode_a == mode_b:
            key_score = 90
        elif distance == 1:
            key_score = 65
        elif distance <= 2:
            key_score = 55
        else:
            key_score = max(20, 50 - distance * 5)

    # Energy score
    energy_a = analysis_a["energy"]
    energy_b = analysis_b["energy"]
    energy_diff = energy_b - energy_a

    if 0 <= energy_diff < 0.15:
        energy_score = 100
    elif abs(energy_diff) < 0.1:
        energy_score = 95
    elif 0.15 <= energy_diff < 0.3:
        energy_score = 85
    elif -0.15 <= energy_diff < 0:
        energy_score = 80
    elif abs(energy_diff) < 0.3:
        energy_score = 70
    elif abs(energy_diff) < 0.5:
        energy_score = 55
    else:
        energy_score = 40

    # Overall score
    overall_score = int(bpm_score * 0.4 + key_score * 0.35 + energy_score * 0.25)

    # Generate recommendation
    if overall_score >= 90:
        recommendation = "Perfect match! These tracks will blend seamlessly."
    elif overall_score >= 80:
        recommendation = "Great mix! Minor adjustments may be needed."
    elif overall_score >= 70:
        recommendation = "Good mix. Consider tempo sync and EQ adjustments."
    elif overall_score >= 60:
        recommendation = "Challenging mix. Use longer transition or different technique."
    elif overall_score >= 50:
        recommendation = "Difficult mix. Consider using a bridge track."
    else:
        recommendation = "Not recommended. These tracks may clash."

    return {
        "score": overall_score,
        "bpmMatch": bpm_score,
        "keyMatch": key_score,
        "energyFlow": energy_score,
        "recommendation": recommendation,
    }
