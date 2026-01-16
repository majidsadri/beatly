import axios from 'axios';
import type {
  SoundCloudUser,
  SoundCloudPlaylist,
  SoundCloudTrack,
  TrackAnalysis,
  StemSet,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sc_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sc_access_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const getAuthUrl = async (): Promise<string> => {
  const response = await api.get<{ url: string }>('/auth/soundcloud/url');
  return response.data.url;
};

export const exchangeCode = async (code: string): Promise<{
  access_token: string;
  refresh_token: string;
  user: SoundCloudUser;
}> => {
  const response = await api.post('/auth/soundcloud/callback', { code });
  return response.data;
};

export const refreshToken = async (): Promise<{ access_token: string }> => {
  const response = await api.post('/auth/soundcloud/refresh');
  return response.data;
};

export const getCurrentUser = async (): Promise<SoundCloudUser> => {
  const response = await api.get<SoundCloudUser>('/auth/soundcloud/me');
  return response.data;
};

// Playlist endpoints
export const getPlaylists = async (): Promise<SoundCloudPlaylist[]> => {
  const response = await api.get<SoundCloudPlaylist[]>('/playlists');
  return response.data;
};

export const getPlaylistTracks = async (
  playlistId: number
): Promise<SoundCloudTrack[]> => {
  const response = await api.get<SoundCloudTrack[]>(
    `/playlists/${playlistId}/tracks`
  );
  return response.data;
};

// Track endpoints
export const getTrackStreamUrl = (trackId: number): string => {
  const token = localStorage.getItem('sc_access_token');
  return `/api/tracks/${trackId}/stream?token=${encodeURIComponent(token || '')}`;
};

export const getStemUrl = (trackId: number, stemName: string): string => {
  return `/api/tracks/${trackId}/stems/${stemName}`;
};

// Analysis endpoints
export const analyzeTrack = async (trackId: number): Promise<TrackAnalysis> => {
  const response = await api.post<TrackAnalysis>(`/tracks/${trackId}/analyze`);
  return response.data;
};

export const getAnalysis = async (trackId: number): Promise<TrackAnalysis | null> => {
  try {
    const response = await api.get<TrackAnalysis>(`/tracks/${trackId}/analysis`);
    return response.data;
  } catch {
    return null;
  }
};

// Stem endpoints
export const requestStems = async (trackId: number): Promise<StemSet> => {
  const response = await api.post<StemSet>(`/tracks/${trackId}/stems`);
  return response.data;
};

export const getStemStatus = async (trackId: number): Promise<StemSet> => {
  const response = await api.get<StemSet>(`/tracks/${trackId}/stems/status`);
  return response.data;
};

// Compatibility scoring
export const getCompatibilityScore = async (
  trackAId: number,
  trackBId: number
): Promise<{ score: number; details: object }> => {
  const response = await api.get(`/tracks/compatibility`, {
    params: { track_a: trackAId, track_b: trackBId },
  });
  return response.data;
};

// Smart ordering
export const getSmartOrder = async (
  playlistId: number
): Promise<{ order: number[]; scores: Record<string, number> }> => {
  const response = await api.get(`/playlists/${playlistId}/smart-order`);
  return response.data;
};

export default api;
