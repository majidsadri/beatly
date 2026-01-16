/**
 * TransitionPlanner - Creates transition plans for DJ mixing
 *
 * Two transition styles:
 * 1. Smooth: Gradual crossfade with careful EQ management
 * 2. Hype: Quick bass swap with riser FX and dramatic drop
 *
 * Key mixing principles:
 * - Never have bass from both tracks at once (causes muddy sound)
 * - Bring in highs/mids first, then swap bass at drop
 * - Align transitions to phrase boundaries (every 8 or 16 bars)
 */

import type {
  TransitionPlan,
  TransitionPhase,
  TransitionStyle,
  TrackAnalysis,
} from '../types';

/**
 * Calculate transition duration based on style and BPM
 * Smooth transitions are longer, hype transitions are shorter
 */
export const getTransitionDuration = (
  style: TransitionStyle,
  bpm: number
): number => {
  // Duration in bars
  const barsSmooth = 32; // 32 bars = 2 phrases
  const barsHype = 16; // 16 bars = 1 phrase

  const bars = style === 'smooth' ? barsSmooth : barsHype;

  // Calculate duration in seconds
  // 4 beats per bar, 60/bpm seconds per beat
  const beatDuration = 60 / bpm;
  return bars * 4 * beatDuration;
};

/**
 * Create a smooth transition plan
 *
 * Timeline (32 bars):
 * - Bars 1-8: Start deck B muted, bring in highs/mids
 * - Bars 9-16: Gradually crossfade highs/mids
 * - Bars 17-24: Swap bass (cut A bass, bring in B bass)
 * - Bars 25-32: Fade out deck A completely
 */
export const createSmoothTransition = (
  analysisA: TrackAnalysis,
  analysisB: TrackAnalysis
): TransitionPlan => {
  const bpm = analysisA.bpm;
  const totalDuration = getTransitionDuration('smooth', bpm);
  const phaseDuration = totalDuration / 4; // 4 phases

  const phases: TransitionPhase[] = [
    {
      name: 'Intro: Bring in highs',
      startOffset: 0,
      duration: phaseDuration,
      deckAVolume: { start: 1, end: 1 },
      deckBVolume: { start: 0, end: 0.3 },
      eqChanges: [
        // Keep B bass cut initially
        { deck: 'B', band: 'low', start: -1, end: -1 },
        // Bring in B highs
        { deck: 'B', band: 'high', start: -1, end: 0 },
        // Slightly reduce A highs
        { deck: 'A', band: 'high', start: 0, end: -0.2 },
      ],
    },
    {
      name: 'Build: Blend mids',
      startOffset: phaseDuration,
      duration: phaseDuration,
      deckAVolume: { start: 1, end: 0.85 },
      deckBVolume: { start: 0.3, end: 0.6 },
      eqChanges: [
        // Keep B bass cut
        { deck: 'B', band: 'low', start: -1, end: -1 },
        // Bring in B mids
        { deck: 'B', band: 'mid', start: -0.5, end: 0 },
        // Reduce A mids
        { deck: 'A', band: 'mid', start: 0, end: -0.3 },
      ],
    },
    {
      name: 'Drop: Bass swap',
      startOffset: phaseDuration * 2,
      duration: phaseDuration,
      deckAVolume: { start: 0.85, end: 0.5 },
      deckBVolume: { start: 0.6, end: 0.9 },
      eqChanges: [
        // Cut A bass, bring in B bass
        { deck: 'A', band: 'low', start: 0, end: -1 },
        { deck: 'B', band: 'low', start: -1, end: 0 },
        // B takes over mids
        { deck: 'A', band: 'mid', start: -0.3, end: -0.7 },
        { deck: 'B', band: 'mid', start: 0, end: 0.2 },
      ],
    },
    {
      name: 'Outro: Fade out A',
      startOffset: phaseDuration * 3,
      duration: phaseDuration,
      deckAVolume: { start: 0.5, end: 0 },
      deckBVolume: { start: 0.9, end: 1 },
      eqChanges: [
        // A fades completely
        { deck: 'A', band: 'high', start: -0.2, end: -1 },
        { deck: 'A', band: 'mid', start: -0.7, end: -1 },
        // B takes full control
        { deck: 'B', band: 'high', start: 0, end: 0 },
        { deck: 'B', band: 'mid', start: 0.2, end: 0 },
      ],
    },
  ];

  return {
    style: 'smooth',
    startTime: 0, // Will be set by engine
    duration: totalDuration,
    phases,
  };
};

/**
 * Create a hype transition plan
 *
 * Timeline (16 bars):
 * - Bars 1-4: Tease deck B with filtered highs, build tension
 * - Bars 5-8: Riser FX, filter sweep on B
 * - Bars 9-12: Drop! Quick bass swap, B takes over
 * - Bars 13-16: A out completely
 */
