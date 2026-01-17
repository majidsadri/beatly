import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

// Beatly Logo Icon - stylized "B" with sound waves
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
