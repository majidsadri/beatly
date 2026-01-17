import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { getAudioEngine, StemName } from '../audio/AudioEngine';
import { DrumsIcon, BassIcon, VocalsIcon, MelodyIcon, MusicNoteIcon, WaveformIcon } from './Icons';
import type { SoundCloudTrack } from '../types';

interface StemStatus {
  status: 'pending' | 'processing' | 'ready' | 'error';
  error?: string;
}

interface TrackListProps {
  onLoadToDeck: (track: SoundCloudTrack, deck: 'A' | 'B') => void;
  onAutoMix: () => void;
}

const STEMS: { name: StemName; label: string; fullName: string; color: string; IconComponent: React.FC<{className?: string; size?: number}> }[] = [
  { name: 'drums', label: 'D', fullName: 'Drums', color: '#f97316', IconComponent: DrumsIcon },
  { name: 'bass', label: 'B', fullName: 'Bass', color: '#8b5cf6', IconComponent: BassIcon },
  { name: 'vocals', label: 'V', fullName: 'Vocals', color: '#ec4899', IconComponent: VocalsIcon },
  { name: 'other', label: 'M', fullName: 'Melody', color: '#10b981', IconComponent: MelodyIcon },
];

// Stem volume state (0-1 for each stem)
interface StemVolumeState {
  drums: number;
  bass: number;
  vocals: number;
  other: number;
}

// Preset configurations
const STEM_PRESETS: { name: string; label: string; IconComponent: React.FC<{className?: string; size?: number}>; config: StemVolumeState }[] = [
  { name: 'full', label: 'Full', IconComponent: MusicNoteIcon, config: { drums: 1, bass: 1, vocals: 1, other: 1 } },
  { name: 'acapella', label: 'Vocal', IconComponent: VocalsIcon, config: { drums: 0, bass: 0, vocals: 1, other: 0 } },
  { name: 'instrumental', label: 'Inst', IconComponent: MelodyIcon, config: { drums: 1, bass: 1, vocals: 0, other: 1 } },
  { name: 'rhythm', label: 'Beat', IconComponent: DrumsIcon, config: { drums: 1, bass: 1, vocals: 0, other: 0 } },
  { name: 'melody', label: 'Synth', IconComponent: WaveformIcon, config: { drums: 0, bass: 0, vocals: 0, other: 1 } },
];

// Legacy interface for backwards compatibility
interface StemEnabledState {
  drums: boolean;
  bass: boolean;
  vocals: boolean;
  other: boolean;
}

interface TrackPlayState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  usingSteams: boolean;
  deck: 'A' | 'B' | null;  // Which deck this track is playing on
  volume: number;  // 0-1 volume for mixing
}

