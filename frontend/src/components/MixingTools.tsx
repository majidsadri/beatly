import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { getAudioEngine } from '../audio/AudioEngine';

interface MixingToolsProps {
  onCrossfadeChange: (value: number) => void;
}

export const MixingTools: React.FC<MixingToolsProps> = ({ onCrossfadeChange }) => {
  const store = useStore();
  const { deckA, deckB } = store;
  const [crossfader, setCrossfader] = useState(0);
  const [isAutoMixing, setIsAutoMixing] = useState(false);
  const [fadeTime, setFadeTime] = useState(8); // seconds
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [drumLoopOn, setDrumLoopOn] = useState(false);
  const [drumBpm, setDrumBpm] = useState(120);
  const [drumVolume, setDrumVolume] = useState(60);

  const audioEngine = getAudioEngine();

  // Sync drum BPM with playing deck
  useEffect(() => {
    if (deckA.isPlaying && deckA.analysis?.bpm) {
      setDrumBpm(Math.round(deckA.analysis.bpm));
    } else if (deckB.isPlaying && deckB.analysis?.bpm) {
      setDrumBpm(Math.round(deckB.analysis.bpm));
    }
  }, [deckA.isPlaying, deckB.isPlaying, deckA.analysis?.bpm, deckB.analysis?.bpm]);

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
  const syncBPM = () => {
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
  };

  // For auto-mix, both decks should be playing
  const canMix = deckA.track && deckB.track;
  const bothPlaying = deckA.isPlaying && deckB.isPlaying;

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

      {/* Drum Loop Section */}
      <div className="mb-4 p-3 bg-gray-800/50 rounded-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-orange-400">DRUM LOOP</span>
            {drumLoopOn && (
              <span className="flex gap-0.5">
                <span className="w-1 h-2 bg-orange-500 rounded-full animate-pulse" />
                <span className="w-1 h-3 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '100ms' }} />
                <span className="w-1 h-2 bg-orange-500 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
              </span>
            )}
          </div>
          <button
            onClick={toggleDrumLoop}
            className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
              drumLoopOn
                ? 'bg-gradient-to-r from-orange-500 to-red-500'
                : 'bg-gray-700'
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${
                drumLoopOn ? 'left-7' : 'left-1'
              }`}
            />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-500">BPM</span>
              <span className="text-xs font-medium text-white">{drumBpm}</span>
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
          disabled={!deckA.isPlaying || isAutoMixing}
          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-violet-500/20 hover:bg-violet-500/30 disabled:bg-gray-800/50 disabled:opacity-50 text-violet-400 disabled:text-gray-500 rounded-xl text-xs font-medium transition-all"
          title={!deckA.isPlaying ? 'Start playing on Deck A first' : 'Crossfade from B to A'}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Fade to A
        </button>
        <button
          onClick={() => startAutoMix('AtoB')}
          disabled={!deckB.isPlaying || isAutoMixing}
          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-gray-800/50 disabled:opacity-50 text-blue-400 disabled:text-gray-500 rounded-xl text-xs font-medium transition-all"
          title={!deckB.isPlaying ? 'Start playing on Deck B first' : 'Crossfade from A to B'}
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
