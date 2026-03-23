import MidiWriter from 'midi-writer-js';
import type { Project, Note, Track } from '../types';

export function downloadMidi(project: Project, filename = 'ai-composition.mid') {
    const writerTracks: any[] = [];

    // Loop through every track (Piano, Bass, etc.) to create a multi-track MIDI
    project.tracks.forEach((trackData: Track) => {
        const midiTrack = new MidiWriter.Track();
        midiTrack.setTempo(project.tempo);

        // Set the instrument for this specific MIDI track
        midiTrack.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: trackData.instrument }));

        trackData.notes.forEach((note: Note) => {
            midiTrack.addEvent(new MidiWriter.NoteEvent({
                pitch: note.pitches,
                duration: `T${note.duration * 128}`, // High-resolution ticks
                startTick: note.startTime * 128,    // Essential for timeline positioning
                velocity: note.velocity || 100
            }));
        });
        writerTracks.push(midiTrack);
    });

    const writer = new MidiWriter.Writer(writerTracks);
    const link = document.createElement('a');
    link.href = writer.dataUri();
    link.download = filename;
    link.click();
}