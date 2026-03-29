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

    // 1. Kill any existing animation
    if (currentAnimId) {
        cancelAnimationFrame(currentAnimId);
        currentAnimId = null;
    }

    // 2. Wipe the canvas completely clean
    canvas.innerHTML = '';

    const pixelsPerBeat = 100;
    let maxProjectWidth = viewport.clientWidth;

    // 3. Draw the Lanes and Notes (Your exact original logic)
    project.tracks.forEach((track: Track, index: number) => {
        const lane = document.createElement('div');
        lane.className = 'track-lane';
        lane.style.position = 'relative';
        lane.style.height = '400px';
        lane.style.width = '100%';
        lane.style.borderBottom = '4px solid #333';
        lane.style.backgroundColor = index % 2 === 0 ? '#121217' : '#1a1a24';

        lane.innerHTML = `<div style="position: sticky; left: 0; background: #646cff; color: white; padding: 4px 10px; font-weight: bold; width: fit-content; z-index: 10;">Track ${index + 1}: ${track.name}</div>`;

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

    // 🛡️ THE LAYER FIX: Move the playhead to the very end of the viewport
    // This physically guarantees it renders ON TOP of everything else.
    viewport.appendChild(playhead);

    playhead.style.display = project.tracks.length > 0 ? 'block' : 'none';
    playhead.style.zIndex = '9999';
    playhead.style.animation = 'none'; // Overrides the broken CSS animations

    // 4. 🛡️ THE BULLETPROOF ANIMATION LOOP
    if (isPlaying && project.tracks.length > 0) {
        const durationSecs = (maxProjectWidth / pixelsPerBeat * 60) / project.tempo;

        // We MUST start this as null so we can grab the exact browser timestamp on the very first frame
        let startTimestamp: number | null = null;

        const sync = (timestamp: number) => {
            // Initialize the clock using the engine's internal timer
            if (!startTimestamp) startTimestamp = timestamp;

            const elapsed = (timestamp - startTimestamp) / 1000;
            const progress = Math.min(elapsed / durationSecs, 1);

            // Mathematically calculate the exact pixel distance
            const x = progress * maxProjectWidth;

            // Move the playhead directly
            playhead.style.transform = `translateX(${x}px)`;

            // Lock the camera to the playhead
            viewport.scrollLeft = Math.max(0, x - (viewport.clientWidth / 2));

            // Loop until finished
            if (progress < 1) {
                currentAnimId = requestAnimationFrame(sync);
            }
        };

        currentAnimId = requestAnimationFrame(sync);
    } else {
        // Reset the playhead to start
        playhead.style.transform = `translateX(0px)`;
        viewport.scrollLeft = 0;
    }
}