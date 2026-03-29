import { generateMelody } from '../ai/prompt';
import { playMelody } from '../audio/synth';
import { renderVisualizer } from './visualizer';
import { AudioRecorder } from '../audio/recorder';
import { convertAudioToNotes } from '../audio/transcriber';
import type { Project, Note } from '../types';

const STORAGE_KEY = 'enterprise_daw_workspace';

export function autoSaveProject(project: Project | null) {
    try {
        if (project) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
            const status = document.getElementById('save-status');
            if (status) {
                status.style.display = 'block';
                setTimeout(() => status.style.display = 'none', 2000);
            }
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }
    } catch (e) {
        console.error("Local storage disabled", e);
    }
}

function loadSavedProject(): Project | null {
    try {
        const savedData = localStorage.getItem(STORAGE_KEY);
        return savedData ? JSON.parse(savedData) : null;
    } catch (e) {
        return null;
    }
}

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
 * 📊 ENTERPRISE ANALYTICS: Updates the top dashboard stats
 */
export function updateDashboardStats(project: Project) {
    const statNotes = document.getElementById('stat-notes');
    const statDuration = document.getElementById('stat-duration');

    if (!statNotes || !statDuration) return;

    let totalNotes = 0;
    let lastNoteEnd = 0;

    project.tracks.forEach(track => {
        totalNotes += track.notes.length;
        track.notes.forEach(note => {
            const end = note.startTime + note.duration;
            if (end > lastNoteEnd) lastNoteEnd = end;
        });
    });

    const durationSeconds = (lastNoteEnd * 60) / project.tempo;
    statNotes.textContent = totalNotes.toString();
    statDuration.textContent = durationSeconds.toFixed(1) + "s";
}

export function setupUI(recorder: AudioRecorder) {
    const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
    const appendBtn = document.getElementById('append-btn') as HTMLButtonElement;
    const playBtn = document.getElementById('play-btn') as HTMLButtonElement;
    const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
    const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
    const recordBtn = document.getElementById('record-btn') as HTMLButtonElement;
    const promptInput = document.getElementById('prompt-input') as HTMLInputElement;
    const lengthSelect = document.getElementById('length-select') as HTMLSelectElement;
    const tempoSlider = document.getElementById('tempo-slider') as HTMLInputElement;
    const tempoDisplay = document.getElementById('tempo-display') as HTMLSpanElement;
    const instrumentSelect = document.getElementById('instrument-select') as HTMLSelectElement;
    const recordingStatus = document.getElementById('recording-status') as HTMLElement;

    let currentMelody: Project | null = loadSavedProject();
    let isRecording = false;

    if (currentMelody) {
        tempoSlider.value = currentMelody.tempo.toString();
        tempoDisplay.textContent = currentMelody.tempo.toString();
        renderVisualizer(currentMelody, false);
        updateDashboardStats(currentMelody);
        exportBtn.disabled = false;
        appendBtn.disabled = false;
    }

    tempoSlider.oninput = () => {
        if (tempoDisplay) tempoDisplay.textContent = tempoSlider.value;
        if (currentMelody) {
            currentMelody.tempo = parseInt(tempoSlider.value);
            renderVisualizer(currentMelody, false);
            updateDashboardStats(currentMelody);
            autoSaveProject(currentMelody);
        }
    };

    playBtn.onclick = async () => {
        if (currentMelody) {
            renderVisualizer(currentMelody, true);
            await playMelody(currentMelody, parseInt(instrumentSelect.value));
        } else {
            alert("Record or generate a melody first!");
        }
    };

    clearBtn.onclick = () => {
        currentMelody = null;
        renderVisualizer({ tempo: parseInt(tempoSlider.value), key: "C", tracks: [] }, false);
        exportBtn.disabled = true;
        appendBtn.disabled = true;
        autoSaveProject(null);

        // Reset stats
        const statNotes = document.getElementById('stat-notes');
        const statDuration = document.getElementById('stat-duration');
        if (statNotes) statNotes.textContent = "0";
        if (statDuration) statDuration.textContent = "0s";
    };

    generateBtn.onclick = async () => {
        const userInput = promptInput.value;
        const tempo = parseInt(tempoSlider.value, 10);
        const inst = parseInt(instrumentSelect.value);
        const length = lengthSelect.value;

        // Toggle this if you are out of API tokens!
        const useMockData = true;

        generateBtn.disabled = true;
        generateBtn.textContent = "⏳...";

        try {
            let newNotes: Note[];
            if (useMockData) {
                newNotes = getMockProject(tempo, inst).tracks[0].notes;
            } else {
                newNotes = await generateMelody(userInput, tempo, length);
            }

            currentMelody = {
                tempo,
                key: "C",
                tracks: [{
                    id: "ai-track",
                    name: "AI Composition",
                    instrument: inst,
                    notes: newNotes,
                    volume: 1,
                    isMuted: false
                }]
            };

            renderVisualizer(currentMelody, false);
            updateDashboardStats(currentMelody);
            autoSaveProject(currentMelody);

            exportBtn.disabled = false;
            appendBtn.disabled = false;
        } catch (e) {
            console.error("AI Error:", e);
            alert("The AI had stage fright. Try again.");
        }

        generateBtn.disabled = false;
        generateBtn.textContent = "✨ New";
    };

    // 🛡️ THE ARRANGER: Stitching songs together
    appendBtn.onclick = async () => {
        if (!currentMelody || currentMelody.tracks.length === 0) return;

        const userInput = promptInput.value;
        const tempo = parseInt(tempoSlider.value, 10);
        const length = lengthSelect.value;

        appendBtn.disabled = true;
        appendBtn.textContent = "⏳...";

        try {
            // 1. Calculate the exact ending beat of the current composition
            let songEndBeat = 0;
            currentMelody.tracks[0].notes.forEach(n => {
                songEndBeat = Math.max(songEndBeat, n.startTime + n.duration);
            });

            // 2. Fetch the next segment from the AI
            const nextSegmentNotes = await generateMelody(userInput, tempo, length);

            // 3. Mathematical Time-Shift: Push all new notes to the end of the timeline
            nextSegmentNotes.forEach(n => {
                n.startTime += songEndBeat;
            });

            // 4. Inject into the master track
            currentMelody.tracks[0].notes.push(...nextSegmentNotes);

            // 5. Save and Render the new, longer timeline
            renderVisualizer(currentMelody, false);
            updateDashboardStats(currentMelody);
            autoSaveProject(currentMelody);

        } catch (e) {
            console.error("AI Append Error:", e);
            alert("Failed to append the next section. Check your API connection.");
        }

        appendBtn.disabled = false;
        appendBtn.textContent = "➕ Append";
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
                if (currentMelody) {
                    renderVisualizer(currentMelody, false);
                    updateDashboardStats(currentMelody);
                    autoSaveProject(currentMelody);
                    exportBtn.disabled = false;
                    appendBtn.disabled = false;
                }
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