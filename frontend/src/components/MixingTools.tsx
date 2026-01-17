import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { getAudioEngine } from '../audio/AudioEngine';
import { DrumsIcon, HouseIcon, HipHopIcon, TechnoIcon, CrossfadeIcon, CutIcon, EQIcon, AutoMixIcon, MixerIcon } from './Icons';

interface MixingToolsProps {
  onCrossfadeChange: (value: number) => void;
}

// Drum patterns
const DRUM_PATTERNS = [
  { name: 'Basic', IconComponent: DrumsIcon, description: 'Simple kick and snare' },
  { name: 'House', IconComponent: HouseIcon, description: 'Four on the floor' },
  { name: 'HipHop', IconComponent: HipHopIcon, description: 'Boom bap groove' },
  { name: 'Techno', IconComponent: TechnoIcon, description: 'Driving kick pattern' },
];

// Transition types for auto mix
const TRANSITION_TYPES = [
  { name: 'Smooth', IconComponent: CrossfadeIcon, description: 'Gradual crossfade' },
  { name: 'Cut', IconComponent: CutIcon, description: 'Quick cut transition' },
  { name: 'EQ Swap', IconComponent: EQIcon, description: 'Bass swap transition' },
];

export const MixingTools: React.FC<MixingToolsProps> = ({ onCrossfadeChange }) => {
  const store = useStore();
  const { deckA, deckB, tracks } = store;
  const [crossfader, setCrossfader] = useState(0);
  const [isAutoMixing, setIsAutoMixing] = useState(false);
  const [fadeTime, setFadeTime] = useState(8); // seconds
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [drumLoopOn, setDrumLoopOn] = useState(false);
  const [drumBpm, setDrumBpm] = useState(120);
  const [drumVolume, setDrumVolume] = useState(60);
  const [drumPattern, setDrumPattern] = useState(0);
  const [masterTime, setMasterTime] = useState({ current: 0, duration: 0 });
  const masterTimelineRef = useRef<HTMLDivElement>(null);

  // Enhanced Auto Mix state
  const [autoMixEnabled, setAutoMixEnabled] = useState(false);
  const [transitionType, setTransitionType] = useState(0);
  const [transitionTrigger, setTransitionTrigger] = useState(30); // seconds before end
  const [countdown, setCountdown] = useState<number | null>(null);
  const [nextTrackIndex, setNextTrackIndex] = useState(0);
  const autoMixRef = useRef<{ interval: number | null; nextDeck: 'A' | 'B' }>({ interval: null, nextDeck: 'B' });

  const audioEngine = getAudioEngine();

  // Sync drum BPM with playing deck
  useEffect(() => {
    if (deckA.isPlaying && deckA.analysis?.bpm) {
      setDrumBpm(Math.round(deckA.analysis.bpm));
    } else if (deckB.isPlaying && deckB.analysis?.bpm) {
      setDrumBpm(Math.round(deckB.analysis.bpm));
    }
  }, [deckA.isPlaying, deckB.isPlaying, deckA.analysis?.bpm, deckB.analysis?.bpm]);

  // Update master timeline based on active deck
  useEffect(() => {
    if (!deckA.isPlaying && !deckB.isPlaying) {
      return;
    }

    const interval = setInterval(() => {
      // Use the primary playing deck for master timeline
      const activeDeck = deckA.isPlaying ? 'A' : 'B';
      const currentTime = audioEngine.getCurrentTime(activeDeck);
      const duration = deckA.isPlaying
        ? (deckA.track?.duration || 0) / 1000
        : (deckB.track?.duration || 0) / 1000;

      setMasterTime({ current: currentTime, duration });
    }, 100);

    return () => clearInterval(interval);
  }, [deckA.isPlaying, deckB.isPlaying, audioEngine, deckA.track, deckB.track]);

  const handleCrossfade = (value: number) => {
    setCrossfader(value);
    onCrossfadeChange(value);
    audioEngine.setCrossfader(value);
  };

  // Toggle drum loop
  const toggleDrumLoop = async () => {
    await audioEngine.resume();

    if (drumLoopOn) {
      audioEngine.stopDrumLoop();
      setDrumLoopOn(false);
    } else {
      audioEngine.setDrumLoopVolume(drumVolume / 100);
      audioEngine.startDrumLoop(drumBpm);
      setDrumLoopOn(true);
    }
  };

  // Update drum BPM
  const handleDrumBpmChange = (bpm: number) => {
    setDrumBpm(bpm);
    if (drumLoopOn) {
      audioEngine.setDrumLoopBpm(bpm);
    }
  };

  // Update drum volume
  const handleDrumVolumeChange = (vol: number) => {
    setDrumVolume(vol);
    audioEngine.setDrumLoopVolume(vol / 100);
  };

  // Auto crossfade - performs smooth crossfade between decks
  const startAutoMix = async (direction: 'AtoB' | 'BtoA') => {
    if (isAutoMixing) return;

    // Ensure audio context is active
    await audioEngine.resume();

    setIsAutoMixing(true);

    const endValue = direction === 'AtoB' ? 1 : -1;
    const startValue = crossfader; // Start from current position
    const totalDistance = Math.abs(endValue - startValue);

    // If already at destination, skip
    if (totalDistance < 0.05) {
      setIsAutoMixing(false);
      return;
    }

    const steps = fadeTime * 20; // 20 updates per second
    const increment = (endValue - startValue) / steps;

    let currentValue = startValue;

    const interval = setInterval(() => {
      currentValue += increment;

      const reachedEnd = direction === 'AtoB'
        ? currentValue >= endValue
        : currentValue <= endValue;

      if (reachedEnd) {
        currentValue = endValue;
        clearInterval(interval);
        setIsAutoMixing(false);

        // Stop the source deck when fully faded
        if (direction === 'AtoB' && currentValue >= 0.95) {
          audioEngine.stop('A');
          store.setDeckPlaying('A', false);
        } else if (direction === 'BtoA' && currentValue <= -0.95) {
          audioEngine.stop('B');
          store.setDeckPlaying('B', false);
        }
      }

      setCrossfader(currentValue);
      audioEngine.setCrossfader(currentValue);
      onCrossfadeChange(currentValue);
    }, 50);
  };

  // Sync BPM between decks
  const syncBPM = useCallback(() => {
    if (!deckA.analysis?.bpm || !deckB.analysis?.bpm) return;

    const targetBpm = deckA.isPlaying ? deckA.analysis.bpm : deckB.analysis.bpm;
    const sourceDeck = deckA.isPlaying ? 'B' : 'A';
    const sourceAnalysis = sourceDeck === 'A' ? deckA.analysis : deckB.analysis;

    if (sourceAnalysis?.bpm) {
      const rate = targetBpm / sourceAnalysis.bpm;
      audioEngine.setPlaybackRate(sourceDeck, rate);
      store.setDeckPlaybackRate(sourceDeck, rate);
    }

    setSyncEnabled(true);
  }, [deckA.analysis?.bpm, deckB.analysis?.bpm, deckA.isPlaying, audioEngine, store]);

  // Load and start next track on the inactive deck
  const loadNextTrack = useCallback(async (targetDeck: 'A' | 'B') => {
    if (tracks.length === 0) return false;

    // Find next track that's not currently playing
    const currentTrackId = targetDeck === 'A' ? deckB.track?.id : deckA.track?.id;
    let nextIdx = nextTrackIndex;

    // Find a track that's not the current one
    for (let i = 0; i < tracks.length; i++) {
      const idx = (nextTrackIndex + i) % tracks.length;
      if (tracks[idx].id !== currentTrackId) {
        nextIdx = idx;
        break;
      }
    }

    const nextTrack = tracks[nextIdx];
    if (!nextTrack) return false;

    // Update next track index for future use
    setNextTrackIndex((nextIdx + 1) % tracks.length);

    // Load the track
    const streamUrl = `/api/uploads/tracks/${nextTrack.id}/stream`;
    audioEngine.clearTrackCache(nextTrack.id);
    await audioEngine.loadTrack(nextTrack.id, streamUrl, true);

    // Set up deck
    store.setDeckTrack(targetDeck, nextTrack);

    // Try to get analysis
    try {
      const response = await fetch(`/api/uploads/tracks/${nextTrack.id}/analyze`, { method: 'POST' });
      if (response.ok) {
        const analysis = await response.json();
        store.cacheAnalysis(nextTrack.id, analysis);
        store.setDeckAnalysis(targetDeck, analysis);
      }
    } catch {
      // Analysis optional
    }

    return true;
  }, [tracks, nextTrackIndex, deckA.track?.id, deckB.track?.id, audioEngine, store]);

  // Start track on a deck
  const startDeck = useCallback(async (deck: 'A' | 'B') => {
    const deckState = deck === 'A' ? deckA : deckB;
    if (!deckState.track) {
      console.log(`[AutoMix] No track on deck ${deck}`);
      return false;
    }

    await audioEngine.resume();

    // Make sure track is loaded in audio engine
    const trackId = deckState.track.id;
    if (!audioEngine.getBuffer(trackId)) {
      console.log(`[AutoMix] Loading track ${trackId} for deck ${deck}`);
      const streamUrl = `/api/uploads/tracks/${trackId}/stream`;
      await audioEngine.loadTrack(trackId, streamUrl, true);
    }

    // Check if stems are available and use them
    const stemStatus = await fetch(`/api/uploads/tracks/${trackId}/stems/status`).then(r => r.ok ? r.json() : null).catch(() => null);

    if (stemStatus?.status === 'ready') {
      console.log(`[AutoMix] Playing deck ${deck} with stems`);
      await audioEngine.loadAllStems(trackId, false);
      await audioEngine.playStems(deck, trackId, 0, deckState.playbackRate);
    } else {
      console.log(`[AutoMix] Playing deck ${deck} without stems`);
      await audioEngine.play(deck, trackId, 0, deckState.playbackRate);
    }

    store.setDeckPlaying(deck, true);
    return true;
  }, [deckA, deckB, audioEngine, store]);

  // Perform the auto mix transition
  const performAutoMixTransition = useCallback(async () => {
    if (isAutoMixing) {
      console.log('[AutoMix] Already mixing, skipping');
      return;
    }

    const activeDeck = deckA.isPlaying && !deckB.isPlaying ? 'A' : deckB.isPlaying && !deckA.isPlaying ? 'B' : null;
    if (!activeDeck) {
      console.log('[AutoMix] No single active deck, skipping');
      return;
    }

    console.log(`[AutoMix] Starting transition from deck ${activeDeck}`);
    const targetDeck = activeDeck === 'A' ? 'B' : 'A';

    // Load next track if needed
    const targetState = targetDeck === 'A' ? deckA : deckB;
    if (!targetState.track) {
      console.log(`[AutoMix] Loading next track to deck ${targetDeck}`);
      const loaded = await loadNextTrack(targetDeck);
      if (!loaded) {
        console.log('[AutoMix] Failed to load next track');
        return;
      }
      // Small delay to let store update
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Start the target deck
    console.log(`[AutoMix] Starting deck ${targetDeck}`);
    const started = await startDeck(targetDeck);
    if (!started) {
      console.log(`[AutoMix] Failed to start deck ${targetDeck}`);
      return;
    }

    // Wait a moment for audio to actually start
    await new Promise(resolve => setTimeout(resolve, 200));

    // Sync BPM if both have analysis
    if (deckA.analysis?.bpm && deckB.analysis?.bpm) {
      console.log('[AutoMix] Syncing BPM');
      syncBPM();
    }

    // Start the crossfade
    const direction = activeDeck === 'A' ? 'AtoB' : 'BtoA';
    console.log(`[AutoMix] Starting crossfade ${direction}`);
    startAutoMix(direction);

    // Update ref for next transition
    autoMixRef.current.nextDeck = activeDeck;
  }, [isAutoMixing, deckA, deckB, loadNextTrack, startDeck, syncBPM]);

  // Monitor playback for auto mix trigger
  useEffect(() => {
    if (!autoMixEnabled) {
      setCountdown(null);
      return;
    }

    const checkInterval = setInterval(() => {
      // Determine which deck is active (solo playing)
      const activeDeck = deckA.isPlaying && !deckB.isPlaying ? 'A' : deckB.isPlaying && !deckA.isPlaying ? 'B' : null;

      if (!activeDeck || isAutoMixing) {
        setCountdown(null);
        return;
      }

      const deckState = activeDeck === 'A' ? deckA : deckB;
      const currentTime = audioEngine.getCurrentTime(activeDeck);
      const duration = deckState.track?.duration ? deckState.track.duration / 1000 : 0;

      if (duration <= 0) {
        setCountdown(null);
        return;
      }

      const timeRemaining = duration - currentTime;
      const triggerTime = transitionTrigger + fadeTime;

      if (timeRemaining <= triggerTime && timeRemaining > 0) {
        setCountdown(Math.ceil(timeRemaining - fadeTime));

        // Trigger transition when countdown reaches 0
        if (timeRemaining <= fadeTime + 1 && !isAutoMixing) {
          performAutoMixTransition();
        }
      } else {
        setCountdown(null);
      }
    }, 500);

    return () => clearInterval(checkInterval);
  }, [autoMixEnabled, deckA, deckB, isAutoMixing, transitionTrigger, fadeTime, audioEngine, performAutoMixTransition]);

  // For auto-mix, both decks should be playing
  const canMix = deckA.track && deckB.track;
  const bothPlaying = deckA.isPlaying && deckB.isPlaying;
  const anyPlaying = deckA.isPlaying || deckB.isPlaying;

  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Master play/pause all
  const toggleMasterPlayback = async () => {
    await audioEngine.resume();
    if (anyPlaying) {
      // Pause all
      if (deckA.isPlaying && deckA.track) {
        audioEngine.stop('A');
        store.setDeckPlaying('A', false);
      }
      if (deckB.isPlaying && deckB.track) {
        audioEngine.stop('B');
        store.setDeckPlaying('B', false);
      }
      if (drumLoopOn) {
        audioEngine.stopDrumLoop();
        setDrumLoopOn(false);
      }
    }
  };

  return (
    <div className="bg-gradient-to-b from-gray-900/90 to-gray-900/70 rounded-2xl border border-gray-800/50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Mixer</h2>
            <p className="text-xs text-gray-500">Crossfade & Sync</p>
          </div>
        </div>

        {isAutoMixing && (
          <div className="flex items-center gap-2 px-2 py-1 bg-violet-500/20 rounded-lg">
            <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
            <span className="text-xs text-violet-400">Mixing...</span>
          </div>
        )}
      </div>

      {/* Master Playback Bar */}
      <div className="mb-4 p-3 bg-gradient-to-r from-violet-900/30 via-gray-800/50 to-blue-900/30 rounded-xl border border-gray-700/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Master Mix</span>
          {anyPlaying && (
            <div className="flex items-center gap-1">
              <span className="flex gap-0.5">
                {[...Array(4)].map((_, i) => (
                  <span
                    key={i}
                    className="w-0.5 bg-gradient-to-t from-violet-500 to-blue-500 rounded-full animate-pulse"
                    style={{
                      height: `${8 + Math.random() * 8}px`,
                      animationDelay: `${i * 100}ms`,
                    }}
                  />
                ))}
              </span>
              <span className="text-[10px] text-green-400 ml-1">LIVE</span>
            </div>
          )}
        </div>

        {/* Master Timeline */}
        <div className="flex items-center gap-3">
          {/* Master Stop Button */}
          <button
            onClick={toggleMasterPlayback}
            disabled={!anyPlaying}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              anyPlaying
                ? 'bg-gradient-to-br from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-white shadow-lg shadow-red-500/30'
                : 'bg-gray-700 text-gray-500'
            }`}
            title={anyPlaying ? 'Stop all playback' : 'No tracks playing'}
          >
            {anyPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Timeline */}
          <div className="flex-1">
            <div
              ref={masterTimelineRef}
              className="relative h-3 bg-gray-700/50 rounded-full overflow-hidden cursor-pointer"
            >
              {/* Progress gradient showing both decks */}
              {deckA.isPlaying && (
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-500 to-violet-400 transition-all duration-100"
                  style={{
                    width: `${masterTime.duration > 0 ? (masterTime.current / masterTime.duration) * 100 : 0}%`,
                    opacity: crossfader <= 0 ? 1 : 0.5 - crossfader * 0.5,
                  }}
                />
              )}
              {deckB.isPlaying && (
                <div
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-100"
                  style={{
                    width: `${masterTime.duration > 0 ? (masterTime.current / masterTime.duration) * 100 : 0}%`,
                    opacity: crossfader >= 0 ? 1 : 0.5 + crossfader * 0.5,
                  }}
                />
              )}
              {/* Drum indicator overlay */}
              {drumLoopOn && (
                <div className="absolute inset-0 bg-orange-500/20 animate-pulse" />
              )}
            </div>

            {/* Time display */}
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-gray-500">{formatTime(masterTime.current)}</span>
              <span className="text-[10px] text-gray-500">
                {anyPlaying ? formatTime(masterTime.duration) : '--:--'}
              </span>
            </div>
          </div>

          {/* Active deck indicators */}
          <div className="flex flex-col gap-1">
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-medium ${
              deckA.isPlaying ? 'bg-violet-500/30 text-violet-400' : 'bg-gray-700/50 text-gray-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${deckA.isPlaying ? 'bg-violet-500 animate-pulse' : 'bg-gray-600'}`} />
              A
            </div>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-medium ${
              deckB.isPlaying ? 'bg-blue-500/30 text-blue-400' : 'bg-gray-700/50 text-gray-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${deckB.isPlaying ? 'bg-blue-500 animate-pulse' : 'bg-gray-600'}`} />
              B
            </div>
          </div>
        </div>
      </div>

      {/* AUTO MIX Control Panel */}
      <div className={`mb-4 p-3 rounded-xl border transition-all ${
        autoMixEnabled
          ? 'bg-gradient-to-br from-green-900/30 to-emerald-900/30 border-green-500/30'
          : 'bg-gray-800/50 border-gray-700/50'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <AutoMixIcon size={18} className="text-white" />
            </div>
            <div>
              <span className="text-xs font-medium text-white">AUTO MIX</span>
              {autoMixEnabled && (
                <span className="ml-2 text-[10px] text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">
                  ACTIVE
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setAutoMixEnabled(!autoMixEnabled)}
            className={`relative w-12 h-6 rounded-full transition-all ${
              autoMixEnabled ? 'bg-green-500' : 'bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow ${
                autoMixEnabled ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* Countdown display */}
        {autoMixEnabled && countdown !== null && countdown > 0 && (
          <div className="mb-3 p-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <span className="text-xs text-yellow-400">Transition in</span>
              </div>
              <span className="text-lg font-bold text-yellow-400">{countdown}s</span>
            </div>
            <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 transition-all"
                style={{ width: `${Math.max(0, 100 - (countdown / transitionTrigger) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Transition happening */}
        {isAutoMixing && (
          <div className="mb-3 p-2 bg-gradient-to-r from-violet-500/20 to-blue-500/20 rounded-lg border border-violet-500/30">
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className="w-1 bg-violet-500 rounded-full animate-pulse"
                    style={{
                      height: `${8 + Math.random() * 8}px`,
                      animationDelay: `${i * 100}ms`,
                    }}
                  />
                ))}
              </div>
              <span className="text-xs text-violet-400 font-medium">Mixing in progress...</span>
            </div>
          </div>
        )}

        {/* Settings when enabled */}
        {autoMixEnabled && (
          <div className="space-y-3">
            {/* Transition type */}
            <div>
              <span className="text-[10px] text-gray-500 mb-1.5 block">Transition Style</span>
              <div className="grid grid-cols-3 gap-1">
                {TRANSITION_TYPES.map((type, index) => (
                  <button
                    key={type.name}
                    onClick={() => setTransitionType(index)}
                    className={`py-2 px-1 rounded-lg text-center transition-all ${
                      transitionType === index
                        ? 'bg-green-500/30 border border-green-500/50'
                        : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent'
                    }`}
                    title={type.description}
                  >
                    <type.IconComponent size={20} className={`mx-auto ${transitionType === index ? 'text-green-400' : 'text-gray-400'}`} />
                    <span className={`text-[8px] block mt-1 ${transitionType === index ? 'text-green-400' : 'text-gray-500'}`}>
                      {type.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Trigger timing */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">Start transition before end</span>
                <span className="text-xs font-medium text-white">{transitionTrigger}s</span>
              </div>
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={transitionTrigger}
                onChange={(e) => setTransitionTrigger(parseInt(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #10b981 0%, #10b981 ${((transitionTrigger - 10) / 50) * 100}%, #374151 ${((transitionTrigger - 10) / 50) * 100}%, #374151 100%)`,
                }}
              />
            </div>

            {/* Next track preview */}
            {tracks.length > 1 && (
              <div className="p-2 bg-gray-700/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">Next up:</span>
                  <span className="text-[10px] text-gray-400 truncate max-w-[150px]">
                    {tracks[nextTrackIndex]?.title || 'No track'}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick tip when disabled */}
        {!autoMixEnabled && (
          <p className="text-[10px] text-gray-500 text-center">
            Enable to automatically mix between tracks
          </p>
        )}
      </div>

      {/* Deck Status */}
      <div className="grid grid-cols-2 gap-2 mb-4 p-2 bg-gray-800/50 rounded-xl">
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${deckA.isPlaying ? 'bg-violet-500/20' : 'bg-gray-700/50'}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${deckA.isPlaying ? 'bg-violet-500 text-white' : 'bg-gray-600 text-gray-400'}`}>
            A
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-medium truncate ${deckA.track ? 'text-white' : 'text-gray-500'}`}>
              {deckA.track?.title || 'No track'}
            </p>
            <p className={`text-[10px] ${deckA.isPlaying ? 'text-violet-400' : 'text-gray-500'}`}>
              {deckA.isPlaying ? 'Playing' : deckA.track ? 'Ready' : 'Empty'}
            </p>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${deckB.isPlaying ? 'bg-blue-500/20' : 'bg-gray-700/50'}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${deckB.isPlaying ? 'bg-blue-500 text-white' : 'bg-gray-600 text-gray-400'}`}>
            B
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-xs font-medium truncate ${deckB.track ? 'text-white' : 'text-gray-500'}`}>
              {deckB.track?.title || 'No track'}
            </p>
            <p className={`text-[10px] ${deckB.isPlaying ? 'text-blue-400' : 'text-gray-500'}`}>
              {deckB.isPlaying ? 'Playing' : deckB.track ? 'Ready' : 'Empty'}
            </p>
          </div>
        </div>
      </div>

      {/* Drum Machine Section */}
      <div className="mb-4 p-3 bg-gradient-to-br from-orange-900/20 to-red-900/20 rounded-xl border border-orange-500/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <DrumsIcon size={18} className="text-white" />
            </div>
            <span className="text-xs font-medium text-orange-400">DRUM MACHINE</span>
            {drumLoopOn && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 rounded-full">
                <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                <span className="text-[9px] text-orange-400">Active</span>
              </span>
            )}
          </div>
          <button
            onClick={toggleDrumLoop}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              drumLoopOn
                ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
          >
            {drumLoopOn ? 'Stop' : 'Start'}
          </button>
        </div>

        {/* Pattern Selection */}
        <div className="mb-3">
          <span className="text-[10px] text-gray-500 mb-1.5 block">Pattern</span>
          <div className="grid grid-cols-4 gap-1">
            {DRUM_PATTERNS.map((pattern, index) => (
              <button
                key={pattern.name}
                onClick={() => setDrumPattern(index)}
                className={`py-2 px-1 rounded-lg text-center transition-all ${
                  drumPattern === index
                    ? 'bg-orange-500/30 border border-orange-500/50'
                    : 'bg-gray-700/50 hover:bg-gray-700 border border-transparent'
                }`}
                title={pattern.description}
              >
                <pattern.IconComponent size={20} className={`mx-auto ${drumPattern === index ? 'text-orange-400' : 'text-gray-400'}`} />
                <span className={`text-[8px] block mt-1 ${drumPattern === index ? 'text-orange-400' : 'text-gray-500'}`}>
                  {pattern.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* BPM and Volume Controls */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500">BPM</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDrumBpmChange(Math.max(60, drumBpm - 1))}
                  className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 text-gray-400 text-xs"
                >
                  -
                </button>
                <span className="text-xs font-medium text-white w-8 text-center">{drumBpm}</span>
                <button
                  onClick={() => handleDrumBpmChange(Math.min(180, drumBpm + 1))}
                  className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 text-gray-400 text-xs"
                >
                  +
                </button>
              </div>
            </div>
            <input
              type="range"
              min="60"
              max="180"
              value={drumBpm}
              onChange={(e) => handleDrumBpmChange(parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #f97316 0%, #f97316 ${((drumBpm - 60) / 120) * 100}%, #374151 ${((drumBpm - 60) / 120) * 100}%, #374151 100%)`,
              }}
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500">Volume</span>
              <span className="text-xs font-medium text-white">{drumVolume}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={drumVolume}
              onChange={(e) => handleDrumVolumeChange(parseInt(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #f97316 0%, #f97316 ${drumVolume}%, #374151 ${drumVolume}%, #374151 100%)`,
              }}
            />
          </div>
        </div>

        {/* Sync BPM hint */}
        {anyPlaying && deckA.analysis?.bpm && (
          <button
            onClick={() => handleDrumBpmChange(Math.round(deckA.analysis?.bpm || 120))}
            className="mt-2 w-full py-1.5 bg-gray-700/50 hover:bg-gray-700 text-[10px] text-gray-400 hover:text-white rounded-lg transition-all"
          >
            Sync to track BPM ({Math.round(deckA.analysis?.bpm || 120)})
          </button>
        )}
      </div>

      {/* Crossfader */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-violet-400">A</span>
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Crossfader</span>
          <span className="text-xs font-medium text-blue-400">B</span>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-2 rounded-full bg-gradient-to-r from-violet-500/30 via-gray-700 to-blue-500/30" />
          </div>
          <input
            type="range"
            min="-1"
            max="1"
            step="0.01"
            value={crossfader}
            onChange={(e) => handleCrossfade(parseFloat(e.target.value))}
            disabled={isAutoMixing}
            className="relative w-full h-2 bg-transparent appearance-none cursor-pointer z-10"
          />
        </div>

        {/* Center marker */}
        <div className="flex justify-center mt-1">
          <div className="w-0.5 h-2 bg-gray-600 rounded" />
        </div>
      </div>

      {/* Auto Mix Controls */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <button
          onClick={() => startAutoMix('BtoA')}
          disabled={!bothPlaying || isAutoMixing}
          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-violet-500/20 hover:bg-violet-500/30 disabled:bg-gray-800/50 disabled:opacity-50 text-violet-400 disabled:text-gray-500 rounded-xl text-xs font-medium transition-all"
          title={!bothPlaying ? 'Both decks must be playing' : 'Crossfade to Deck A'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Fade to A
        </button>
        <button
          onClick={() => startAutoMix('AtoB')}
          disabled={!bothPlaying || isAutoMixing}
          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-gray-800/50 disabled:opacity-50 text-blue-400 disabled:text-gray-500 rounded-xl text-xs font-medium transition-all"
          title={!bothPlaying ? 'Both decks must be playing' : 'Crossfade to Deck B'}
        >
          Fade to B
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>

      {/* Hint when not mixing */}
      {!bothPlaying && canMix && (
        <div className="mb-4 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-[10px] text-yellow-500/80 text-center">
            {!deckA.isPlaying && !deckB.isPlaying
              ? 'Play tracks on both decks to enable mixing'
              : !deckA.isPlaying
                ? 'Play a track on Deck A to enable full mixing'
                : 'Play a track on Deck B to enable full mixing'}
          </p>
        </div>
      )}

      {/* Fade Time */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">Fade Duration</span>
          <span className="text-xs font-medium text-white">{fadeTime}s</span>
        </div>
        <input
          type="range"
          min="2"
          max="32"
          step="1"
          value={fadeTime}
          onChange={(e) => setFadeTime(parseInt(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${((fadeTime - 2) / 30) * 100}%, #374151 ${((fadeTime - 2) / 30) * 100}%, #374151 100%)`,
          }}
        />
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-600">2s</span>
          <span className="text-[10px] text-gray-600">32s</span>
        </div>
      </div>

      {/* Sync & Tools */}
      <div className="flex gap-2">
        <button
          onClick={syncBPM}
          disabled={!deckA.analysis?.bpm || !deckB.analysis?.bpm || !bothPlaying}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all ${
            syncEnabled
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50 disabled:text-gray-500'
          }`}
          title={
            !deckA.analysis?.bpm || !deckB.analysis?.bpm
              ? 'BPM analysis required for both tracks'
              : !bothPlaying
                ? 'Both decks must be playing'
                : 'Sync BPM of the incoming track to the playing track'
          }
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncEnabled ? 'Synced' : 'Sync BPM'}
        </button>

        <button
          onClick={() => {
            setCrossfader(0);
            audioEngine.setCrossfader(0);
            onCrossfadeChange(0);
          }}
          disabled={isAutoMixing}
          className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 rounded-xl text-xs font-medium transition-all"
        >
          Center
        </button>
      </div>

      {/* BPM Display */}
      {(deckA.analysis?.bpm || deckB.analysis?.bpm) && (
        <div className="mt-4 pt-4 border-t border-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <p className="text-[10px] text-gray-500 mb-1">DECK A</p>
              <p className="text-lg font-bold text-violet-400">
                {deckA.analysis?.bpm ? Math.round(deckA.analysis.bpm) : '--'}
              </p>
              <p className="text-[10px] text-gray-500">BPM</p>
            </div>

            <div className="flex flex-col items-center gap-1">
              {deckA.analysis?.bpm && deckB.analysis?.bpm && (
                <>
                  <span className={`text-xs font-medium ${
                    Math.abs(deckA.analysis.bpm - deckB.analysis.bpm) < 3
                      ? 'text-green-400'
                      : Math.abs(deckA.analysis.bpm - deckB.analysis.bpm) < 10
                        ? 'text-yellow-400'
                        : 'text-red-400'
                  }`}>
                    {Math.abs(deckA.analysis.bpm - deckB.analysis.bpm).toFixed(1)} BPM
                  </span>
                  <span className="text-[10px] text-gray-500">difference</span>
                </>
              )}
            </div>

            <div className="text-center">
              <p className="text-[10px] text-gray-500 mb-1">DECK B</p>
              <p className="text-lg font-bold text-blue-400">
                {deckB.analysis?.bpm ? Math.round(deckB.analysis.bpm) : '--'}
              </p>
              <p className="text-[10px] text-gray-500">BPM</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
