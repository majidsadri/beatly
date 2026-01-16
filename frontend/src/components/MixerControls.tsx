import { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { getAudioEngine } from '../audio/AudioEngine';
import { createTransitionPlan, calculateBpmMatch } from '../audio/TransitionPlanner';
import type { TransitionStyle } from '../types';

export const MixerControls: React.FC = () => {
  const store = useStore();
  const {
    djMode,
    setDjMode,
    smartOrder,
    setSmartOrder,
    crossfader,
    setCrossfader,
    masterVolume,
    setMasterVolume,
    deckA,
    deckB,
    isTransitioning,
    setTransitioning,
    setTransitionPlan,
  } = store;

  const [transitionStyle, setTransitionStyle] = useState<TransitionStyle>('smooth');
  const audioEngine = getAudioEngine();

  // Handle crossfader change
  const handleCrossfaderChange = (value: number) => {
    setCrossfader(value);
    audioEngine.setCrossfader(value);
  };

  // Handle master volume change
  const handleMasterVolumeChange = (value: number) => {
    setMasterVolume(value);
    audioEngine.setMasterVolume(value);
  };

  // Start automatic transition
  const startTransition = useCallback(async () => {
    if (!deckA.analysis || !deckB.analysis || !deckA.track || !deckB.track) {
      console.warn('Cannot start transition: missing analysis or tracks');
      return;
    }

    setTransitioning(true);

    // Calculate BPM match rate for deck B
    const { rate, adjusted } = calculateBpmMatch(deckA.analysis.bpm, deckB.analysis.bpm);
    if (adjusted) {
      store.setDeckPlaybackRate('B', rate);
      audioEngine.setPlaybackRate('B', rate);
    }

    // Create transition plan
    const plan = createTransitionPlan(transitionStyle, deckA.analysis, deckB.analysis);
    setTransitionPlan(plan);

    // Start deck B at the right time (aligned to beats)
    const startOffset = audioEngine.calculateBeatAlignedStart(
      deckA.analysis,
      deckB.analysis,
      deckA.currentTime
    );

    // Resume audio context and start deck B
    await audioEngine.resume();
    audioEngine.play('B', deckB.track.id, startOffset, rate);
    store.setDeckPlaying('B', true);

    // Play riser effect for hype transitions
    if (transitionStyle === 'hype') {
      const riser = audioEngine.createNoiseRiser(plan.duration / 2);
      riser.start();
    }

    // Execute the transition
    await audioEngine.executeTransition(plan, deckA.track.id, deckB.track.id, (phase, progress) => {
      console.log(`Transition: ${phase} - ${Math.round(progress * 100)}%`);
    });

    // Transition complete - deck A should now be stopped
    audioEngine.stop('A');
    store.setDeckPlaying('A', false);

    // Reset EQ on deck A
    store.setDeckEQ('A', 'low', 0);
    store.setDeckEQ('A', 'mid', 0);
    store.setDeckEQ('A', 'high', 0);

    // Swap decks: B becomes the new A for next transition
    // In a real app, you'd load the next track into the now-empty deck A
    setTransitioning(false);
    setTransitionPlan(null);
  }, [
    deckA,
    deckB,
    transitionStyle,
    audioEngine,
    store,
    setTransitioning,
    setTransitionPlan,
  ]);

  // Sync BPM of deck B to deck A
  const syncBpm = () => {
    if (!deckA.analysis || !deckB.analysis) return;

    const { rate } = calculateBpmMatch(deckA.analysis.bpm, deckB.analysis.bpm);
    store.setDeckPlaybackRate('B', rate);
    audioEngine.setPlaybackRate('B', rate);
  };

  return (
    <div className="bg-dj-dark rounded-xl p-6 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: DJ Mode Controls */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            DJ Mode
          </h3>

          {/* DJ Mode Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm">Auto Mixing</span>
            <button
              onClick={() => setDjMode(!djMode)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                djMode ? 'bg-dj-purple' : 'bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  djMode ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Smart Order Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm">Smart Order</span>
            <button
              onClick={() => setSmartOrder(!smartOrder)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                smartOrder ? 'bg-dj-blue' : 'bg-gray-700'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  smartOrder ? 'translate-x-7' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Transition Style */}
          <div>
            <label className="block text-sm mb-2">Transition Style</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTransitionStyle('smooth')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                  transitionStyle === 'smooth'
                    ? 'bg-dj-purple text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Smooth
              </button>
              <button
                onClick={() => setTransitionStyle('hype')}
                className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                  transitionStyle === 'hype'
                    ? 'bg-dj-pink text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                Hype
              </button>
            </div>
          </div>
        </div>

        {/* Center: Crossfader */}
        <div className="flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Crossfader
          </h3>

          <div className="w-full max-w-xs">
            {/* Labels */}
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span className="text-dj-purple">A</span>
              <span>CENTER</span>
              <span className="text-dj-blue">B</span>
            </div>

            {/* Crossfader track */}
            <div className="relative h-8 crossfader-track rounded-lg">
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={crossfader}
                onChange={(e) => handleCrossfaderChange(parseFloat(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {/* Crossfader handle */}
              <div
                className="absolute top-0 bottom-0 w-6 bg-white rounded shadow-lg transform -translate-x-1/2 transition-all"
                style={{ left: `${((crossfader + 1) / 2) * 100}%` }}
              />
            </div>

            {/* Transition button */}
            <button
              onClick={startTransition}
              disabled={!djMode || isTransitioning || !deckB.track}
              className={`w-full mt-4 py-3 rounded-lg font-semibold transition-all ${
                isTransitioning
                  ? 'bg-dj-pink animate-pulse'
                  : 'bg-gradient-to-r from-dj-purple to-dj-blue hover:from-dj-purple/80 hover:to-dj-blue/80 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {isTransitioning ? 'Mixing...' : 'Start Transition'}
            </button>
          </div>
        </div>

        {/* Right: Volume & Sync */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Master
          </h3>

          {/* Master Volume */}
          <div>
            <label className="block text-xs text-gray-500 mb-2">
              Volume: {Math.round(masterVolume * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={(e) => handleMasterVolumeChange(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* BPM Sync */}
          <button
            onClick={syncBpm}
            disabled={!deckA.analysis || !deckB.analysis}
            className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
          >
            Sync BPM (B → A)
          </button>

          {/* BPM Display */}
          {deckA.analysis && deckB.analysis && (
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-gray-500">A:</span>{' '}
                <span className="text-dj-purple font-mono">
                  {Math.round(deckA.analysis.bpm)}
                </span>
              </div>
              <div>
                <span className="text-gray-500">B:</span>{' '}
                <span className="text-dj-blue font-mono">
                  {Math.round(deckB.analysis.bpm * deckB.playbackRate)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
