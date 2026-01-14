// Audio Playback UI for TTS output
// Handles text-to-speech generation and audio playback

import { InferenceWorkerManager, type WorkerHandle, type InferenceTask } from '../core/inference-worker-manager';
import { notify } from './notification-api';

export class AudioPlaybackUI {
    private container: HTMLElement;
    private playButton: HTMLButtonElement | null = null;
    private audioElement: HTMLAudioElement | null = null;
    private workerManager: InferenceWorkerManager;
    private workerHandle: WorkerHandle | null = null;
    private isPlaying: boolean = false;
    private isGenerating: boolean = false;
    private currentAudioUrl: string | null = null;

    constructor(container: HTMLElement, workerManager: InferenceWorkerManager) {
        this.container = container;
        this.workerManager = workerManager;
    }

    /**
     * Generate and play speech from text
     */
    async playText(text: string, voice: string = 'default'): Promise<void> {
        if (this.isGenerating) {
            notify({
                type: 'warning',
                title: 'Speech Generation In Progress',
                message: 'Please wait for the current speech to finish generating.'
            });
            return;
        }

        if (!text.trim()) {
            notify({
                type: 'warning',
                title: 'No Text to Speak',
                message: 'Please provide text to convert to speech.'
            });
            return;
        }

        this.isGenerating = true;

        try {
            // Initialize TTS worker if not already done
            if (!this.workerHandle) {
                notify({
                    type: 'info',
                    title: 'Initializing Text-to-Speech',
                    message: 'Loading Kokoro TTS model...'
                });

                this.workerHandle = await this.workerManager.initializeWorker('speech-tts');
            }

            // Run TTS inference
            notify({
                type: 'info',
                title: 'Generating Speech',
                message: 'Converting text to speech...'
            });

            const task: InferenceTask = {
                type: 'speech-tts',
                input: text,
                parameters: {
                    voice
                }
            };

            const result = await this.workerManager.runInference(this.workerHandle, task);

            // Extract audio blob from result
            const audioBlob = result.output instanceof Blob ? result.output : null;

            if (!audioBlob) {
                throw new Error('TTS did not return audio blob');
            }

            // Play the audio
            await this.playAudioBlob(audioBlob);

            notify({
                type: 'success',
                title: 'Speech Generated',
                message: 'Playing audio...'
            });
        } catch (error) {
            console.error('TTS failed:', error);
            notify({
                type: 'error',
                title: 'Speech Generation Failed',
                message: `Unable to generate speech: ${error instanceof Error ? error.message : String(error)}`
            });
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * Play audio from a blob
     */
    private async playAudioBlob(audioBlob: Blob): Promise<void> {
        // Clean up previous audio
        this.cleanup();

        // Create object URL for the audio blob
        this.currentAudioUrl = URL.createObjectURL(audioBlob);

        // Create audio element
        this.audioElement = new Audio(this.currentAudioUrl);

        // Set up event listeners
        this.audioElement.addEventListener('play', () => {
            this.isPlaying = true;
            this.updatePlayButton();
        });

        this.audioElement.addEventListener('pause', () => {
            this.isPlaying = false;
            this.updatePlayButton();
        });

        this.audioElement.addEventListener('ended', () => {
            this.isPlaying = false;
            this.updatePlayButton();
            this.cleanup();
        });

        this.audioElement.addEventListener('error', (error) => {
            console.error('Audio playback error:', error);
            notify({
                type: 'error',
                title: 'Playback Failed',
                message: 'Unable to play audio.'
            });
            this.cleanup();
        });

        // Create playback controls
        this.createPlaybackControls();

        // Auto-play the audio
        try {
            await this.audioElement.play();
        } catch (error) {
            console.error('Auto-play failed:', error);
            notify({
                type: 'info',
                title: 'Audio Ready',
                message: 'Click the play button to hear the speech.'
            });
        }
    }

    /**
     * Create playback controls UI
     */
    private createPlaybackControls(): void {
        if (this.playButton) {
            return;
        }

        const controlsContainer = document.createElement('div');
        controlsContainer.className = `
            flex items-center gap-2
            px-3 py-2
            bg-blue-50 border border-blue-200
            rounded-lg
        `;

        this.playButton = document.createElement('button');
        this.playButton.className = `
            p-2
            bg-blue-500 hover:bg-blue-600 active:bg-blue-700
            text-white
            rounded-lg border-none
            cursor-pointer transition-colors
            focus:outline-2 focus:outline-blue-500
        `;
        this.playButton.innerHTML = '▶️';
        this.playButton.setAttribute('aria-label', 'Play audio');
        this.playButton.setAttribute('title', 'Play/Pause audio');

        this.playButton.addEventListener('click', () => {
            this.togglePlayback();
        });

        const label = document.createElement('span');
        label.className = 'text-sm text-blue-700';
        label.textContent = 'Audio playback';

        controlsContainer.appendChild(this.playButton);
        controlsContainer.appendChild(label);

        this.container.appendChild(controlsContainer);
    }

    /**
     * Toggle audio playback
     */
    private togglePlayback(): void {
        if (!this.audioElement) {
            return;
        }

        if (this.isPlaying) {
            this.audioElement.pause();
        } else {
            this.audioElement.play().catch(error => {
                console.error('Playback failed:', error);
                notify({
                    type: 'error',
                    title: 'Playback Failed',
                    message: 'Unable to play audio.'
                });
            });
        }
    }

    /**
     * Update play button state
     */
    private updatePlayButton(): void {
        if (!this.playButton) {
            return;
        }

        if (this.isPlaying) {
            this.playButton.innerHTML = '⏸️';
            this.playButton.setAttribute('aria-label', 'Pause audio');
        } else {
            this.playButton.innerHTML = '▶️';
            this.playButton.setAttribute('aria-label', 'Play audio');
        }
    }

    /**
     * Stop playback and clean up resources
     */
    cleanup(): void {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement.src = '';
            this.audioElement = null;
        }

        if (this.currentAudioUrl) {
            URL.revokeObjectURL(this.currentAudioUrl);
            this.currentAudioUrl = null;
        }

        if (this.playButton) {
            this.playButton.remove();
            this.playButton = null;
        }

        this.isPlaying = false;
    }

    /**
     * Clean up worker resources
     */
    cleanupWorker(): void {
        this.cleanup();

        if (this.workerHandle) {
            this.workerManager.terminateWorker(this.workerHandle);
            this.workerHandle = null;
        }
    }

    /**
     * Check if audio is currently playing
     */
    isCurrentlyPlaying(): boolean {
        return this.isPlaying;
    }

    /**
     * Check if speech is currently being generated
     */
    isCurrentlyGenerating(): boolean {
        return this.isGenerating;
    }
}
