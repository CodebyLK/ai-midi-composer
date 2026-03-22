export class AudioRecorder {
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];

    // This checks if the browser supports recording and asks for the mic
    async setup() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);

            // As audio comes in, save the chunks of data
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
        this.audioChunks = []; // Clear any old recordings
        this.mediaRecorder.start();
    }

    // Returns a Promise with the final Audio File URL when stopped
    stop(): Promise<string> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder) return resolve("");

            this.mediaRecorder.onstop = () => {
                // Combine the chunks into a single audio file (WebM format)
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
                const audioUrl = URL.createObjectURL(audioBlob);
                resolve(audioUrl);
            };

            this.mediaRecorder.stop();
        });
    }
}