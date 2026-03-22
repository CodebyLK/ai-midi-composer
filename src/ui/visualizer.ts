import type { Melody } from '../types';
import { playNotePreview } from '../audio/synth';

const NOTE_MAP: Record<string, number> = {
    "G5": 20, "F#5": 40, "F5": 60, "E5": 80, "D5": 100, "C#5": 120, "C5": 140,
    "B4": 160, "A#4": 180, "A4": 200, "G#4": 220, "G4": 240, "F#4": 260, 
    "F4": 280, "E4": 300, "D#4": 320, "D4": 340, "C#4": 360, "C4": 380 
};

const PIXEL_TO_NOTE: Record<number, string> = Object.fromEntries(
    Object.entries(NOTE_MAP).map(([note, pos]) => [pos, note])
);

export function renderVisualizer(melody: Melody) {
    const canvas = document.getElementById('visualizer-canvas');
    const playhead = document.getElementById('playhead');
    const viewport = document.getElementById('visualizer-viewport');
    const instSelect = document.getElementById('instrument-select') as HTMLSelectElement;

    if (!canvas || !playhead || !viewport) return;
    
    canvas.innerHTML = ''; 
    canvas.appendChild(playhead);

    const pixelsPerBeat = 100;
    let currentX = 0;

    melody.notes.forEach((note, nIdx) => {
        const width = ((note.duration || 1) * pixelsPerBeat) - 4;
        note.pitches.forEach((pitch, pIdx) => {
            const block = document.createElement('div');
            block.className = 'note-block';
            block.style.left = `${currentX}px`;
            block.style.top = `${NOTE_MAP[pitch] || 150}px`;
            block.style.width = `${width}px`;
            block.style.height = '16px';
            
            block.onmousedown = (e) => {
                const startY = e.clientY;
                const originalTop = parseInt(block.style.top);
                const inst = parseInt(instSelect?.value || "1");
                let lastTop = originalTop;

                const move = (me: MouseEvent) => {
                    let nt = Math.round((originalTop + (me.clientY - startY)) / 20) * 20;
                    nt = Math.max(20, Math.min(380, nt));
                    block.style.top = `${nt}px`;
                    if (nt !== lastTop) {
                        const p = PIXEL_TO_NOTE[nt];
                        if (p) playNotePreview(p, inst);
                        lastTop = nt;
                    }
                };
                const up = () => {
                    const finalTop = parseInt(block.style.top);
                    const finalPitch = PIXEL_TO_NOTE[finalTop];
                    if (finalPitch) melody.notes[nIdx].pitches[pIdx] = finalPitch;
                    document.removeEventListener('mousemove', move);
                    document.removeEventListener('mouseup', up);
                };
                document.addEventListener('mousemove', move);
                document.addEventListener('mouseup', up);
            };
            canvas.appendChild(block);
        });
        currentX += (note.duration || 1) * pixelsPerBeat;
    });

    canvas.style.width = `${currentX}px`;
    playhead.style.display = 'block';
    playhead.style.setProperty('--scroll-width', `${currentX}px`);
    
    // --- ANIMATION CALCULATION (Only declared once now!) ---
    const secs = (currentX / pixelsPerBeat * 60) / melody.tempo;
    playhead.style.animation = 'none';
    playhead.offsetHeight; 
    playhead.style.animation = `movePlayhead ${secs}s linear forwards`;

    // --- THE SMART FOLLOW-CAM ---
    let animationFrameId: number;

    const sync = () => {
        const st = window.getComputedStyle(playhead);
        const tr = st.transform || (st as any).webkitTransform;
        let x = 0;
        if (tr && tr !== 'none') {
            const match = tr.match(/matrix\((?:[^,]+, ){4}([^,]+),/);
            if (match) x = parseFloat(match[1]);
        }
        
        // Keep the playhead in the center of the screen
        viewport.scrollLeft = x - (viewport.clientWidth / 2);
        
        // Keep the loop going while playing
        animationFrameId = requestAnimationFrame(sync);
    };

    // 1. Start tracking the camera
    animationFrameId = requestAnimationFrame(sync);

    // 2. Stop tracking the exact moment the song finishes
    playhead.onanimationend = () => {
        cancelAnimationFrame(animationFrameId);
        console.log("Playback finished. Scroll unlocked!");
    };
}