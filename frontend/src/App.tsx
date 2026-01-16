import { useCallback } from 'react';
import { useStore } from './store/useStore';
import { FileUpload } from './components/FileUpload';
import { TrackList } from './components/TrackList';
import { MixingTools } from './components/MixingTools';
import { getAudioEngine } from './audio/AudioEngine';
import type { SoundCloudTrack } from './types';

function App() {
  const store = useStore();
  const { selectedPlaylist, tracks, deckA, deckB } = store;
  const audioEngine = getAudioEngine();

  // Load track to deck (called from TrackList)
  const handleLoadToDeck = useCallback(async (track: SoundCloudTrack, deck: 'A' | 'B') => {
    audioEngine.stop(deck);
    store.setDeckTrack(deck, track);
    store.setDeckPlaying(deck, false);
    store.setDeckCurrentTime(deck, 0);

    const streamUrl = `/api/uploads/tracks/${track.id}/stream`;
    await audioEngine.loadTrack(track.id, streamUrl);

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

  // Auto mix callback (passed to TrackList but not used there)
  const handleAutoMix = useCallback(async () => {
    if (!deckA.track || !deckB.track) return;
    await audioEngine.resume();
    if (!deckA.isPlaying && !deckB.isPlaying) {
      await audioEngine.play('A', deckA.track.id, 0, deckA.playbackRate);
      store.setDeckPlaying('A', true);
    }
  }, [audioEngine, deckA, deckB, store]);

  // Crossfader change callback (passed to MixingTools)
  const handleCrossfadeChange = useCallback(() => {
    // MixingTools handles crossfader internally
  }, []);

  // Show file upload if no tracks loaded
  if (!selectedPlaylist || tracks.length === 0) {
    return (
      <div className="min-h-screen bg-[#080810]">
        <FileUpload />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Header */}
      <header className="bg-gradient-to-b from-gray-900/80 to-transparent px-6 py-4">
        <div className="flex items-center justify-between max-w-[1800px] mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              Beatly
            </h1>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-gray-800/50 rounded-full">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs text-gray-400">
                {tracks.length} tracks
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Playing indicator */}
            {(deckA.isPlaying || deckB.isPlaying) && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/20 rounded-lg">
                <span className="flex gap-0.5">
                  <span className="w-1 h-3 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-4 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-2 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                  <span className="w-1 h-5 bg-violet-500 rounded-full animate-pulse" style={{ animationDelay: '450ms' }} />
                </span>
                <span className="text-xs text-violet-400 font-medium">Playing</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 sm:px-6 pb-6 max-w-[1920px] mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
          {/* Left - Track List with integrated deck controls */}
          <div className="order-2 xl:order-1">
            <TrackList
              onLoadToDeck={handleLoadToDeck}
              onAutoMix={handleAutoMix}
            />
          </div>

          {/* Right - Mixing Tools */}
          <div className="order-1 xl:order-2">
            <div className="sticky top-4">
              <MixingTools onCrossfadeChange={handleCrossfadeChange} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
