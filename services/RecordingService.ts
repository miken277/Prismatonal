import { audioEngine } from './AudioEngine';

class RecordingService {
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];
    private stream: MediaStream | null = null;
    private audioDest: MediaStreamAudioDestinationNode | null = null;
    
    public isRecording: boolean = false;

    constructor() {}

    /**
     * Start audio recording from the synth engine.
     * @returns Promise that resolves when recording successfully starts
     */
    public async startRecording(): Promise<void> {
        this.recordedChunks = [];
        this.isRecording = true;

        try {
            await this.startAudioCapture();
        } catch (error) {
            this.isRecording = false;
            throw error;
        }
    }

    private async startAudioCapture() {
        const ctx = audioEngine.getContext();
        if (!ctx) {
            // Ensure audio is initialized
            await audioEngine.init();
        }
        
        const context = audioEngine.getContext();
        if (!context) throw new Error("Audio Context not available");

        // Create destination node if needed
        if (!this.audioDest) {
            this.audioDest = context.createMediaStreamDestination();
        }
        
        // Connect engine output to our recorder destination
        audioEngine.connectToRecordingDestination(this.audioDest);
        
        this.stream = this.audioDest.stream;
        this.setupMediaRecorder(this.stream, 'audio/webm;codecs=opus');
    }

    private setupMediaRecorder(stream: MediaStream, mimeTypePreference: string) {
        let mimeType = mimeTypePreference;
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/mp4';
            if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'audio/webm'; 
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

        this.mediaRecorder.start(100); 
    }

    public stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        this.isRecording = false;
        
        // We do NOT stop tracks here for internal audio destination, 
        // as that might kill the node for future use or cause context issues.
        // But we should disconnect from the engine to save CPU if necessary?
        // AudioEngine.connectToRecordingDestination adds a connection. 
        // Ideally we disconnect it, but the Web Audio API handles fan-out fine.
        // Let's leave it connected or manage disconnection in AudioEngine if strict resource management is needed.
    }

    private finalizeRecording() {
        if (this.recordedChunks.length === 0) return;

        const blob = new Blob(this.recordedChunks, {
            type: this.mediaRecorder?.mimeType || 'audio/webm'
        });
        
        // Default extension based on mime
        const ext = blob.type.includes('mp4') ? 'm4a' : 'webm'; 
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `PrismaTonal_Audio_${timestamp}.${ext}`;

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