export class AudioRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];

    async setup() {
        try {
            // 🛡️ CRITICAL FIX: Turn off voice filters for pure music recording
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false,
                    channelCount: 1 // Mono is better for pitch detection
                }
            });

            this.mediaRecorder = new MediaRecorder(stream);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            return true;
        } catch (err) {
            console.error("Microphone access denied or not available:", err);
            return false;
        }
    }

    start() {
        if (!this.mediaRecorder) return;
        this.audioChunks = [];
        this.mediaRecorder.start();
    }

    stop(): Promise<string> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder) return resolve("");

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                resolve(audioUrl);
            };

            this.mediaRecorder.stop();
        });
    }
}