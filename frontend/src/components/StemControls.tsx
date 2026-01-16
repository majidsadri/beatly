import { useState, useEffect } from 'react';
import { getAudioEngine, type StemName } from '../audio/AudioEngine';
import type { DeckId } from '../types';

interface StemControlsProps {
  deck: DeckId;
  trackId: number | null;
  isPlaying: boolean;
  onStemsReady: (ready: boolean) => void;
  onStemsModeChange?: (enabled: boolean) => void;
}

interface StemState {
  volume: number;
  muted: boolean;
  solo: boolean;
}

const STEMS: { name: StemName; label: string; icon: string; color: string; activeColor: string }[] = [
  { name: 'drums', label: 'DRUMS', icon: '◉', color: '#f97316', activeColor: 'rgba(249, 115, 22, 0.3)' },
  { name: 'bass', label: 'BASS', icon: '◎', color: '#8b5cf6', activeColor: 'rgba(139, 92, 246, 0.3)' },
  { name: 'vocals', label: 'VOCAL', icon: '◈', color: '#ec4899', activeColor: 'rgba(236, 72, 153, 0.3)' },
  { name: 'other', label: 'MELODY', icon: '◇', color: '#10b981', activeColor: 'rgba(16, 185, 129, 0.3)' },
];

export const StemControls: React.FC<StemControlsProps> = ({
  deck,
  trackId,
  isPlaying,
  onStemsReady,
  onStemsModeChange,
}) => {
  const [separating, setSeparating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stemsAvailable, setStemsAvailable] = useState(false);
  const [stemsEnabled, setStemsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stems, setStems] = useState<Record<StemName, StemState>>({
    drums: { volume: 1, muted: false, solo: false },
    bass: { volume: 1, muted: false, solo: false },
    vocals: { volume: 1, muted: false, solo: false },
    other: { volume: 1, muted: false, solo: false },
  });

  const audioEngine = getAudioEngine();

  // Check if stems are available when track changes
  useEffect(() => {
    if (!trackId) {
      setStemsAvailable(false);
      setStemsEnabled(false);
      return;
    }

    const checkStems = async () => {
      try {
        const response = await fetch(`/api/uploads/tracks/${trackId}/stems/status`);
        const data = await response.json();

        if (data.status === 'ready') {
          setStemsAvailable(true);
          onStemsReady(true);
        } else {
          setStemsAvailable(false);
          onStemsReady(false);
        }
      } catch {
        setStemsAvailable(false);
        onStemsReady(false);
      }
    };

    checkStems();
  }, [trackId, onStemsReady]);

  // Simulate progress during separation
  useEffect(() => {
    if (!separating) {
      setProgress(0);
      return;
    }

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [separating]);

  // Separate track into stems
  const handleSeparate = async () => {
    if (!trackId) return;

    setSeparating(true);
    setError(null);
    setProgress(0);

    try {
      const response = await fetch(`/api/uploads/tracks/${trackId}/stems`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.status === 'ready') {
        setProgress(100);
        setStemsAvailable(true);
        onStemsReady(true);
        await audioEngine.loadAllStems(trackId, true); // forceReload=true
      } else if (data.status === 'error') {
        setError(data.error || 'Separation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to separate stems');
    } finally {
      setSeparating(false);
    }
  };

  // Toggle stems mode
  const handleToggleStems = async () => {
    if (!trackId || !stemsAvailable) return;

    const newEnabled = !stemsEnabled;

    if (newEnabled) {
      const loaded = await audioEngine.loadAllStems(trackId, true); // forceReload=true
      if (!loaded) {
        setError('Failed to load stems');
        return;
      }
    }

    setStemsEnabled(newEnabled);
    onStemsModeChange?.(newEnabled);
  };

  // Update stem volume
  const handleVolumeChange = (stemName: StemName, volume: number) => {
    setStems(prev => ({
      ...prev,
      [stemName]: { ...prev[stemName], volume, muted: false },
    }));

    if (stemsEnabled) {
      audioEngine.setStemVolume(deck, stemName, volume);
    }
  };

  // Toggle mute
  const handleMute = (stemName: StemName) => {
    const newMuted = !stems[stemName].muted;
    setStems(prev => ({
      ...prev,
      [stemName]: { ...prev[stemName], muted: newMuted, solo: false },
    }));

    if (stemsEnabled) {
      audioEngine.setStemVolume(deck, stemName, newMuted ? 0 : stems[stemName].volume);
    }
  };

  // Toggle solo (mute all others)
  const handleSolo = (stemName: StemName) => {
    const wasSolo = stems[stemName].solo;

    setStems(prev => {
      const newStems = { ...prev };

      if (wasSolo) {
        // Un-solo: restore all volumes
        for (const name of Object.keys(newStems) as StemName[]) {
          newStems[name] = { ...newStems[name], solo: false, muted: false };
          if (stemsEnabled) {
            audioEngine.setStemVolume(deck, name, newStems[name].volume);
          }
        }
      } else {
        // Solo: mute all except this one
        for (const name of Object.keys(newStems) as StemName[]) {
          const isSoloed = name === stemName;
          newStems[name] = { ...newStems[name], solo: isSoloed, muted: !isSoloed };
          if (stemsEnabled) {
            audioEngine.setStemVolume(deck, name, isSoloed ? newStems[name].volume : 0);
          }
        }
      }

      return newStems;
    });
  };

  // Apply stem volumes when stems are enabled/disabled
  useEffect(() => {
    if (!trackId) return;

    if (stemsEnabled) {
      for (const stemName of Object.keys(stems) as StemName[]) {
        const stem = stems[stemName];
        audioEngine.setStemVolume(deck, stemName, stem.muted ? 0 : stem.volume);
      }
    }
  }, [stemsEnabled, trackId, deck, audioEngine]);

  const deckColor = deck === 'A' ? '#8b5cf6' : '#3b82f6';

  // Not available state - show separate button
  if (!stemsAvailable && !separating) {
    return (
      <div className="mt-4 p-4 bg-gradient-to-b from-gray-900/80 to-gray-900/40 rounded-xl border border-gray-800/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-600" />
            <span className="text-sm font-medium text-gray-400">STEM ISOLATION</span>
          </div>
        </div>

        <button
          onClick={handleSeparate}
          disabled={!trackId}
          className="w-full py-3 px-4 rounded-lg font-medium text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 active:scale-[0.98]"
        >
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            Separate into Stems
          </span>
        </button>

        <p className="text-xs text-gray-500 text-center mt-2">
          AI-powered separation into drums, bass, vocals & melody
        </p>
      </div>
    );
  }

  // Separating state - show progress
  if (separating) {
    return (
      <div className="mt-4 p-4 bg-gradient-to-b from-gray-900/80 to-gray-900/40 rounded-xl border border-gray-800/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            <span className="text-sm font-medium text-gray-300">SEPARATING STEMS</span>
          </div>
          <span className="text-xs text-gray-500">{Math.round(progress)}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Animated stem icons */}
        <div className="flex justify-center gap-4">
          {STEMS.map((stem, i) => (
            <div
              key={stem.name}
              className="flex flex-col items-center gap-1 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                style={{ backgroundColor: stem.activeColor, color: stem.color }}
              >
                {stem.icon}
              </div>
              <span className="text-[10px] text-gray-500">{stem.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Stems available - show controls
  return (
    <div className="mt-4 p-4 bg-gradient-to-b from-gray-900/80 to-gray-900/40 rounded-xl border border-gray-800/50">
      {/* Header with toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full transition-colors duration-200"
            style={{ backgroundColor: stemsEnabled ? '#10b981' : '#6b7280' }}
          />
          <span className="text-sm font-medium text-gray-300">STEM ISOLATION</span>
        </div>

        {/* Toggle switch */}
        <button
          onClick={handleToggleStems}
          className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
            stemsEnabled
              ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 shadow-lg shadow-violet-500/30'
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          <div
            className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${
              stemsEnabled ? 'left-8' : 'left-1'
            }`}
          />
          <span className={`absolute inset-0 flex items-center text-[9px] font-bold transition-opacity duration-200 ${
            stemsEnabled ? 'justify-start pl-1.5 opacity-100' : 'opacity-0'
          }`}>
            ON
          </span>
          <span className={`absolute inset-0 flex items-center text-[9px] font-bold text-gray-400 transition-opacity duration-200 ${
            !stemsEnabled ? 'justify-end pr-1.5 opacity-100' : 'opacity-0'
          }`}>
            OFF
          </span>
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 mb-3 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
          {error}
        </div>
      )}

      {/* Stem controls grid */}
      <div className="grid grid-cols-4 gap-2">
        {STEMS.map((stem) => {
          const state = stems[stem.name];
          const isActive = stemsEnabled && !state.muted;
          const isSolo = state.solo;

          return (
            <div
              key={stem.name}
              className={`relative p-3 rounded-xl transition-all duration-200 ${
                stemsEnabled
                  ? isActive
                    ? 'bg-gray-800/80'
                    : 'bg-gray-900/60 opacity-40'
                  : 'bg-gray-800/40 opacity-50'
              }`}
              style={{
                borderWidth: 1,
                borderColor: isActive && stemsEnabled ? stem.color + '40' : 'transparent',
                boxShadow: isSolo ? `0 0 20px ${stem.color}30` : 'none',
              }}
            >
              {/* Stem icon and label */}
              <div className="flex flex-col items-center mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-1 transition-all duration-200"
                  style={{
                    backgroundColor: isActive ? stem.activeColor : 'rgba(75, 85, 99, 0.3)',
                    color: isActive ? stem.color : '#6b7280',
                  }}
                >
                  {stem.icon}
                </div>
                <span
                  className="text-[10px] font-bold tracking-wider transition-colors duration-200"
                  style={{ color: isActive ? stem.color : '#6b7280' }}
                >
                  {stem.label}
                </span>
              </div>

              {/* Volume slider */}
              <div className="mb-3 px-1">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={state.volume}
                  onChange={(e) => handleVolumeChange(stem.name, parseFloat(e.target.value))}
                  disabled={!stemsEnabled}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer disabled:cursor-not-allowed"
                  style={{
                    background: `linear-gradient(to right, ${stem.color} 0%, ${stem.color} ${state.volume * 100}%, #374151 ${state.volume * 100}%, #374151 100%)`,
                  }}
                />
              </div>

              {/* Mute/Solo buttons */}
              <div className="flex gap-1">
                <button
                  onClick={() => handleMute(stem.name)}
                  disabled={!stemsEnabled}
                  className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all duration-200 disabled:cursor-not-allowed ${
                    state.muted
                      ? 'bg-red-500/80 text-white'
                      : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 hover:text-gray-300'
                  }`}
                >
                  M
                </button>
                <button
                  onClick={() => handleSolo(stem.name)}
                  disabled={!stemsEnabled}
                  className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all duration-200 disabled:cursor-not-allowed ${
                    state.solo
                      ? 'bg-amber-500/80 text-white'
                      : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 hover:text-gray-300'
                  }`}
                >
                  S
                </button>
              </div>

              {/* Active indicator */}
              {isSolo && (
                <div
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-full animate-pulse"
                  style={{ backgroundColor: stem.color }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      {stemsEnabled && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => {
              const newStems = { ...stems };
              for (const name of Object.keys(newStems) as StemName[]) {
                newStems[name] = { ...newStems[name], muted: false, solo: false, volume: 1 };
                audioEngine.setStemVolume(deck, name, 1);
              }
              setStems(newStems);
            }}
            className="flex-1 py-2 text-xs font-medium text-gray-400 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 hover:text-gray-300 transition-all duration-200"
          >
            Reset All
          </button>
          <button
            onClick={() => {
              // Mute vocals (common use case)
              handleMute('vocals');
            }}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all duration-200 ${
              stems.vocals.muted
                ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                : 'text-gray-400 bg-gray-800/50 hover:bg-gray-700/50 hover:text-gray-300'
            }`}
          >
            {stems.vocals.muted ? 'Unmute Vocals' : 'Mute Vocals'}
          </button>
        </div>
      )}
    </div>
  );
};