export const TrackList: React.FC<TrackListProps> = ({ onLoadToDeck: _onLoadToDeck, onAutoMix: _onAutoMix }) => {
  const store = useStore();
  const { tracks, setTracks, setDeckTrack, setDeckPlaying, setDeckAnalysis, cacheAnalysis, getAnalysis, deckA, deckB } = store;
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [stemStatuses, setStemStatuses] = useState<Record<number, StemStatus>>({});
  const [separatingTrack, setSeparatingTrack] = useState<number | null>(null);
  const [playStates, setPlayStates] = useState<Record<number, TrackPlayState>>({});
  const [seekingTrack, setSeekingTrack] = useState<number | null>(null);
  const timelineRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [stemEnabled, setStemEnabled] = useState<Record<number, StemEnabledState>>({});
  const [stemVolumes, setStemVolumes] = useState<Record<number, StemVolumeState>>({});
  const [loadingStems, setLoadingStems] = useState<number | null>(null);

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
            // Initialize stem states when stems are ready
            if (data.status === 'ready') {
              if (!stemEnabled[track.id]) {
                setStemEnabled(prev => ({
                  ...prev,
                  [track.id]: { drums: true, bass: true, vocals: true, other: true }
                }));
              }
              if (!stemVolumes[track.id]) {
                setStemVolumes(prev => ({
                  ...prev,
                  [track.id]: { drums: 1, bass: 1, vocals: 1, other: 1 }
                }));
              }
            }
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

  // Sync store deck states back to local playStates (for when MixingTools stops a deck)
  useEffect(() => {
    setPlayStates(prev => {
      let updated = { ...prev };
      let hasChanges = false;

      // Check deck A - if store says deck A stopped but we think it's playing
      if (deckA.track) {
        const trackState = prev[deckA.track.id];
        if (trackState?.deck === 'A' && trackState.isPlaying && !deckA.isPlaying) {
          // Store says deck A stopped - sync local state
          updated[deckA.track.id] = { ...trackState, isPlaying: false };
          hasChanges = true;
        }
      }

      // Check deck B - if store says deck B stopped but we think it's playing
      if (deckB.track) {
        const trackState = prev[deckB.track.id];
        if (trackState?.deck === 'B' && trackState.isPlaying && !deckB.isPlaying) {
          // Store says deck B stopped - sync local state
          updated[deckB.track.id] = { ...trackState, isPlaying: false };
          hasChanges = true;
        }
      }

      return hasChanges ? updated : prev;
    });
  }, [deckA.isPlaying, deckB.isPlaying, deckA.track, deckB.track]);

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
          // Clear cache for this track ID to prevent stale audio
          audioEngine.clearTrackCache(data.id);

          // Use consistent format with FileUpload.tsx
          newTracks.push({
            id: data.id,
            title: data.title,
            duration: data.duration || 0,
            artwork_url: null,
            user: {
              id: 0,
              username: 'Local File',
              avatar_url: null,
              permalink_url: '',
            },
            waveform_url: '',
            permalink_url: '',
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
              // Initialize stem state
              if (status.status === 'ready') {
                setStemEnabled(prev => ({
                  ...prev,
                  [trackId]: { drums: true, bass: true, vocals: true, other: true }
                }));
              }
            }
          }
        }, 1000);
      }
    } catch (error) {
      setStemStatuses(prev => ({ ...prev, [trackId]: { status: 'error', error: 'Failed to separate' } }));
      setSeparatingTrack(null);
    }
  };

  // Find an available deck (A or B)
  const getAvailableDeck = useCallback((): 'A' | 'B' | null => {
    const playingTracks = Object.values(playStates).filter(s => s.isPlaying);
    const usedDecks = playingTracks.map(s => s.deck);

    if (!usedDecks.includes('A')) return 'A';
    if (!usedDecks.includes('B')) return 'B';
    return null; // Both decks in use
  }, [playStates]);

  // Play/pause a track - uses stems if available, supports multiple tracks
  const toggleTrackPlay = useCallback(async (track: SoundCloudTrack) => {
    await audioEngine.resume();

    const currentState = playStates[track.id];
    const isCurrentlyPlaying = currentState?.isPlaying;
    const stemStatus = stemStatuses[track.id];
    const hasStemsReady = stemStatus?.status === 'ready';

    if (isCurrentlyPlaying && currentState?.deck) {
      // Stop this track
      audioEngine.stop(currentState.deck);

      // Update global store
      setDeckTrack(currentState.deck, null);
      setDeckPlaying(currentState.deck, false);
      setDeckAnalysis(currentState.deck, null);

      setPlayStates(prev => ({
        ...prev,
        [track.id]: { ...prev[track.id], isPlaying: false, deck: null }
      }));
    } else {
      // Find available deck
      let deck = getAvailableDeck();
      if (!deck) {
        // Both decks in use - stop the oldest one
        const playingTracks = Object.entries(playStates).filter(([_, s]) => s.isPlaying);
        if (playingTracks.length > 0) {
          const [oldTrackId, oldState] = playingTracks[0];
          if (oldState.deck) {
            audioEngine.stop(oldState.deck);

            // Update global store for stopped deck
            setDeckTrack(oldState.deck, null);
            setDeckPlaying(oldState.deck, false);
            setDeckAnalysis(oldState.deck, null);

            setPlayStates(prev => ({
              ...prev,
              [oldTrackId]: { ...prev[Number(oldTrackId)], isPlaying: false, deck: null }
            }));
            deck = oldState.deck;
          }
        }
      }

      const useDeck = deck || 'A';

      // Load track (always force reload to prevent stale cache issues)
      const streamUrl = `/api/uploads/tracks/${track.id}/stream`;
      audioEngine.clearTrackCache(track.id);
      await audioEngine.loadTrack(track.id, streamUrl, true);

      const loadedBuffer = audioEngine.getBuffer(track.id);
      const duration = loadedBuffer?.duration ?? (track.duration / 1000);
      const startTime = currentState?.currentTime ?? 0;
      const volume = currentState?.volume ?? 1;

      // Update global store with track info
      setDeckTrack(useDeck, track);
      setDeckPlaying(useDeck, true);

      // Try to get or fetch analysis for BPM sync
      let analysis = getAnalysis(track.id);
      if (!analysis) {
        try {
          const response = await fetch(`/api/uploads/tracks/${track.id}/analyze`, {
            method: 'POST',
          });
          if (response.ok) {
            const fetchedAnalysis = await response.json();
            if (fetchedAnalysis) {
              analysis = fetchedAnalysis;
              cacheAnalysis(track.id, fetchedAnalysis);
            }
          }
        } catch {
          // Analysis optional
        }
      }
      if (analysis) {
        setDeckAnalysis(useDeck, analysis);
      }

      // If stems are ready, load and play with stems
      if (hasStemsReady) {
        setLoadingStems(track.id);
        await audioEngine.loadAllStems(track.id, true); // forceReload=true
        setLoadingStems(null);

        await audioEngine.playStems(useDeck, track.id, startTime, 1.0);

        // Apply current stem enabled state
        const stemState = stemEnabled[track.id] || { drums: true, bass: true, vocals: true, other: true };
        audioEngine.setStemVolume(useDeck, 'drums', stemState.drums ? 1 : 0);
        audioEngine.setStemVolume(useDeck, 'bass', stemState.bass ? 1 : 0);
        audioEngine.setStemVolume(useDeck, 'vocals', stemState.vocals ? 1 : 0);
        audioEngine.setStemVolume(useDeck, 'other', stemState.other ? 1 : 0);

        setPlayStates(prev => ({
          ...prev,
          [track.id]: { isPlaying: true, currentTime: startTime, duration, usingSteams: true, deck: useDeck, volume }
        }));
      } else {
        await audioEngine.play(useDeck, track.id, startTime, 1.0);
        setPlayStates(prev => ({
          ...prev,
          [track.id]: { isPlaying: true, currentTime: startTime, duration, usingSteams: false, deck: useDeck, volume }
        }));
      }

      // Set volume
      audioEngine.setVolume(useDeck, volume);
    }
  }, [audioEngine, playStates, stemStatuses, stemEnabled, getAvailableDeck, setDeckTrack, setDeckPlaying, setDeckAnalysis, cacheAnalysis, getAnalysis]);

  // Update current time for all playing tracks
  useEffect(() => {
    const playingTracks = Object.entries(playStates).filter(([_, s]) => s.isPlaying && s.deck);
    if (playingTracks.length === 0) return;

    const interval = setInterval(() => {
      setPlayStates(prev => {
        const updates: Record<number, TrackPlayState> = {};
        const decksToStop: ('A' | 'B')[] = [];

        for (const [trackId, state] of Object.entries(prev)) {
          if (state.isPlaying && state.deck) {
            const time = audioEngine.getCurrentTime(state.deck);

            // Check if track ended
            if (time >= state.duration - 0.1) {
              audioEngine.stop(state.deck);
              decksToStop.push(state.deck);
              updates[Number(trackId)] = { ...state, isPlaying: false, currentTime: 0, deck: null };
            } else {
              updates[Number(trackId)] = { ...state, currentTime: time };
            }
          }
        }

        // Update global store for ended tracks
        decksToStop.forEach(deck => {
          setDeckTrack(deck, null);
          setDeckPlaying(deck, false);
          setDeckAnalysis(deck, null);
        });

        if (Object.keys(updates).length === 0) return prev;
        return { ...prev, ...updates };
      });
    }, 100);

    return () => clearInterval(interval);
  }, [playStates, audioEngine, setDeckTrack, setDeckPlaying, setDeckAnalysis]);

  // Seek to position in track
  const seekTrack = useCallback(async (trackId: number, position: number) => {
    const state = playStates[trackId];
    if (!state) return;

    const seekTime = Math.max(0, Math.min(position * state.duration, state.duration - 0.1));

    setPlayStates(prev => ({
      ...prev,
      [trackId]: { ...prev[trackId], currentTime: seekTime }
    }));

    if (state.isPlaying && state.deck) {
      audioEngine.stop(state.deck);
      if (state.usingSteams) {
        await audioEngine.playStems(state.deck, trackId, seekTime, 1.0);
        // Re-apply stem volumes
        const stemState = stemEnabled[trackId] || { drums: true, bass: true, vocals: true, other: true };
        audioEngine.setStemVolume(state.deck, 'drums', stemState.drums ? 1 : 0);
        audioEngine.setStemVolume(state.deck, 'bass', stemState.bass ? 1 : 0);
        audioEngine.setStemVolume(state.deck, 'vocals', stemState.vocals ? 1 : 0);
        audioEngine.setStemVolume(state.deck, 'other', stemState.other ? 1 : 0);
      } else {
        await audioEngine.play(state.deck, trackId, seekTime, 1.0);
      }
      audioEngine.setVolume(state.deck, state.volume);
    }
  }, [playStates, audioEngine, stemEnabled]);

  // Update volume for a track
  const setTrackVolume = useCallback((trackId: number, volume: number) => {
    const state = playStates[trackId];

    setPlayStates(prev => ({
      ...prev,
      [trackId]: { ...prev[trackId], volume }
    }));

    if (state?.isPlaying && state.deck) {
      audioEngine.setVolume(state.deck, volume);
    }
  }, [playStates, audioEngine]);

  // Handle timeline mouse down
  const handleTimelineMouseDown = (e: React.MouseEvent<HTMLDivElement>, trackId: number) => {
    const state = playStates[trackId];
    if (!state) return;

    setSeekingTrack(trackId);

    const rect = e.currentTarget.getBoundingClientRect();
    const position = (e.clientX - rect.left) / rect.width;
    seekTrack(trackId, position);
  };

  // Handle timeline drag
  useEffect(() => {
    if (!seekingTrack) return;

    const handleMouseMove = (e: MouseEvent) => {
      const ref = timelineRefs.current[seekingTrack];
      if (!ref) return;

      const rect = ref.getBoundingClientRect();
      const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      seekTrack(seekingTrack, position);
    };

    const handleMouseUp = () => {
      setSeekingTrack(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [seekingTrack, seekTrack]);

  // Format time for display
  const formatTimeShort = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get progress percentage
  const getProgressPercent = (trackId: number): number => {
    const state = playStates[trackId];
    if (!state || state.duration <= 0) return 0;
    return Math.min(100, (state.currentTime / state.duration) * 100);
  };

  // Toggle a single stem on/off (mute/unmute)
  const toggleStem = (trackId: number, stemName: StemName) => {
    const currentVolumes = stemVolumes[trackId] || { drums: 1, bass: 1, vocals: 1, other: 1 };
    const currentEnabled = stemEnabled[trackId] || { drums: true, bass: true, vocals: true, other: true };
    const newEnabled = !currentEnabled[stemName];

    setStemEnabled(prev => ({
      ...prev,
      [trackId]: { ...currentEnabled, [stemName]: newEnabled }
    }));

    // Update audio engine immediately if this track is playing
    const playState = playStates[trackId];
    if (playState?.isPlaying && playState.deck) {
      const volume = newEnabled ? currentVolumes[stemName] : 0;
      audioEngine.setStemVolume(playState.deck, stemName, volume);
    }
  };

  // Solo a stem (only that stem plays at full volume)
  const soloStem = (trackId: number, stemName: StemName) => {
    const newEnabled = {
      drums: stemName === 'drums',
      bass: stemName === 'bass',
      vocals: stemName === 'vocals',
      other: stemName === 'other',
    };
    const currentVolumes = stemVolumes[trackId] || { drums: 1, bass: 1, vocals: 1, other: 1 };

    setStemEnabled(prev => ({
      ...prev,
      [trackId]: newEnabled
    }));

    const playState = playStates[trackId];
    if (playState?.isPlaying && playState.deck) {
      audioEngine.setStemVolume(playState.deck, 'drums', newEnabled.drums ? currentVolumes.drums : 0);
      audioEngine.setStemVolume(playState.deck, 'bass', newEnabled.bass ? currentVolumes.bass : 0);
      audioEngine.setStemVolume(playState.deck, 'vocals', newEnabled.vocals ? currentVolumes.vocals : 0);
      audioEngine.setStemVolume(playState.deck, 'other', newEnabled.other ? currentVolumes.other : 0);
    }
  };


  // Apply a preset configuration
  const applyPreset = (trackId: number, preset: typeof STEM_PRESETS[0]) => {
    const { config } = preset;

    // Update enabled state based on which stems have volume > 0
    const newEnabled = {
      drums: config.drums > 0,
      bass: config.bass > 0,
      vocals: config.vocals > 0,
      other: config.other > 0,
    };

    setStemEnabled(prev => ({
      ...prev,
      [trackId]: newEnabled
    }));

    setStemVolumes(prev => ({
      ...prev,
      [trackId]: { ...config }
    }));

    // Apply to audio engine
    const playState = playStates[trackId];
    if (playState?.isPlaying && playState.deck) {
      audioEngine.setStemVolume(playState.deck, 'drums', config.drums);
      audioEngine.setStemVolume(playState.deck, 'bass', config.bass);
      audioEngine.setStemVolume(playState.deck, 'vocals', config.vocals);
      audioEngine.setStemVolume(playState.deck, 'other', config.other);
    }
  };

  // Enable all stems at full volume (used by Full Mix preset internally)
  const enableAllStems = useCallback((trackId: number) => {
    const fullConfig = { drums: 1, bass: 1, vocals: 1, other: 1 };

    setStemEnabled(prev => ({
      ...prev,
      [trackId]: { drums: true, bass: true, vocals: true, other: true }
    }));

    setStemVolumes(prev => ({
      ...prev,
      [trackId]: fullConfig
    }));

    const playState = playStates[trackId];
    if (playState?.isPlaying && playState.deck) {
      audioEngine.setStemVolume(playState.deck, 'drums', 1);
      audioEngine.setStemVolume(playState.deck, 'bass', 1);
      audioEngine.setStemVolume(playState.deck, 'vocals', 1);
      audioEngine.setStemVolume(playState.deck, 'other', 1);
    }
  }, [audioEngine, playStates]);


  // Check if stem is enabled (not muted)
  const isStemEnabled = (trackId: number, stemName: StemName): boolean => {
    return stemEnabled[trackId]?.[stemName] ?? true;
  };

  // Check if only one stem is enabled (soloed)
  const isStemSoloed = (trackId: number, stemName: StemName): boolean => {
    const state = stemEnabled[trackId];
    if (!state) return false;
    return state[stemName] &&
      Object.entries(state).filter(([_, v]) => v).length === 1;
  };


  return (
    <div className="bg-gradient-to-b from-gray-900/90 to-gray-900/70 rounded-2xl border border-gray-800/50 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
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

      {/* Auto Mix Bar - Common timeline for all playing tracks */}
      {Object.values(playStates).some(s => s.isPlaying) && (
        <div className="p-4 border-b border-gray-800/50 bg-gradient-to-r from-violet-900/30 via-gray-900/50 to-blue-900/30">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Auto Mix</span>
              <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[9px] text-green-400">LIVE</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {Object.values(playStates).filter(s => s.isPlaying).length === 2 && (
                <span className="text-[10px] text-violet-400">2 tracks mixing</span>
              )}
            </div>
          </div>

          {/* Combined Timeline */}
          <div className="mb-3">
            <div className="relative h-4 bg-gray-800/80 rounded-full overflow-hidden">
              {/* Deck A progress */}
              {(() => {
                const trackA = Object.entries(playStates).find(([_, s]) => s.isPlaying && s.deck === 'A');
                if (trackA) {
                  const progress = trackA[1].duration > 0 ? (trackA[1].currentTime / trackA[1].duration) * 100 : 0;
                  return (
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-100"
                      style={{ width: `${progress}%`, opacity: 0.8 }}
                    />
                  );
                }
                return null;
              })()}
              {/* Deck B progress overlay */}
              {(() => {
                const trackB = Object.entries(playStates).find(([_, s]) => s.isPlaying && s.deck === 'B');
                if (trackB) {
                  const progress = trackB[1].duration > 0 ? (trackB[1].currentTime / trackB[1].duration) * 100 : 0;
                  return (
                    <div
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-100"
                      style={{ width: `${progress}%`, opacity: 0.5 }}
                    />
                  );
                }
                return null;
              })()}
              {/* Center line */}
              <div className="absolute top-0 left-1/2 w-0.5 h-full bg-gray-600" />
            </div>

            {/* Time display */}
            <div className="flex justify-between mt-1">
              {(() => {
                const trackA = Object.entries(playStates).find(([_, s]) => s.isPlaying && s.deck === 'A');
                const time = trackA ? trackA[1].currentTime : 0;
                const mins = Math.floor(time / 60);
                const secs = Math.floor(time % 60);
                return <span className="text-[10px] text-violet-400">{mins}:{secs.toString().padStart(2, '0')}</span>;
              })()}
              <span className="text-[9px] text-gray-500">MIX TIMELINE</span>
              {(() => {
                const trackB = Object.entries(playStates).find(([_, s]) => s.isPlaying && s.deck === 'B');
                const time = trackB ? trackB[1].currentTime : 0;
                const mins = Math.floor(time / 60);
                const secs = Math.floor(time % 60);
                return <span className="text-[10px] text-blue-400">{mins}:{secs.toString().padStart(2, '0')}</span>;
              })()}
            </div>
          </div>

          {/* Deck Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Deck A */}
            <div className={`p-2 rounded-lg border ${
              Object.entries(playStates).find(([_, s]) => s.isPlaying && s.deck === 'A')
                ? 'bg-violet-500/10 border-violet-500/30'
                : 'bg-gray-800/30 border-gray-700/30'
            }`}>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-[10px] font-bold text-white">A</span>
                <div className="flex-1 min-w-0">
                  {(() => {
                    const trackA = Object.entries(playStates).find(([_, s]) => s.isPlaying && s.deck === 'A');
                    if (trackA) {
                      const track = tracks.find(t => t.id === Number(trackA[0]));
                      return <p className="text-[10px] text-white font-medium truncate">{track?.title || 'Unknown'}</p>;
                    }
                    return <p className="text-[10px] text-gray-500">No track</p>;
                  })()}
                </div>
              </div>
            </div>

            {/* Deck B */}
            <div className={`p-2 rounded-lg border ${
              Object.entries(playStates).find(([_, s]) => s.isPlaying && s.deck === 'B')
                ? 'bg-blue-500/10 border-blue-500/30'
                : 'bg-gray-800/30 border-gray-700/30'
            }`}>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white">B</span>
                <div className="flex-1 min-w-0">
                  {(() => {
                    const trackB = Object.entries(playStates).find(([_, s]) => s.isPlaying && s.deck === 'B');
                    if (trackB) {
                      const track = tracks.find(t => t.id === Number(trackB[0]));
                      return <p className="text-[10px] text-white font-medium truncate">{track?.title || 'Unknown'}</p>;
                    }
                    return <p className="text-[10px] text-gray-500">No track</p>;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Track List */}
      <div className="max-h-[600px] overflow-y-auto">
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
              const isDragging = draggedIndex === index;
              const isDragOver = dragOverIndex === index;
              const stemStatus = stemStatuses[track.id];
              const isSeparating = separatingTrack === track.id;
              const playState = playStates[track.id];
              const isPlaying = playState?.isPlaying ?? false;
              const hasStemsReady = stemStatus?.status === 'ready';
              const isLoadingStems = loadingStems === track.id;
              const trackVolume = playState?.volume ?? 1;
              const deckLabel = playState?.deck;
              const deckColor = deckLabel === 'A' ? 'violet' : deckLabel === 'B' ? 'blue' : 'gray';

              return (
                <div
                  key={track.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`group transition-all duration-200 ${
                    isDragging ? 'opacity-50 bg-violet-500/10' : ''
                  } ${isDragOver ? 'bg-violet-500/20 border-t-2 border-violet-500' : ''} ${
                    isPlaying ? (deckLabel === 'A' ? 'bg-violet-500/10 border-l-2 border-violet-500' : 'bg-blue-500/10 border-l-2 border-blue-500') : 'hover:bg-gray-800/30'
                  }`}
                >
                  {/* Main track row */}
                  <div className="flex items-center gap-3 p-3">
                    {/* Channel Indicator */}
                    <div className="w-8 flex flex-col items-center gap-1">
                      {isPlaying && deckLabel ? (
                        <>
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold bg-${deckColor}-500 text-white shadow-lg shadow-${deckColor}-500/50`}>
                            {deckLabel}
                          </span>
                          <span className="flex justify-center gap-0.5">
                            <span className={`w-0.5 h-2 bg-${deckColor}-500 rounded-full animate-pulse`} />
                            <span className={`w-0.5 h-3 bg-${deckColor}-500 rounded-full animate-pulse`} style={{ animationDelay: '150ms' }} />
                            <span className={`w-0.5 h-2 bg-${deckColor}-500 rounded-full animate-pulse`} style={{ animationDelay: '300ms' }} />
                          </span>
                        </>
                      ) : (
                        <span className="text-xs font-medium text-gray-500">{index + 1}</span>
                      )}
                    </div>

                    {/* Play/Pause Button */}
                    <button
                      onClick={() => toggleTrackPlay(track)}
                      disabled={isLoadingStems}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                        isPlaying
                          ? `bg-${deckColor}-500 text-white shadow-lg shadow-${deckColor}-500/30`
                          : 'bg-gray-800 text-gray-400 hover:bg-violet-500 hover:text-white'
                      }`}
                    >
                      {isLoadingStems ? (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : isPlaying ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>

                    {/* Track Info & Timeline */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-white truncate">{track.title}</p>
                        {hasStemsReady && (
                          <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] font-bold rounded">
                            STEMS
                          </span>
                        )}
                      </div>

                      {/* Timeline */}
                      <div
                        ref={(el) => { timelineRefs.current[track.id] = el; }}
                        onMouseDown={(e) => handleTimelineMouseDown(e, track.id)}
                        className={`relative h-2 bg-gray-700 rounded-full cursor-pointer overflow-hidden group/timeline`}
                      >
                        <div
                          className={`absolute top-0 left-0 h-full rounded-full transition-all duration-100 ${
                            isPlaying ? `bg-${deckColor}-500` : 'bg-violet-500'
                          }`}
                          style={{ width: `${getProgressPercent(track.id)}%` }}
                        />
                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/timeline:opacity-100 transition-opacity" />
                      </div>

                      {/* Time display */}
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-gray-500">
                          {playState ? formatTimeShort(playState.currentTime) : '0:00'}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {formatDuration(track.duration)}
                        </span>
                      </div>
                    </div>

                    {/* Volume Control - Only show when playing */}
                    {isPlaying && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                        </svg>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={trackVolume}
                          onChange={(e) => setTrackVolume(track.id, parseFloat(e.target.value))}
                          className={`w-20 h-1 accent-${deckColor}-500`}
                        />
                        <span className="text-[10px] text-gray-500 w-8">{Math.round(trackVolume * 100)}%</span>
                      </div>
                    )}

                    {/* Stems / Separate Button */}
                    <div className="flex-shrink-0">
                      {stemStatus?.status === 'processing' || isSeparating ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
                          <span className="w-4 h-4 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-gray-400">Splitting...</span>
                        </div>
                      ) : !hasStemsReady ? (
                        <button
                          onClick={() => separateStems(track.id)}
                          className="px-3 py-2 bg-gray-800 hover:bg-violet-500/20 text-xs text-gray-400 hover:text-violet-400 rounded-lg transition-all flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                          </svg>
                          Split
                        </button>
                      ) : null}
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeTrack(index)}
                      className="w-8 h-8 rounded-lg bg-gray-800/50 text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0 flex items-center justify-center"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Stem Controls - Compact Square Grid */}
                  {hasStemsReady && (
                    <div className="px-3 pb-3 pt-1">
                      <div className="flex items-start gap-2">
                        {/* 2x2 Stem Grid */}
                        <div className="grid grid-cols-2 gap-1.5">
                          {STEMS.map((stem) => {
                            const enabled = isStemEnabled(track.id, stem.name);
                            const soloed = isStemSoloed(track.id, stem.name);

                            return (
                              <button
                                key={stem.name}
                                onClick={() => toggleStem(track.id, stem.name)}
                                onDoubleClick={() => soloStem(track.id, stem.name)}
                                className={`relative w-14 h-14 rounded-lg flex flex-col items-center justify-center transition-all ${
                                  enabled
                                    ? 'shadow-lg hover:scale-105'
                                    : 'opacity-40 hover:opacity-70'
                                } ${soloed ? 'ring-2 ring-white' : ''}`}
                                style={{
                                  backgroundColor: enabled ? `${stem.color}40` : '#1f2937',
                                  border: `2px solid ${enabled ? stem.color : '#374151'}`,
                                }}
                                title={`${stem.fullName} - Click to ${enabled ? 'disable' : 'enable'}, Double-click to solo`}
                              >
                                <stem.IconComponent size={18} className={enabled ? '' : 'opacity-50'} />
                                <span
                                  className="text-[7px] font-bold uppercase"
                                  style={{ color: enabled ? stem.color : '#6b7280' }}
                                >
                                  {stem.label}
                                </span>
                                {/* ON/OFF indicator */}
                                <span
                                  className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${
                                    enabled ? 'bg-green-500' : 'bg-gray-600'
                                  }`}
                                />
                              </button>
                            );
                          })}
                        </div>

                        {/* Quick Actions */}
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => enableAllStems(track.id)}
                            className="px-2 py-1 bg-gray-700/50 hover:bg-green-500/20 text-[8px] text-gray-400 hover:text-green-400 rounded transition-all"
                            title="Enable all stems"
                          >
                            ALL
                          </button>
                          {STEM_PRESETS.slice(1, 4).map((preset) => (
                            <button
                              key={preset.name}
                              onClick={() => applyPreset(track.id, preset)}
                              className="px-2 py-1 bg-gray-700/50 hover:bg-gray-600/50 text-gray-400 hover:text-white rounded transition-all flex items-center justify-center"
                              title={preset.label}
                            >
                              <preset.IconComponent size={12} />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
