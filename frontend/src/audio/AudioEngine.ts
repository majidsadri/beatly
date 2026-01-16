/**
 * AudioEngine - Web Audio API-based DJ mixing engine with stem support
 *
 * This engine manages two decks (A and B) with:
 * - Independent playback control
 * - 3-band EQ per deck (low, mid, high)
 * - Volume control and crossfader
 * - Beat-aligned transitions
 * - Time-stretching via playbackRate
 * - Individual stem volume controls (drums, bass, vocals, other)
 */

import type { DeckId, TrackAnalysis, TransitionPlan, TransitionPhase } from '../types';

export type StemName = 'drums' | 'bass' | 'vocals' | 'other';

export interface StemNodes {
  source: AudioBufferSourceNode | null;
  gainNode: GainNode;
}

export interface DeckNodes {
  source: AudioBufferSourceNode | null;
  gainNode: GainNode;
  eqLow: BiquadFilterNode;
  eqMid: BiquadFilterNode;
  eqHigh: BiquadFilterNode;
  analyser: AnalyserNode;
  // Stem-specific nodes
  stems: {
    drums: StemNodes;
    bass: StemNodes;
    vocals: StemNodes;
    other: StemNodes;
  };
  usingSteams: boolean;
}

export class AudioEngine {
  private context!: AudioContext;
  private masterGain!: GainNode;
  private deckA!: DeckNodes;
  private deckB!: DeckNodes;
  private buffers: Map<number, AudioBuffer> = new Map();
  private stemBuffers: Map<string, AudioBuffer> = new Map();
  private initialized: boolean = false;
  private unlocked: boolean = false;

  // Playback state
  private deckAStartTime: number = 0;
  private deckBStartTime: number = 0;
  private deckAPauseTime: number = 0;
  private deckBPauseTime: number = 0;
  private deckAPlaying: boolean = false;
  private deckBPlaying: boolean = false;

  // Crossfader position (-1 = full A, 0 = center, 1 = full B)
  private crossfaderPosition: number = 0;

  // Transition state
  private transitionInterval: number | null = null;

  // Drum machine state
  private drumLoopInterval: number | null = null;
  private drumLoopPlaying: boolean = false;
  private drumLoopBpm: number = 120;
  private drumLoopGain!: GainNode;

  constructor() {
    this.initContext();
  }

  private initContext(): void {
    if (this.initialized) return;

    // Use webkit prefix for older iOS Safari
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      console.error('Web Audio API not supported');
      return;
    }

    this.context = new AudioContextClass();
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    this.masterGain.gain.value = 0.8;

    this.deckA = this.createDeckNodes();
    this.deckB = this.createDeckNodes();

    // Create drum loop gain node
    this.drumLoopGain = this.context.createGain();
    this.drumLoopGain.gain.value = 0.6;
    this.drumLoopGain.connect(this.masterGain);

    this.initialized = true;

    // Log initial state
    console.log('AudioEngine initialized, context state:', this.context.state);

    // Set up iOS unlock listeners
    this.setupIOSUnlock();

