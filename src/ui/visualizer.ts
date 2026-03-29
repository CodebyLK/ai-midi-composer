import type { Project, Track, Note } from '../types';
import { playNotePreview } from '../audio/synth';

// 🛡️ Note Map ordered by Pitch Height
// 🛡️ FIXED: Restored the missing D#5 and aligned the 20px grid perfectly
const NOTE_MAP: Record<string, number> = {
    "G5": 0, "F#5": 20, "F5": 40, "E5": 60, "D#5": 80, "D5": 100, "C#5": 120, "C5": 140,
    "B4": 160, "A#4": 180, "A4": 200, "G#4": 220, "G4": 240, "F#4": 260,
    "F4": 280, "E4": 300, "D#4": 320, "D4": 340, "C#4": 360, "C4": 380
};

// 🛡️ Ordered array of notes to calculate chords
const ORDERED_NOTES = [
    "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
    "C5", "C#5", "D5", "D#5", "E5", "F5", "F#5", "G5"
];

const PIXEL_TO_NOTE: Record<number, string> = Object.fromEntries(
    Object.entries(NOTE_MAP).map(([note, pos]) => [pos, note])
);

let currentAnimId: number | null = null;

/**
 * 🎵 THEORY ENGINE: Calculates chord intervals
 */
function buildChord(rootPitch: string, type: string): string[] {
    const rootIndex = ORDERED_NOTES.indexOf(rootPitch);
    if (rootIndex === -1) return [rootPitch];

    const chord = [rootPitch];

    if (type === 'major') {
        if (ORDERED_NOTES[rootIndex + 4]) chord.push(ORDERED_NOTES[rootIndex + 4]); // Major 3rd
        if (ORDERED_NOTES[rootIndex + 7]) chord.push(ORDERED_NOTES[rootIndex + 7]); // Perfect 5th
    } else if (type === 'minor') {
        if (ORDERED_NOTES[rootIndex + 3]) chord.push(ORDERED_NOTES[rootIndex + 3]); // Minor 3rd
        if (ORDERED_NOTES[rootIndex + 7]) chord.push(ORDERED_NOTES[rootIndex + 7]); // Perfect 5th
    } else if (type === 'octave') {
        if (ORDERED_NOTES[rootIndex + 12]) chord.push(ORDERED_NOTES[rootIndex + 12]); // Octave
    }

    return chord;
}

