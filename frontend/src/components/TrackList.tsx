import { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import type { SoundCloudTrack } from '../types';

interface TrackListProps {
  onLoadToDeck: (track: SoundCloudTrack, deck: 'A' | 'B') => void;
  onAutoMix: () => void;
}

export const TrackList: React.FC<TrackListProps> = ({ onLoadToDeck, onAutoMix }) => {
  const { tracks, setTracks, deckA, deckB } = useStore();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newTracks = [...tracks];
      const [removed] = newTracks.splice(draggedIndex, 1);
      newTracks.splice(dragOverIndex, 0, removed);
      setTracks(newTracks);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const newTracks: SoundCloudTrack[] = [];

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
          newTracks.push({
            id: data.id,
            title: data.title,
            duration: data.duration || 0,
            artwork_url: null,
            user: { username: 'Local File' },
            stream_url: `/api/uploads/tracks/${data.id}/stream`,
          });
        }
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }

    if (newTracks.length > 0) {
      setTracks([...tracks, ...newTracks]);
    }
    setUploading(false);
  };

  const removeTrack = (index: number) => {
    const newTracks = tracks.filter((_, i) => i !== index);
    setTracks(newTracks);
  };

  const moveTrack = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === tracks.length - 1) return;

    const newTracks = [...tracks];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newTracks[index], newTracks[newIndex]] = [newTracks[newIndex], newTracks[index]];
    setTracks(newTracks);
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const isTrackLoaded = (trackId: number) => {
    return deckA.track?.id === trackId || deckB.track?.id === trackId;
  };

  const getLoadedDeck = (trackId: number): 'A' | 'B' | null => {
    if (deckA.track?.id === trackId) return 'A';
    if (deckB.track?.id === trackId) return 'B';
    return null;
  };

  return (
    <div className="bg-gradient-to-b from-gray-900/90 to-gray-900/70 rounded-2xl border border-gray-800/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800/50">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Playlist</h2>
              <p className="text-xs text-gray-500">{tracks.length} tracks</p>
            </div>
          </div>

          {/* Auto Mix Button */}
          {tracks.length >= 2 && (
            <button
              onClick={onAutoMix}
              className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-medium rounded-lg shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Auto Mix
            </button>
          )}
        </div>

        {/* Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full py-2.5 border-2 border-dashed border-gray-700 hover:border-violet-500/50 rounded-xl text-sm text-gray-400 hover:text-violet-400 transition-all duration-200 flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Tracks
            </>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,.m4a,.ogg,.flac"
          multiple
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
      </div>

      {/* Track List */}
      <div className="max-h-[400px] overflow-y-auto">
        {tracks.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-800/50 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 mb-1">No tracks yet</p>
            <p className="text-xs text-gray-600">Upload MP3 files to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-800/30">
            {tracks.map((track, index) => {
              const loadedDeck = getLoadedDeck(track.id);
              const isDragging = draggedIndex === index;
              const isDragOver = dragOverIndex === index;

              return (
                <div
                  key={track.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`group flex items-center gap-3 p-3 transition-all duration-200 cursor-grab active:cursor-grabbing ${
                    isDragging ? 'opacity-50 bg-violet-500/10' : ''
                  } ${isDragOver ? 'bg-violet-500/20 border-t-2 border-violet-500' : ''} ${
                    loadedDeck ? 'bg-gray-800/30' : 'hover:bg-gray-800/20'
                  }`}
                >
                  {/* Track Number / Drag Handle */}
                  <div className="flex flex-col items-center gap-0.5 w-6">
                    <button
                      onClick={() => moveTrack(index, 'up')}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition-opacity"
                      disabled={index === 0}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <span className="text-xs font-medium text-gray-500 group-hover:hidden">{index + 1}</span>
                    <svg className="w-4 h-4 text-gray-600 hidden group-hover:block" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm0 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-2 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm8-14a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm-2 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm2 4a2 2 0 1 1-4 0 2 2 0 0 1 4 0z" />
                    </svg>
                    <button
                      onClick={() => moveTrack(index, 'down')}
                      className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-white transition-opacity"
                      disabled={index === tracks.length - 1}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{track.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{track.user.username}</span>
                      {track.duration > 0 && (
                        <>
                          <span className="text-gray-700">•</span>
                          <span className="text-xs text-gray-500">{formatDuration(track.duration)}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Loaded Indicator */}
                  {loadedDeck && (
                    <div
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        loadedDeck === 'A'
                          ? 'bg-violet-500/20 text-violet-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      DECK {loadedDeck}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onLoadToDeck(track, 'A')}
                      className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                        loadedDeck === 'A'
                          ? 'bg-violet-500 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-violet-500/20 hover:text-violet-400'
                      }`}
                      title="Load to Deck A"
                    >
                      A
                    </button>
                    <button
                      onClick={() => onLoadToDeck(track, 'B')}
                      className={`p-1.5 rounded-lg text-xs font-medium transition-all ${
                        loadedDeck === 'B'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-blue-500/20 hover:text-blue-400'
                      }`}
                      title="Load to Deck B"
                    >
                      B
                    </button>
                    <button
                      onClick={() => removeTrack(index)}
                      className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-all"
                      title="Remove"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DJ Tools Bar */}
      {tracks.length >= 2 && (
        <div className="p-3 border-t border-gray-800/50 bg-gray-900/50">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">DJ Tools</span>
            <div className="flex items-center gap-2">
              <button
                onClick={onAutoMix}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-all"
                title="Crossfade between decks"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
                Crossfade
              </button>
              <button
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-all"
                title="Sync BPM between decks"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