    // Also listen for state changes
    this.context.onstatechange = () => {
      console.log('AudioContext state changed to:', this.context.state);
    };
  }

  /**
   * Debug method to check audio engine state
   */
  debug(): void {
    console.log('=== AudioEngine Debug ===');
    console.log('Initialized:', this.initialized);
    console.log('Unlocked:', this.unlocked);
    console.log('Context state:', this.context?.state);
    console.log('Master gain:', this.masterGain?.gain.value);
    console.log('Deck A gain:', this.deckA?.gainNode.gain.value);
    console.log('Deck B gain:', this.deckB?.gainNode.gain.value);
    console.log('Deck A playing:', this.deckAPlaying);
    console.log('Deck B playing:', this.deckBPlaying);
    console.log('Buffers loaded:', this.buffers.size);
    console.log('========================');
  }

  /**
   * Test audio by playing a simple beep directly to output
   */
  async testAudio(): Promise<void> {
    await this.resume();

    console.log('Testing audio output with beep...');

    const oscillator = this.context.createOscillator();
    const testGain = this.context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 440; // A4 note
    testGain.gain.value = 0.3;

    oscillator.connect(testGain);
    testGain.connect(this.context.destination);

    oscillator.start();
    oscillator.stop(this.context.currentTime + 0.3); // 300ms beep

    console.log('Beep should play now, context state:', this.context.state);
  }

  /**
   * Play track directly to destination (bypass EQ for testing)
   */
  playDirect(deck: DeckId, trackId: number): void {
    const buffer = this.buffers.get(trackId);

    if (!buffer) {
      console.error('No buffer loaded');
      return;
    }

    if (this.context.state === 'suspended') {
      this.context.resume();
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    // Connect directly to destination, bypassing all processing
    source.connect(this.context.destination);

    console.log('Playing directly to destination, context state:', this.context.state);
    source.start(0);
  }

  /**
   * iOS Safari requires audio context to be unlocked via user gesture.
   * This sets up listeners to unlock on first touch/click.
   */
  private setupIOSUnlock(): void {
    if (this.unlocked) return;

    const unlock = async () => {
      if (this.unlocked) return;

      try {
        // Resume context if suspended
        if (this.context.state === 'suspended') {
          await this.context.resume();
        }

        // Play a silent buffer to fully unlock on iOS
        const buffer = this.context.createBuffer(1, 1, 22050);
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.context.destination);
        source.start(0);
        source.stop(0.001);

        this.unlocked = true;
        console.log('Audio context unlocked');

        // Remove listeners once unlocked
        document.removeEventListener('touchstart', unlock, true);
        document.removeEventListener('touchend', unlock, true);
        document.removeEventListener('click', unlock, true);
        document.removeEventListener('keydown', unlock, true);
      } catch (e) {
        console.warn('Failed to unlock audio context:', e);
      }
    };

    // Listen for user gestures
    document.addEventListener('touchstart', unlock, true);
    document.addEventListener('touchend', unlock, true);
    document.addEventListener('click', unlock, true);
    document.addEventListener('keydown', unlock, true);
  }

  private createStemNodes(): StemNodes {
    const gainNode = this.context.createGain();
    gainNode.gain.value = 1;
    return { source: null, gainNode };
  }

  /**
   * Create audio nodes for a deck:
   * source -> eqLow -> eqMid -> eqHigh -> gainNode -> masterGain
   * OR (when using stems):
   * stem sources -> stem gains -> eqLow -> eqMid -> eqHigh -> gainNode -> masterGain
   */
  private createDeckNodes(): DeckNodes {
    const gainNode = this.context.createGain();
    gainNode.gain.value = 1; // Ensure deck volume is at full

    // 3-band EQ using biquad filters
    const eqLow = this.context.createBiquadFilter();
    eqLow.type = 'lowshelf';
    eqLow.frequency.value = 320;
    eqLow.gain.value = 0;

    const eqMid = this.context.createBiquadFilter();
    eqMid.type = 'peaking';
    eqMid.frequency.value = 1000;
    eqMid.Q.value = 0.5;
    eqMid.gain.value = 0;

    const eqHigh = this.context.createBiquadFilter();
    eqHigh.type = 'highshelf';
    eqHigh.frequency.value = 3200;
    eqHigh.gain.value = 0;

    const analyser = this.context.createAnalyser();
    analyser.fftSize = 2048;

    // Create stem nodes
    const stems = {
      drums: this.createStemNodes(),
      bass: this.createStemNodes(),
      vocals: this.createStemNodes(),
      other: this.createStemNodes(),
    };

    // Connect EQ chain (keeping for future use)
    eqLow.connect(eqMid);
    eqMid.connect(eqHigh);
    eqHigh.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(this.masterGain);

    // Connect stem gains directly to analyser (bypass EQ for Safari compatibility)
    stems.drums.gainNode.connect(analyser);
    stems.bass.gainNode.connect(analyser);
    stems.vocals.gainNode.connect(analyser);
    stems.other.gainNode.connect(analyser);

    return {
      source: null,
      gainNode,
      eqLow,
      eqMid,
      eqHigh,
      analyser,
      stems,
      usingSteams: false,
    };
  }

  async resume(): Promise<void> {
    if (!this.initialized) {
      this.initContext();
    }

    console.log('Resume called, context state:', this.context.state);

    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
        // Wait a bit for Safari to fully activate
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('Context resumed, new state:', this.context.state);
      } catch (e) {
        console.warn('Failed to resume audio context:', e);
      }
    }

    // For iOS/Safari, also play silent buffer if not yet unlocked
    if (!this.unlocked) {
      try {
        const buffer = this.context.createBuffer(1, 1, 22050);
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.context.destination);
        source.start(0);
        this.unlocked = true;
        console.log('Audio context unlocked with silent buffer');
      } catch (e) {
        console.warn('Failed to unlock with silent buffer:', e);
      }
    }
  }

  /**
   * Check if audio is ready to play (context running and unlocked)
   */
  isReady(): boolean {
    return this.initialized && this.context.state === 'running';
  }

  async loadTrack(trackId: number, url: string, forceReload: boolean = false): Promise<void> {
    // Clear cache if forcing reload
    if (forceReload && this.buffers.has(trackId)) {
      this.buffers.delete(trackId);
      // Also clear stem buffers for this track
      for (const stemName of ['drums', 'bass', 'vocals', 'other'] as StemName[]) {
        this.stemBuffers.delete(`${trackId}-${stemName}`);
      }
    }

    if (this.buffers.has(trackId)) return;

    // Ensure context is initialized
    if (!this.initialized) {
      this.initContext();
    }

    // Add cache-busting parameter and use no-store to completely bypass cache
    const cacheBustUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    const response = await fetch(cacheBustUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch track: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // decodeAudioData returns a promise but also accepts callbacks for older browsers
    const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      this.context.decodeAudioData(
        arrayBuffer,
        (buffer) => resolve(buffer),
        (error) => reject(error || new Error('Failed to decode audio'))
      );
    });

    this.buffers.set(trackId, audioBuffer);
  }

  async loadStem(trackId: number, stemName: StemName, url: string, forceReload: boolean = false): Promise<void> {
    const key = `${trackId}-${stemName}`;

    if (forceReload && this.stemBuffers.has(key)) {
      this.stemBuffers.delete(key);
    }

    if (this.stemBuffers.has(key)) return;

    // Ensure context is initialized
    if (!this.initialized) {
      this.initContext();
    }

    // Add cache-busting parameter and bypass browser cache
    const cacheBustUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    const response = await fetch(cacheBustUrl, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch stem: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    // decodeAudioData with callback for older browser support
    const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
      this.context.decodeAudioData(
        arrayBuffer,
        (buffer) => resolve(buffer),
        (error) => reject(error || new Error('Failed to decode audio'))
      );
    });

    this.stemBuffers.set(key, audioBuffer);
  }

  /**
   * Load all stems for a track
   */
  async loadAllStems(trackId: number, forceReload: boolean = false): Promise<boolean> {
    const stemNames: StemName[] = ['drums', 'bass', 'vocals', 'other'];
    let allLoaded = true;

    for (const stemName of stemNames) {
      try {
        const url = `/api/uploads/tracks/${trackId}/stems/${stemName}`;
        await this.loadStem(trackId, stemName, url, forceReload);
      } catch (err) {
        console.warn(`Failed to load stem ${stemName} for track ${trackId}:`, err);
        allLoaded = false;
      }
    }

    return allLoaded;
  }

  /**
   * Check if stems are loaded for a track
   */
  hasStemsLoaded(trackId: number): boolean {
    const stemNames: StemName[] = ['drums', 'bass', 'vocals', 'other'];
    return stemNames.every(name => this.stemBuffers.has(`${trackId}-${name}`));
  }

  /**
   * Clear all cached audio buffers
   */
  clearCache(): void {
    this.buffers.clear();
    this.stemBuffers.clear();
    console.log('AudioEngine cache cleared');
  }

  /**
   * Clear cache for a specific track
   */
  clearTrackCache(trackId: number): void {
    this.buffers.delete(trackId);
    for (const stemName of ['drums', 'bass', 'vocals', 'other'] as StemName[]) {
      this.stemBuffers.delete(`${trackId}-${stemName}`);
    }
  }

  getBuffer(trackId: number): AudioBuffer | undefined {
    return this.buffers.get(trackId);
  }

  getStemBuffer(trackId: number, stemName: StemName): AudioBuffer | undefined {
    return this.stemBuffers.get(`${trackId}-${stemName}`);
  }

  /**
   * Play a track on a specific deck (full mix, no stem separation)
   */
  async play(deck: DeckId, trackId: number, startTime: number = 0, playbackRate: number = 1): Promise<void> {
    const deckNodes = deck === 'A' ? this.deckA : this.deckB;
    const buffer = this.buffers.get(trackId);

    if (!buffer) {
      console.error(`No buffer loaded for track ${trackId}`);
      return;
    }

    // Ensure context is running
    if (this.context.state !== 'running') {
      console.log('Context not running, attempting to resume...');
      await this.context.resume();
      // Give Safari time to fully activate
      await new Promise(resolve => setTimeout(resolve, 50));
      console.log('After resume, context state:', this.context.state);
    }

    this.playInternal(deck, deckNodes, buffer, trackId, startTime, playbackRate);
  }

  private playInternal(
    deck: DeckId,
    deckNodes: DeckNodes,
    buffer: AudioBuffer,
    trackId: number,
    startTime: number,
    playbackRate: number
  ): void {
    this.stop(deck);
    deckNodes.usingSteams = false;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;

    // Connect to EQ chain OR directly to analyser (Safari workaround)
    // Try connecting directly to analyser to bypass potential EQ issues
    source.connect(deckNodes.analyser);

    deckNodes.source = source;

    // Log for debugging
    console.log(`Playing track ${trackId} on deck ${deck}, context state: ${this.context.state}`);
    console.log(`Buffer duration: ${buffer.duration}s, sample rate: ${buffer.sampleRate}`);

    source.start(0, startTime);

    if (deck === 'A') {
      this.deckAStartTime = this.context.currentTime - startTime / playbackRate;
      this.deckAPlaying = true;
    } else {
      this.deckBStartTime = this.context.currentTime - startTime / playbackRate;
      this.deckBPlaying = true;
    }

    source.onended = () => {
      if (deck === 'A') this.deckAPlaying = false;
      else this.deckBPlaying = false;
    };
  }

  /**
   * Play stems on a specific deck with individual volume control
   */
  async playStems(deck: DeckId, trackId: number, startTime: number = 0, playbackRate: number = 1): Promise<void> {
    const deckNodes = deck === 'A' ? this.deckA : this.deckB;

    // Check if all stems are loaded
    if (!this.hasStemsLoaded(trackId)) {
      console.warn('Stems not loaded, falling back to full track');
      await this.play(deck, trackId, startTime, playbackRate);
      return;
    }

    // Ensure context is running
    if (this.context.state !== 'running') {
      console.log('Context not running for stems, attempting to resume...');
      await this.context.resume();
      await new Promise(resolve => setTimeout(resolve, 50));
      console.log('After resume for stems, context state:', this.context.state);
    }

    this.playStemsInternal(deck, deckNodes, trackId, startTime, playbackRate);
  }

  private playStemsInternal(
    deck: DeckId,
    deckNodes: DeckNodes,
    trackId: number,
    startTime: number,
    playbackRate: number
  ): void {
    this.stop(deck);
    deckNodes.usingSteams = true;

    const stemNames: StemName[] = ['drums', 'bass', 'vocals', 'other'];

    for (const stemName of stemNames) {
      const buffer = this.stemBuffers.get(`${trackId}-${stemName}`);
      if (!buffer) continue;

      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = playbackRate;
      source.connect(deckNodes.stems[stemName].gainNode);

      deckNodes.stems[stemName].source = source;
      source.start(0, startTime);
    }

    console.log(`Playing stems for track ${trackId} on deck ${deck}, context state: ${this.context.state}`);

    if (deck === 'A') {
      this.deckAStartTime = this.context.currentTime - startTime / playbackRate;
      this.deckAPlaying = true;
    } else {
      this.deckBStartTime = this.context.currentTime - startTime / playbackRate;
      this.deckBPlaying = true;
    }
  }

  /**
   * Set individual stem volume (0-1)
   */
  setStemVolume(deck: DeckId, stemName: StemName, volume: number): void {
    const deckNodes = deck === 'A' ? this.deckA : this.deckB;
    deckNodes.stems[stemName].gainNode.gain.setTargetAtTime(volume, this.context.currentTime, 0.01);
  }

  /**
   * Get current stem volume
   */
  getStemVolume(deck: DeckId, stemName: StemName): number {
    const deckNodes = deck === 'A' ? this.deckA : this.deckB;
    return deckNodes.stems[stemName].gainNode.gain.value;
  }

  stop(deck: DeckId): void {
    const deckNodes = deck === 'A' ? this.deckA : this.deckB;

    // Stop main source
    if (deckNodes.source) {
      try {
        deckNodes.source.stop();
        deckNodes.source.disconnect();
      } catch { /* Source may already be stopped */ }
      deckNodes.source = null;
    }

    // Stop stem sources
    for (const stemName of ['drums', 'bass', 'vocals', 'other'] as StemName[]) {
      const stemNode = deckNodes.stems[stemName];
      if (stemNode.source) {
        try {
          stemNode.source.stop();
          stemNode.source.disconnect();
        } catch { /* Source may already be stopped */ }
        stemNode.source = null;
      }
    }

    if (deck === 'A') {
      this.deckAPauseTime = this.getCurrentTime('A');
      this.deckAPlaying = false;
    } else {
      this.deckBPauseTime = this.getCurrentTime('B');
      this.deckBPlaying = false;
    }
  }

  pause(deck: DeckId): void {
    this.stop(deck);
  }

  getCurrentTime(deck: DeckId): number {
    const isPlaying = deck === 'A' ? this.deckAPlaying : this.deckBPlaying;
    const startTime = deck === 'A' ? this.deckAStartTime : this.deckBStartTime;
    const pauseTime = deck === 'A' ? this.deckAPauseTime : this.deckBPauseTime;
    const deckNodes = deck === 'A' ? this.deckA : this.deckB;

    // Get playback rate from main source or first stem source
    let playbackRate = 1;
    if (deckNodes.source) {
      playbackRate = deckNodes.source.playbackRate.value;
    } else if (deckNodes.stems.drums.source) {
      playbackRate = deckNodes.stems.drums.source.playbackRate.value;
    }

    if (isPlaying) {
      return (this.context.currentTime - startTime) * playbackRate;
    }
    return pauseTime;
  }

  setVolume(deck: DeckId, volume: number): void {
    const deckNodes = deck === 'A' ? this.deckA : this.deckB;
    deckNodes.gainNode.gain.setTargetAtTime(volume, this.context.currentTime, 0.01);
  }

  setEQ(deck: DeckId, band: 'low' | 'mid' | 'high', value: number): void {
    const deckNodes = deck === 'A' ? this.deckA : this.deckB;
    const filter = band === 'low' ? deckNodes.eqLow : band === 'mid' ? deckNodes.eqMid : deckNodes.eqHigh;
    const gainDb = value * 12;
    filter.gain.setTargetAtTime(gainDb, this.context.currentTime, 0.01);
  }

  setPlaybackRate(deck: DeckId, rate: number): void {
    const deckNodes = deck === 'A' ? this.deckA : this.deckB;

    // Set rate on main source
    if (deckNodes.source) {
      deckNodes.source.playbackRate.setTargetAtTime(rate, this.context.currentTime, 0.01);
    }

    // Set rate on all stem sources
    for (const stemName of ['drums', 'bass', 'vocals', 'other'] as StemName[]) {
      const stemNode = deckNodes.stems[stemName];
      if (stemNode.source) {
        stemNode.source.playbackRate.setTargetAtTime(rate, this.context.currentTime, 0.01);
      }
    }
  }

  setMasterVolume(volume: number): void {
    this.masterGain.gain.setTargetAtTime(volume, this.context.currentTime, 0.01);
  }

  setCrossfader(position: number): void {
    this.crossfaderPosition = position;
    const normalizedPosition = (position + 1) / 2;
    const angleA = (1 - normalizedPosition) * Math.PI / 2;
    const angleB = normalizedPosition * Math.PI / 2;

    const gainA = Math.cos(angleB);
    const gainB = Math.cos(angleA);

    this.deckA.gainNode.gain.setTargetAtTime(gainA, this.context.currentTime, 0.01);
    this.deckB.gainNode.gain.setTargetAtTime(gainB, this.context.currentTime, 0.01);
  }

  getFrequencyData(deck: DeckId): Uint8Array {
    const deckNodes = deck === 'A' ? this.deckA : this.deckB;
    const dataArray = new Uint8Array(deckNodes.analyser.frequencyBinCount);
    deckNodes.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  getWaveformData(deck: DeckId): Uint8Array {
    const deckNodes = deck === 'A' ? this.deckA : this.deckB;
    const dataArray = new Uint8Array(deckNodes.analyser.frequencyBinCount);
    deckNodes.analyser.getByteTimeDomainData(dataArray);
    return dataArray;
  }

  calculateBpmSyncRate(sourceBpm: number, targetBpm: number): number {
    return targetBpm / sourceBpm;
  }

  findPhraseTransitionPoint(
    analysis: TrackAnalysis,
    currentTime: number,
    barsBeforeEnd: number = 32
  ): number {
    const { bpm, beatGrid } = analysis;
    const beatsPerBar = 4;
    const beatDuration = 60 / bpm;
    const barDuration = beatDuration * beatsPerBar;
    const phraseBars = 16;
    const phraseDuration = barDuration * phraseBars;
    const trackDuration = beatGrid.beats[beatGrid.beats.length - 1] || 0;
    const targetStartTime = trackDuration - (barsBeforeEnd * barDuration);

    const phraseMarkers = analysis.phraseMarkers || [];
    let transitionStart = targetStartTime;

    for (const marker of phraseMarkers) {
      if (marker <= targetStartTime && marker > currentTime) {
        transitionStart = marker;
      }
    }

    if (phraseMarkers.length === 0) {
      const firstDownbeat = beatGrid.downbeats[0] || 0;
      const timeSinceFirst = targetStartTime - firstDownbeat;
      const phraseCount = Math.floor(timeSinceFirst / phraseDuration);
      transitionStart = firstDownbeat + (phraseCount * phraseDuration);
    }

    return Math.max(transitionStart, currentTime + phraseDuration);
  }

  calculateBeatAlignedStart(
    deckAAnalysis: TrackAnalysis,
    deckBAnalysis: TrackAnalysis,
    deckATime: number
  ): number {
    const deckBFirstDownbeat = deckBAnalysis.beatGrid.downbeats[0] || 0;
    return deckBFirstDownbeat;
  }

  async executeTransition(
    plan: TransitionPlan,
    deckATrackId: number,
    deckBTrackId: number,
    onProgress?: (phase: string, progress: number) => void
  ): Promise<void> {
    return new Promise((resolve) => {
      const startTime = this.context.currentTime;

      if (this.transitionInterval) {
        clearInterval(this.transitionInterval);
      }

      this.transitionInterval = window.setInterval(() => {
        const elapsed = this.context.currentTime - startTime;

        let currentPhase: TransitionPhase | null = null;
        let phaseProgress = 0;

        for (const phase of plan.phases) {
          if (elapsed >= phase.startOffset && elapsed < phase.startOffset + phase.duration) {
            currentPhase = phase;
            phaseProgress = (elapsed - phase.startOffset) / phase.duration;
            break;
          }
        }

        if (currentPhase) {
          const deckAVolume = this.lerp(currentPhase.deckAVolume.start, currentPhase.deckAVolume.end, phaseProgress);
          const deckBVolume = this.lerp(currentPhase.deckBVolume.start, currentPhase.deckBVolume.end, phaseProgress);

          this.setVolume('A', deckAVolume);
          this.setVolume('B', deckBVolume);

          for (const eqChange of currentPhase.eqChanges) {
            const value = this.lerp(eqChange.start, eqChange.end, phaseProgress);
            this.setEQ(eqChange.deck, eqChange.band, value);
          }

          if (onProgress) {
            onProgress(currentPhase.name, phaseProgress);
          }
        }

        if (elapsed >= plan.duration) {
          if (this.transitionInterval) {
            clearInterval(this.transitionInterval);
            this.transitionInterval = null;
          }
          resolve();
        }
      }, 50);
    });
  }

  private lerp(start: number, end: number, t: number): number {
    return start + (end - start) * Math.min(1, Math.max(0, t));
  }

  createNoiseRiser(duration: number): AudioBufferSourceNode {
    const sampleRate = this.context.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = this.context.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      const amplitude = Math.pow(t, 2) * 0.3;
      data[i] = (Math.random() * 2 - 1) * amplitude;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const highpass = this.context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(200, this.context.currentTime);
    highpass.frequency.exponentialRampToValueAtTime(8000, this.context.currentTime + duration);

    source.connect(highpass);
    highpass.connect(this.masterGain);

    return source;
  }

  // ============ DRUM LOOP METHODS ============

  /**
   * Play a kick drum sound
   */
  private playKick(time: number): void {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);

    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.3);

    osc.connect(gain);
    gain.connect(this.drumLoopGain);

    osc.start(time);
    osc.stop(time + 0.3);
  }

  /**
   * Play a snare/clap sound
   */
  private playSnare(time: number): void {
    // Noise burst for snare
    const bufferSize = this.context.sampleRate * 0.1;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }

    const noise = this.context.createBufferSource();
    noise.buffer = buffer;

    const noiseGain = this.context.createGain();
    noiseGain.gain.setValueAtTime(0.8, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1000;

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.drumLoopGain);

    noise.start(time);
  }

  /**
   * Play a hi-hat sound
   */
  private playHiHat(time: number): void {
    const bufferSize = this.context.sampleRate * 0.05;
    const buffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
    }

    const noise = this.context.createBufferSource();
    noise.buffer = buffer;

    const noiseGain = this.context.createGain();
    noiseGain.gain.setValueAtTime(0.3, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.05);

    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 5000;

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.drumLoopGain);

    noise.start(time);
  }

  /**
   * Start the drum loop
   */
  startDrumLoop(bpm?: number): void {
    if (this.drumLoopPlaying) return;

    if (bpm) this.drumLoopBpm = bpm;

    this.drumLoopPlaying = true;
    const beatInterval = 60 / this.drumLoopBpm; // seconds per beat
    let beatCount = 0;

    const scheduleNextBeat = () => {
      if (!this.drumLoopPlaying) return;

      const time = this.context.currentTime + 0.05; // small lookahead

      // 4/4 pattern: Kick on 1 and 3, Snare on 2 and 4, Hi-hat on every beat
      const beatInBar = beatCount % 4;

      if (beatInBar === 0 || beatInBar === 2) {
        this.playKick(time);
      }
      if (beatInBar === 1 || beatInBar === 3) {
        this.playSnare(time);
      }
      this.playHiHat(time);

      beatCount++;

      this.drumLoopInterval = window.setTimeout(scheduleNextBeat, beatInterval * 1000);
    };

    scheduleNextBeat();
  }

  /**
   * Stop the drum loop
   */
  stopDrumLoop(): void {
    this.drumLoopPlaying = false;
    if (this.drumLoopInterval) {
      clearTimeout(this.drumLoopInterval);
      this.drumLoopInterval = null;
    }
  }

  /**
   * Check if drum loop is playing
   */
  isDrumLoopPlaying(): boolean {
    return this.drumLoopPlaying;
  }

  /**
   * Set drum loop BPM
   */
  setDrumLoopBpm(bpm: number): void {
    this.drumLoopBpm = bpm;
    // If playing, restart with new BPM
    if (this.drumLoopPlaying) {
      this.stopDrumLoop();
      this.startDrumLoop(bpm);
    }
  }

  /**
   * Get current drum loop BPM
   */
  getDrumLoopBpm(): number {
    return this.drumLoopBpm;
  }

  /**
   * Set drum loop volume
   */
  setDrumLoopVolume(volume: number): void {
    this.drumLoopGain.gain.setTargetAtTime(volume, this.context.currentTime, 0.01);
  }

  dispose(): void {
    if (this.transitionInterval) {
      clearInterval(this.transitionInterval);
    }
    this.stopDrumLoop();
    this.stop('A');
    this.stop('B');
    this.context.close();
  }
}

let engineInstance: AudioEngine | null = null;

export const getAudioEngine = (): AudioEngine => {
  if (!engineInstance) {
    engineInstance = new AudioEngine();
    // Expose on window for debugging
    (window as unknown as { audioEngine: AudioEngine }).audioEngine = engineInstance;
  }
  return engineInstance;
};
