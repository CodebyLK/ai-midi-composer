import {
    BasicPitch,
    addPitchBendsToNoteEvents,
    noteFramesToTime,
    outputToNotesPoly
} from '@spotify/basic-pitch';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-wasm';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import type { Note } from '../types';

// Converts MIDI numbers to string notation (C4, G#3, etc.)
function midiToPitch(midi: number): string {
    const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const octave = Math.floor(midi / 12) - 1;
    const noteName = notes[midi % 12];
    return `${noteName}${octave}`;
}

export async function convertAudioToNotes(audioUrl: string, tempo: number): Promise<Note[]> {
    console.log("Configuring Machine Learning Backend...");

    try {
        setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm/dist/');
        await tf.setBackend('wasm');
        await tf.ready();
    } catch (e) {
        console.warn("Could not force WASM backend, proceeding with default...", e);
    }

    const basicPitch = new BasicPitch('https://unpkg.com/@spotify/basic-pitch@1.0.1/model/model.json');
    const response = await fetch(audioUrl);
    const audioArrayBuffer = await response.arrayBuffer();
    const audioCtx = new window.AudioContext({ sampleRate: 22050 });
    let audioBuffer = await audioCtx.decodeAudioData(audioArrayBuffer);

    if (audioBuffer.numberOfChannels > 1) {
        const monoBuffer = audioCtx.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
        const monoData = monoBuffer.getChannelData(0);
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.getChannelData(1);
        for (let i = 0; i < audioBuffer.length; i++) {
            monoData[i] = (leftChannel[i] + rightChannel[i]) / 2;
        }
        audioBuffer = monoBuffer;
    }

    const frames: number[][] = [];
    const onsets: number[][] = [];
    const contours: number[][] = [];

    await basicPitch.evaluateModel(
        audioBuffer,
        (f: number[][], o: number[][], c: number[][]) => {
            frames.push(...f); onsets.push(...o); contours.push(...c);
        },
        (percent: number) => {
            console.log(`Transcription: ${Math.round(percent * 100)}%`);
        }
    );

    console.log("Processing note events...");
    const midiNotes = noteFramesToTime(
        addPitchBendsToNoteEvents(
            contours,
            outputToNotesPoly(frames, onsets, 0.25, 0.2, 11)
        )
    );

    const rawNotes: Note[] = [];
    const beatDuration = 60 / tempo;

    midiNotes.forEach((midiNote: any) => {
        const rawMidi = Math.round(midiNote.pitchMidi);

        // Ignore ghost notes outside real piano range
        if (rawMidi < 21 || rawMidi > 108) return;

        // 🛡️ FIX: Defining these variables so TypeScript can find them!
        const pitchString = midiToPitch(rawMidi);
        const rawStartTime = midiNote.startTimeSeconds ?? midiNote.startSeconds ?? midiNote.startTime ?? 0;
        const rawDuration = midiNote.durationSeconds ?? midiNote.duration ?? 0.5;
        const rawAmplitude = midiNote.amplitude ?? 0.8;

        // 🛡️ THE 8-BEAT PEDAL CUTTER: Respects whole notes!
        const safeDuration = Math.min(8.0, rawDuration / beatDuration);

        rawNotes.push({
            pitches: [pitchString],
            duration: Math.max(0.125, safeDuration),
            startTime: rawStartTime / beatDuration,
            velocity: Math.round(rawAmplitude * 127)
        });
    });

    rawNotes.sort((a, b) => a.startTime - b.startTime);

    // STEP 1: DE-STUTTER
    const deStuttered: Note[] = [];
    rawNotes.forEach(note => {
        const pitch = note.pitches[0];
        const lastSamePitch = deStuttered.slice().reverse().find(n => n.pitches[0] === pitch);

        if (lastSamePitch && (note.startTime - (lastSamePitch.startTime + lastSamePitch.duration)) < 0.15) {
            const newEnd = Math.max(lastSamePitch.startTime + lastSamePitch.duration, note.startTime + note.duration);
            lastSamePitch.duration = Math.min(8.0, newEnd - lastSamePitch.startTime);
        } else {
            deStuttered.push({ ...note, pitches: [...note.pitches] });
        }
    });

    // STEP 2: CHORD GROUPER
    const finalChords: Note[] = [];
    deStuttered.forEach(note => {
        const existingChord = finalChords.find(c => Math.abs(c.startTime - note.startTime) < 0.1);

        if (existingChord) {
            if (!existingChord.pitches.includes(note.pitches[0])) {
                existingChord.pitches.push(note.pitches[0]);
                existingChord.duration = Math.max(existingChord.duration, note.duration);
            }
        } else {
            finalChords.push(note);
        }
    });

    // ... (Keep everything above Step 2: Chord Grouper the same)

    // 🛡️ STEP 3: THE QUANTIZER
    // Snaps notes to the nearest 1/12th of a beat (perfect for triplets!)
    const quantizedNotes = finalChords.map(note => {
        const snap = 1 / 12; // High enough resolution for triplets and 16th notes

        return {
            ...note,
            // Round the start time to the nearest snap point
            startTime: Math.round(note.startTime / snap) * snap,
            // Round the duration so blocks look clean on the grid
            duration: Math.max(snap, Math.round(note.duration / snap) * snap)
        };
    });

    // 🛡️ STEP 4: THE HARMONIC FILTER
    // If a "chord" has two notes of the same letter (octaves),
    // and one is much quieter, we kill the "ghost" overtone.
    quantizedNotes.forEach(note => {
        if (note.pitches.length > 1) {
            const baseNotes = note.pitches.map(p => p.replace(/\d/g, ''));
            const uniqueBases = new Set(baseNotes);

            if (uniqueBases.size < note.pitches.length) {
                // We found an octave! Keep only the lowest one to clean up the sound.
                const sortedPitches = [...note.pitches].sort((a, b) => {
                    const octA = parseInt(a.replace(/\D/g, ''));
                    const octB = parseInt(b.replace(/\D/g, ''));
                    return octA - octB;
                });
                note.pitches = [sortedPitches[0]];
            }
        }
    });

    console.log(`Successfully Quantized ${quantizedNotes.length} notes!`, quantizedNotes);
    return quantizedNotes;
}