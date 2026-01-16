import { useState, useRef, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { getAudioEngine } from '../audio/AudioEngine';
import type { SoundCloudTrack } from '../types';

interface StemStatus {
  status: 'pending' | 'processing' | 'ready' | 'error';
  error?: string;
}

interface TrackListProps {
  onLoadToDeck: (track: SoundCloudTrack, deck: 'A' | 'B') => void;
  onAutoMix: () => void;
}

const STEMS = [
  { name: 'drums', label: 'D', color: '#f97316' },
  { name: 'bass', label: 'B', color: '#8b5cf6' },
  { name: 'vocals', label: 'V', color: '#ec4899' },
  { name: 'other', label: 'M', color: '#10b981' },
];

export const TrackList: React.FC<TrackListProps> = ({ onLoadToDeck, onAutoMix }) => {
  const { tracks, setTracks, deckA, deckB } = useStore();
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [stemStatuses, setStemStatuses] = useState<Record<number, StemStatus>>({});
  const [separatingTrack, setSeparatingTrack] = useState<number | null>(null);

  const audioEngine = getAudioEngine();

  // Check stem status for all tracks
  useEffect(() => {
    const checkStatuses = async () => {
      for (const track of tracks) {
        try {
          const response = await fetch(`/api/uploads/tracks/${track.id}/stems/status`);
          if (response.ok) {
            const data = await response.json();
            setStemStatuses(prev => ({ ...prev, [track.id]: data }));
          }
        } catch {
          // Ignore errors
        }
      }
    };
    if (tracks.length > 0) {
      checkStatuses();
    }
  }, [tracks]);

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

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getLoadedDeck = (trackId: number): 'A' | 'B' | null => {
    if (deckA.track?.id === trackId) return 'A';
    if (deckB.track?.id === trackId) return 'B';
    return null;
  };

  // Separate stems for a track
  const separateStems = async (trackId: number) => {
    setSeparatingTrack(trackId);
    setStemStatuses(prev => ({ ...prev, [trackId]: { status: 'processing' } }));

    try {
      const response = await fetch(`/api/uploads/tracks/${trackId}/stems`, {
        method: 'POST',
      });

      if (response.ok) {
        // Poll for completion
        const pollInterval = setInterval(async () => {
          const statusRes = await fetch(`/api/uploads/tracks/${trackId}/stems/status`);
          if (statusRes.ok) {
            const status = await statusRes.json();
            setStemStatuses(prev => ({ ...prev, [trackId]: status }));

            if (status.status === 'ready' || status.status === 'error') {
              clearInterval(pollInterval);
              setSeparatingTrack(null);
            }
          }
        }, 1000);
      }
    } catch (error) {
      setStemStatuses(prev => ({ ...prev, [trackId]: { status: 'error', error: 'Failed to separate' } }));
      setSeparatingTrack(null);
    }
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

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium rounded-lg transition-all"
          >
            {uploading ? (
              <span className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
            Add
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
      </div>

      {/* Track List */}
      <div className="max-h-[500px] overflow-y-auto">
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
              const stemStatus = stemStatuses[track.id];
              const isSeparating = separatingTrack === track.id;

              return (
                <div
                  key={track.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`group p-3 transition-all duration-200 cursor-grab active:cursor-grabbing ${
                    isDragging ? 'opacity-50 bg-violet-500/10' : ''
                  } ${isDragOver ? 'bg-violet-500/20 border-t-2 border-violet-500' : ''} ${
                    loadedDeck ? 'bg-gray-800/30' : 'hover:bg-gray-800/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Track Number */}
                    <span className="w-6 text-center text-xs font-medium text-gray-500">{index + 1}</span>

                    {/* Track Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{track.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {track.duration > 0 && (
                          <span className="text-xs text-gray-500">{formatDuration(track.duration)}</span>
                        )}
                        {loadedDeck && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            loadedDeck === 'A' ? 'bg-violet-500/20 text-violet-400' : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            DECK {loadedDeck}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stems Section */}
                    <div className="flex items-center gap-1">
                      {stemStatus?.status === 'ready' ? (
                        // Show stem buttons when ready
                        STEMS.map((stem) => (
                          <div
                            key={stem.name}
                            className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold"
                            style={{ backgroundColor: `${stem.color}30`, color: stem.color }}
                            title={stem.name}
                          >
                            {stem.label}
                          </div>
                        ))
                      ) : stemStatus?.status === 'processing' || isSeparating ? (
                        // Show loading
                        <div className="flex items-center gap-1 px-2 py-1 bg-gray-800 rounded">
                          <span className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-[10px] text-gray-400">Splitting...</span>
                        </div>
                      ) : (
                        // Show separate button
                        <button
                          onClick={() => separateStems(track.id)}
                          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-[10px] text-gray-400 hover:text-white rounded transition-all"
                          title="Separate into stems"
                        >
                          Stems
                        </button>
                      )}
                    </div>

                    {/* Deck Load Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onLoadToDeck(track, 'A')}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
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
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                          loadedDeck === 'B'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-blue-500/20 hover:text-blue-400'
                        }`}
                        title="Load to Deck B"
                      >
                        B
                      </button>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeTrack(index)}
                      className="w-7 h-7 rounded-lg bg-gray-800 text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                      title="Remove"
                    >
                      <svg className="w-3 h-3 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    </div>
  );
};
