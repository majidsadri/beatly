import { useState, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { getAudioEngine } from '../audio/AudioEngine';
import { BeatlyIcon, UploadIcon, WaveformIcon, SyncIcon, MixerIcon, MusicNoteIcon } from './Icons';
import type { SoundCloudTrack } from '../types';

interface UploadedTrack {
  id: number;
  title: string;
  filename: string;
  duration: number;
  file_path: string;
}

export const FileUpload: React.FC = () => {
  const { setTracks, selectPlaylist } = useStore();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);
    setUploadProgress([]);

    // Clear all caches before uploading new files
    try {
      await fetch('/api/uploads/cache', { method: 'DELETE' });
      const audioEngine = getAudioEngine();
      audioEngine.clearCache();
      setUploadProgress(['Cleared cache...']);
    } catch {
      // Continue even if cache clear fails
    }

    const uploadedTracks: SoundCloudTrack[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress((prev) => [...prev, `Uploading ${file.name}...`]);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/uploads/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Upload failed');
        }

        const track: UploadedTrack = await response.json();

        // Convert to SoundCloudTrack format for compatibility
        const compatibleTrack: SoundCloudTrack = {
          id: track.id,
          title: track.title,
          user: {
            id: 0,
            username: 'Local File',
            avatar_url: null,
            permalink_url: '',
          },
          artwork_url: null,
          duration: track.duration,
          waveform_url: '',
          permalink_url: '',
        };

        uploadedTracks.push(compatibleTrack);
        setUploadProgress((prev) => [
          ...prev.slice(0, -1),
          `✓ Uploaded ${file.name}`,
        ]);
      } catch (err) {
        setUploadProgress((prev) => [
          ...prev.slice(0, -1),
          `✗ Failed: ${file.name}`,
        ]);
        console.error(`Failed to upload ${file.name}:`, err);
      }
    }

    if (uploadedTracks.length > 0) {
      // Create a fake playlist for the uploaded tracks
      selectPlaylist({
        id: -1,
        title: 'My Uploads',
        user: {
          id: 0,
          username: 'Local',
          avatar_url: null,
          permalink_url: '',
        },
        artwork_url: null,
        track_count: uploadedTracks.length,
      });

      setTracks(uploadedTracks);
    }

    setUploading(false);
  }, [setTracks, selectPlaylist]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        {/* Animated Header */}
        <div className="text-center mb-8">
          {/* Animated Beatly Logo */}
          <div className="relative inline-block mb-6">
            {/* Glow effect behind */}
            <div className="absolute inset-0 blur-2xl opacity-50">
              <div className="text-6xl font-bold bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 bg-clip-text text-transparent animate-pulse">
                Beatly
              </div>
            </div>

            {/* Main title with beat animation */}
            <h1 className="relative text-6xl font-bold">
              {['B', 'e', 'a', 't', 'l', 'y'].map((letter, index) => (
                <span
                  key={index}
                  className="inline-block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent"
                  style={{
                    animation: `beatPulse 0.6s ease-in-out infinite`,
                    animationDelay: `${index * 0.1}s`,
                  }}
                >
                  {letter}
                </span>
              ))}
            </h1>

            {/* Equalizer bars under the title */}
            <div className="flex justify-center gap-1 mt-3">
              {[...Array(12)].map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 rounded-full bg-gradient-to-t from-violet-500 via-fuchsia-500 to-pink-500"
                  style={{
                    animation: `eqBar 0.5s ease-in-out infinite`,
                    animationDelay: `${i * 0.05}s`,
                    height: '20px',
                  }}
                />
              ))}
            </div>
          </div>

          <p className="text-gray-400 text-lg">
            Upload your tracks and start mixing like a DJ
          </p>
        </div>

        {/* CSS Animations */}
        <style>{`
          @keyframes beatPulse {
            0%, 100% { transform: scale(1) translateY(0); }
            50% { transform: scale(1.05) translateY(-2px); }
          }
          @keyframes eqBar {
            0%, 100% { height: 8px; opacity: 0.5; }
            50% { height: 24px; opacity: 1; }
          }
        `}</style>

        {/* Upload area */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
            transition-all duration-200
            ${uploading
              ? 'border-dj-purple bg-dj-purple/10'
              : 'border-gray-600 hover:border-dj-purple hover:bg-dj-purple/5'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.m4a,.ogg,.flac"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />

          {uploading ? (
            <div className="space-y-4">
              <div className="w-16 h-16 border-4 border-dj-purple border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-gray-300">Uploading tracks...</p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex justify-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <UploadIcon size={40} className="text-white" />
                </div>
              </div>
              <p className="text-xl text-gray-300 mb-2">
                Drop your audio files here
              </p>
              <p className="text-gray-500">
                or click to browse
              </p>
              <p className="text-xs text-gray-600 mt-4">
                Supports: MP3, WAV, M4A, OGG, FLAC
              </p>
            </>
          )}
        </div>

        {/* Upload progress */}
        {uploadProgress.length > 0 && (
          <div className="mt-6 bg-dj-dark rounded-xl p-4 max-h-48 overflow-y-auto">
            {uploadProgress.map((message, index) => (
              <div
                key={index}
                className={`text-sm py-1 ${
                  message.startsWith('✓')
                    ? 'text-green-400'
                    : message.startsWith('✗')
                    ? 'text-red-400'
                    : 'text-gray-400'
                }`}
              >
                {message}
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-6 bg-red-900/30 border border-red-500/50 rounded-xl p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Features */}
        <div className="mt-12 grid grid-cols-2 gap-4 text-sm">
          <div className="bg-dj-dark rounded-xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
              <WaveformIcon size={20} className="text-violet-400" />
            </div>
            <p className="text-gray-300">Auto BPM & Key Detection</p>
          </div>
          <div className="bg-dj-dark rounded-xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <SyncIcon size={20} className="text-blue-400" />
            </div>
            <p className="text-gray-300">Beat-Aligned Transitions</p>
          </div>
          <div className="bg-dj-dark rounded-xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-pink-500/20 flex items-center justify-center flex-shrink-0">
              <MusicNoteIcon size={20} className="text-pink-400" />
            </div>
            <p className="text-gray-300">AI Stem Separation</p>
          </div>
          <div className="bg-dj-dark rounded-xl p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
              <MixerIcon size={20} className="text-violet-400" />
            </div>
            <p className="text-gray-300">Two-Deck DJ Mixer</p>
          </div>
        </div>
      </div>
    </div>
  );
};
