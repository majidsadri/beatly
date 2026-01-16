import { useCallback } from 'react';
import { useStore } from './store/useStore';
import { FileUpload } from './components/FileUpload';
import { DJDeck } from './components/DJDeck';
import { MixerControls } from './components/MixerControls';
import { TrackList } from './components/TrackList';
import { MixingTools } from './components/MixingTools';
import { getAudioEngine } from './audio/AudioEngine';
import type { SoundCloudTrack } from './types';

function App() {
  const store = useStore();
  const { selectedPlaylist, tracks, deckA, deckB } = store;
  const audioEngine = getAudioEngine();

  // Load track to deck
  const handleLoadToDeck = useCallback(async (track: SoundCloudTrack, deck: 'A' | 'B') => {
    // Stop current playback
    audioEngine.stop(deck);

    // Update store
    store.setDeckTrack(deck, track);
    store.setDeckPlaying(deck, false);
    store.setDeckCurrentTime(deck, 0);

    // Load audio
    const streamUrl = `/api/uploads/tracks/${track.id}/stream`;
    await audioEngine.loadTrack(track.id, streamUrl);

    // Request analysis in background
    try {
      const response = await fetch(`/api/uploads/tracks/${track.id}/analyze`, {
        method: 'POST',
      });
      if (response.ok) {
        const analysis = await response.json();
        store.cacheAnalysis(track.id, analysis);
        store.setDeckAnalysis(deck, analysis);
      }
    } catch {
      console.warn('Analysis failed');
    }
  }, [audioEngine, store]);

  // Auto mix - start crossfade
  const handleAutoMix = useCallback(async () => {
    // If deck A is playing, fade to B. If B is playing, fade to A
    // If neither, start A and prepare B
    if (!deckA.track || !deckB.track) return;

    await audioEngine.resume();

    if (!deckA.isPlaying && !deckB.isPlaying) {
      // Start deck A
      await audioEngine.play('A', deckA.track.id, 0, deckA.playbackRate);
      store.setDeckPlaying('A', true);
    }
  }, [audioEngine, deckA, deckB, store]);

  // Crossfader change
  const handleCrossfadeChange = useCallback((value: number) => {
    // Update any UI state if needed
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
      <main className="px-4 sm:px-6 pb-6 max-w-[1800px] mx-auto">
        <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
          {/* Left sidebar - Track List & Mixing Tools */}
          <div className="space-y-4 order-2 xl:order-1">
            <TrackList
              onLoadToDeck={handleLoadToDeck}
              onAutoMix={handleAutoMix}
            />
            <MixingTools onCrossfadeChange={handleCrossfadeChange} />
          </div>

          {/* Main area - Decks */}
          <div className="order-1 xl:order-2 space-y-6">
            {/* DJ Decks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DJDeck deck="A" />
              <DJDeck deck="B" />
            </div>

            {/* Mixer Controls */}
            <MixerControls />
          </div>
        </div>
      </main>

      {/* Quick actions floating bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-gray-900/95 backdrop-blur-lg rounded-2xl border border-gray-800/50 shadow-2xl">
        <button
          onClick={async () => {
            await audioEngine.resume();
            if (deckA.track && !deckA.isPlaying) {
              await audioEngine.play('A', deckA.track.id, deckA.currentTime, deckA.playbackRate);
              store.setDeckPlaying('A', true);
            }
          }}
          disabled={!deckA.track}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            deckA.isPlaying
              ? 'bg-violet-500 text-white'
              : 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 disabled:opacity-40'
          }`}
        >
          {deckA.isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          Deck A
        </button>

        <div className="w-px h-6 bg-gray-700" />

        <button
          onClick={async () => {
            await audioEngine.resume();
            if (deckB.track && !deckB.isPlaying) {
              await audioEngine.play('B', deckB.track.id, deckB.currentTime, deckB.playbackRate);
              store.setDeckPlaying('B', true);
            }
          }}
          disabled={!deckB.track}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
            deckB.isPlaying
              ? 'bg-blue-500 text-white'
              : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-40'
          }`}
        >
          {deckB.isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          Deck B
        </button>

        <div className="w-px h-6 bg-gray-700" />

        <button
          onClick={handleAutoMix}
          disabled={!deckA.track || !deckB.track}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:from-gray-700 disabled:to-gray-700 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-violet-500/20"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Mix
        </button>
      </div>
    </div>
  );
}

export default App;
