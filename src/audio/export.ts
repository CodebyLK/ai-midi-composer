import MidiWriter from 'midi-writer-js';
import type { Melody, Note } from '../types';

function getMidiDuration(beats: number): string {
    const midiDur = Math.round(4 / beats);
    return midiDur.toString();
}

// NEW: We added `instrumentNumber` as an argument, defaulting to 1 (Piano)
export function downloadMidi(melody: Melody, instrumentNumber: number = 1, filename = 'ai-composer.mid') {
    const track = new MidiWriter.Track();

    track.setTempo(melody.tempo);

    // NEW: Inject the Program Change Event to set the instrument
    track.addEvent(new MidiWriter.ProgramChangeEvent({ instrument: instrumentNumber }));

    melody.notes.forEach((note: Note) => {
        const durationInBeats = note.duration || 1;
        const midiDuration = getMidiDuration(durationInBeats);

        const midiEvent = new MidiWriter.NoteEvent({
            pitch: note.pitches,
            duration: midiDuration,
            velocity: note.velocity || 100
        });

        track.addEvent(midiEvent);
    });

    const write = new MidiWriter.Writer(track);
    const base64String = write.base64();

    const uri = 'data:audio/midi;base64,' + base64String;
    const link = document.createElement('a');
    link.href = uri;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}