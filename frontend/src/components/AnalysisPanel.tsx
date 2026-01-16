import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { calculateMixCompatibility, getCamelotKey } from '../utils/compatibility';

export const AnalysisPanel: React.FC = () => {
  const { deckA, deckB, tracks, currentTrackIndex, smartOrder } = useStore();

  // Calculate compatibility between current decks
  const compatibility = useMemo(() => {
    if (!deckA.analysis || !deckB.analysis) return null;
    return calculateMixCompatibility(deckA.analysis, deckB.analysis);
  }, [deckA.analysis, deckB.analysis]);

  // Get upcoming tracks for preview
  const upcomingTracks = useMemo(() => {
    return tracks.slice(currentTrackIndex + 1, currentTrackIndex + 5);
  }, [tracks, currentTrackIndex]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Perfect';
    if (score >= 80) return 'Great';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'OK';
    if (score >= 50) return 'Difficult';
    return 'Poor';
  };

  return (
    <div className="bg-dj-dark rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-6">Analysis & Compatibility</h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Mix Compatibility */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
            Current Mix Compatibility
          </h4>

          {compatibility ? (
            <div className="space-y-4">
              {/* Overall Score */}
              <div className="flex items-center gap-4">
                <div
                  className={`text-4xl font-bold ${getScoreColor(compatibility.score)}`}
                >
                  {compatibility.score}
                </div>
                <div>
                  <div className={`font-semibold ${getScoreColor(compatibility.score)}`}>
                    {getScoreLabel(compatibility.score)}
                  </div>
                  <div className="text-sm text-gray-400">{compatibility.recommendation}</div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-3">
                {/* BPM Match */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">BPM Match</span>
                    <span className={getScoreColor(compatibility.bpmMatch)}>
                      {compatibility.bpmMatch}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-dj-purple transition-all duration-300"
                      style={{ width: `${compatibility.bpmMatch}%` }}
                    />
                  </div>
                </div>

                {/* Key Match */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Key Compatibility</span>
                    <span className={getScoreColor(compatibility.keyMatch)}>
                      {compatibility.keyMatch}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-dj-blue transition-all duration-300"
                      style={{ width: `${compatibility.keyMatch}%` }}
                    />
                  </div>
                </div>

                {/* Energy Flow */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Energy Flow</span>
                    <span className={getScoreColor(compatibility.energyFlow)}>
                      {compatibility.energyFlow}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-dj-pink transition-all duration-300"
                      style={{ width: `${compatibility.energyFlow}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Deck Comparison */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
                {/* Deck A */}
                <div>
                  <div className="text-xs text-gray-500 mb-2">Deck A</div>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-gray-400">BPM: </span>
                      <span className="text-dj-purple font-mono">
                        {Math.round(deckA.analysis!.bpm)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Key: </span>
                      <span className="text-dj-purple font-mono">
                        {deckA.analysis!.key} ({getCamelotKey(deckA.analysis!.key)})
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Energy: </span>
                      <span className="text-dj-purple font-mono">
                        {Math.round(deckA.analysis!.energy * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deck B */}
                <div>
                  <div className="text-xs text-gray-500 mb-2">Deck B</div>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-gray-400">BPM: </span>
                      <span className="text-dj-blue font-mono">
                        {Math.round(deckB.analysis!.bpm)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Key: </span>
                      <span className="text-dj-blue font-mono">
                        {deckB.analysis!.key} ({getCamelotKey(deckB.analysis!.key)})
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400">Energy: </span>
                      <span className="text-dj-blue font-mono">
                        {Math.round(deckB.analysis!.energy * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 py-8 text-center">
              <p>Load tracks into both decks to see compatibility analysis</p>
            </div>
          )}
        </div>

        {/* Upcoming Tracks */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
              Upcoming Tracks
            </h4>
            {smartOrder && (
              <span className="text-xs bg-dj-blue/20 text-dj-blue px-2 py-1 rounded">
                Smart Order
              </span>
            )}
          </div>

          {upcomingTracks.length > 0 ? (
            <div className="space-y-2">
              {upcomingTracks.map((track, index) => (
                <div
                  key={track.id}
                  className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
                >
                  {/* Position */}
                  <span className="text-sm text-gray-500 w-6">
                    {currentTrackIndex + index + 2}
                  </span>

                  {/* Artwork */}
                  <div className="w-10 h-10 rounded overflow-hidden bg-gray-700 flex-shrink-0">
                    {track.artwork_url ? (
                      <img
                        src={track.artwork_url}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-600">
                        ♪
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{track.title}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {track.user.username}
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="text-xs text-gray-500">
                    {Math.floor(track.duration / 60000)}:
                    {String(Math.floor((track.duration % 60000) / 1000)).padStart(2, '0')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 py-8 text-center">
              <p>No more tracks in playlist</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
