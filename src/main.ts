import './style.css'
import { setupUI } from './ui/app';
import { AudioRecorder } from './audio/recorder';

// Initialize the application once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // 1. Create the recorder instance from your audio/recorder.ts file
    const recorder = new AudioRecorder();

    // 2. Pass it to setupUI to satisfy the "Expected 1 arguments" requirement
    setupUI(recorder);

    console.log("🎹 Application initialized: Recorder linked to UI.");
});