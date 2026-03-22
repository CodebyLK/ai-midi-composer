export interface Note {
  pitches: string[]; // e.g., ["C4", "E4", "G4"] for a chord, or ["C4"] for a single note
  duration: number;  // e.g., 1 (quarter note), 0.5 (eighth note)
  velocity: number;  // 0 to 127
}

export interface Melody {
  tempo: number;
  key: string;
  notes: Note[];
}