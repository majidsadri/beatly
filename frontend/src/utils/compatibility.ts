/**
 * Compatibility Scoring - Calculates mix compatibility between tracks
 *
 * Factors considered:
 * 1. BPM closeness (within mixable range)
 * 2. Key compatibility (Camelot wheel / circle of fifths)
 * 3. Energy continuity (for good flow)
 *
 * Camelot Wheel:
 * - Each key maps to a number (1-12) and letter (A/B for minor/major)
 * - Compatible keys: same number, +/-1 number, same number opposite letter
 */

import type { TrackAnalysis, MixCompatibility } from '../types';

// Camelot wheel mapping: key name -> [number, mode]
const CAMELOT_MAP: Record<string, [number, 'A' | 'B']> = {
  // Minor keys (A)
  'Am': [8, 'A'], 'A#m': [3, 'A'], 'Bbm': [3, 'A'],
  'Bm': [10, 'A'],
  'Cm': [5, 'A'],
  'C#m': [12, 'A'], 'Dbm': [12, 'A'],
  'Dm': [7, 'A'],
  'D#m': [2, 'A'], 'Ebm': [2, 'A'],
  'Em': [9, 'A'],
  'Fm': [4, 'A'],
  'F#m': [11, 'A'], 'Gbm': [11, 'A'],
  'Gm': [6, 'A'],
  'G#m': [1, 'A'], 'Abm': [1, 'A'],

  // Major keys (B)
  'A': [11, 'B'],
  'A#': [6, 'B'], 'Bb': [6, 'B'],
  'B': [1, 'B'],
  'C': [8, 'B'],
  'C#': [3, 'B'], 'Db': [3, 'B'],
  'D': [10, 'B'],
  'D#': [5, 'B'], 'Eb': [5, 'B'],
  'E': [12, 'B'],
  'F': [7, 'B'],
  'F#': [4, 'B'], 'Gb': [4, 'B'],
  'G': [9, 'B'],
  'G#': [2, 'B'], 'Ab': [2, 'B'],
};

/**
 * Get Camelot notation for a key
 */
export const getCamelotKey = (key: string): string => {
  const camelot = CAMELOT_MAP[key];
  if (!camelot) return '?';
  return `${camelot[0]}${camelot[1]}`;
};

/**
 * Calculate key compatibility score (0-100)
 *
 * Perfect match: same Camelot key = 100
 * Adjacent number: +/-1 on wheel = 90
 * Relative major/minor: same number, different letter = 80
 * Energy boost: +7 on wheel = 70
 * Otherwise: lower scores based on distance
 */
export const calculateKeyCompatibility = (
  keyA: string,
  keyB: string
): number => {
  const camelotA = CAMELOT_MAP[keyA];
  const camelotB = CAMELOT_MAP[keyB];

  if (!camelotA || !camelotB) return 50; // Unknown keys

  const [numA, modeA] = camelotA;
  const [numB, modeB] = camelotB;

  // Perfect match
  if (numA === numB && modeA === modeB) {
    return 100;
  }

  // Relative major/minor (same number, different mode)
  if (numA === numB && modeA !== modeB) {
    return 80;
  }

  // Adjacent numbers (same mode)
  const distance = Math.abs(numA - numB);
  const wrappedDistance = Math.min(distance, 12 - distance);

  if (wrappedDistance === 1 && modeA === modeB) {
    return 90;
  }

  // Energy boost (+7 semitones, wraps to +5 or -7 on wheel)
  if (wrappedDistance === 7 || wrappedDistance === 5) {
    return 70;
  }

  // Adjacent with different mode
  if (wrappedDistance === 1) {
    return 65;
  }

  // Further apart
  if (wrappedDistance <= 2) {
    return 55;
  }

  // Distant keys
  return Math.max(20, 50 - wrappedDistance * 5);
};

/**
 * Calculate BPM compatibility score (0-100)
 *
 * Perfect match: same BPM = 100
 * Within 3%: very compatible = 95
 * Within 6%: compatible (minor tempo adjustment) = 85
 * Within 10%: usable = 70
 * Double/half time compatible: 80
 * Otherwise: lower scores
 */
export const calculateBpmCompatibility = (bpmA: number, bpmB: number): number => {
  const ratio = bpmA / bpmB;
  const percentDiff = Math.abs(1 - ratio) * 100;

  // Direct match
  if (percentDiff < 1) return 100;
  if (percentDiff < 3) return 95;
  if (percentDiff < 6) return 85;
  if (percentDiff < 10) return 70;

  // Check double/half time
  const doubleRatio = bpmA / (bpmB * 2);
  const halfRatio = bpmA / (bpmB / 2);
  const doublePercentDiff = Math.abs(1 - doubleRatio) * 100;
  const halfPercentDiff = Math.abs(1 - halfRatio) * 100;

  if (doublePercentDiff < 6 || halfPercentDiff < 6) return 80;

  // Too far apart
  if (percentDiff < 15) return 50;
  return Math.max(10, 40 - percentDiff);
};

