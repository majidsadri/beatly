import { useCallback } from 'react';
import { useStore } from './store/useStore';
import { TrackList } from './components/TrackList';
import { MixingTools } from './components/MixingTools';
import { getAudioEngine } from './audio/AudioEngine';
import { StynXLogo } from './components/Icons';
import type { SoundCloudTrack } from './types';

function App() {
  const store = useStore();
  const { tracks, deckA, deckB } = store;
  const audioEngine = getAudioEngine();

  // Load track to deck (called from TrackList)
  const handleLoadToDeck = useCallback(async (track: SoundCloudTrack, deck: 'A' | 'B') => {
    audioEngine.stop(deck);
    store.setDeckTrack(deck, track);
    store.setDeckPlaying(deck, false);
    store.setDeckCurrentTime(deck, 0);

    audioEngine.clearTrackCache(track.id);
    const streamUrl = `/api/uploads/tracks/${track.id}/stream`;
    await audioEngine.loadTrack(track.id, streamUrl, true);

    try {
      const response = await fetch(`/api/uploads/tracks/${track.id}/analyze`, { method: 'POST' });
      if (response.ok) {
        const analysis = await response.json();
        store.cacheAnalysis(track.id, analysis);
        store.setDeckAnalysis(deck, analysis);
      }
    } catch {
      // Analysis optional
    }
  }, [audioEngine, store]);

  // Auto mix callback
  const handleAutoMix = useCallback(async () => {
    if (!deckA.track || !deckB.track) return;
    await audioEngine.resume();
    if (!deckA.isPlaying && !deckB.isPlaying) {
      await audioEngine.play('A', deckA.track.id, 0, deckA.playbackRate);
      store.setDeckPlaying('A', true);
    }
  }, [audioEngine, deckA, deckB, store]);

  const handleCrossfadeChange = useCallback(() => {}, []);

  const isPlaying = deckA.isPlaying || deckB.isPlaying;

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-white">
      {/* Ambient background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-cyan-500/10 via-transparent to-transparent" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-emerald-500/10 via-transparent to-transparent" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between max-w-[1800px] mx-auto">
            {/* Logo */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <StynXLogo size={48} />
                <div>
                  <h1 className="text-2xl font-bold text-white tracking-wider">
                    StynX
                  </h1>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest">DJ Studio</p>
                </div>
              </div>

              {/* Track count badge */}
              {tracks.length > 0 && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 backdrop-blur rounded-full border border-white/10">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs text-gray-300 font-medium">
                    {tracks.length} track{tracks.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Playing indicator */}
              {isPlaying && (
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 backdrop-blur rounded-xl border border-cyan-500/30">
                  <div className="flex items-end gap-0.5 h-4">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className="w-1 bg-gradient-to-t from-cyan-500 to-emerald-400 rounded-full"
                        style={{
                          animation: 'eqBar 0.5s ease-in-out infinite',
                          animationDelay: `${i * 0.1}s`,
                          height: '100%',
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                    LIVE
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 px-4 sm:px-6 py-6 max-w-[1920px] mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
          {/* Left - Track List */}
          <div className="order-2 xl:order-1">
            <TrackList
              onLoadToDeck={handleLoadToDeck}
              onAutoMix={handleAutoMix}
            />
          </div>

          {/* Right - Mixing Tools */}
          <div className="order-1 xl:order-2">
            <div className="sticky top-6">
              <MixingTools onCrossfadeChange={handleCrossfadeChange} />
            </div>
          </div>
        </div>
      </main>

      {/* Global styles */}
      <style>{`
        @keyframes eqBar {
          0%, 100% { height: 20%; }
          50% { height: 100%; }
        }
        .bg-gradient-radial {
          background: radial-gradient(ellipse at center, var(--tw-gradient-from), var(--tw-gradient-via), var(--tw-gradient-to));
        }
      `}</style>
    </div>
  );
}

export default App;
