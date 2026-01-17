import { useState } from 'react';
import { useStore } from '../store/useStore';
import { getPlaylistTracks } from '../api/soundcloud';
import type { SoundCloudPlaylist } from '../types';

export const PlaylistPicker: React.FC = () => {
  const { playlists, user, selectPlaylist, setTracks, logout } = useStore();
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSelectPlaylist = async (playlist: SoundCloudPlaylist) => {
    setLoading(playlist.id);
    setError(null);

    try {
      const tracks = await getPlaylistTracks(playlist.id);
      setTracks(tracks);
      selectPlaylist(playlist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playlist');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-[#1a1a2e]">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-wider">
              StynX
            </h1>
            {user && (
              <p className="text-gray-400 mt-1">
                Welcome, {user.username}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('sc_access_token');
              logout();
            }}
            className="text-sm text-gray-400 hover:text-red-400 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Playlist selection */}
      <div className="max-w-4xl mx-auto">
        <h2 className="text-xl font-semibold mb-6">Select a playlist to mix</h2>

        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {playlists.length === 0 ? (
          <div className="bg-[#16213e] rounded-xl p-8 text-center">
            <p className="text-gray-400 mb-4">
              No playlists found in your SoundCloud account.
            </p>
            <p className="text-gray-500 text-sm">
              Create a playlist on SoundCloud and refresh this page.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => handleSelectPlaylist(playlist)}
                disabled={loading !== null}
                className="bg-[#16213e] hover:bg-gray-800 rounded-xl p-4 text-left transition-all duration-200 group disabled:opacity-50"
              >
                {/* Artwork */}
                <div className="aspect-square rounded-lg overflow-hidden mb-4 bg-gray-800">
                  {playlist.artwork_url ? (
                    <img
                      src={playlist.artwork_url.replace('-large', '-t500x500')}
                      alt={playlist.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl text-gray-600">♪</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <h3 className="font-semibold truncate mb-1 group-hover:text-cyan-400 transition-colors">
                  {playlist.title}
                </h3>
                <p className="text-sm text-gray-400">
                  {playlist.track_count} tracks
                </p>

                {/* Loading indicator */}
                {loading === playlist.id && (
                  <div className="flex items-center gap-2 mt-3 text-cyan-400">
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm">Loading tracks...</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
