import { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { getAudioEngine } from '../audio/AudioEngine';
import { StemControls } from './StemControls';
import type { DeckId, SoundCloudTrack, TrackAnalysis } from '../types';
import { getCamelotKey } from '../utils/compatibility';

// Local file stream URL
const getLocalStreamUrl = (trackId: number): string => {
  return `/api/uploads/tracks/${trackId}/stream`;
};

// Analyze uploaded track
const analyzeLocalTrack = async (trackId: number): Promise<TrackAnalysis> => {
  const response = await fetch(`/api/uploads/tracks/${trackId}/analyze`, {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('Analysis failed');
  }
  return response.json();
};

interface DJDeckProps {
  deck: DeckId;
}

export const DJDeck: React.FC<DJDeckProps> = ({ deck }) => {
  const store = useStore();
  const deckState = deck === 'A' ? store.deckA : store.deckB;
  const { tracks, currentTrackIndex, djMode } = store;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stemsReady, setStemsReady] = useState(false);
  const [useStemsMode, setUseStemsMode] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const audioEngine = getAudioEngine();

  // Load track into deck
  const loadTrack = useCallback(async (track: SoundCloudTrack) => {
    setLoading(true);
    setError(null);

    try {
      // Stop current playback
      audioEngine.stop(deck);

      // Update store
      store.setDeckTrack(deck, track);
      store.setDeckPlaying(deck, false);

      // Load audio from local uploads (force reload to prevent stale cache)
      const streamUrl = getLocalStreamUrl(track.id);
      audioEngine.clearTrackCache(track.id);
      await audioEngine.loadTrack(track.id, streamUrl, true);

      // Check if we have analysis cached
      const cachedAnalysis = store.getAnalysis(track.id);
      if (cachedAnalysis) {
        store.setDeckAnalysis(deck, cachedAnalysis);
      } else {
        // Request analysis in background
        setAnalyzing(true);
        try {
          const analysis = await analyzeLocalTrack(track.id);
          store.cacheAnalysis(track.id, analysis);
          store.setDeckAnalysis(deck, analysis);
        } catch {
          console.warn('Analysis failed, continuing without');
        } finally {
          setAnalyzing(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load track');
    } finally {
      setLoading(false);
    }
  }, [deck, store, audioEngine]);

  // Initialize deck A with first track, deck B with second track
  useEffect(() => {
    if (tracks.length === 0 || deckState.track) return;

    if (deck === 'A') {
      loadTrack(tracks[0]);
    } else if (deck === 'B' && tracks.length > 1) {
      // Auto-load second track into deck B
      loadTrack(tracks[1]);
    }
  }, [deck, tracks, deckState.track, loadTrack]);

  // Waveform visualization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Clear
      ctx.fillStyle = '#0f0f1a';
      ctx.fillRect(0, 0, width, height);

      if (deckState.isPlaying) {
        const waveform = audioEngine.getWaveformData(deck);

        // Draw waveform
        ctx.beginPath();
        ctx.strokeStyle = deck === 'A' ? '#8B5CF6' : '#3B82F6';
        ctx.lineWidth = 2;

        const sliceWidth = width / waveform.length;
        let x = 0;

        for (let i = 0; i < waveform.length; i++) {
          const v = waveform[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.stroke();
      } else {
        // Static waveform placeholder
        ctx.fillStyle = '#2a2a4a';
        ctx.fillRect(0, height / 2 - 2, width, 4);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [deck, deckState.isPlaying, audioEngine]);

  // Update playback time
  useEffect(() => {
    if (!deckState.isPlaying) return;

    const interval = setInterval(() => {
      const time = audioEngine.getCurrentTime(deck);
      store.setDeckCurrentTime(deck, time);
    }, 100);

    return () => clearInterval(interval);
  }, [deck, deckState.isPlaying, audioEngine, store]);

  // Play/Pause
  const togglePlay = async () => {
    console.log(`Toggle play on deck ${deck}, current state: ${deckState.isPlaying}`);

    await audioEngine.resume();

    // Debug audio engine state
    audioEngine.debug();

    if (deckState.isPlaying) {
      audioEngine.pause(deck);
      store.setDeckPlaying(deck, false);
    } else if (deckState.track) {
      console.log(`Starting playback of track ${deckState.track.id} on deck ${deck}`);

      // Use stems playback if stems mode is enabled
      if (useStemsMode && stemsReady) {
        await audioEngine.playStems(
          deck,
          deckState.track.id,
          deckState.currentTime,
          deckState.playbackRate
        );
      } else {
        await audioEngine.play(
          deck,
          deckState.track.id,
          deckState.currentTime,
          deckState.playbackRate
        );
      }
      store.setDeckPlaying(deck, true);
    }
  };

  // Track selection
  const handleTrackSelect = (trackIndex: number) => {
    const track = tracks[trackIndex];
    if (track) {
      loadTrack(track);
    }
  };

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get track duration in seconds
  const getTrackDuration = (): number => {
    if (deckState.track?.duration) {
      return deckState.track.duration / 1000;
    }
    // Fallback: get from audio buffer
    const buffer = audioEngine.getBuffer(deckState.track?.id ?? 0);
    return buffer?.duration ?? 0;
  };

  // Seek to position
  const seekTo = async (position: number) => {
    if (!deckState.track) return;

    const duration = getTrackDuration();
    const seekTime = Math.max(0, Math.min(position * duration, duration - 0.1));

    store.setDeckCurrentTime(deck, seekTime);

    // If playing, restart at new position
    if (deckState.isPlaying) {
      audioEngine.stop(deck);
      if (useStemsMode && stemsReady) {
        await audioEngine.playStems(deck, deckState.track.id, seekTime, deckState.playbackRate);
      } else {
        await audioEngine.play(deck, deckState.track.id, seekTime, deckState.playbackRate);
      }
    }
  };

  // Handle timeline click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || !deckState.track) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const position = (e.clientX - rect.left) / rect.width;
    seekTo(position);
  };

  // Handle timeline drag
  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!deckState.track) return;
    setIsSeeking(true);
    handleTimelineClick(e);
  };

  // Handle mouse move for seeking
  useEffect(() => {
    if (!isSeeking) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;
      const rect = timelineRef.current.getBoundingClientRect();
      const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekTo(position);
    };

    const handleMouseUp = () => {
      setIsSeeking(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSeeking, deckState.track, useStemsMode, stemsReady]);

  // Calculate progress percentage
  const getProgressPercent = (): number => {
    const duration = getTrackDuration();
    if (duration <= 0) return 0;
    return Math.min(100, (deckState.currentTime / duration) * 100);
  };

  const deckColor = deck === 'A' ? 'dj-purple' : 'dj-blue';
  const deckColorHex = deck === 'A' ? '#8B5CF6' : '#3B82F6';

  return (
    <div className={`bg-dj-dark rounded-xl p-6 border-2 border-${deckColor}/30`}>
      {/* Deck header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span
            className={`text-xl font-bold text-${deckColor}`}
          >
            Deck {deck}
          </span>
          {deckState.isPlaying && (
            <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          )}
        </div>
        {analyzing && (
          <span className="text-xs text-gray-400 flex items-center gap-2">
            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
            Analyzing...
          </span>
        )}
      </div>

      {/* Track info */}
      <div className="mb-4">
        {deckState.track ? (
          <div className="flex items-center gap-4">
            {/* Artwork */}
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
              {deckState.track.artwork_url ? (
                <img
                  src={deckState.track.artwork_url}
                  alt={deckState.track.title}
                  className={`w-full h-full object-cover ${deckState.isPlaying ? 'vinyl-spinning' : ''}`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl text-gray-600">
                  ♪
                </div>
              )}
            </div>

            {/* Track details */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{deckState.track.title}</h3>
              <p className="text-sm text-gray-400 truncate">
                {deckState.track.user.username}
              </p>
              {deckState.analysis && (
                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span className="text-dj-purple">
                    {Math.round(deckState.analysis.bpm)} BPM
                  </span>
                  <span className="text-dj-blue">
                    {getCamelotKey(deckState.analysis.key)}
                  </span>
                  <span className="text-dj-pink">
                    E: {Math.round(deckState.analysis.energy * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-gray-500 text-center py-4">
            {loading ? 'Loading track...' : 'No track loaded'}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Waveform */}
      <div className="mb-2">
        <canvas
          ref={canvasRef}
          width={400}
          height={60}
          className="w-full rounded-lg"
        />
      </div>

      {/* Timeline / Seek Bar */}
      <div className="mb-4">
        <div
          ref={timelineRef}
          onMouseDown={handleTimelineMouseDown}
          className={`relative h-8 bg-gray-800 rounded-lg cursor-pointer overflow-hidden group ${
            !deckState.track ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {/* Progress fill */}
          <div
            className="absolute top-0 left-0 h-full transition-all duration-100"
            style={{
              width: `${getProgressPercent()}%`,
              background: `linear-gradient(90deg, ${deckColorHex}40 0%, ${deckColorHex} 100%)`,
            }}
          />

          {/* Playhead */}
          <div
            className="absolute top-0 w-1 h-full bg-white shadow-lg transition-all duration-100"
            style={{ left: `calc(${getProgressPercent()}% - 2px)` }}
          />

          {/* Time markers */}
          <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
            <span className="text-xs font-medium text-white bg-black/50 px-1.5 py-0.5 rounded">
              {formatTime(deckState.currentTime)}
            </span>
            <span className="text-xs text-gray-400 bg-black/50 px-1.5 py-0.5 rounded">
              {deckState.track ? formatTime(getTrackDuration()) : '--:--'}
            </span>
          </div>

          {/* Hover effect */}
          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Quick seek buttons */}
        <div className="flex items-center justify-center gap-2 mt-2">
          <button
            onClick={() => seekTo(Math.max(0, (deckState.currentTime - 10) / getTrackDuration()))}
            disabled={!deckState.track}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded transition-colors"
            title="Back 10s"
          >
            -10s
          </button>
          <button
            onClick={() => seekTo(Math.max(0, (deckState.currentTime - 5) / getTrackDuration()))}
            disabled={!deckState.track}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded transition-colors"
            title="Back 5s"
          >
            -5s
          </button>
          <button
            onClick={() => seekTo(0)}
            disabled={!deckState.track}
            className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded font-medium transition-colors"
            title="Go to start"
          >
            ⏮
          </button>
          <button
            onClick={() => seekTo(Math.min(1, (deckState.currentTime + 5) / getTrackDuration()))}
            disabled={!deckState.track}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded transition-colors"
            title="Forward 5s"
          >
            +5s
          </button>
          <button
            onClick={() => seekTo(Math.min(1, (deckState.currentTime + 10) / getTrackDuration()))}
            disabled={!deckState.track}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded transition-colors"
            title="Forward 10s"
          >
            +10s
          </button>
        </div>
      </div>

      {/* Transport controls */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={togglePlay}
          disabled={!deckState.track || loading}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-50 ${
            deckState.isPlaying
              ? `bg-${deckColor} hover:bg-${deckColor}/80`
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          {loading ? (
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : deckState.isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>

      {/* Track selector */}
      <div className="mt-4">
        <label className="block text-xs text-gray-500 mb-2">Load Track</label>
        <select
          value={deckState.track?.id ?? ''}
          onChange={(e) => {
            const trackIndex = tracks.findIndex(
              (t) => t.id === Number(e.target.value)
            );
            if (trackIndex >= 0) {
              handleTrackSelect(trackIndex);
            }
          }}
          disabled={loading}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-dj-purple/50"
        >
          <option value="">Select a track...</option>
          {tracks.map((track, index) => (
            <option key={track.id} value={track.id}>
              {index + 1}. {track.title}
            </option>
          ))}
        </select>
      </div>

      {/* EQ Controls */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        {(['high', 'mid', 'low'] as const).map((band) => (
          <div key={band} className="text-center">
            <label className="block text-xs text-gray-500 mb-1 uppercase">
              {band}
            </label>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.1"
              value={deckState[`eq${band.charAt(0).toUpperCase()}${band.slice(1)}` as 'eqLow' | 'eqMid' | 'eqHigh']}
              onChange={(e) => {
                const value = parseFloat(e.target.value);
                store.setDeckEQ(deck, band, value);
                audioEngine.setEQ(deck, band, value);
              }}
              className="w-full h-20 -rotate-90 origin-center transform translate-y-6"
              style={{ writingMode: 'bt-lr' } as React.CSSProperties}
            />
          </div>
        ))}
      </div>

      {/* Stem Isolation Controls */}
      <StemControls
        deck={deck}
        trackId={deckState.track?.id ?? null}
        isPlaying={deckState.isPlaying}
        onStemsReady={(ready) => {
          setStemsReady(ready);
        }}
        onStemsModeChange={async (enabled) => {
          setUseStemsMode(enabled);
          // If currently playing, restart with new mode
          if (deckState.isPlaying && deckState.track) {
            const currentTime = audioEngine.getCurrentTime(deck);
            audioEngine.stop(deck);
            if (enabled) {
              await audioEngine.playStems(
                deck,
                deckState.track.id,
                currentTime,
                deckState.playbackRate
              );
            } else {
              await audioEngine.play(
                deck,
                deckState.track.id,
                currentTime,
                deckState.playbackRate
              );
            }
          }
        }}
      />
    </div>
  );
};