/**
 * Calculate energy flow score (0-100)
 *
 * Considers:
 * - Similar energy = smooth transition
 * - Slight energy increase = natural build
 * - Large energy drop = mood change (can be intentional)
 */
export const calculateEnergyFlow = (
  energyA: number,
  energyB: number,
  energyCurveA?: number[],
  energyCurveB?: number[]
): number => {
  const diff = energyB - energyA;

  // Slight increase is ideal (building energy)
  if (diff >= 0 && diff < 0.15) return 100;

  // Maintaining similar energy
  if (Math.abs(diff) < 0.1) return 95;

  // Moderate increase
  if (diff >= 0.15 && diff < 0.3) return 85;

  // Slight decrease (cooling down)
  if (diff >= -0.15 && diff < 0) return 80;

  // Larger changes
  if (Math.abs(diff) < 0.3) return 70;
  if (Math.abs(diff) < 0.5) return 55;

  // Dramatic change
  return 40;
};

/**
 * Calculate overall mix compatibility score
 */
export const calculateMixCompatibility = (
  analysisA: TrackAnalysis,
  analysisB: TrackAnalysis
): MixCompatibility => {
  const bpmScore = calculateBpmCompatibility(analysisA.bpm, analysisB.bpm);
  const keyScore = calculateKeyCompatibility(analysisA.key, analysisB.key);
  const energyScore = calculateEnergyFlow(
    analysisA.energy,
    analysisB.energy,
    analysisA.energyCurve,
    analysisB.energyCurve
  );

  // Weighted average
  // BPM is most important for technical mixing
  // Key matters for harmonic mixing
  // Energy affects the flow
  const weights = { bpm: 0.4, key: 0.35, energy: 0.25 };
  const overallScore = Math.round(
    bpmScore * weights.bpm + keyScore * weights.key + energyScore * weights.energy
  );

  // Generate recommendation
  let recommendation: string;
  if (overallScore >= 90) {
    recommendation = 'Perfect match! These tracks will blend seamlessly.';
  } else if (overallScore >= 80) {
    recommendation = 'Great mix! Minor adjustments may be needed.';
  } else if (overallScore >= 70) {
    recommendation = 'Good mix. Consider tempo sync and EQ adjustments.';
  } else if (overallScore >= 60) {
    recommendation = 'Challenging mix. Use longer transition or different technique.';
  } else if (overallScore >= 50) {
    recommendation = 'Difficult mix. Consider using a bridge track.';
  } else {
    recommendation = 'Not recommended. These tracks may clash.';
  }

  return {
    score: overallScore,
    bpmMatch: bpmScore,
    keyMatch: keyScore,
    energyFlow: energyScore,
    recommendation,
  };
};

/**
 * Sort tracks by compatibility with a reference track
 * Returns tracks ordered from most to least compatible
 */
export const sortByCompatibility = (
  referenceAnalysis: TrackAnalysis,
  candidates: { track: unknown; analysis: TrackAnalysis }[]
): { track: unknown; analysis: TrackAnalysis; compatibility: MixCompatibility }[] => {
  return candidates
    .map((candidate) => ({
      ...candidate,
      compatibility: calculateMixCompatibility(referenceAnalysis, candidate.analysis),
    }))
    .sort((a, b) => b.compatibility.score - a.compatibility.score);
};

/**
 * Generate smart playlist order
 * Greedy algorithm: start with first track, always pick most compatible next track
 */
export const generateSmartOrder = (
  analyses: { trackId: number; analysis: TrackAnalysis }[]
): { order: number[]; totalScore: number } => {
  if (analyses.length === 0) return { order: [], totalScore: 0 };
  if (analyses.length === 1) return { order: [analyses[0].trackId], totalScore: 100 };

  const order: number[] = [];
  const remaining = [...analyses];
  let totalScore = 0;

  // Start with first track
  const first = remaining.shift()!;
  order.push(first.trackId);
  let currentAnalysis = first.analysis;

  // Greedily select best next track
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = -1;

    for (let i = 0; i < remaining.length; i++) {
      const compatibility = calculateMixCompatibility(
        currentAnalysis,
        remaining[i].analysis
      );
      if (compatibility.score > bestScore) {
        bestScore = compatibility.score;
        bestIndex = i;
      }
    }

    const next = remaining.splice(bestIndex, 1)[0];
    order.push(next.trackId);
    totalScore += bestScore;
    currentAnalysis = next.analysis;
  }

  // Average score
  totalScore = Math.round(totalScore / (order.length - 1));

  return { order, totalScore };
};
