import { useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import type { ZoneId, Zone } from '../types';

// Zone icon components
const ZoneIcons: Record<ZoneId, React.FC<{ className?: string }>> = {
  chill: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.5 19h19v2h-19v-2zm19.57-9.36c-.21-.8-1.04-1.28-1.84-1.06L14.92 10l-6.9-6.43-1.93.51 4.14 7.17-4.97 1.33-1.97-1.54-1.45.39 2.59 4.49L21 11.49c.81-.23 1.28-1.05 1.07-1.85z"/>
    </svg>
  ),
  groove: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
    </svg>
  ),
  energy: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11 21h-1l1-7H7.5c-.88 0-.33-.75-.31-.78C8.48 10.94 10.42 7.54 13.01 3h1l-1 7h3.51c.4 0 .62.19.4.66C12.97 17.55 11 21 11 21z"/>
    </svg>
  ),
  power: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/>
    </svg>
  ),
  metal: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
    </svg>
  ),
};

// Export for use in other components
export const getZoneIcon = (zoneId: ZoneId, className?: string) => {
  const Icon = ZoneIcons[zoneId];
  return Icon ? <Icon className={className} /> : null;
};

interface ZoneManagerProps {
  onUploadToZone: (files: FileList, zoneId: ZoneId) => void;
  uploading: boolean;
}

