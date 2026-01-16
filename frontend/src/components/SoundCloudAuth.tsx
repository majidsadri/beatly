import { useState } from 'react';
import { getAuthUrl } from '../api/soundcloud';

interface SoundCloudAuthProps {
  error?: string | null;
}

export const SoundCloudAuth: React.FC<SoundCloudAuthProps> = ({ error }) => {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const url = await getAuthUrl();
      window.location.href = url;
    } catch (err) {
      console.error('Failed to get auth URL:', err);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-dj-purple via-dj-blue to-dj-pink bg-clip-text text-transparent mb-2">
            Beatly
          </h1>
          <p className="text-gray-400">
            DJ-style mixing powered by SoundCloud
          </p>
        </div>

        {/* Features */}
        <div className="bg-dj-dark rounded-xl p-6 mb-8 text-left">
          <h2 className="text-lg font-semibold mb-4">Mix your playlists like a DJ</h2>
          <ul className="space-y-3 text-gray-300">
            <li className="flex items-start gap-3">
              <span className="text-dj-purple">♪</span>
              <span>Auto-detect BPM, key, and energy for each track</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-dj-blue">♪</span>
              <span>Beat-aligned transitions with phrase matching</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-dj-pink">♪</span>
              <span>AI-powered stem separation for layered mixing</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-dj-purple">♪</span>
              <span>Smart track ordering for perfect flow</span>
            </li>
          </ul>
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Login button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white font-semibold py-4 px-8 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <svg
                className="w-6 h-6"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M7 17.939h-1v-8.068c.308-.231.639-.429 1-.566v8.634zm3 0h1v-9.224c-.229.265-.443.548-.621.857l-.379-.184v8.551zm2 0h1v-8.848c-.508-.079-.623-.05-1-.01v8.858zm2 0h1v-8.987c-.308.018-.621.06-1 .157v8.83zm2 0h1v-8.216c-.271.187-.54.398-1 .712v7.504zm-1.954-9.412c-.477.146-.932.331-1.046.426v8.986h1v-8.842c.016-.095.045-.396.046-.57zm-8.046 1.482v7.93h1v-7.93c-.315-.076-.668-.114-1 0zm12 .424c-.298-.08-.636-.154-1-.209v9.215h1v-9.006zm2-.424v9.43h1v-9.43c-.34-.074-.655-.112-1 0zm6 2.323c-1.399-.863-2.846-1.351-4.314-1.481v7.577c1.46.13 2.907.618 4.314 1.481v-7.577zm-23-5.332c-1.397.863-2.843 1.351-4.314 1.481v7.577c1.471-.13 2.917-.618 4.314-1.481v-7.577z" />
              </svg>
              Connect with SoundCloud
            </>
          )}
        </button>

        {/* Legal notice */}
        <p className="text-xs text-gray-500 mt-6">
          By connecting, you agree to stream music legally through your SoundCloud account.
          Beatly processes audio for analysis only and respects SoundCloud&apos;s Terms of Service.
        </p>
      </div>
    </div>
  );
};
