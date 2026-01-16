"""Tests for audio analysis functions."""

import pytest
from app.services.analysis import (
    calculate_compatibility_score,
    calculate_mix_compatibility,
    CAMELOT_MAP,
    KEY_SHORT_NAMES,
)


def create_mock_analysis(
    track_id: int = 1,
    bpm: float = 128.0,
    key: str = "Am",
    energy: float = 0.7,
) -> dict:
    """Create a mock analysis dict for testing."""
    return {
        "trackId": track_id,
        "bpm": bpm,
        "key": key,
        "keyNumber": 8,
        "keyMode": "minor",
        "energy": energy,
        "energyCurve": [0.5, 0.6, 0.7, 0.8, 0.7],
        "beatGrid": {
            "bpm": bpm,
            "downbeats": [0, 1.875, 3.75],
            "beats": [0, 0.46875, 0.9375, 1.40625, 1.875],
            "barLength": 4,
        },
        "drops": [60, 180],
        "peaks": [30, 90, 150],
        "phraseMarkers": [0, 30, 60, 90, 120],
    }


class TestCamelotMapping:
    """Tests for Camelot wheel key mapping."""

    def test_minor_keys_mapped(self):
        """All minor keys should be mapped."""
        minor_keys = [
            "A minor", "A# minor", "Bb minor", "B minor", "C minor",
            "C# minor", "Db minor", "D minor", "D# minor", "Eb minor",
            "E minor", "F minor", "F# minor", "Gb minor", "G minor",
            "G# minor", "Ab minor",
        ]
        for key in minor_keys:
            assert key in CAMELOT_MAP, f"{key} not in CAMELOT_MAP"
            num, mode = CAMELOT_MAP[key]
            assert mode == "A", f"{key} should map to A mode"
            assert 1 <= num <= 12, f"{key} Camelot number out of range"

    def test_major_keys_mapped(self):
        """All major keys should be mapped."""
        major_keys = [
            "A major", "A# major", "Bb major", "B major", "C major",
            "C# major", "Db major", "D major", "D# major", "Eb major",
            "E major", "F major", "F# major", "Gb major", "G major",
            "G# major", "Ab major",
        ]
        for key in major_keys:
            assert key in CAMELOT_MAP, f"{key} not in CAMELOT_MAP"
            num, mode = CAMELOT_MAP[key]
            assert mode == "B", f"{key} should map to B mode"
            assert 1 <= num <= 12, f"{key} Camelot number out of range"

    def test_enharmonic_equivalents(self):
        """Enharmonic equivalent keys should map to same Camelot position."""
        assert CAMELOT_MAP["A# minor"] == CAMELOT_MAP["Bb minor"]
        assert CAMELOT_MAP["C# minor"] == CAMELOT_MAP["Db minor"]
        assert CAMELOT_MAP["D# minor"] == CAMELOT_MAP["Eb minor"]
        assert CAMELOT_MAP["F# minor"] == CAMELOT_MAP["Gb minor"]
        assert CAMELOT_MAP["G# minor"] == CAMELOT_MAP["Ab minor"]


