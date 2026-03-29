# AI Composer Pro

A browser-based, enterprise-grade MIDI sequencer and AI composition assistant. This application allows users to generate multi-track musical arrangements using generative AI, manually edit notes via a theory-aware Piano Roll, and transcribe live audio into MIDI data.

## 🚀 Core Features
* **AI-Assisted Arranger:** Leverages the Gemini 2.5 Flash API to generate musical progressions based on text prompts. Supports appending sections to build full-length songs.
* **Theory-Aware Piano Roll:** A custom-built visualizer canvas with a locked Y-axis keyboard. Includes a "Chord Stamper" tool that calculates and draws Major/Minor triads and octaves on the fly.
* **Audio-to-MIDI Transcription:** Uses `@spotify/basic-pitch` and TensorFlow.js to record live piano audio and convert it into quantized, editable MIDI blocks.
* **Take Manager (Version Control):** Automatically snapshots the workspace state before destructive actions. Users can safely rename, delete, and restore previous takes.
* **MIDI Export:** Compiles the browser-based visualizer data into an industry-standard `.mid` file via `midi-writer-js`, preserving instrument assignments and exact timing.

## 🛠️ Tech Stack
* **Frontend:** HTML5, CSS3 (Custom Variables), Vanilla TypeScript
* **Audio Engine:** Web Audio API (Procedural Synths & Reverb)
* **Machine Learning:** Google Gemini API, TensorFlow.js (WASM backend)
* **Build Tool:** Vite

## 📦 Setup & Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   VITE_GEMINI_API_KEY="your_api_key_here"
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## 🧠 Architecture Notes
State management is handled entirely via `localStorage`, ensuring the workspace is resilient to accidental browser refreshes. The UI is decoupled from the `synth.ts` audio engine, allowing the visualizer to mathematically calculate note geometry independently of playback timing.