export const ZoneManager: React.FC<ZoneManagerProps> = ({ onUploadToZone, uploading }) => {
  const { zones, tracks, toggleZone, activeZoneFilter, setActiveZoneFilter } = useStore();
  const [expandedZone, setExpandedZone] = useState<ZoneId | null>(null);
  const fileInputRefs = useRef<Record<ZoneId, HTMLInputElement | null>>({} as Record<ZoneId, HTMLInputElement | null>);

  const getTrackCountForZone = (zoneId: ZoneId) => {
    return tracks.filter(t => t.zoneId === zoneId).length;
  };

  const getUnassignedCount = () => {
    return tracks.filter(t => !t.zoneId).length;
  };

  const handleFileSelect = (zoneId: ZoneId) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadToZone(e.target.files, zoneId);
      e.target.value = ''; // Reset input
    }
  };

  const getZoneGradient = (zone: Zone) => {
    const gradients: Record<string, string> = {
      sky: 'from-sky-500/20 to-sky-600/10',
      violet: 'from-violet-500/20 to-violet-600/10',
      emerald: 'from-emerald-500/20 to-emerald-600/10',
      orange: 'from-orange-500/20 to-orange-600/10',
      red: 'from-red-500/20 to-red-600/10',
    };
    return gradients[zone.color] || 'from-gray-500/20 to-gray-600/10';
  };

  const getZoneBorder = (zone: Zone) => {
    const borders: Record<string, string> = {
      sky: 'border-sky-500/30',
      violet: 'border-violet-500/30',
      emerald: 'border-emerald-500/30',
      orange: 'border-orange-500/30',
      red: 'border-red-500/30',
    };
    return borders[zone.color] || 'border-gray-500/30';
  };

  const getZoneTextColor = (zone: Zone) => {
    const colors: Record<string, string> = {
      sky: 'text-sky-400',
      violet: 'text-violet-400',
      emerald: 'text-emerald-400',
      orange: 'text-orange-400',
      red: 'text-red-400',
    };
    return colors[zone.color] || 'text-gray-400';
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-4 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Music Zones</h2>
            <p className="text-[10px] text-gray-400">Organize by intensity</p>
          </div>
        </div>

        {/* Show All button */}
        <button
          onClick={() => setActiveZoneFilter(null)}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
            activeZoneFilter === null
              ? 'bg-white/20 text-white border border-white/30'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
          }`}
        >
          All ({tracks.length})
        </button>
      </div>

      {/* Zones Grid */}
      <div className="space-y-2">
        {zones.map((zone) => {
          const trackCount = getTrackCountForZone(zone.id);
          const isExpanded = expandedZone === zone.id;
          const isFiltered = activeZoneFilter === zone.id;

          return (
            <div
              key={zone.id}
              className={`rounded-xl border transition-all overflow-hidden ${
                zone.enabled
                  ? `bg-gradient-to-r ${getZoneGradient(zone)} ${getZoneBorder(zone)}`
                  : 'bg-gray-800/30 border-gray-700/30 opacity-50'
              }`}
            >
              {/* Zone Header */}
              <div className="flex items-center gap-3 p-3">
                {/* Zone Icon & Name */}
                <button
                  onClick={() => setExpandedZone(isExpanded ? null : zone.id)}
                  className="flex items-center gap-2 flex-1 min-w-0"
                >
                  <span className="w-6 h-6 flex items-center justify-center" style={{ color: zone.bgColor }}>
                    {getZoneIcon(zone.id, 'w-5 h-5')}
                  </span>
                  <div className="flex-1 min-w-0 text-left">
                    <p className={`text-sm font-medium ${zone.enabled ? 'text-white' : 'text-gray-500'}`}>
                      {zone.name}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">{zone.description}</p>
                  </div>
                </button>

                {/* Track Count */}
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                  trackCount > 0 ? `bg-${zone.color}-500/20 ${getZoneTextColor(zone)}` : 'bg-gray-700/50 text-gray-500'
                }`}>
                  {trackCount}
                </div>

                {/* Filter Button */}
                <button
                  onClick={() => setActiveZoneFilter(isFiltered ? null : zone.id)}
                  disabled={!zone.enabled}
                  className={`p-1.5 rounded-lg transition-all ${
                    isFiltered
                      ? `bg-${zone.color}-500/30 ${getZoneTextColor(zone)}`
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  } disabled:opacity-30`}
                  title={isFiltered ? 'Show all' : `Filter to ${zone.name}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </button>

                {/* Enable/Disable Toggle */}
                <button
                  onClick={() => toggleZone(zone.id)}
                  className={`relative w-10 h-5 rounded-full transition-all ${
                    zone.enabled ? `bg-${zone.color}-500` : 'bg-gray-600'
                  }`}
                  style={{ backgroundColor: zone.enabled ? zone.bgColor : undefined }}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow ${
                      zone.enabled ? 'left-5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              {/* Expanded Content - Upload */}
              {isExpanded && zone.enabled && (
                <div className="px-3 pb-3 pt-1 border-t border-white/5">
                  <button
                    onClick={() => fileInputRefs.current[zone.id]?.click()}
                    disabled={uploading}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed transition-all ${
                      uploading
                        ? 'border-gray-600 bg-gray-800/50 text-gray-500'
                        : `border-${zone.color}-500/50 hover:border-${zone.color}-500 bg-${zone.color}-500/10 hover:bg-${zone.color}-500/20 ${getZoneTextColor(zone)}`
                    }`}
                    style={{
                      borderColor: uploading ? undefined : `${zone.bgColor}50`,
                    }}
                  >
                    {uploading ? (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    )}
                    <span className="text-xs font-medium">
                      {uploading ? 'Uploading...' : `Add to ${zone.name}`}
                    </span>
                  </button>
                  <input
                    ref={(el) => { fileInputRefs.current[zone.id] = el; }}
                    type="file"
                    accept=".mp3,.wav,.m4a,.ogg,.flac"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect(zone.id)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Unassigned Tracks */}
      {getUnassignedCount() > 0 && (
        <div className="mt-3 p-3 bg-gray-800/30 rounded-xl border border-gray-700/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-gray-400">Unassigned tracks</span>
            </div>
            <span className="px-2 py-0.5 bg-gray-700/50 rounded-full text-[10px] text-gray-400">
              {getUnassignedCount()}
            </span>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-gray-500">
            {zones.filter(z => z.enabled).length} of {zones.length} zones active
          </span>
          <span className="text-gray-500">
            {tracks.length} total tracks
          </span>
        </div>
      </div>
    </div>
  );
};
