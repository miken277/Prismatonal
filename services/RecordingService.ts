
import { audioEngine } from './AudioEngine';

export type RecordingMode = 'video-audio' | 'audio-only';

class RecordingService {
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];
    private stream: MediaStream | null = null;
    private audioDest: MediaStreamAudioDestinationNode | null = null;
    
    public isRecording: boolean = false;

    constructor() {}

    /**
     * Start recording based on the selected mode.
     * @param mode 'video-audio' uses getDisplayMedia, 'audio-only' uses WebAudio API
     * @returns Promise that resolves when recording successfully starts
     */
    public async startRecording(mode: RecordingMode): Promise<void> {
        this.recordedChunks = [];
        this.isRecording = true;

        try {
            if (mode === 'video-audio') {
                await this.startScreenCapture();
            } else {
                await this.startAudioCapture();
            }
        } catch (error) {
            console.error("Failed to start recording:", error);
            this.isRecording = false;
            throw error;
        }
    }

    private async startScreenCapture() {
        // "Hardware capture" for Audio+Visual
        // This prompts the user to share a tab or screen.
        // Important: User must select "Share Audio" in the browser dialog for system audio to be captured.
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                displaySurface: "browser", // Prefer tab sharing
            } as MediaTrackConstraints, 
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        this.stream = displayStream;
        this.setupMediaRecorder(this.stream, 'video/webm;codecs=vp9,opus');
    }

    private async startAudioCapture() {
        // "Hardware capture" equivalent for Audio Only
        // Creates a virtual destination node in the Web Audio graph
        const ctx = audioEngine.getContext();
        if (!ctx) {
            // Ensure audio is initialized
            await audioEngine.init();
        }
        
        const context = audioEngine.getContext();
        if (!context) throw new Error("Audio Context not available");

        this.audioDest = context.createMediaStreamDestination();
        audioEngine.connectToRecordingDestination(this.audioDest);
        
        this.stream = this.audioDest.stream;
        this.setupMediaRecorder(this.stream, 'audio/webm;codecs=opus');
    }

    private setupMediaRecorder(stream: MediaStream, mimeTypePreference: string) {
        // Check supported types
        let mimeType = mimeTypePreference;
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            // Fallback
            if (mimeType.startsWith('video')) {
                mimeType = 'video/mp4';
                if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
            } else {
                mimeType = 'audio/mp4';
                if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm'; 
            }
        }

        this.mediaRecorder = new MediaRecorder(stream, { mimeType });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            this.finalizeRecording();
        };

        // If the user stops sharing via the browser UI, stop the recorder
        stream.getVideoTracks().forEach(track => {
            track.onended = () => {
                if (this.isRecording) this.stopRecording();
            };
        });

        this.mediaRecorder.start(100); // Collect chunks every 100ms
    }

    public stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
        }
        
        // Stop all tracks to release hardware/indicator
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        
        // Disconnect audio node if used
        if (this.audioDest) {
            this.audioDest.disconnect();
            this.audioDest = null;
        }
    }

    private finalizeRecording() {
        if (this.recordedChunks.length === 0) return;

        const blob = new Blob(this.recordedChunks, {
            type: this.mediaRecorder?.mimeType || 'video/webm'
        });
        
        const isVideo = blob.type.startsWith('video');
        const ext = isVideo ? 'webm' : 'webm'; // Browser MediaRecorder mostly outputs webm containers
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `PrismaTonal_Performance_${timestamp}.${ext}`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        a.click();
        
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
}

export const recordingService = new RecordingService();