export function renderVisualizer(project: Project, isPlaying: boolean = false) {
    const canvas = document.getElementById('visualizer-canvas');
    const viewport = document.getElementById('visualizer-viewport');
    const playhead = document.getElementById('playhead');
    const keyboardPanel = document.getElementById('piano-keyboard');
    const instSelect = document.getElementById('instrument-select') as HTMLSelectElement;

    if (!canvas || !viewport || !playhead) return;

    if (currentAnimId) {
        cancelAnimationFrame(currentAnimId);
        currentAnimId = null;
    }

    canvas.innerHTML = '';

    // 🛡️ ENTERPRISE: Draw the Piano Keyboard
    // 🛡️ ENTERPRISE: Draw the Piano Keyboard
    if (keyboardPanel) {
        keyboardPanel.innerHTML = '';
        // Give the panel a white background so white keys look connected
        keyboardPanel.style.backgroundColor = '#fefefe';

        Object.entries(NOTE_MAP).forEach(([noteName, topPos]) => {
            const isBlackKey = noteName.includes('#');
            const key = document.createElement('div');

            key.style.position = 'absolute';
            key.style.top = `${topPos}px`;
            key.style.width = isBlackKey ? '35px' : '100%';
            // Stretch the white keys slightly so they overlap perfectly
            key.style.height = isBlackKey ? '20px' : '21px';

            key.style.backgroundColor = isBlackKey ? '#222' : '#fefefe';
            key.style.borderBottom = '1px solid #ccc';
            key.style.borderRight = isBlackKey ? '2px solid #111' : 'none';
            key.style.borderBottomRightRadius = isBlackKey ? '3px' : '0px';
            key.style.zIndex = isBlackKey ? '2' : '1';

            key.style.color = isBlackKey ? '#888' : '#555';
            key.style.fontSize = '10px';
            key.style.fontWeight = 'bold';
            key.style.display = 'flex';
            key.style.alignItems = 'center';
            key.style.justifyContent = 'flex-end';
            key.style.paddingRight = '5px';
            key.style.boxSizing = 'border-box';
            key.style.cursor = 'pointer';

            // Only label the C notes to keep it looking clean and professional
            if (noteName.startsWith('C') && !noteName.includes('#')) {
                key.textContent = noteName;
            }

            // Click the key to hear the note
            key.onmousedown = () => playNotePreview(noteName, parseInt(instSelect?.value || "1"));

            keyboardPanel.appendChild(key);
        });
    }

    const pixelsPerBeat = 100;
    let maxProjectWidth = viewport.clientWidth;

    project.tracks.forEach((track: Track) => {
        const lane = document.createElement('div');
        lane.className = 'track-lane';
        lane.style.position = 'relative';
        lane.style.height = '420px'; // Fit all notes
        lane.style.width = '100%';
        lane.style.backgroundColor = '#121217';

        // Horizontal Grid Lines to match the keys
        Object.values(NOTE_MAP).forEach(topPos => {
            const line = document.createElement('div');
            line.style.position = 'absolute';
            line.style.top = `${topPos + 20}px`;
            line.style.width = '100%';
            line.style.borderBottom = '1px solid #222';
            line.style.pointerEvents = 'none'; // So clicks pass through to the lane
            lane.appendChild(line);
        });

        // 🛡️ THE CHORD STAMPER: Use Music Theory on Double Click
        lane.ondblclick = (e) => {
            const rect = lane.getBoundingClientRect();
            const clickX = e.clientX - rect.left + viewport.scrollLeft;
            const clickY = e.clientY - rect.top;

            const snappedStart = Math.floor(clickX / pixelsPerBeat);
            const snappedTop = Math.round(clickY / 20) * 20;
            const rootPitch = PIXEL_TO_NOTE[snappedTop];

            if (rootPitch) {
                // 1. What are we drawing? (Single, Minor, Major)
                const toolSelect = document.getElementById('draw-tool') as HTMLSelectElement;
                const toolType = toolSelect ? toolSelect.value : 'single';

                // 2. How long is it? (16th, Quarter, Whole)
                const sizeSelect = document.getElementById('draw-size') as HTMLSelectElement;
                const noteDuration = sizeSelect ? parseFloat(sizeSelect.value) : 1;

                // Magic happens here: Build the chord AND apply the duration!
                const pitchesToDraw = buildChord(rootPitch, toolType);

                track.notes.push({
                    pitches: pitchesToDraw,
                    duration: noteDuration, // 🛡️ Now uses your selected duration
                    startTime: snappedStart,
                    velocity: 100
                });

                renderVisualizer(project, false);
                localStorage.setItem('enterprise_daw_workspace', JSON.stringify(project));
            }
        };

        track.notes.forEach((note: Note, nIdx: number) => {
            const width = (note.duration * pixelsPerBeat) - 4;
            const left = note.startTime * pixelsPerBeat;
            maxProjectWidth = Math.max(maxProjectWidth, left + width + 400);

            note.pitches.forEach((pitch, pIdx) => {
                const block = document.createElement('div');
                block.className = 'note-block';
                block.style.left = `${left}px`;
                block.style.top = `${NOTE_MAP[pitch] || 150}px`;
                block.style.width = `${width}px`;
                block.style.height = '18px';
                block.style.position = 'absolute';
                block.style.borderRadius = '3px';

                block.oncontextmenu = (e) => {
                    e.preventDefault();
                    track.notes.splice(nIdx, 1);
                    renderVisualizer(project, false);
                    localStorage.setItem('enterprise_daw_workspace', JSON.stringify(project));
                };

                block.onmousedown = (e) => {
                    if (e.button === 2) return; // Ignore right-clicks for dragging
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const originalTop = parseInt(block.style.top);
                    const originalLeft = parseInt(block.style.left);
                    const inst = parseInt(instSelect?.value || "1");

                    const move = (me: MouseEvent) => {
                        let nt = Math.round((originalTop + (me.clientY - startY)) / 20) * 20;
                        nt = Math.max(20, Math.min(380, nt));
                        let nl = originalLeft + (me.clientX - startX);
                        nl = Math.round(nl / 25) * 25;
                        block.style.top = `${nt}px`;
                        block.style.left = `${nl}px`;
                        const p = PIXEL_TO_NOTE[nt];
                        if (p && nt !== originalTop) playNotePreview(p, inst);
                    };

                    const up = () => {
                        const finalTop = parseInt(block.style.top);
                        const finalLeft = parseInt(block.style.left);
                        const finalPitch = PIXEL_TO_NOTE[finalTop];
                        if (finalPitch) {
                            track.notes[nIdx].pitches[pIdx] = finalPitch;
                            track.notes[nIdx].startTime = finalLeft / pixelsPerBeat;
                            localStorage.setItem('enterprise_daw_workspace', JSON.stringify(project));
                        }
                        document.removeEventListener('mousemove', move);
                        document.removeEventListener('mouseup', up);
                    };
                    document.addEventListener('mousemove', move);
                    document.addEventListener('mouseup', up);
                };
                lane.appendChild(block);
            });
        });
        canvas.appendChild(lane);
    });

    canvas.style.width = `${maxProjectWidth}px`;

    viewport.appendChild(playhead);
    playhead.style.display = project.tracks.length > 0 ? 'block' : 'none';
    playhead.style.zIndex = '9999';
    playhead.style.animation = 'none';
    playhead.style.height = '420px';

    if (isPlaying && project.tracks.length > 0) {
        const durationSecs = (maxProjectWidth / pixelsPerBeat * 60) / project.tempo;
        let startTimestamp: number | null = null;

        const sync = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const elapsed = (timestamp - startTimestamp) / 1000;
            const progress = Math.min(elapsed / durationSecs, 1);
            const x = progress * maxProjectWidth;

            playhead.style.transform = `translateX(${x}px)`;
            viewport.scrollLeft = Math.max(0, x - (viewport.clientWidth / 2));

            if (progress < 1) {
                currentAnimId = requestAnimationFrame(sync);
            }
        };
        currentAnimId = requestAnimationFrame(sync);
    } else {
        playhead.style.transform = `translateX(0px)`;
        viewport.scrollLeft = 0;
    }

    const statNotes = document.getElementById('stat-notes');
    const statDuration = document.getElementById('stat-duration');
    if (statNotes && statDuration) {
        let totalNotes = 0;
        let maxTime = 0;
        project.tracks.forEach(t => {
            totalNotes += t.notes.length;
            t.notes.forEach(n => maxTime = Math.max(maxTime, n.startTime + n.duration));
        });
        const durationSecs = (maxTime * 60) / project.tempo;
        statNotes.textContent = totalNotes.toString();
        statDuration.textContent = durationSecs.toFixed(1) + "s";
    }
}