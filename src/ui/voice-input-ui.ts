// Voice Input UI for audio capture and transcription
// Handles microphone access, recording, and ASR integration

import { InferenceWorkerManager, type WorkerHandle, type InferenceTask } from '../core/inference-worker-manager';
import { notify } from './notification-api';

export interface VoiceInputCallbacks {
    onTranscription: (text: string) => void;
}

export class VoiceInputUI {
    private container: HTMLElement;
    private voiceButton: HTMLButtonElement;
    private recordingIndicator: HTMLElement | null = null;
    private callbacks: VoiceInputCallbacks;
    private workerManager: InferenceWorkerManager;
    private workerHandle: WorkerHandle | null = null;
    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private isRecording: boolean = false;
    private isProcessing: boolean = false;

    constructor(container: HTMLElement, callbacks: VoiceInputCallbacks, workerManager: InferenceWorkerManager) {
        this.container = container;
        this.callbacks = callbacks;
        this.workerManager = workerManager;

        this.voiceButton = this.createVoiceButton();
        this.container.appendChild(this.voiceButton);

        this.setupEventListeners();
    }

    private createVoiceButton(): HTMLButtonElement {
        const button = document.createElement('button');
        button.className = `
            p-2
            bg-blue-500 hover:bg-blue-600 active:bg-blue-700
            text-white
            rounded-lg border-none
            cursor-pointer transition-colors
            focus:outline-2 focus:outline-blue-500
            disabled:opacity-50 disabled:cursor-not-allowed
        `;
        button.setAttribute('aria-label', 'Voice input');
        button.setAttribute('title', 'Click to start voice input');
        button.innerHTML = '🎤';

        return button;
    }

    private setupEventListeners(): void {
        this.voiceButton.addEventListener('click', () => {
            if (this.isRecording) {
                this.stopRecording();
            } else {
                this.startRecording();
            }
        });
    }

    private async startRecording(): Promise<void> {
        try {
            // Request microphone permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Create media recorder
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                // Stop all tracks
                stream.getTracks().forEach(track => track.stop());

                // Process the recorded audio
                await this.processRecording();
            };

            // Start recording
            this.mediaRecorder.start();
            this.isRecording = true;

            // Update UI
            this.showRecordingIndicator();
            this.voiceButton.innerHTML = '⏹️';
            this.voiceButton.setAttribute('title', 'Click to stop recording');
            this.voiceButton.className = this.voiceButton.className.replace('bg-blue-500', 'bg-red-500')
                .replace('hover:bg-blue-600', 'hover:bg-red-600')
                .replace('active:bg-blue-700', 'active:bg-red-700');

            notify({
                type: 'info',
                title: 'Recording Started',
                message: 'Speak now. Click the button again to stop recording.'
            });
        } catch (error) {
            console.error('Failed to start recording:', error);

            if (error instanceof Error && error.name === 'NotAllowedError') {
                notify({
                    type: 'error',
                    title: 'Microphone Permission Denied',
                    message: 'Please grant microphone access to use voice input.'
                });
            } else {
                notify({
                    type: 'error',
                    title: 'Recording Failed',
                    message: `Unable to start recording: ${error instanceof Error ? error.message : String(error)}`
                });
            }
        }
    }

    private stopRecording(): void {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;

            // Update UI
            this.hideRecordingIndicator();
            this.voiceButton.innerHTML = '🎤';
            this.voiceButton.setAttribute('title', 'Click to start voice input');
            this.voiceButton.className = this.voiceButton.className.replace('bg-red-500', 'bg-blue-500')
                .replace('hover:bg-red-600', 'hover:bg-blue-600')
                .replace('active:bg-red-700', 'active:bg-blue-700');
        }
    }

    private async processRecording(): Promise<void> {
        if (this.audioChunks.length === 0) {
            notify({
                type: 'warning',
                title: 'No Audio Recorded',
                message: 'No audio was captured. Please try again.'
            });
            return;
        }

        this.isProcessing = true;
        this.voiceButton.disabled = true;

        try {
            // Combine audio chunks into a single blob
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

            // Convert blob to ArrayBuffer
            const audioBuffer = await audioBlob.arrayBuffer();

            // Initialize ASR worker if not already done
            if (!this.workerHandle) {
                notify({
                    type: 'info',
                    title: 'Initializing Speech Recognition',
                    message: 'Loading Whisper model...'
                });

                this.workerHandle = await this.workerManager.initializeWorker('speech-asr');
            }

            // Run transcription
            notify({
                type: 'info',
                title: 'Transcribing Audio',
                message: 'Processing your speech...'
            });

            const task: InferenceTask = {
                type: 'speech-asr',
                input: audioBuffer,
                parameters: {
                    language: 'auto'
                }
            };

            const result = await this.workerManager.runInference(this.workerHandle, task);

            // Extract transcription from result
            const transcription = typeof result.output === 'string' ? result.output : '';

            if (transcription.trim()) {
                // Insert transcription into input field
                this.callbacks.onTranscription(transcription);

                notify({
                    type: 'info',
                    title: 'Transcription Complete',
                    message: 'Your speech has been converted to text.'
                });
            } else {
                notify({
                    type: 'warning',
                    title: 'No Speech Detected',
                    message: 'Unable to transcribe audio. Please try again.'
                });
            }
        } catch (error) {
            console.error('Transcription failed:', error);
            notify({
                type: 'error',
                title: 'Transcription Failed',
                message: `Unable to transcribe audio: ${error instanceof Error ? error.message : String(error)}`
            });
        } finally {
            this.isProcessing = false;
            this.voiceButton.disabled = false;
            this.audioChunks = [];
        }
    }

    private showRecordingIndicator(): void {
        if (this.recordingIndicator) {
            this.recordingIndicator.classList.remove('hidden');
            return;
        }

        this.recordingIndicator = document.createElement('div');
        this.recordingIndicator.className = `
            flex items-center gap-2
            px-3 py-2
            bg-red-50 border border-red-200
            rounded-lg
            text-sm text-red-700
        `;

        const pulseIndicator = document.createElement('div');
        pulseIndicator.className = `
            w-3 h-3
            bg-red-500
            rounded-full
            animate-pulse
        `;

        const text = document.createElement('span');
        text.textContent = 'Recording...';

        this.recordingIndicator.appendChild(pulseIndicator);
        this.recordingIndicator.appendChild(text);

        // Insert before voice button
        this.container.insertBefore(this.recordingIndicator, this.voiceButton);
    }

    private hideRecordingIndicator(): void {
        if (this.recordingIndicator) {
            this.recordingIndicator.classList.add('hidden');
        }
    }

    /**
     * Clean up resources
     */
    cleanup(): void {
        if (this.isRecording) {
            this.stopRecording();
        }

        if (this.workerHandle) {
            this.workerManager.terminateWorker(this.workerHandle);
            this.workerHandle = null;
        }
    }

    /**
     * Check if voice input is currently recording
     */
    isCurrentlyRecording(): boolean {
        return this.isRecording;
    }

    /**
     * Check if voice input is currently processing
     */
    isCurrentlyProcessing(): boolean {
        return this.isProcessing;
    }
}
