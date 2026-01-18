// Zone Types - Music intensity/genre categories
export type ZoneId = 'chill' | 'groove' | 'energy' | 'power' | 'metal';

export interface Zone {
  id: ZoneId;
  name: string;
  description: string;
  color: string;      // Tailwind color class
  bgColor: string;    // Background color
  icon: string;       // Emoji or icon identifier
  enabled: boolean;
}

export const DEFAULT_ZONES: Zone[] = [
  {
    id: 'chill',
    name: 'Chill',
    description: 'Light, ambient, easy listening',
    color: 'sky',
    bgColor: '#0ea5e9',
    icon: '🌊',
    enabled: true,
  },
  {
    id: 'groove',
    name: 'Groove',
    description: 'Mid-tempo, funk, soul, R&B',
    color: 'violet',
    bgColor: '#8b5cf6',
    icon: '🎸',
    enabled: true,
  },
  {
    id: 'energy',
    name: 'Energy',
    description: 'Upbeat, dance, house, pop',
    color: 'emerald',
    bgColor: '#10b981',
    icon: '⚡',
    enabled: true,
  },
  {
    id: 'power',
    name: 'Power',
    description: 'High energy, EDM, techno, trance',
    color: 'orange',
    bgColor: '#f97316',
    icon: '🔥',
    enabled: true,
  },
  {
    id: 'metal',
    name: 'Metal',
    description: 'Hard rock, heavy metal, intense',
    color: 'red',
    bgColor: '#ef4444',
    icon: '🤘',
    enabled: true,
  },
];

// SoundCloud Types
export interface SoundCloudUser {
  id: number;
  username: string;
  avatar_url: string;
  permalink_url: string;
}

export interface SoundCloudTrack {
  id: number;
  title: string;
  user: SoundCloudUser;
  artwork_url: string | null;
  duration: number; // milliseconds
  stream_url?: string;
  waveform_url: string;
  permalink_url: string;
  zoneId?: ZoneId; // Optional zone assignment
}

export interface SoundCloudPlaylist {
  id: number;
  title: string;
  user: SoundCloudUser;
  artwork_url: string | null;
  track_count: number;
  tracks?: SoundCloudTrack[];
}

// Analysis Types
export interface BeatGrid {
  bpm: number;
  downbeats: number[]; // timestamps in seconds
  beats: number[]; // all beat timestamps
  barLength: number; // beats per bar (usually 4)
}

export interface TrackAnalysis {
  trackId: number;
  bpm: number;
  key: string; // e.g., "Am", "C", "F#m"
  keyNumber: number; // Camelot-style number 1-12
  keyMode: 'major' | 'minor';
  energy: number; // 0-1 overall energy
  energyCurve: number[]; // energy over time
  beatGrid: BeatGrid;
  drops: number[]; // timestamps of detected drops
  peaks: number[]; // timestamps of energy peaks
  phraseMarkers: number[]; // phrase boundary timestamps (every 8/16 bars)
}

export interface StemSet {
  trackId: number;
  drums: string; // URL to stem audio
  bass: string;
  vocals: string;
  other: string;
  status: 'pending' | 'processing' | 'ready' | 'error';
}

// Mix Compatibility
export interface MixCompatibility {
  score: number; // 0-100
  bpmMatch: number; // 0-100
  keyMatch: number; // 0-100
  energyFlow: number; // 0-100
  recommendation: string;
}

// Deck State
export type DeckId = 'A' | 'B';

export interface DeckState {
  id: DeckId;
  track: SoundCloudTrack | null;
  analysis: TrackAnalysis | null;
  stems: StemSet | null;
  isPlaying: boolean;
  currentTime: number;
  volume: number;
  eqLow: number; // -1 to 1
  eqMid: number;
  eqHigh: number;
  playbackRate: number;
}

// Transition Types
export type TransitionStyle = 'smooth' | 'hype';

export interface TransitionPlan {
  style: TransitionStyle;
  startTime: number; // when to start transition (seconds into current track)
  duration: number; // transition duration in seconds
  phases: TransitionPhase[];
}

export interface TransitionPhase {
  name: string;
  startOffset: number; // seconds from transition start
  duration: number;
  deckAVolume: { start: number; end: number };
  deckBVolume: { start: number; end: number };
  eqChanges: {
    deck: DeckId;
    band: 'low' | 'mid' | 'high';
    start: number;
    end: number;
  }[];
}

// App State
export interface AppState {
  isAuthenticated: boolean;
  user: SoundCloudUser | null;
  playlists: SoundCloudPlaylist[];
  selectedPlaylist: SoundCloudPlaylist | null;
  tracks: SoundCloudTrack[];
  currentTrackIndex: number;
  djMode: boolean;
  smartOrder: boolean;
  deckA: DeckState;
  deckB: DeckState;
  crossfader: number; // -1 (full A) to 1 (full B)
  masterVolume: number;
  isTransitioning: boolean;
  transitionPlan: TransitionPlan | null;
  analysisCache: Map<number, TrackAnalysis>;
  stemsCache: Map<number, StemSet>;
  // Zones
  zones: Zone[];
  activeZoneFilter: ZoneId | null; // null means show all
}