class TestCompatibilityScore:
    """Tests for compatibility scoring."""

    def test_identical_tracks_score_high(self):
        """Identical tracks should have perfect compatibility."""
        analysis_a = create_mock_analysis(bpm=128, key="Am", energy=0.7)
        analysis_b = create_mock_analysis(bpm=128, key="Am", energy=0.7)

        score = calculate_compatibility_score(analysis_a, analysis_b)
        assert score >= 95, f"Identical tracks should score >=95, got {score}"

    def test_similar_bpm_scores_well(self):
        """Tracks with similar BPM should score well."""
        analysis_a = create_mock_analysis(bpm=128, key="Am", energy=0.7)
        analysis_b = create_mock_analysis(bpm=130, key="Am", energy=0.7)

        score = calculate_compatibility_score(analysis_a, analysis_b)
        assert score >= 80, f"Similar BPM should score >=80, got {score}"

    def test_very_different_bpm_scores_low(self):
        """Tracks with very different BPM should score low."""
        analysis_a = create_mock_analysis(bpm=128, key="Am", energy=0.7)
        analysis_b = create_mock_analysis(bpm=90, key="Am", energy=0.7)

        score = calculate_compatibility_score(analysis_a, analysis_b)
        assert score < 70, f"Different BPM should score <70, got {score}"

    def test_double_time_compatibility(self):
        """Double-time BPM relationship should be reasonably compatible."""
        analysis_a = create_mock_analysis(bpm=128, key="Am", energy=0.7)
        analysis_b = create_mock_analysis(bpm=64, key="Am", energy=0.7)

        score = calculate_compatibility_score(analysis_a, analysis_b)
        assert score >= 60, f"Double-time should score >=60, got {score}"

    def test_adjacent_keys_compatible(self):
        """Adjacent keys on Camelot wheel should be compatible."""
        analysis_a = create_mock_analysis(bpm=128, key="Am", energy=0.7)
        # Dm is adjacent to Am on Camelot wheel
        analysis_b = create_mock_analysis(bpm=128, key="Dm", energy=0.7)

        score = calculate_compatibility_score(analysis_a, analysis_b)
        assert score >= 75, f"Adjacent keys should score >=75, got {score}"

    def test_energy_increase_preferred(self):
        """Slight energy increase should score well."""
        analysis_a = create_mock_analysis(bpm=128, key="Am", energy=0.6)
        analysis_b = create_mock_analysis(bpm=128, key="Am", energy=0.7)

        score = calculate_compatibility_score(analysis_a, analysis_b)
        assert score >= 90, f"Energy increase should score >=90, got {score}"


class TestMixCompatibility:
    """Tests for detailed mix compatibility calculation."""

    def test_returns_all_fields(self):
        """Should return all expected fields."""
        analysis_a = create_mock_analysis()
        analysis_b = create_mock_analysis()

        result = calculate_mix_compatibility(analysis_a, analysis_b)

        assert "score" in result
        assert "bpmMatch" in result
        assert "keyMatch" in result
        assert "energyFlow" in result
        assert "recommendation" in result

    def test_perfect_match_recommendation(self):
        """Perfect match should have appropriate recommendation."""
        analysis_a = create_mock_analysis(bpm=128, key="Am", energy=0.7)
        analysis_b = create_mock_analysis(bpm=128, key="Am", energy=0.75)

        result = calculate_mix_compatibility(analysis_a, analysis_b)

        assert result["score"] >= 90
        assert "perfect" in result["recommendation"].lower() or "great" in result["recommendation"].lower()

    def test_poor_match_recommendation(self):
        """Poor match should have warning recommendation."""
        analysis_a = create_mock_analysis(bpm=128, key="Am", energy=0.9)
        analysis_b = create_mock_analysis(bpm=90, key="F#m", energy=0.3)

        result = calculate_mix_compatibility(analysis_a, analysis_b)

        assert result["score"] < 60
        assert "difficult" in result["recommendation"].lower() or "not recommended" in result["recommendation"].lower()

    def test_individual_scores_valid_range(self):
        """Individual scores should be in 0-100 range."""
        analysis_a = create_mock_analysis()
        analysis_b = create_mock_analysis(bpm=125, key="Dm", energy=0.6)

        result = calculate_mix_compatibility(analysis_a, analysis_b)

        assert 0 <= result["bpmMatch"] <= 100
        assert 0 <= result["keyMatch"] <= 100
        assert 0 <= result["energyFlow"] <= 100
        assert 0 <= result["score"] <= 100


class TestKeyShortNames:
    """Tests for key short name mapping."""

    def test_all_keys_have_short_names(self):
        """All Camelot keys should have short name mappings."""
        for key in CAMELOT_MAP:
            assert key in KEY_SHORT_NAMES, f"{key} missing from KEY_SHORT_NAMES"

    def test_minor_keys_end_with_m(self):
        """Minor key short names should end with 'm'."""
        minor_keys = [k for k in KEY_SHORT_NAMES if "minor" in k]
        for key in minor_keys:
            short = KEY_SHORT_NAMES[key]
            assert short.endswith("m"), f"{key} short name should end with 'm', got {short}"

    def test_major_keys_no_m(self):
        """Major key short names should not end with 'm'."""
        major_keys = [k for k in KEY_SHORT_NAMES if "major" in k]
        for key in major_keys:
            short = KEY_SHORT_NAMES[key]
            assert not short.endswith("m"), f"{key} short name should not end with 'm', got {short}"
