import { 
    BasicPitch, 
    addPitchBendsToNoteEvents, 
    noteFramesToTime, 
    outputToNotesPoly 
} from '@spotify/basic-pitch';
import type { Note } from '../types';

const MIDI_TO_PITCH: Record<number, string> = {
    60: "C4", 61: "C#4", 62: "D4", 63: "D#4", 64: "E4", 65: "F4",
    66: "F#4", 67: "G4", 68: "G#4", 69: "A4", 70: "A#4", 71: "B4",
    72: "C5", 73: "C#5", 74: "D5", 75: "D#5", 76: "E5", 77: "F5",
    78: "F#5", 79: "G5"
};

export async function convertAudioToNotes(audioUrl: string, tempo: number): Promise<Note[]> {
    console.log("Loading Basic Pitch Model...");
    
    // 1. Initialize the Spotify Basic Pitch model using the public URL
    const basicPitch = new BasicPitch('https://unpkg.com/@spotify/basic-pitch@1.0.1/model/model.json');
    
    // 2. Fetch the audio file you just recorded
    const response = await fetch(audioUrl);
    const audioArrayBuffer = await response.arrayBuffer();

    // 3. Decode it into raw audio data 
    // basic-pitch requires exactly 22050Hz sample rate to work
    const audioCtx = new window.AudioContext({ sampleRate: 22050 });
    const audioBuffer = await audioCtx.decodeAudioData(audioArrayBuffer);

    console.log("Evaluating audio...");
    
    // Setup arrays to catch the streaming ML data
    const frames: number[][] = [];
    const onsets: number[][] = [];
    const contours: number[][] = [];

    // 4. Run the Machine Learning model!
    await basicPitch.evaluateModel(
        audioBuffer,
        (f: number[][], o: number[][], c: number[][]) => {
            frames.push(...f);
            onsets.push(...o);
            contours.push(...c);
        },
        (percent: number) => {
            console.log(`Transcription progress: ${Math.round(percent * 100)}%`);
        }
    );

    console.log("Processing note events...");

    // 5. Convert the raw ML matrix data into human-readable MIDI notes
    const midiNotes = noteFramesToTime(
        addPitchBendsToNoteEvents(
            contours,
            // 0.25 and 0.25 are the activation/onset thresholds, 5 is min note length
            outputToNotesPoly(frames, onsets, 0.25, 0.25, 5) 
        )
    );

    // 6. Convert Spotify's raw MIDI timing into our App's format (Beats)
    const appNotes: Note[] = [];
    
    midiNotes.forEach((midiNote: any) => {
        // Find our string pitch, ignore it if it's too high/low for our current synth
        const pitchString = MIDI_TO_PITCH[Math.round(midiNote.pitchMidi)];
        if (!pitchString) return;

        // Convert raw seconds into musical beats based on your app's tempo
        const durationInSeconds = midiNote.durationSeconds;
        let durationInBeats = durationInSeconds / (60 / tempo);
        
        // Round to nearest 16th note (0.25) to keep the visualizer clean
        durationInBeats = Math.max(0.25, Math.round(durationInBeats * 4) / 4);

        appNotes.push({
            pitches: [pitchString],
            duration: durationInBeats,
            velocity: Math.round(midiNote.amplitude * 127) // 0-127 MIDI standard
        });
    });

    console.log("Transcription complete!", appNotes);
    return appNotes;
}