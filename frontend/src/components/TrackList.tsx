import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { getAudioEngine, StemName } from '../audio/AudioEngine';
import { DrumsIcon, BassIcon, VocalsIcon, MelodyIcon, MusicNoteIcon, WaveformIcon } from './Icons';
import { ZoneManager, getZoneIcon } from './ZoneManager';
import type { SoundCloudTrack, ZoneId } from '../types';

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
  const { tracks, setTracks, setDeckTrack, setDeckPlaying, setDeckAnalysis, cacheAnalysis, getAnalysis, deckA, deckB, zones, activeZoneFilter, setTrackZone, getZone } = store;
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
  const [waveformPeaks, setWaveformPeaks] = useState<Record<number, number[]>>({});

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

  // Preload waveforms for tracks that don't have them yet
  useEffect(() => {
    const loadWaveforms = async () => {
      for (const track of tracks) {
        if (waveformPeaks[track.id]) continue; // Already have waveform

        try {
          // Load track audio to get waveform (if not already loaded)
          if (!audioEngine.hasBuffer(track.id)) {
            const streamUrl = `/api/uploads/tracks/${track.id}/stream`;
            await audioEngine.loadTrack(track.id, streamUrl, false);
          }

          // Generate waveform peaks
          const peaks = audioEngine.generateWaveformPeaks(track.id, 80);
          if (peaks.some(p => p > 0)) {
            setWaveformPeaks(prev => ({ ...prev, [track.id]: peaks }));
          }
        } catch (err) {
          console.warn(`Failed to load waveform for track ${track.id}:`, err);
        }
      }
    };

    if (tracks.length > 0) {
      loadWaveforms();
    }
  }, [tracks, audioEngine]);

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

  const handleFileUpload = async (files: FileList | null, zoneId?: ZoneId) => {
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
              avatar_url: '',
              permalink_url: '',
            },
            waveform_url: '',
            permalink_url: '',
            zoneId: zoneId, // Assign zone if provided
          });
        }
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }

    if (newTracks.length > 0) {
      // Set up playlist if not already set
      if (!store.selectedPlaylist) {
        store.selectPlaylist({
          id: -1,
          title: 'My Uploads',
          user: { id: 0, username: 'Local', avatar_url: '', permalink_url: '' },
          artwork_url: null,
          track_count: newTracks.length,
        });
      }
      setTracks([...tracks, ...newTracks]);
    }
    setUploading(false);
  };

  // Handle upload to specific zone
  const handleUploadToZone = (files: FileList, zoneId: ZoneId) => {
    handleFileUpload(files, zoneId);
  };

  // Get filtered tracks based on active zone filter
  const filteredTracks = activeZoneFilter
    ? tracks.filter(t => t.zoneId === activeZoneFilter)
    : tracks;

  // Get zone info for a track
  const getTrackZone = (track: SoundCloudTrack) => {
    if (!track.zoneId) return null;
    return getZone(track.zoneId);
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

      // Generate waveform peaks for visualization
      if (!waveformPeaks[track.id]) {
        const peaks = audioEngine.generateWaveformPeaks(track.id, 80);
        setWaveformPeaks(prev => ({ ...prev, [track.id]: peaks }));
      }

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
  }, [audioEngine, playStates, stemStatuses, stemEnabled, getAvailableDeck, setDeckTrack, setDeckPlaying, setDeckAnalysis, cacheAnalysis, getAnalysis, waveformPeaks]);

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
    <div className="space-y-4">
      {/* Now Playing Bar - At the top */}
      {Object.values(playStates).some(s => s.isPlaying) && (
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl p-4 bg-gradient-to-r from-cyan-500/10 via-transparent to-emerald-500/10">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Now Playing</span>
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-500/20 rounded-full border border-emerald-500/30">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[9px] text-emerald-400 font-medium">LIVE</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {Object.values(playStates).filter(s => s.isPlaying).length === 2 && (
                <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full">2 decks active</span>
              )}
            </div>
          </div>

          {/* Waveform Display for Both Decks */}
          <div className="space-y-2 mb-3">
            {/* Deck A Waveform */}
            {(() => {
              const trackAEntry = Object.entries(playStates).find(([_, s]) => s.isPlaying && s.deck === 'A');
              if (!trackAEntry) return null;
              const [trackIdStr, state] = trackAEntry;
              const trackId = Number(trackIdStr);
              const track = tracks.find(t => t.id === trackId);
              const peaks = waveformPeaks[trackId] || new Array(100).fill(0.1);
              const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

              return (
                <div className="relative">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-[9px] font-bold text-white">A</span>
                    <span className="text-[10px] text-white font-medium truncate flex-1">{track?.title || 'Unknown'}</span>
                    <span className="text-[10px] text-cyan-400 font-mono">
                      {Math.floor(state.currentTime / 60)}:{Math.floor(state.currentTime % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="relative h-12 bg-gray-900/50 rounded-lg overflow-hidden">
                    {/* Waveform bars */}
                    <div className="absolute inset-0 flex items-center">
                      {peaks.map((peak, i) => {
                        const barPosition = (i / peaks.length) * 100;
                        const isPast = barPosition < progress;
                        return (
                          <div
                            key={i}
                            className="flex-1 flex items-center justify-center"
                            style={{ height: '100%' }}
                          >
                            <div
                              className="w-full mx-px rounded-sm"
                              style={{
                                height: `${Math.max(4, peak * 85)}%`,
                                backgroundColor: isPast ? '#06b6d4' : '#164e63',
                                opacity: isPast ? 1 : 0.4,
                                boxShadow: isPast ? '0 0 4px #06b6d4' : 'none',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {/* Playhead */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_white] z-10"
                      style={{ left: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Deck B Waveform */}
            {(() => {
              const trackBEntry = Object.entries(playStates).find(([_, s]) => s.isPlaying && s.deck === 'B');
              if (!trackBEntry) return null;
              const [trackIdStr, state] = trackBEntry;
              const trackId = Number(trackIdStr);
              const track = tracks.find(t => t.id === trackId);
              const peaks = waveformPeaks[trackId] || new Array(100).fill(0.1);
              const progress = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;

              return (
                <div className="relative">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-5 h-5 rounded bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-[9px] font-bold text-white">B</span>
                    <span className="text-[10px] text-white font-medium truncate flex-1">{track?.title || 'Unknown'}</span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {Math.floor(state.currentTime / 60)}:{Math.floor(state.currentTime % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div className="relative h-12 bg-gray-900/50 rounded-lg overflow-hidden">
                    {/* Waveform bars */}
                    <div className="absolute inset-0 flex items-center">
                      {peaks.map((peak, i) => {
                        const barPosition = (i / peaks.length) * 100;
                        const isPast = barPosition < progress;
                        return (
                          <div
                            key={i}
                            className="flex-1 flex items-center justify-center"
                            style={{ height: '100%' }}
                          >
                            <div
                              className="w-full mx-px rounded-sm"
                              style={{
                                height: `${Math.max(4, peak * 85)}%`,
                                backgroundColor: isPast ? '#10b981' : '#064e3b',
                                opacity: isPast ? 1 : 0.4,
                                boxShadow: isPast ? '0 0 4px #10b981' : 'none',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {/* Playhead */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_white] z-10"
                      style={{ left: `${progress}%` }}
                    />
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Deck Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Deck A */}
            <div className={`p-3 rounded-xl border backdrop-blur transition-all ${
              Object.entries(playStates).find(([_, s]) => s.isPlaying && s.deck === 'A')
                ? 'bg-cyan-500/10 border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                : 'bg-white/5 border-white/10'
            }`}>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-[11px] font-bold text-white shadow-lg">A</span>
                <div className="flex-1 min-w-0">
                  {(() => {
                    const trackA = Object.entries(playStates).find(([_, s]) => s.isPlaying && s.deck === 'A');
                    if (trackA) {
                      const track = tracks.find(t => t.id === Number(trackA[0]));
                      return <p className="text-[11px] text-white font-medium truncate">{track?.title || 'Unknown'}</p>;
                    }
                    return <p className="text-[11px] text-gray-500">Empty</p>;
                  })()}
                </div>
              </div>
            </div>

            {/* Deck B */}
            <div className={`p-3 rounded-xl border backdrop-blur transition-all ${
              Object.entries(playStates).find(([_, s]) => s.isPlaying && s.deck === 'B')
                ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-500/10'
                : 'bg-white/5 border-white/10'
            }`}>
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-[11px] font-bold text-white shadow-lg">B</span>
                <div className="flex-1 min-w-0">
                  {(() => {
                    const trackB = Object.entries(playStates).find(([_, s]) => s.isPlaying && s.deck === 'B');
                    if (trackB) {
                      const track = tracks.find(t => t.id === Number(trackB[0]));
                      return <p className="text-[11px] text-white font-medium truncate">{track?.title || 'Unknown'}</p>;
                    }
                    return <p className="text-[11px] text-gray-500">Empty</p>;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Zone Manager */}
      <ZoneManager onUploadToZone={handleUploadToZone} uploading={uploading} />

      {/* Track List */}
      <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-white/10 bg-gradient-to-r from-cyan-500/10 via-transparent to-emerald-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Tracks</h2>
                <p className="text-xs text-gray-400">
                  {activeZoneFilter ? (
                    <>
                      {filteredTracks.length} of {tracks.length} tracks
                      <span className="ml-1 text-cyan-400">
                        ({zones.find(z => z.id === activeZoneFilter)?.name})
                      </span>
                    </>
                  ) : (
                    <>{tracks.length} {tracks.length === 1 ? 'track' : 'tracks'} loaded</>
                  )}
                </p>
              </div>
            </div>

            {/* Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl transition-all border border-white/10 hover:border-white/20"
            >
              {uploading ? (
                <span className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
              Add Tracks
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

        {/* Track List Scroll Container */}
        <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          {tracks.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 flex items-center justify-center border border-white/10">
              <svg className="w-10 h-10 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <p className="text-base text-white font-medium mb-2">No tracks loaded</p>
            <p className="text-sm text-gray-400 mb-6">Upload audio files to start mixing</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-105"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload Tracks
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filteredTracks.map((track, index) => {
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
              const deckColor = deckLabel === 'A' ? 'cyan' : deckLabel === 'B' ? 'emerald' : 'gray';
              const trackZone = getTrackZone(track);

              return (
                <div
                  key={track.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`group transition-all duration-200 ${
                    isDragging ? 'opacity-50 bg-cyan-500/10' : ''
                  } ${isDragOver ? 'bg-cyan-500/20 border-t-2 border-cyan-500' : ''} ${
                    isPlaying ? (deckLabel === 'A' ? 'bg-cyan-500/5 border-l-2 border-cyan-500' : 'bg-emerald-500/5 border-l-2 border-emerald-500') : 'hover:bg-white/5'
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
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                        isPlaying
                          ? `bg-${deckColor}-500 text-white shadow-lg shadow-${deckColor}-500/30`
                          : 'bg-gray-800 text-gray-400 hover:bg-violet-500 hover:text-white'
                      }`}
                    >
                      {isLoadingStems ? (
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : isPlaying ? (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>

                    {/* Stem Controls - Inline (only when stems ready) */}
                    {hasStemsReady && (
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {STEMS.map((stem) => {
                          const enabled = isStemEnabled(track.id, stem.name);
                          const soloed = isStemSoloed(track.id, stem.name);
                          return (
                            <button
                              key={stem.name}
                              onClick={() => toggleStem(track.id, stem.name)}
                              onDoubleClick={() => soloStem(track.id, stem.name)}
                              className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                                enabled ? 'hover:scale-110' : 'opacity-30 hover:opacity-60'
                              } ${soloed ? 'ring-1 ring-white' : ''}`}
                              style={{
                                backgroundColor: enabled ? `${stem.color}50` : 'transparent',
                                border: `1px solid ${enabled ? stem.color : '#374151'}`,
                              }}
                              title={`${stem.fullName}`}
                            >
                              <stem.IconComponent size={12} className={enabled ? '' : 'opacity-50'} />
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Stems / Separate Button (only when no stems) */}
                    {!hasStemsReady && (
                      <div className="flex-shrink-0">
                        {stemStatus?.status === 'processing' || isSeparating ? (
                          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800 rounded">
                            <span className="w-3 h-3 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-[10px] text-gray-400">Split</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => separateStems(track.id)}
                            className="px-2 py-1 bg-gray-800 hover:bg-violet-500/20 text-[10px] text-gray-400 hover:text-violet-400 rounded transition-all flex items-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                            Split
                          </button>
                        )}
                      </div>
                    )}

                    {/* Zone Indicator */}
                    {trackZone && (
                      <span
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${trackZone.bgColor}30`, color: trackZone.bgColor }}
                        title={trackZone.name}
                      >
                        {getZoneIcon(trackZone.id, 'w-3 h-3')}
                      </span>
                    )}

                    {/* Track Info & Timeline */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-white truncate flex-1">{track.title}</p>
                        <span className="text-[9px] text-gray-500 flex-shrink-0">
                          {playState ? formatTimeShort(playState.currentTime) : '0:00'} / {formatDuration(track.duration)}
                        </span>
                      </div>

                      {/* Compact Waveform Timeline */}
                      <div
                        ref={(el) => { timelineRefs.current[track.id] = el; }}
                        onMouseDown={(e) => handleTimelineMouseDown(e, track.id)}
                        className="relative h-5 bg-gray-800/50 rounded cursor-pointer overflow-hidden group/timeline mt-1"
                      >
                        {/* Waveform bars */}
                        <div className="absolute inset-0 flex items-center px-0.5">
                          {(waveformPeaks[track.id] || new Array(50).fill(0.1)).slice(0, 50).map((peak, i) => {
                            const progress = getProgressPercent(track.id);
                            const barPosition = (i / 50) * 100;
                            const isPast = barPosition < progress;
                            const barColor = isPlaying
                              ? (deckColor === 'cyan' ? (isPast ? '#06b6d4' : '#164e63') : (isPast ? '#10b981' : '#064e3b'))
                              : (isPast ? '#8b5cf6' : '#3f3f46');

                            return (
                              <div
                                key={i}
                                className="flex-1 flex items-center justify-center"
                                style={{ height: '100%' }}
                              >
                                <div
                                  className="w-full mx-px rounded-sm"
                                  style={{
                                    height: `${Math.max(15, peak * 85)}%`,
                                    backgroundColor: barColor,
                                    opacity: isPast ? 1 : 0.5,
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* Playhead indicator */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg shadow-white/50 z-10"
                          style={{ left: `${getProgressPercent(track.id)}%` }}
                        />
                      </div>
                    </div>

                    {/* Volume Control - Only show when playing */}
                    {isPlaying && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={trackVolume}
                          onChange={(e) => setTrackVolume(track.id, parseFloat(e.target.value))}
                          className={`w-14 h-1 accent-${deckColor}-500`}
                        />
                        <span className="text-[9px] text-gray-500 w-6">{Math.round(trackVolume * 100)}%</span>
                      </div>
                    )}

                    {/* Zone Selector */}
                    <select
                      value={track.zoneId || ''}
                      onChange={(e) => setTrackZone(track.id, e.target.value as ZoneId || undefined)}
                      className="w-16 px-1 py-0.5 bg-gray-800/80 border border-white/10 rounded text-[9px] text-gray-300 opacity-0 group-hover:opacity-100 transition-all cursor-pointer hover:border-white/30 focus:border-cyan-500/50 focus:outline-none"
                    >
                      <option value="">Zone</option>
                      {zones.filter(z => z.enabled).map(zone => (
                        <option key={zone.id} value={zone.id}>{zone.name}</option>
                      ))}
                    </select>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeTrack(index)}
                      className="w-6 h-6 rounded bg-gray-800/50 text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0 flex items-center justify-center"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
  </div>
  );
};
