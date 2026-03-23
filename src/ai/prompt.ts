import type { Note } from '../types';

export async function generateMelody(userInput: string, tempo: number, length: string): Promise<Note[]> {
    const systemPrompt = `
    You are an expert composer. Generate a progression based on: "${userInput}". 
    CRITICAL: The composition must be ${length} long at ${tempo} BPM.
    Return ONLY a JSON array of notes. No conversational text.
    Each note MUST include: "pitches" (string[]), "duration" (number in beats), "startTime" (number in beats), and "velocity" (0-127).
    Example: [{"pitches":["C4"],"duration":1,"startTime":0,"velocity":100}]
  `;

    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

    // RESTORED: Back to your original gemini-2.5-flash model!
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }] })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(`${data.error?.message || response.statusText}`);

    const rawContent = data.candidates[0].content.parts[0].text;

    // Force the parser to ONLY grab what is inside the array brackets
    const match = rawContent.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("AI did not return a valid JSON array.");

    return JSON.parse(match[0]);
}