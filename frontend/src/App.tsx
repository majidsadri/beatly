import { useCallback, useState, useRef } from 'react';
import { useStore } from './store/useStore';
import { TrackList } from './components/TrackList';
import { MixingTools } from './components/MixingTools';
import { getAudioEngine } from './audio/AudioEngine';
import { StynXLogo, UploadIcon } from './components/Icons';
import type { SoundCloudTrack } from './types';

function App() {
  const store = useStore();
  const { selectedPlaylist, tracks, deckA, deckB, setTracks, selectPlaylist } = store;
  const audioEngine = getAudioEngine();
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload directly from dashboard
  const handleDashboardUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const uploadedTracks: SoundCloudTrack[] = [];

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/uploads/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          audioEngine.clearTrackCache(data.id);
          uploadedTracks.push({
            id: data.id,
            title: data.title,
            duration: data.duration || 0,
            artwork_url: null,
            user: { id: 0, username: 'Local File', avatar_url: '', permalink_url: '' },
            waveform_url: '',
            permalink_url: '',
          });
        }
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }

    if (uploadedTracks.length > 0) {
      if (!selectedPlaylist) {
        selectPlaylist({
          id: -1,
          title: 'My Uploads',
          user: { id: 0, username: 'Local', avatar_url: '', permalink_url: '' },
          artwork_url: null,
          track_count: uploadedTracks.length,
        });
      }
      setTracks([...tracks, ...uploadedTracks]);
    }
    setUploading(false);
  }, [audioEngine, selectedPlaylist, selectPlaylist, setTracks, tracks]);

  // Handle drag and drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleDashboardUpload(e.dataTransfer.files);
  }, [handleDashboardUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

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
    <div
      className="min-h-screen bg-[#0f0f1a] text-white"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Ambient background gradients */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-radial from-cyan-500/10 via-transparent to-transparent" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-radial from-emerald-500/10 via-transparent to-transparent" />
      </div>

      {/* Drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-50 bg-cyan-500/10 backdrop-blur-sm flex items-center justify-center border-4 border-dashed border-cyan-500/50 m-4 rounded-3xl">
          <div className="text-center">
            <UploadIcon size={64} className="text-cyan-400 mx-auto mb-4" />
            <p className="text-2xl font-semibold text-white">Drop your tracks here</p>
            <p className="text-gray-400 mt-2">MP3, WAV, M4A, OGG, FLAC</p>
          </div>
        </div>
      )}

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
              {/* Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              >
                {uploading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <UploadIcon size={18} className="group-hover:scale-110 transition-transform" />
                )}
                <span>Upload</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,.flac"
                multiple
                className="hidden"
                onChange={(e) => handleDashboardUpload(e.target.files)}
              />

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
