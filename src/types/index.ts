export interface Note {
    pitches: string[];
    duration: number;
    startTime: number; // Added for the timeline
    velocity: number;  // Restored from your original
}

export interface Track {
    id: string;
    name: string;
    instrument: number;
    notes: Note[];
    volume: number;
    isMuted: boolean;
}

export interface Project {
    name?: string; // 🛡️ ADDED: Allows custom names for the history cabinet
    tempo: number;
    key: string;
    tracks: Track[];
}