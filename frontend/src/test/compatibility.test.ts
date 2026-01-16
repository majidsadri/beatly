import { describe, it, expect } from 'vitest'
import {
  getCamelotKey,
  calculateKeyCompatibility,
  calculateBpmCompatibility,
  calculateEnergyFlow,
  calculateMixCompatibility,
  generateSmartOrder,
} from '../utils/compatibility'
import type { TrackAnalysis, BeatGrid } from '../types'

const createMockAnalysis = (overrides: Partial<TrackAnalysis> = {}): TrackAnalysis => {
  const beatGrid: BeatGrid = {
    bpm: overrides.bpm || 128,
    downbeats: [0, 1.875, 3.75],
    beats: [0, 0.46875, 0.9375, 1.40625, 1.875],
    barLength: 4,
  }

  return {
    trackId: 1,
    bpm: 128,
    key: 'Am',
    keyNumber: 8,
    keyMode: 'minor',
    energy: 0.7,
    energyCurve: [0.5, 0.6, 0.7, 0.8, 0.7],
    beatGrid,
    drops: [60, 180],
    peaks: [30, 90, 150],
    phraseMarkers: [0, 30, 60, 90, 120],
    ...overrides,
  }
}

describe('getCamelotKey', () => {
  it('should return correct Camelot key for minor keys', () => {
    expect(getCamelotKey('Am')).toBe('8A')
    expect(getCamelotKey('Em')).toBe('9A')
    expect(getCamelotKey('Bm')).toBe('10A')
  })

  it('should return correct Camelot key for major keys', () => {
    expect(getCamelotKey('C')).toBe('8B')
    expect(getCamelotKey('G')).toBe('9B')
    expect(getCamelotKey('D')).toBe('10B')
  })

  it('should handle enharmonic equivalents', () => {
    expect(getCamelotKey('A#m')).toBe('3A')
    expect(getCamelotKey('Bbm')).toBe('3A')
  })

  it('should return ? for unknown keys', () => {
    expect(getCamelotKey('XYZ')).toBe('?')
  })
})

describe('calculateKeyCompatibility', () => {
  it('should return 100 for identical keys', () => {
    expect(calculateKeyCompatibility('Am', 'Am')).toBe(100)
    expect(calculateKeyCompatibility('C', 'C')).toBe(100)
  })

  it('should return 80 for relative major/minor', () => {
    // Am and C have the same Camelot number (8), different mode
    expect(calculateKeyCompatibility('Am', 'C')).toBe(80)
  })

  it('should return 90 for adjacent keys', () => {
    // Am (8A) and Dm (7A) are adjacent
    expect(calculateKeyCompatibility('Am', 'Dm')).toBe(90)
    // Am (8A) and Em (9A) are adjacent
    expect(calculateKeyCompatibility('Am', 'Em')).toBe(90)
  })

  it('should return lower scores for distant keys', () => {
    const score = calculateKeyCompatibility('Am', 'F#m')
    expect(score).toBeLessThan(70)
  })
})

describe('calculateBpmCompatibility', () => {
  it('should return 100 for identical BPM', () => {
    expect(calculateBpmCompatibility(128, 128)).toBe(100)
  })

  it('should return high score for close BPM', () => {
    expect(calculateBpmCompatibility(128, 130)).toBeGreaterThan(80)
  })

  it('should return 80 for double time matches', () => {
    // 128 BPM is compatible with 64 BPM (half time)
    expect(calculateBpmCompatibility(128, 64)).toBe(80)
    // 128 BPM is compatible with 256 BPM (double time)
    expect(calculateBpmCompatibility(128, 256)).toBe(80)
  })

  it('should return low score for very different BPMs', () => {
    expect(calculateBpmCompatibility(128, 90)).toBeLessThan(50)
  })
})

describe('calculateEnergyFlow', () => {
  it('should return 100 for slight energy increase', () => {
    expect(calculateEnergyFlow(0.7, 0.8)).toBe(100)
  })

  it('should return high score for similar energy', () => {
    expect(calculateEnergyFlow(0.7, 0.72)).toBeGreaterThan(90)
  })

  it('should return lower score for large energy drop', () => {
    expect(calculateEnergyFlow(0.9, 0.4)).toBeLessThan(60)
  })
})

describe('calculateMixCompatibility', () => {
  it('should return high score for compatible tracks', () => {
    const analysisA = createMockAnalysis({ bpm: 128, key: 'Am', energy: 0.7 })
    const analysisB = createMockAnalysis({ bpm: 128, key: 'Am', energy: 0.75 })

    const result = calculateMixCompatibility(analysisA, analysisB)
    expect(result.score).toBeGreaterThan(90)
    expect(result.recommendation).toContain('Perfect')
  })

  it('should return moderate score for somewhat compatible tracks', () => {
    const analysisA = createMockAnalysis({ bpm: 128, key: 'Am', energy: 0.7 })
    const analysisB = createMockAnalysis({ bpm: 125, key: 'Dm', energy: 0.6 })

    const result = calculateMixCompatibility(analysisA, analysisB)
    expect(result.score).toBeGreaterThan(60)
    expect(result.score).toBeLessThan(90)
  })

  it('should return low score for incompatible tracks', () => {
    const analysisA = createMockAnalysis({ bpm: 128, key: 'Am', energy: 0.9 })
    const analysisB = createMockAnalysis({ bpm: 90, key: 'F#m', energy: 0.3 })

    const result = calculateMixCompatibility(analysisA, analysisB)
    expect(result.score).toBeLessThan(50)
  })

  it('should include detailed breakdown', () => {
    const analysisA = createMockAnalysis({ bpm: 128, key: 'Am', energy: 0.7 })
    const analysisB = createMockAnalysis({ bpm: 128, key: 'Em', energy: 0.75 })

    const result = calculateMixCompatibility(analysisA, analysisB)
    expect(result.bpmMatch).toBeDefined()
    expect(result.keyMatch).toBeDefined()
    expect(result.energyFlow).toBeDefined()
    expect(result.recommendation).toBeDefined()
  })
})

describe('generateSmartOrder', () => {
  it('should return empty for no tracks', () => {
    const result = generateSmartOrder([])
    expect(result.order).toHaveLength(0)
  })

  it('should return single track for one track', () => {
    const analysis = createMockAnalysis({ trackId: 1 })
    const result = generateSmartOrder([{ trackId: 1, analysis }])
    expect(result.order).toEqual([1])
  })

  it('should order tracks by compatibility', () => {
    const tracks = [
      { trackId: 1, analysis: createMockAnalysis({ trackId: 1, bpm: 128, key: 'Am', energy: 0.7 }) },
      { trackId: 2, analysis: createMockAnalysis({ trackId: 2, bpm: 128, key: 'Em', energy: 0.75 }) },
      { trackId: 3, analysis: createMockAnalysis({ trackId: 3, bpm: 90, key: 'F#m', energy: 0.3 }) },
    ]

    const result = generateSmartOrder(tracks)
    expect(result.order).toHaveLength(3)
    // Track 1 starts, track 2 should come next (compatible), track 3 last (incompatible)
    expect(result.order[0]).toBe(1)
    expect(result.order[1]).toBe(2)
    expect(result.order[2]).toBe(3)
  })
})
