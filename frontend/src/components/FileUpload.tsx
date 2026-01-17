import { useState, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import { getAudioEngine } from '../audio/AudioEngine';
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
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-dj-purple via-dj-blue to-dj-pink bg-clip-text text-transparent mb-4">
            Beatly
          </h1>
          <p className="text-gray-400 text-lg">
            Upload your tracks and start mixing like a DJ
          </p>
        </div>

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
              <div className="text-6xl mb-4">🎵</div>
              <p className="text-xl text-gray-300 mb-2">
                Drop your MP3 files here
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
          <div className="bg-dj-dark rounded-xl p-4">
            <span className="text-dj-purple text-lg">♪</span>
            <p className="text-gray-300 mt-2">Auto BPM & Key Detection</p>
          </div>
          <div className="bg-dj-dark rounded-xl p-4">
            <span className="text-dj-blue text-lg">♪</span>
            <p className="text-gray-300 mt-2">Beat-Aligned Transitions</p>
          </div>
          <div className="bg-dj-dark rounded-xl p-4">
            <span className="text-dj-pink text-lg">♪</span>
            <p className="text-gray-300 mt-2">Smart Mix Compatibility</p>
          </div>
          <div className="bg-dj-dark rounded-xl p-4">
            <span className="text-dj-purple text-lg">♪</span>
            <p className="text-gray-300 mt-2">Two-Deck DJ Player</p>
          </div>
        </div>
      </div>
    </div>
  );
};
