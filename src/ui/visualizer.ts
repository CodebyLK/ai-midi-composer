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

// 🛡️ CRITICAL FIX: Added 'isPlaying' flag. Defaults to false.
export function renderVisualizer(project: Project, isPlaying: boolean = false) {
    const canvas = document.getElementById('visualizer-canvas');
    const playhead = document.getElementById('playhead');
    const viewport = document.getElementById('visualizer-viewport');
    const instSelect = document.getElementById('instrument-select') as HTMLSelectElement;

    if (!canvas || !playhead || !viewport) return;

    canvas.innerHTML = '';
    canvas.appendChild(playhead);

    const pixelsPerBeat = 100;
    let maxProjectWidth = 800;

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
    playhead.style.display = project.tracks.length > 0 ? 'block' : 'none';
    playhead.style.setProperty('--scroll-width', `${maxProjectWidth}px`);

    // 🛡️ CRITICAL FIX: Only animate if the Play button was actually clicked
    if (isPlaying) {
        const secs = (maxProjectWidth / pixelsPerBeat * 60) / project.tempo;
        playhead.style.animation = 'none';
        playhead.offsetHeight;
        playhead.style.animation = `movePlayhead ${secs}s linear forwards`;

        let animId: number;
        const sync = () => {
            const tr = window.getComputedStyle(playhead).transform;
            if (tr && tr !== 'none') {
                const x = parseFloat(tr.split(',')[4]);
                viewport.scrollLeft = x - (viewport.clientWidth / 2);
            }
            animId = requestAnimationFrame(sync);
        };
        animId = requestAnimationFrame(sync);
        playhead.onanimationend = () => cancelAnimationFrame(animId);
    } else {
        // Reset playhead to start
        playhead.style.animation = 'none';
        viewport.scrollLeft = 0;
    }
}