import '@testing-library/jest-dom'

// Mock AudioContext
const mockAudioContext = {
  createGain: () => ({
    connect: () => {},
    gain: { value: 1, setTargetAtTime: () => {} },
  }),
  createBiquadFilter: () => ({
    connect: () => {},
    type: '',
    frequency: { value: 0 },
    Q: { value: 0 },
    gain: { value: 0, setTargetAtTime: () => {} },
  }),
  createAnalyser: () => ({
    connect: () => {},
    fftSize: 2048,
    frequencyBinCount: 1024,
    getByteFrequencyData: () => {},
    getByteTimeDomainData: () => {},
  }),
  createBufferSource: () => ({
    connect: () => {},
    start: () => {},
    stop: () => {},
    disconnect: () => {},
    buffer: null,
    playbackRate: { value: 1, setTargetAtTime: () => {} },
    onended: null,
  }),
  createBuffer: () => ({
    getChannelData: () => new Float32Array(44100),
  }),
  decodeAudioData: async () => ({}),
  destination: {},
  currentTime: 0,
  sampleRate: 44100,
  state: 'running',
  resume: async () => {},
  close: async () => {},
}

global.AudioContext = jest.fn().mockImplementation(() => mockAudioContext) as unknown as typeof AudioContext

// Mock fetch
global.fetch = jest.fn().mockImplementation(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  })
) as unknown as typeof fetch
