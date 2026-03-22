import { generateMelody } from '../ai/prompt';
import { playMelody } from '../audio/synth';
import { downloadMidi } from '../audio/export'; 
import { renderVisualizer } from './visualizer';
import { AudioRecorder } from '../audio/recorder';
import { convertAudioToNotes } from '../audio/transcriber';

// --- RESTORED MOCK DATA HELPER ---
const getMockMelody = (tempo: number) => ({
    tempo: tempo,
    key: "C minor",
    notes: [
        { pitches: ["C4", "E4", "G4"], duration: 2, velocity: 100 },
        { pitches: ["F4", "A4", "C5"], duration: 2, velocity: 100 },
        { pitches: ["G4", "B4", "D5"], duration: 4, velocity: 100 },
        { pitches: ["C4", "G4", "C5"], duration: 8, velocity: 100 },
    ]
});

export function setupUI() {
    // 1. Core Elements
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

    const recorder = new AudioRecorder();
    let currentMelody: any = null; 
    let isRecording = false;

    // 2. Update BPM label
    tempoSlider.oninput = () => {
        if (tempoDisplay) tempoDisplay.textContent = tempoSlider.value;
    };

    // --- PLAY LOGIC ---
    playBtn.onclick = () => {
        if (currentMelody) {
            playMelody(currentMelody, parseInt(instrumentSelect.value));
            renderVisualizer(currentMelody);
        } else {
            alert("No music to play! Generate something or record your piano.");
        }
    };

    // --- CLEAR LOGIC ---
    clearBtn.onclick = () => {
        currentMelody = null;
        renderVisualizer({ tempo: parseInt(tempoSlider.value), key: "C", notes: [] });
        exportBtn.disabled = true;
    };

    // --- GENERATE LOGIC ---
    generateBtn.onclick = async () => {
        const userInput = promptInput.value;
        const requestedTempo = parseInt(tempoSlider.value, 10);
        
        // TOGGLE THIS TO 'false' WHEN YOU WANT THE REAL AI
        const useMockData = true; 

        if (useMockData) {
            console.log("Prompt received:", userInput); 
            currentMelody = getMockMelody(requestedTempo);
        } else {
            generateBtn.disabled = true;
            generateBtn.textContent = "Composing...";
            try {
                currentMelody = await generateMelody(userInput, requestedTempo, "8 bars");
            } catch (e) {
                console.error(e);
                alert("AI failed to respond.");
            }
            generateBtn.disabled = false;
            generateBtn.textContent = "Generate New AI Melody";
        }

        if (currentMelody) {
            renderVisualizer(currentMelody);
            playMelody(currentMelody, parseInt(instrumentSelect.value));
            exportBtn.disabled = false;
        }
    };

    // --- RECORDING LOGIC ---
    recordBtn.onclick = async () => {
        if (isRecording) {
            isRecording = false;
            recordBtn.textContent = "Analyzing Notes... ⏳";
            recordingStatus.style.display = "none";
            
            const audioUrl = await recorder.stop();
            const tempo = parseInt(tempoSlider.value);

            try {
                const extractedNotes = await convertAudioToNotes(audioUrl, tempo);
                currentMelody = { tempo, key: "C", notes: extractedNotes };
                renderVisualizer(currentMelody);
                exportBtn.disabled = false;
            } catch (err) {
                console.error("Transcription Error:", err);
                alert("Couldn't hear the notes clearly. Try again!");
            } finally {
                recordBtn.textContent = "🎤 Record Real Piano";
            }
            return;
        }

        const hasMic = await recorder.setup();
        if (hasMic) {
            isRecording = true;
            recordBtn.textContent = "⏹ Stop Recording";
            recordingStatus.style.display = "inline";
            recorder.start();
        }
    };

    // --- EXPORT LOGIC ---
    exportBtn.onclick = () => {
        if (currentMelody) {
            downloadMidi(currentMelody, parseInt(instrumentSelect.value));
        }
    };
}