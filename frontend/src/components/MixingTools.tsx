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

  const audioEngine = getAudioEngine();

  const handleCrossfade = (value: number) => {
    setCrossfader(value);
    onCrossfadeChange(value);
    audioEngine.setCrossfader(value);
  };

  // Auto crossfade from A to B
  const startAutoMix = async (direction: 'AtoB' | 'BtoA') => {
    if (isAutoMixing) return;

    setIsAutoMixing(true);

    const startValue = direction === 'AtoB' ? -1 : 1;
    const endValue = direction === 'AtoB' ? 1 : -1;
    const steps = fadeTime * 20; // 20 updates per second
    const increment = (endValue - startValue) / steps;

    let currentValue = startValue;
    setCrossfader(currentValue);
    audioEngine.setCrossfader(currentValue);

    // Start the target deck if not playing
    if (direction === 'AtoB' && deckB.track && !deckB.isPlaying) {
      await audioEngine.resume();
      await audioEngine.play('B', deckB.track.id, 0, deckB.playbackRate);
      store.setDeckPlaying('B', true);
    } else if (direction === 'BtoA' && deckA.track && !deckA.isPlaying) {
      await audioEngine.resume();
      await audioEngine.play('A', deckA.track.id, 0, deckA.playbackRate);
      store.setDeckPlaying('A', true);
    }

    const interval = setInterval(() => {
      currentValue += increment;

      if ((direction === 'AtoB' && currentValue >= endValue) ||
          (direction === 'BtoA' && currentValue <= endValue)) {
        currentValue = endValue;
        clearInterval(interval);
        setIsAutoMixing(false);

        // Stop the source deck
        if (direction === 'AtoB') {
          audioEngine.stop('A');
          store.setDeckPlaying('A', false);
        } else {
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

  const canMix = deckA.track && deckB.track;

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
          disabled={!canMix || isAutoMixing || !deckB.isPlaying}
          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-violet-500/20 hover:bg-violet-500/30 disabled:bg-gray-800/50 disabled:opacity-50 text-violet-400 disabled:text-gray-500 rounded-xl text-xs font-medium transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Fade to A
        </button>
        <button
          onClick={() => startAutoMix('AtoB')}
          disabled={!canMix || isAutoMixing || !deckA.isPlaying}
          className="flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-500/20 hover:bg-blue-500/30 disabled:bg-gray-800/50 disabled:opacity-50 text-blue-400 disabled:text-gray-500 rounded-xl text-xs font-medium transition-all"
        >
          Fade to B
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>

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
          disabled={!deckA.analysis?.bpm || !deckB.analysis?.bpm}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all ${
            syncEnabled
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50 disabled:text-gray-500'
          }`}
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
          className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-medium transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
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
