import type { Project, Track, Note } from '../types';
import { playNotePreview } from '../audio/synth';

const NOTE_MAP: Record<string, number> = {
    "G5": 20, "F#5": 40, "F5": 60, "E5": 80, "D5": 100, "C#5": 120, "C5": 140,
    "B4": 160, "A#4": 180, "A4": 200, "G#4": 220, "G4": 240, "F#4": 260,
    "F4": 280, "E4": 300, "D#4": 320, "D4": 340, "C#4": 360, "C4": 380
};

const PIXEL_TO_NOTE: Record<number, string> = Object.fromEntries(
    Object.entries(NOTE_MAP).map(([note, pos]) => [pos, note])
);

let currentAnimId: number | null = null;

export function renderVisualizer(project: Project, isPlaying: boolean = false) {
    const canvas = document.getElementById('visualizer-canvas');
    const viewport = document.getElementById('visualizer-viewport');
    const playhead = document.getElementById('playhead');
    const instSelect = document.getElementById('instrument-select') as HTMLSelectElement;

    if (!canvas || !viewport || !playhead) return;

    // 1. Reset any running animations
    if (currentAnimId) {
        cancelAnimationFrame(currentAnimId);
        currentAnimId = null;
    }

    // 2. Clear the canvas
    canvas.innerHTML = '';

    const pixelsPerBeat = 100;
    let maxProjectWidth = viewport.clientWidth;

    // 3. Render Lanes and Notes
    project.tracks.forEach((track: Track, index: number) => {
        const lane = document.createElement('div');
        lane.className = 'track-lane';
        lane.style.position = 'relative';
        lane.style.height = '400px';
        lane.style.width = '100%';
        lane.style.borderBottom = '4px solid #333';
        lane.style.backgroundColor = index % 2 === 0 ? '#121217' : '#1a1a24';

        lane.innerHTML = `<div style="position: sticky; left: 0; background: #646cff; color: white; padding: 4px 10px; font-weight: bold; width: fit-content; z-index: 10;">Track ${index + 1}: ${track.name}</div>`;

        // 🛡️ THE DEMO-SAVER: Double-click to add a note manually
        lane.ondblclick = (e) => {
            const rect = lane.getBoundingClientRect();
            const clickX = e.clientX - rect.left + viewport.scrollLeft;
            const clickY = e.clientY - rect.top;

            const snappedStart = Math.floor(clickX / pixelsPerBeat);
            const snappedTop = Math.round(clickY / 20) * 20;
            const pitch = PIXEL_TO_NOTE[snappedTop];

            if (pitch) {
                // Read the selected note size from the UI (defaults to 1 if not found)
                const sizeSelect = document.getElementById('draw-size') as HTMLSelectElement;
                const noteDuration = sizeSelect ? parseFloat(sizeSelect.value) : 1;

                track.notes.push({
                    pitches: [pitch],
                    duration: noteDuration, // Uses the dropdown value!
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
                block.style.height = '16px';
                block.style.position = 'absolute';

                // 🛡️ THE ERASER: Right-click to delete a note
                block.oncontextmenu = (e) => {
                    e.preventDefault(); // Stops the browser's default right-click menu

                    // Remove this specific note from the track array
                    track.notes.splice(nIdx, 1);

                    // Refresh the UI and auto-save the deletion
                    renderVisualizer(project, false);
                    localStorage.setItem('enterprise_daw_workspace', JSON.stringify(project));
                };

                // Manual Dragging Logic
                block.onmousedown = (e) => {
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

    // 4. Playhead Positioning
    viewport.appendChild(playhead);
    playhead.style.display = project.tracks.length > 0 ? 'block' : 'none';
    playhead.style.zIndex = '9999';
    playhead.style.animation = 'none';

    // 5. Animation Loop
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

    // 6. 🛡️ DASHBOARD ANALYTICS: Update the top bar numbers
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