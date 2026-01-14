// Feature Gating based on hardware capabilities
// Determines which multimodal features can be enabled based on VRAM, RAM, etc.

import { HardwareDiagnostics, type HardwareProfile, type Feature } from '../utils/hardware-diagnostics';
import { HardwareDiagnosticsLogger } from '../utils/hardware-diagnostics-logger';

export interface FeatureGateResult {
    enabled: boolean;
    reason?: string;
    requirements?: {
        minVRAM: number;
        actualVRAM: number;
    };
}

export class FeatureGate {
    private hardwareProfile: HardwareProfile | null = null;
    private initialized: boolean = false;

    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        this.hardwareProfile = await HardwareDiagnostics.detectCapabilities();
        this.initialized = true;

        // Log feature gate decisions during initialization
        const features: Feature[] = ['text-chat', 'image-generation', 'vision', 'speech', 'video'];
        for (const feature of features) {
            const result = await this.canEnableFeature(feature);
            HardwareDiagnosticsLogger.logFeatureGateDecision(feature, result.enabled, result.reason);
        }
    }

    async canEnableFeature(feature: Feature): Promise<FeatureGateResult> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.hardwareProfile) {
            return {
                enabled: false,
                reason: 'Hardware profile not available'
            };
        }

        const requirements = HardwareDiagnostics.getFeatureRequirements(feature);
        const canSupport = HardwareDiagnostics.canSupport(feature, this.hardwareProfile);

        if (!canSupport) {
            // Determine specific reason for failure
            let reason = 'Hardware requirements not met';

            // Handle null RAM case
            if (this.hardwareProfile.ram === null) {
                reason = 'RAM detection unavailable - cannot verify requirements';
            } else if (this.hardwareProfile.ram < requirements.minRAM) {
                reason = `Insufficient RAM: ${this.hardwareProfile.ram} GB available, ${requirements.minRAM} GB required`;
            } else if (this.hardwareProfile.gpuVRAM < requirements.minVRAM) {
                reason = `Insufficient VRAM: ${this.hardwareProfile.gpuVRAM.toFixed(1)} GB available, ${requirements.minVRAM} GB required`;
            } else if (!this.hardwareProfile.webGPUSupported && requirements.requiresWebGPU) {
                reason = 'WebGPU not supported in this browser';
            } else if (this.hardwareProfile.storageAvailable < requirements.minStorage) {
                reason = `Insufficient storage: ${this.hardwareProfile.storageAvailable.toFixed(1)} GB available, ${requirements.minStorage} GB required`;
            }

            return {
                enabled: false,
                reason,
                requirements: {
                    minVRAM: requirements.minVRAM,
                    actualVRAM: this.hardwareProfile.gpuVRAM
                }
            };
        }

        return {
            enabled: true
        };
    }

    async getImageGenerationGate(): Promise<FeatureGateResult> {
        return this.canEnableFeature('image-generation');
    }

    async getVisionGate(): Promise<FeatureGateResult> {
        return this.canEnableFeature('vision');
    }

    async getSpeechGate(): Promise<FeatureGateResult> {
        return this.canEnableFeature('speech');
    }

    getHardwareProfile(): HardwareProfile | null {
        return this.hardwareProfile;
    }

    async refreshHardwareProfile(): Promise<void> {
        HardwareDiagnostics.clearCache();
        this.hardwareProfile = await HardwareDiagnostics.detectCapabilities();
    }
}
