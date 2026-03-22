import type { Melody } from '../types';

export async function generateMelody(userInput: string, tempo: number, length: string): Promise<Melody> {
  const systemPrompt = `
    You are an expert composer.
    Generate a musical progression based on: "${userInput}". 
    
    CRITICAL RULES:
    1. The composition MUST be exactly ${length} long.
    2. The tempo MUST be exactly ${tempo} BPM.
    3. DO NOT include any comments (like // or /* */) in your response. Return pure, valid JSON only.
    
    You MUST return ONLY valid JSON matching this exact structure: 
    { "tempo": number, "key": string, "notes": [{ "pitches": string[], "duration": number, "velocity": number }] }
    
    Tip: To play a chord, put multiple notes in the "pitches" array like ["C4", "E4", "G4"]. For a single melody note, use one like ["C4"].
  `;

  // (Paste your AIza... key back in here!)
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{ 
        parts: [{ text: systemPrompt }] 
      }]
    })
  });

  const data = await response.json();

  if (!response.ok) {
      throw new Error(`Gemini API Error: ${data.error?.message || response.statusText}`);
  }

  const rawContent = data.candidates[0].content.parts[0].text;
  
  // 1. Remove markdown tags
  let cleanedContent = rawContent.replace(/```json|```/gi, '').trim();
  
  // 2. NEW: Scrub out any single-line comments (//) the AI might have snuck in
  cleanedContent = cleanedContent.replace(/\/\/.*$/gm, '');

  // 3. Parse the safely cleaned text
  const parsedMelody: Melody = JSON.parse(cleanedContent);
  
  return parsedMelody;
}