export const createHypeTransition = (
  analysisA: TrackAnalysis,
  analysisB: TrackAnalysis
): TransitionPlan => {
  const bpm = analysisA.bpm;
  const totalDuration = getTransitionDuration('hype', bpm);
  const phaseDuration = totalDuration / 4;

  const phases: TransitionPhase[] = [
    {
      name: 'Tease: Filter intro',
      startOffset: 0,
      duration: phaseDuration,
      deckAVolume: { start: 1, end: 1 },
      deckBVolume: { start: 0, end: 0.2 },
      eqChanges: [
        // Heavy filter on B
        { deck: 'B', band: 'low', start: -1, end: -1 },
        { deck: 'B', band: 'mid', start: -1, end: -0.5 },
        { deck: 'B', band: 'high', start: -1, end: -0.3 },
      ],
    },
    {
      name: 'Build: Riser tension',
      startOffset: phaseDuration,
      duration: phaseDuration,
      deckAVolume: { start: 1, end: 0.9 },
      deckBVolume: { start: 0.2, end: 0.5 },
      eqChanges: [
        // Open up B filter
        { deck: 'B', band: 'low', start: -1, end: -1 },
        { deck: 'B', band: 'mid', start: -0.5, end: 0 },
        { deck: 'B', band: 'high', start: -0.3, end: 0.3 },
        // Start reducing A
        { deck: 'A', band: 'high', start: 0, end: -0.3 },
      ],
    },
    {
      name: 'Drop: Bass swap!',
      startOffset: phaseDuration * 2,
      duration: phaseDuration * 0.5, // Quick drop!
      deckAVolume: { start: 0.9, end: 0.3 },
      deckBVolume: { start: 0.5, end: 1 },
      eqChanges: [
        // Instant bass swap
        { deck: 'A', band: 'low', start: 0, end: -1 },
        { deck: 'B', band: 'low', start: -1, end: 0 },
        // A filter down
        { deck: 'A', band: 'mid', start: 0, end: -0.8 },
        { deck: 'A', band: 'high', start: -0.3, end: -1 },
        // B full
        { deck: 'B', band: 'high', start: 0.3, end: 0 },
      ],
    },
    {
      name: 'Outro: A out',
      startOffset: phaseDuration * 2.5,
      duration: phaseDuration * 1.5,
      deckAVolume: { start: 0.3, end: 0 },
      deckBVolume: { start: 1, end: 1 },
      eqChanges: [
        // A completely out
        { deck: 'A', band: 'low', start: -1, end: -1 },
        { deck: 'A', band: 'mid', start: -0.8, end: -1 },
        { deck: 'A', band: 'high', start: -1, end: -1 },
      ],
    },
  ];

  return {
    style: 'hype',
    startTime: 0,
    duration: totalDuration,
    phases,
  };
};

/**
 * Create a transition plan based on style
 */
export const createTransitionPlan = (
  style: TransitionStyle,
  analysisA: TrackAnalysis,
  analysisB: TrackAnalysis
): TransitionPlan => {
  return style === 'smooth'
    ? createSmoothTransition(analysisA, analysisB)
    : createHypeTransition(analysisA, analysisB);
};

/**
 * Adjust transition timing based on track analysis
 * Attempts to align transition with musical structure (drops, peaks)
 */
export const optimizeTransitionTiming = (
  plan: TransitionPlan,
  analysisA: TrackAnalysis,
  analysisB: TrackAnalysis,
  currentTime: number
): TransitionPlan => {
  // Find the next phrase boundary after currentTime
  const phraseMarkers = analysisA.phraseMarkers || [];
  let optimalStartTime = currentTime;

  // Find phrase boundary that gives enough time for transition
  for (const marker of phraseMarkers) {
    if (marker > currentTime) {
      // Check if there's a drop or peak in B that we should align to
      const dropTimeInB = analysisB.drops[0] || 0;

      // If there's a drop in first 30 seconds of B, align bass swap to it
      if (dropTimeInB > 0 && dropTimeInB < 30) {
        // Calculate when to start so bass swap hits the drop
        const bassSwapPhase = plan.phases.find((p) => p.name.includes('Bass swap') || p.name.includes('Drop'));
        if (bassSwapPhase) {
          // Start earlier so bass swap aligns with B's drop
          optimalStartTime = marker;
        }
      } else {
        optimalStartTime = marker;
      }
      break;
    }
  }

  return {
    ...plan,
    startTime: optimalStartTime,
  };
};

/**
 * Calculate the BPM ratio for track B to match track A
 * Limits the adjustment to prevent extreme pitch changes
 */
export const calculateBpmMatch = (
  bpmA: number,
  bpmB: number,
  maxAdjustment: number = 0.08 // Max 8% tempo change
): { rate: number; adjusted: boolean } => {
  const ratio = bpmA / bpmB;

  // If within range, adjust B to match A
  if (ratio >= 1 - maxAdjustment && ratio <= 1 + maxAdjustment) {
    return { rate: ratio, adjusted: true };
  }

  // Check if double/half time works
  if (ratio >= 2 * (1 - maxAdjustment) && ratio <= 2 * (1 + maxAdjustment)) {
    return { rate: ratio / 2, adjusted: true };
  }

  if (ratio >= 0.5 * (1 - maxAdjustment) && ratio <= 0.5 * (1 + maxAdjustment)) {
    return { rate: ratio * 2, adjusted: true };
  }

  // Too far apart, don't adjust
  return { rate: 1, adjusted: false };
};
