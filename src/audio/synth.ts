import type { Melody, Note } from '../types';

function getFrequency(pitch: string): number {
    const notes: Record<string, number> = {
        "C4": 261.63, "C#4": 277.18, "D4": 293.66, "D#4": 311.13,
        "E4": 329.63, "F4": 349.23, "F#4": 369.99, "G4": 392.00,
        "G#4": 415.30, "A4": 440.00, "A#4": 466.16, "B4": 493.88,
        "C5": 523.25, "C#5": 554.37, "D5": 587.33, "D#5": 622.25,
        "E5": 659.25, "F5": 698.46, "F#5": 739.99, "G5": 783.99
    };
    return notes[pitch] || 440; 
}

function getInstrumentConfig(midiProgram: number) {
    switch (midiProgram) {
        case 1: return { type: 'triangle' as OscillatorType, attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.8 };
        case 25: return { type: 'sine' as OscillatorType, attack: 0.01, decay: 0.5, sustain: 0, release: 0.5 };
        case 40: return { type: 'sawtooth' as OscillatorType, attack: 0.02, decay: 0.1, sustain: 0.8, release: 0.1, filter: 600 };
        case 41: return { type: 'sawtooth' as OscillatorType, attack: 0.2, decay: 0.1, sustain: 0.8, release: 0.3 };
        case 57: return { type: 'square' as OscillatorType, attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.1, filter: 2000 };
        case 74: return { type: 'sine' as OscillatorType, attack: 0.1, decay: 0.1, sustain: 0.9, release: 0.2 };
        default: return { type: 'triangle' as OscillatorType, attack: 0.05, decay: 0.1, sustain: 0.5, release: 0.1 };
    }
}

let audioCtx: AudioContext | null = null;

export function playMelody(melody: Melody, instrumentNumber: number = 1) {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const config = getInstrumentConfig(instrumentNumber);
    let currentStartTime = audioCtx.currentTime;

    melody.notes.forEach((note: Note) => {
        const durationInSeconds = (60 / melody.tempo) * (note.duration || 1);
        note.pitches.forEach((pitch) => {
            const osc = audioCtx!.createOscillator();
            const gain = audioCtx!.createGain();
            osc.type = config.type;
            osc.frequency.value = getFrequency(pitch);

            if (config.filter) {
                const filter = audioCtx!.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = config.filter;
                osc.connect(filter);
                filter.connect(gain);
            } else {
                osc.connect(gain);
            }
            
            gain.connect(audioCtx!.destination);
            gain.gain.setValueAtTime(0, currentStartTime);
            gain.gain.linearRampToValueAtTime(0.15, currentStartTime + config.attack);
            gain.gain.linearRampToValueAtTime(0.15 * config.sustain, currentStartTime + config.attack + config.decay);
            
            const releaseStart = currentStartTime + durationInSeconds;
            gain.gain.setValueAtTime(0.15 * config.sustain, releaseStart);
            gain.gain.linearRampToValueAtTime(0, releaseStart + config.release);

            osc.start(currentStartTime);
            osc.stop(releaseStart + config.release);
        });
        currentStartTime += durationInSeconds;
    });
}

export function playNotePreview(pitch: string, instrumentNumber: number = 1) {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const config = getInstrumentConfig(instrumentNumber);
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = config.type;
    osc.frequency.value = getFrequency(pitch);
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.1, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
}