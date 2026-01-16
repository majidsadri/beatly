import { create } from 'zustand';
import type {
  AppState,
  DeckState,
  DeckId,
  SoundCloudUser,
  SoundCloudPlaylist,
  SoundCloudTrack,
  TrackAnalysis,
  StemSet,
  TransitionPlan,
} from '../types';

const createInitialDeckState = (id: DeckId): DeckState => ({
  id,
  track: null,
  analysis: null,
  stems: null,
  isPlaying: false,
  currentTime: 0,
  volume: 1,
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  playbackRate: 1,
});

interface StoreActions {
  // Auth
  setAuthenticated: (isAuthenticated: boolean) => void;
  setUser: (user: SoundCloudUser | null) => void;
  logout: () => void;

  // Playlists
  setPlaylists: (playlists: SoundCloudPlaylist[]) => void;
  selectPlaylist: (playlist: SoundCloudPlaylist | null) => void;
  setTracks: (tracks: SoundCloudTrack[]) => void;
  setCurrentTrackIndex: (index: number) => void;

  // DJ Mode
  setDjMode: (enabled: boolean) => void;
  setSmartOrder: (enabled: boolean) => void;

  // Deck controls
  setDeckTrack: (deck: DeckId, track: SoundCloudTrack | null) => void;
  setDeckAnalysis: (deck: DeckId, analysis: TrackAnalysis | null) => void;
  setDeckStems: (deck: DeckId, stems: StemSet | null) => void;
  setDeckPlaying: (deck: DeckId, isPlaying: boolean) => void;
  setDeckCurrentTime: (deck: DeckId, time: number) => void;
  setDeckVolume: (deck: DeckId, volume: number) => void;
  setDeckEQ: (deck: DeckId, band: 'low' | 'mid' | 'high', value: number) => void;
  setDeckPlaybackRate: (deck: DeckId, rate: number) => void;

  // Mixer
  setCrossfader: (value: number) => void;
  setMasterVolume: (volume: number) => void;

  // Transitions
  setTransitioning: (isTransitioning: boolean) => void;
  setTransitionPlan: (plan: TransitionPlan | null) => void;

  // Cache
  cacheAnalysis: (trackId: number, analysis: TrackAnalysis) => void;
  cacheStems: (trackId: number, stems: StemSet) => void;
  getAnalysis: (trackId: number) => TrackAnalysis | undefined;
  getStems: (trackId: number) => StemSet | undefined;
}

type Store = AppState & StoreActions;

export const useStore = create<Store>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  user: null,
  playlists: [],
  selectedPlaylist: null,
  tracks: [],
  currentTrackIndex: 0,
  djMode: false,
  smartOrder: false,
  deckA: createInitialDeckState('A'),
  deckB: createInitialDeckState('B'),
  crossfader: 0,
  masterVolume: 0.8,
  isTransitioning: false,
  transitionPlan: null,
  analysisCache: new Map(),
  stemsCache: new Map(),

  // Auth actions
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setUser: (user) => set({ user }),
  logout: () =>
    set({
      isAuthenticated: false,
      user: null,
      playlists: [],
      selectedPlaylist: null,
      tracks: [],
      deckA: createInitialDeckState('A'),
      deckB: createInitialDeckState('B'),
    }),

  // Playlist actions
  setPlaylists: (playlists) => set({ playlists }),
  selectPlaylist: (playlist) => set({ selectedPlaylist: playlist }),
  setTracks: (tracks) => set({ tracks }),
  setCurrentTrackIndex: (index) => set({ currentTrackIndex: index }),

  // DJ Mode actions
  setDjMode: (enabled) => set({ djMode: enabled }),
  setSmartOrder: (enabled) => set({ smartOrder: enabled }),

  // Deck actions
  setDeckTrack: (deck, track) =>
    set((state) => ({
      [deck === 'A' ? 'deckA' : 'deckB']: {
        ...state[deck === 'A' ? 'deckA' : 'deckB'],
        track,
        currentTime: 0,
      },
    })),

  setDeckAnalysis: (deck, analysis) =>
    set((state) => ({
      [deck === 'A' ? 'deckA' : 'deckB']: {
        ...state[deck === 'A' ? 'deckA' : 'deckB'],
        analysis,
      },
    })),

  setDeckStems: (deck, stems) =>
    set((state) => ({
      [deck === 'A' ? 'deckA' : 'deckB']: {
        ...state[deck === 'A' ? 'deckA' : 'deckB'],
        stems,
      },
    })),

  setDeckPlaying: (deck, isPlaying) =>
    set((state) => ({
      [deck === 'A' ? 'deckA' : 'deckB']: {
        ...state[deck === 'A' ? 'deckA' : 'deckB'],
        isPlaying,
      },
    })),

  setDeckCurrentTime: (deck, time) =>
    set((state) => ({
      [deck === 'A' ? 'deckA' : 'deckB']: {
        ...state[deck === 'A' ? 'deckA' : 'deckB'],
        currentTime: time,
      },
    })),

  setDeckVolume: (deck, volume) =>
    set((state) => ({
      [deck === 'A' ? 'deckA' : 'deckB']: {
        ...state[deck === 'A' ? 'deckA' : 'deckB'],
        volume,
      },
    })),

  setDeckEQ: (deck, band, value) =>
    set((state) => {
      const key = deck === 'A' ? 'deckA' : 'deckB';
      const eqKey = `eq${band.charAt(0).toUpperCase()}${band.slice(1)}` as
        | 'eqLow'
        | 'eqMid'
        | 'eqHigh';
      return {
        [key]: {
          ...state[key],
          [eqKey]: value,
        },
      };
    }),

  setDeckPlaybackRate: (deck, rate) =>
    set((state) => ({
      [deck === 'A' ? 'deckA' : 'deckB']: {
        ...state[deck === 'A' ? 'deckA' : 'deckB'],
        playbackRate: rate,
      },
    })),

  // Mixer actions
  setCrossfader: (value) => set({ crossfader: value }),
  setMasterVolume: (volume) => set({ masterVolume: volume }),

  // Transition actions
  setTransitioning: (isTransitioning) => set({ isTransitioning }),
  setTransitionPlan: (plan) => set({ transitionPlan: plan }),

  // Cache actions
  cacheAnalysis: (trackId, analysis) =>
    set((state) => {
      const newCache = new Map(state.analysisCache);
      newCache.set(trackId, analysis);
      return { analysisCache: newCache };
    }),

  cacheStems: (trackId, stems) =>
    set((state) => {
      const newCache = new Map(state.stemsCache);
      newCache.set(trackId, stems);
      return { stemsCache: newCache };
    }),

  getAnalysis: (trackId) => get().analysisCache.get(trackId),
  getStems: (trackId) => get().stemsCache.get(trackId),
}));
