import { generateMelody } from '../ai/prompt';
import { playMelody } from '../audio/synth';
import { renderVisualizer } from './visualizer';
import { AudioRecorder } from '../audio/recorder';
import { convertAudioToNotes } from '../audio/transcriber';
import type { Project, Note } from '../types';

// --- HELPER: WRAP DATA FOR TYPES ---
const getMockProject = (tempo: number, instrument: number): Project => ({
    tempo: tempo,
    key: "C minor",
    tracks: [{
        id: "mock-1",
        name: "AI Melody",
        instrument: instrument,
        notes: [
            { pitches: ["C4", "E4", "G4"], duration: 2, startTime: 0, velocity: 100 },
            { pitches: ["F4", "A4", "C5"], duration: 2, startTime: 2, velocity: 100 },
            { pitches: ["G4", "B4", "D5"], duration: 4, startTime: 4, velocity: 100 },
            { pitches: ["C4", "G4", "C5"], duration: 8, startTime: 8, velocity: 100 },
        ],
        volume: 1,
        isMuted: false
    }]
});

// --- INTERNAL BINARY EXPORTER ---
function downloadMidiFile(project: Project, instrument: number) {
    if (!project || !project.tracks[0]) return;
    const TICKS_PER_BEAT = 128;
    const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 1, 0, TICKS_PER_BEAT];
    let trackData: number[] = [0x00, 0xc0, instrument];
    let lastT = 0;
    let events: { t: number, m: number, v: number, type: number }[] = [];

    project.tracks[0].notes.forEach((n: Note) => {
        const start = Math.round(n.startTime * TICKS_PER_BEAT);
        const end = Math.round((n.startTime + n.duration) * TICKS_PER_BEAT);
        n.pitches.forEach(p => {
            const octave = parseInt(p.replace(/\D/g, ''));
            const noteName = p.replace(/\d/g, '');
            const notesArr = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
            const midi = (octave + 1) * 12 + notesArr.indexOf(noteName);
            events.push({ t: start, m: midi, v: n.velocity || 64, type: 0x90 });
            events.push({ t: end, m: midi, v: 0, type: 0x80 });
        });
    });

    events.sort((a, b) => a.t - b.t).forEach(e => {
        let delta = e.t - lastT;
        if (delta > 127) trackData.push(((delta >> 7) & 0x7f) | 0x80);
        trackData.push(delta & 0x7f);
        trackData.push(e.type, e.m, e.v);
        lastT = e.t;
    });

    trackData.push(0x00, 0xff, 0x2f, 0x00);
    const len = trackData.length;
    const trackHeader = [0x4d, 0x54, 0x72, 0x6b, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff];
    const blob = new Blob([new Uint8Array([...header, ...trackHeader, ...trackData])], { type: 'audio/midi' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Piano_Session.mid`;
    a.click();
}

/**
 * MAIN UI INITIALIZATION
 */
export function setupUI(recorder: AudioRecorder) {
    const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
    const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
    const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
    const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
    const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
    const promptInput = document.getElementById('prompt-input') as HTMLInputElement;
    const tempoSlider = document.getElementById('tempo-slider') as HTMLInputElement;
    const tempoDisplay = document.getElementById('tempo-display') as HTMLSpanElement;
    const instrumentSelect = document.getElementById('instrument-select') as HTMLSelectElement;
    const recordingStatus = document.getElementById('recording-status') as HTMLElement;

    let currentMelody: Project | null = null;
    let isRecording = false;

    tempoSlider.oninput = () => {
        if (tempoDisplay) tempoDisplay.textContent = tempoSlider.value;
        if (currentMelody) {
            currentMelody.tempo = parseInt(tempoSlider.value);
            renderVisualizer(currentMelody, false);
        }
    };

    // 🛡️ Added 'async' and 'await' to clear Promise warnings
    playBtn.onclick = async () => {
        if (currentMelody) {
            renderVisualizer(currentMelody, true); // Pass true to start playhead
            await playMelody(currentMelody, parseInt(instrumentSelect.value));
        } else {
            alert("Record or generate a melody first!");
        }
    };

    clearBtn.onclick = () => {
        currentMelody = null;
        // 🛡️ Ensure clear logic sends a valid Project object
        renderVisualizer({ tempo: parseInt(tempoSlider.value), key: "C", tracks: [] }, false);
        exportBtn.disabled = true;
    };

    generateBtn.onclick = async () => {
        const userInput = promptInput.value;
        const tempo = parseInt(tempoSlider.value, 10);
        const inst = parseInt(instrumentSelect.value);

        const useMockData = true;

        if (useMockData) {
            console.log(`Mocking melody for prompt: "${userInput}"`);
            currentMelody = getMockProject(tempo, inst);
        } else {
            generateBtn.disabled = true;
            generateBtn.textContent = "AI is composing...";
            try {
                const aiNotes = await generateMelody(userInput, tempo, "8 bars");
                currentMelody = {
                    tempo,
                    key: "C",
                    tracks: [{
                        id: "ai-track",
                        name: "AI Generation",
                        instrument: inst,
                        notes: aiNotes,
                        volume: 1,
                        isMuted: false
                    }]
                };
            } catch (e) {
                console.error("AI Error:", e);
                alert("The AI had stage fright. Try again.");
            }
            generateBtn.disabled = false;
            generateBtn.textContent = "Generate New AI Melody";
        }

        if (currentMelody) {
            renderVisualizer(currentMelody, false);
            await playMelody(currentMelody, inst);
            exportBtn.disabled = false;
        }
    };

    recordBtn.onclick = async () => {
        if (isRecording) {
            isRecording = false;
            recordBtn.textContent = "Analyzing Notes... ⏳";
            if (recordingStatus) recordingStatus.style.display = "none";

            const audioUrl = await recorder.stop();
            const tempo = parseInt(tempoSlider.value);

            try {
                const extractedNotes = await convertAudioToNotes(audioUrl, tempo);
                currentMelody = {
                    tempo,
                    key: "C",
                    tracks: [{
                        id: "rec-track",
                        name: "Piano Recording",
                        instrument: parseInt(instrumentSelect.value),
                        notes: extractedNotes,
                        volume: 1,
                        isMuted: false
                    }]
                };
                if (currentMelody) renderVisualizer(currentMelody, false);
                exportBtn.disabled = false;
            } catch (err) {
                console.error(err);
                alert("Transcription failed. Play clearly!");
            } finally {
                recordBtn.textContent = "🎤 Record Real Piano";
            }
            return;
        }

        if (await recorder.setup()) {
            isRecording = true;
            recordBtn.textContent = "⏹ Stop Recording";
            if (recordingStatus) recordingStatus.style.display = "inline";
            recorder.start();
        }
    };

    exportBtn.onclick = () => {
        if (currentMelody) {
            downloadMidiFile(currentMelody, parseInt(instrumentSelect.value));
        }
    };
}