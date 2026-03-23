import type { Project, Note, Track } from '../types';

/**
 * HELPER: Converts note names (C4, G#3) to MIDI frequencies.
 * Uses the formula: $f = 440 \times 2^{\frac{n-69}{12}}$
 */
function getFrequency(pitch: string): number {
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const noteName = pitch.replace(/\d/g, '');
    const octave = parseInt(pitch.replace(/\D/g, ''));

    const noteIndex = notes.indexOf(noteName);
    if (noteIndex === -1 || isNaN(octave)) return 440;

    const midiNumber = (octave + 1) * 12 + noteIndex;
    return 440 * Math.pow(2, (midiNumber - 69) / 12);
}

let audioCtx: AudioContext | null = null;

/**
 * HELPER: Creates a procedural reverb tail.
 */
function createReverb(ctx: AudioContext): ConvolverNode {
    const length = ctx.sampleRate * 2.5;
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const decay = Math.exp(-i / (ctx.sampleRate * 0.4));
        left[i] = (Math.random() * 2 - 1) * decay;
        right[i] = (Math.random() * 2 - 1) * decay;
    }

    const convolver = ctx.createConvolver();
    convolver.buffer = impulse;
    return convolver;
}

/**
 * MAIN PLAYBACK ENGINE
 */
export async function playMelody(project: Project, instrumentId: number = 1) {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        const masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.8;

        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.value = -12;
        compressor.ratio.value = 12;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;

        const reverbNode = createReverb(audioCtx);
        const reverbGain = audioCtx.createGain();
        reverbGain.gain.value = 0.4;

        masterGain.connect(compressor);
        compressor.connect(audioCtx.destination);
        compressor.connect(reverbNode);
        reverbNode.connect(reverbGain);
        reverbGain.connect(audioCtx.destination);

        const secondsPerBeat = 60 / project.tempo;
        const startTime = audioCtx.currentTime + 0.1;

        project.tracks.forEach((track: Track) => {
            if (track.isMuted) return;

            track.notes.forEach((note: Note) => {
                const startBeat = note.startTime || 0;
                const durationBeats = note.duration || 1;
                const noteStart = startTime + (startBeat * secondsPerBeat);
                const noteDuration = durationBeats * secondsPerBeat;
                const safeDuration = Math.max(noteDuration, 0.1);

                note.pitches.forEach((pitch) => {
                    const freq = getFrequency(pitch);
                    const vol = 0.15 * (track.volume ?? 0.8);

                    // 1. The Body
                    // 🛡️ FIX TS6133: We now use instrumentId to change the "flavor"
                    const osc1 = audioCtx!.createOscillator();
                    osc1.type = instrumentId > 1 ? 'triangle' : 'sine';
                    osc1.frequency.value = freq;

                    // 2. The Harmonic
                    const osc2 = audioCtx!.createOscillator();
                    osc2.type = 'sine';
                    osc2.frequency.value = freq * 2;

                    // 3. The Hammer Strike
                    const osc3 = audioCtx!.createOscillator();
                    osc3.type = 'triangle';
                    osc3.frequency.value = freq;

                    // 4. Acoustic Filter
                    const filter = audioCtx!.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.Q.value = 1;
                    filter.frequency.setValueAtTime(freq * 4, noteStart);
                    filter.frequency.setTargetAtTime(freq * 1.5, noteStart + 0.05, 0.2);

                    const gain = audioCtx!.createGain();

                    osc1.connect(filter);

                    const osc2Gain = audioCtx!.createGain();
                    osc2Gain.gain.value = 0.2;
                    osc2.connect(osc2Gain).connect(filter);

                    const osc3Gain = audioCtx!.createGain();
                    osc3Gain.gain.value = 0.15;
                    osc3.connect(osc3Gain).connect(filter);

                    filter.connect(gain);
                    gain.connect(masterGain);

                    // --- THE PERFECT PIANO ENVELOPE ---
                    gain.gain.setValueAtTime(0, noteStart);
                    gain.gain.linearRampToValueAtTime(vol, noteStart + 0.02);
                    gain.gain.setTargetAtTime(vol * 0.3, noteStart + 0.03, 0.8);

                    gain.gain.setValueAtTime(vol * 0.3, noteStart + safeDuration);
                    gain.gain.linearRampToValueAtTime(0, noteStart + safeDuration + 0.1);

                    osc1.start(noteStart);
                    osc2.start(noteStart);
                    osc3.start(noteStart);

                    osc1.stop(noteStart + safeDuration + 0.2);
                    osc2.stop(noteStart + safeDuration + 0.2);
                    osc3.stop(noteStart + safeDuration + 0.2);
                });
            });
        });
    } catch (error: any) {
        console.error("[Synth Crash]", error);
    }
}

export function playNotePreview(pitch: string, instrument: number = 1) {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = instrument > 1 ? 'triangle' : 'sine';
    osc.frequency.value = getFrequency(pitch);

    osc.connect(gain).connect(audioCtx.destination);

    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.setTargetAtTime(0.001, audioCtx.currentTime + 0.02, 0.2);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}