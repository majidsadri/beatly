import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

// StynX Logo - Animated audio waveform with cyan-green gradient
export const StynXLogo: React.FC<IconProps & { animated?: boolean }> = ({ className = '', size = 24, animated = true }) => {
  const uniqueId = React.useId();
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 100 60" fill="none" className={className}>
      <defs>
        <linearGradient id={`stynxGrad-${uniqueId}`} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="40%" stopColor="#22d3ee" />
          <stop offset="60%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
        <filter id={`glow-${uniqueId}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      {/* Animated waveform bars */}
      {[0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88].map((x, i) => {
        const heights = [12, 20, 28, 38, 50, 45, 50, 38, 28, 20, 12, 8];
        const h = heights[i];
        return (
          <rect
            key={i}
            x={x + 2}
            y={30 - h / 2}
            width="5"
            height={h}
            rx="2.5"
            fill={`url(#stynxGrad-${uniqueId})`}
            filter={`url(#glow-${uniqueId})`}
            style={animated ? {
              animation: `waveBar 1.2s ease-in-out infinite`,
              animationDelay: `${i * 0.08}s`,
              transformOrigin: 'center',
            } : undefined}
          />
        );
      })}
      <style>{`
        @keyframes waveBar {
          0%, 100% { transform: scaleY(1); opacity: 0.8; }
          50% { transform: scaleY(1.3); opacity: 1; }
        }
      `}</style>
    </svg>
  );
};

// StynX Logo Large - For hero sections
export const StynXLogoLarge: React.FC<IconProps> = ({ className = '', size = 200 }) => {
  const uniqueId = React.useId();
  return (
    <div className={`relative ${className}`}>
      {/* Glow background */}
      <div
        className="absolute inset-0 blur-3xl opacity-30"
        style={{
          background: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
          transform: 'scale(1.5)',
        }}
      />
      <svg width={size} height={size * 0.5} viewBox="0 0 200 100" fill="none" className="relative z-10">
        <defs>
          <linearGradient id={`stynxGradLg-${uniqueId}`} x1="0%" y1="50%" x2="100%" y2="50%">
            <stop offset="0%" stopColor="#06b6d4" />
            <stop offset="30%" stopColor="#22d3ee" />
            <stop offset="70%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <filter id={`glowLg-${uniqueId}`} x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        {/* Waveform path - smoother curve matching reference */}
        <path
          d="M5 50
             Q 15 50, 20 45
             Q 25 40, 30 50
             Q 35 60, 40 50
             Q 45 40, 50 35
             Q 55 30, 60 20
             Q 65 10, 70 5
             Q 75 0, 80 15
             Q 85 30, 90 50
             Q 95 70, 100 85
             Q 105 100, 110 85
             Q 115 70, 120 50
             Q 125 30, 130 20
             Q 135 10, 140 25
             Q 145 40, 150 50
             Q 155 60, 160 55
             Q 165 50, 170 50
             Q 175 50, 180 48
             Q 185 46, 190 50
             L 195 50"
          stroke={`url(#stynxGradLg-${uniqueId})`}
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          filter={`url(#glowLg-${uniqueId})`}
          style={{
            animation: 'wavePulse 2s ease-in-out infinite',
          }}
        />
        {/* Highlight dot at peak */}
        <circle
          cx="110"
          cy="85"
          r="4"
          fill="#22d3ee"
          filter={`url(#glowLg-${uniqueId})`}
          style={{
            animation: 'dotPulse 2s ease-in-out infinite',
          }}
        />
        <style>{`
          @keyframes wavePulse {
            0%, 100% { opacity: 0.9; }
            50% { opacity: 1; }
          }
          @keyframes dotPulse {
            0%, 100% { opacity: 0.6; r: 3; }
            50% { opacity: 1; r: 5; }
          }
        `}</style>
      </svg>
    </div>
  );
};

// Beatly Logo Icon - stylized "B" with sound waves (legacy)
export const BeatlyIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="beatlyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#8b5cf6" />
        <stop offset="50%" stopColor="#d946ef" />
        <stop offset="100%" stopColor="#ec4899" />
      </linearGradient>
    </defs>
    <circle cx="12" cy="12" r="10" stroke="url(#beatlyGrad)" strokeWidth="2" fill="none" />
    <path d="M9 7v10M9 12h4a2 2 0 100-4H9M9 12h4a2 2 0 110 4H9" stroke="url(#beatlyGrad)" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Music Note Icon
export const MusicNoteIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2"/>
    <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

// Drums Icon
export const DrumsIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <ellipse cx="12" cy="14" rx="8" ry="4" stroke="currentColor" strokeWidth="2"/>
    <path d="M4 14v3c0 2.2 3.6 4 8 4s8-1.8 8-4v-3" stroke="currentColor" strokeWidth="2"/>
    <path d="M4 10v4M20 10v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="8" cy="6" r="2" stroke="currentColor" strokeWidth="2"/>
    <circle cx="16" cy="6" r="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M8 8v6M16 8v6" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

// Bass Icon
export const BassIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M3 12h4l3-9 4 18 3-9h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Vocals/Microphone Icon
export const VocalsIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2"/>
    <path d="M5 10v1a7 7 0 0014 0v-1M12 18v4M8 22h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// Melody/Synth Icon  
export const MelodyIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="2" y="10" width="4" height="10" rx="1" stroke="currentColor" strokeWidth="2"/>
    <rect x="7" y="6" width="4" height="14" rx="1" stroke="currentColor" strokeWidth="2"/>
    <rect x="12" y="8" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="2"/>
    <rect x="17" y="4" width="4" height="16" rx="1" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

// Mixer/Sliders Icon
export const MixerIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="4" cy="12" r="2" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="10" r="2" stroke="currentColor" strokeWidth="2"/>
    <circle cx="20" cy="14" r="2" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

// Waveform Icon
export const WaveformIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M2 12h2l2-4 2 8 2-6 2 4 2-8 2 10 2-6 2 4h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Crossfade Icon
export const CrossfadeIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M4 4l16 16M4 20L20 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="4" cy="4" r="2" fill="currentColor"/>
    <circle cx="20" cy="20" r="2" fill="currentColor"/>
  </svg>
);

// Auto Mix Icon
export const AutoMixIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

// Sync Icon
export const SyncIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M4 4v5h5M20 20v-5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20.49 9A9 9 0 005.64 5.64L4 4M3.51 15a9 9 0 0014.85 3.36L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Cut/Transition Icon
export const CutIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <circle cx="6" cy="6" r="3" stroke="currentColor" strokeWidth="2"/>
    <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="2"/>
    <path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

// EQ Icon
export const EQIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="4" y="10" width="3" height="8" rx="1" fill="currentColor"/>
    <rect x="10" y="6" width="3" height="12" rx="1" fill="currentColor"/>
    <rect x="16" y="8" width="3" height="10" rx="1" fill="currentColor"/>
  </svg>
);

// Play Icon
export const PlayIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M8 5v14l11-7z"/>
  </svg>
);

// Pause Icon
export const PauseIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <rect x="6" y="4" width="4" height="16" rx="1"/>
    <rect x="14" y="4" width="4" height="16" rx="1"/>
  </svg>
);

// Stop Icon
export const StopIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <rect x="6" y="6" width="12" height="12" rx="1"/>
  </svg>
);

// Upload Icon
export const UploadIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// House Pattern Icon
export const HouseIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Techno/Lightning Icon
export const TechnoIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

// HipHop Icon
export const HipHopIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="2"/>
    <path d="M5 10v1a7 7 0 0014 0v-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <path d="M8 22l2-4h4l2 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
