import { HardwareDiagnosticsLogger } from './hardware-diagnostics-logger';

export interface HardwareProfile {
    ram: number | null;       // GB, null if unknown
    ramDetectionMethod: 'deviceMemory' | 'performance' | 'manual' | 'unknown';
    ramActual?: number;       // User-specified actual RAM if different from detected
    cpuCores: number;
    storageAvailable: number; // GB, 0 means unknown not "no storage"
    storageDetectionMethod: 'estimate' | 'fallback' | 'unknown';
    gpuVRAM: number;          // GB (estimated)
    webGPUSupported: boolean;
    gpuPerformanceScore: number; // 0-100
    browserName: string;      // Chrome, Brave, Firefox, Edge, Safari
    timestamp: number;        // When profile was created
}

export type Feature = 'text-chat' | 'image-generation' | 'vision' | 'speech' | 'video';

export interface FeatureSettings {
    enabledFeatures: Feature[];
    imageResolution: '512x512' | '768x768' | '1024x1024';
    maxContextLength: number;
}

export interface FeatureRequirements {
    minRAM: number;           // GB
    minVRAM: number;          // GB
    minCPUCores: number;
    minStorage: number;       // GB
    requiresWebGPU: boolean;
}

export class HardwareDiagnostics {
    private static readonly CACHE_KEY = 'hardware-profile-cache';
    private static readonly CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

    private static readonly FEATURE_REQUIREMENTS: Record<Feature, FeatureRequirements> = {
        'text-chat': {
            minRAM: 4,
            minVRAM: 0,
            minCPUCores: 2,
            minStorage: 0, // Text chat should always be available
            requiresWebGPU: false
        },
        'image-generation': {
            minRAM: 8,
            minVRAM: 4,
            minCPUCores: 4,
            minStorage: 10,
            requiresWebGPU: true
        },
        'vision': {
            minRAM: 6,
            minVRAM: 2,
            minCPUCores: 4,
            minStorage: 5,
            requiresWebGPU: true
        },
        'speech': {
            minRAM: 4,
            minVRAM: 1,
            minCPUCores: 2,
            minStorage: 3,
            requiresWebGPU: true
        },
        'video': {
            minRAM: 16,
            minVRAM: 8,
            minCPUCores: 8,
            minStorage: 20,
            requiresWebGPU: true
        }
    };

    private static detectBrowserName(): string {
        const userAgent = navigator.userAgent;

        // Check for Brave first (it contains Chrome but is Brave)
        if ((navigator as any).brave !== undefined) {
            return 'Brave';
        }

        // Check for Edge
        if (userAgent.includes('Edg/')) {
            return 'Edge';
        }

        // Check for Chrome
        if (userAgent.includes('Chrome/')) {
            return 'Chrome';
        }

        // Check for Firefox
        if (userAgent.includes('Firefox/')) {
            return 'Firefox';
        }

        // Check for Safari
        if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/')) {
            return 'Safari';
        }

        return 'Unknown';
    }


    static async detectCapabilities(): Promise<HardwareProfile> {
        console.log('[Hardware Detection] Starting capability detection...');

        // Check cache first
        const cached = this.getCachedProfile();
        if (cached) {
            console.log('[Hardware Detection] Using cached profile from:', new Date(cached.timestamp).toISOString());
            console.log('[Hardware Detection] Cached storage:', cached.storageAvailable, 'GB');
            console.log('[Hardware Detection] To force re-detection, run: localStorage.removeItem("hardware-profile-cache")');
            return cached;
        }

        console.log('[Hardware Detection] No cache found, running fresh detection...');

        // Detect browser name first for logging
        const browserName = this.detectBrowserName();
        console.log('[Hardware Detection] Browser:', browserName);

        // Detect RAM (Requirement 1.1)
        let ram: number | null = null;
        let ramDetectionMethod: 'deviceMemory' | 'performance' | 'manual' | 'unknown' = 'unknown';
        if ((navigator as any).deviceMemory) {
            ram = (navigator as any).deviceMemory;
            ramDetectionMethod = 'deviceMemory';
            console.log(`[RAM Detection] navigator.deviceMemory reports ${ram} GB`);
            if (ram !== null && ram >= 8) {
                console.warn(`[RAM Detection] ⚠️ API is capped at 8GB. Actual RAM may be higher (16GB, 32GB, etc.)`);
                console.warn(`[RAM Detection] This is a browser privacy limitation, not a bug.`);
            }
        } else {
            console.log(`[RAM Detection] navigator.deviceMemory not available in this browser`);
        }

        // Check for manual override
        const manualRAM = this.getManualRAMOverride();
        if (manualRAM !== null) {
            console.log(`[RAM Detection] ✓ Using manual override: ${manualRAM} GB (detected: ${ram ?? 'unknown'} GB)`);
            ramDetectionMethod = 'manual';
        }

        HardwareDiagnosticsLogger.logHardwareCheck('RAM Detection', ram ?? 'unknown', ramDetectionMethod, browserName);

        // Detect CPU cores (Requirement 6.2)
        const cpuCores = navigator.hardwareConcurrency || 2; // Default to 2 cores
        HardwareDiagnosticsLogger.logHardwareCheck('CPU Cores', cpuCores, 'hardwareConcurrency', browserName);

        // Detect available storage (Requirement 6.3)
        const { storageAvailable, storageDetectionMethod } = await this.detectStorage();
        HardwareDiagnosticsLogger.logHardwareCheck('Storage Available', `${storageAvailable.toFixed(1)} GB`, storageDetectionMethod, browserName);

        // Detect GPU VRAM and WebGPU support (Requirement 6.4)
        const { gpuVRAM, webGPUSupported } = await this.detectGPU();
        HardwareDiagnosticsLogger.logHardwareCheck('GPU VRAM', `${gpuVRAM.toFixed(1)} GB`, 'WebGPU adapter', browserName);
        HardwareDiagnosticsLogger.logHardwareCheck('WebGPU Support', webGPUSupported, 'navigator.gpu', browserName);

        // Benchmark GPU performance
        const gpuPerformanceScore = webGPUSupported ? await this.benchmarkGPU() : 0;
        HardwareDiagnosticsLogger.logHardwareCheck('GPU Performance Score', gpuPerformanceScore, 'compute benchmark', browserName);

        const profile: HardwareProfile = {
            ram: manualRAM !== null ? manualRAM : ram,
            ramDetectionMethod,
            ramActual: manualRAM !== null ? manualRAM : undefined,
            cpuCores,
            storageAvailable,
            storageDetectionMethod,
            gpuVRAM,
            webGPUSupported,
            gpuPerformanceScore,
            browserName,
            timestamp: Date.now()
        };

        // Log complete profile
        HardwareDiagnosticsLogger.logHardwareProfile(profile);

        // Cache the profile
        this.cacheProfile(profile);

        return profile;
    }


    static canSupport(feature: Feature, profile: HardwareProfile): boolean {
        const requirements = this.FEATURE_REQUIREMENTS[feature];

        // Treat null RAM as "unknown" - don't disable features based on unknown RAM
        // Only check RAM if it was successfully detected
        if (profile.ram !== null && profile.ram < requirements.minRAM) return false;
        if (profile.gpuVRAM < requirements.minVRAM) return false;
        if (profile.cpuCores < requirements.minCPUCores) return false;
        if (profile.storageAvailable < requirements.minStorage) return false;
        if (requirements.requiresWebGPU && !profile.webGPUSupported) return false;

        return true;
    }


    static getRecommendedSettings(profile: HardwareProfile): FeatureSettings {
        const enabledFeatures: Feature[] = [];

        // Check each feature
        for (const feature of Object.keys(this.FEATURE_REQUIREMENTS) as Feature[]) {
            if (this.canSupport(feature, profile)) {
                enabledFeatures.push(feature);
            }
        }

        // Determine image resolution based on VRAM
        let imageResolution: '512x512' | '768x768' | '1024x1024' = '512x512';
        if (profile.gpuVRAM >= 8) {
            imageResolution = '1024x1024';
        } else if (profile.gpuVRAM >= 6) {
            imageResolution = '768x768';
        }

        // Determine max context length based on RAM
        let maxContextLength = 2048;
        if (profile.ram !== null) {
            if (profile.ram >= 16) {
                maxContextLength = 8192;
            } else if (profile.ram >= 8) {
                maxContextLength = 4096;
            }
        }

        return {
            enabledFeatures,
            imageResolution,
            maxContextLength
        };
    }


    static getFeatureRequirements(feature: Feature): FeatureRequirements {
        return this.FEATURE_REQUIREMENTS[feature];
    }


    private static async detectStorage(): Promise<{ storageAvailable: number; storageDetectionMethod: 'estimate' | 'fallback' | 'unknown' }> {
        // Try navigator.storage.estimate first
        if (navigator.storage && navigator.storage.estimate) {
            try {
                // Request persistent storage to potentially increase quota
                if (navigator.storage.persist) {
                    await navigator.storage.persist();
                }

                const estimate = await navigator.storage.estimate();
                const quota = estimate.quota || 0;
                const usage = estimate.usage || 0;
                const availableBytes = quota - usage;
                const availableGB = availableBytes / (1024 ** 3);

                // Log the raw values for debugging
                console.log(`[Storage Detection] quota=${quota} bytes (${(quota / (1024 ** 3)).toFixed(2)} GB)`);
                console.log(`[Storage Detection] usage=${usage} bytes (${(usage / (1024 ** 3)).toFixed(2)} GB)`);
                console.log(`[Storage Detection] available=${availableBytes} bytes (${availableGB.toFixed(2)} GB)`);

                // If we got valid quota data, use it
                if (quota > 0 && availableBytes >= 0) {
                    return { storageAvailable: availableGB, storageDetectionMethod: 'estimate' };
                }

                // If quota is 0 but usage > 0, storage is working but quota API is restricted
                if (quota === 0 && usage > 0) {
                    console.log(`[Storage Detection] Quota API restricted but storage is working (usage=${usage})`);
                    // Estimate based on usage - if we're using storage, we have at least that much
                    const estimatedGB = Math.max(10, (usage / (1024 ** 3)) * 2); // Assume at least 2x current usage
                    return { storageAvailable: estimatedGB, storageDetectionMethod: 'fallback' };
                }

                // Handle negative available space (usage > quota)
                // This happens in Brave where quota API returns unrealistic values
                if (availableBytes < 0) {
                    console.warn(`[Storage Detection] Usage (${(usage / (1024 ** 3)).toFixed(2)} GB) exceeds quota (${(quota / (1024 ** 3)).toFixed(2)} GB)`);
                    console.warn(`[Storage Detection] This is a Brave browser issue - quota API is unreliable`);
                    // Storage is clearly working (we're using it!), estimate based on actual usage
                    const usageGB = usage / (1024 ** 3);
                    const estimatedGB = Math.max(50, usageGB * 2); // Assume at least 2x current usage available
                    console.log(`[Storage Detection] Estimating ${estimatedGB.toFixed(2)} GB available based on usage`);
                    return { storageAvailable: estimatedGB, storageDetectionMethod: 'fallback' };
                }

                // Quota is 0 and usage is 0 - try IndexedDB fallback
                console.log(`[Storage Detection] Quota API returned 0, trying IndexedDB fallback`);
            } catch (error) {
                console.error('[Storage Detection] navigator.storage.estimate failed:', error);
            }
        }

        // Fallback: Try to estimate from IndexedDB databases
        try {
            if (typeof indexedDB !== 'undefined' && indexedDB.databases) {
                const databases = await indexedDB.databases();
                console.log(`[Storage Detection] Found ${databases.length} IndexedDB databases`);

                if (databases.length > 0) {
                    // If we have databases, storage is working
                    // Estimate a reasonable amount based on typical browser quotas
                    console.log(`[Storage Detection] IndexedDB is working, estimating 50GB available`);
                    return { storageAvailable: 50, storageDetectionMethod: 'fallback' };
                }
            }
        } catch (error) {
            console.error('[Storage Detection] IndexedDB fallback failed:', error);
        }

        console.warn('[Storage Detection] All detection methods failed, returning 0');
        return { storageAvailable: 0, storageDetectionMethod: 'unknown' };
    }


    private static async detectGPU(): Promise<{ gpuVRAM: number; webGPUSupported: boolean }> {
        if (!navigator.gpu) {
            return { gpuVRAM: 0, webGPUSupported: false };
        }

        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                return { gpuVRAM: 0, webGPUSupported: false };
            }

            // Estimate VRAM based on maxBufferSize
            // This is a rough estimate: maxBufferSize is typically a fraction of total VRAM
            const maxBufferSize = adapter.limits.maxBufferSize;
            const estimatedVRAM = (maxBufferSize / (1024 ** 3)) * 4; // Multiply by 4 as heuristic

            return {
                gpuVRAM: Math.round(estimatedVRAM * 10) / 10,
                webGPUSupported: true
            };
        } catch (error) {
            console.error('Failed to detect GPU:', error);
            return { gpuVRAM: 0, webGPUSupported: false };
        }
    }


    private static async benchmarkGPU(): Promise<number> {
        if (!navigator.gpu) {
            return 0;
        }

        try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
                return 0;
            }

            const device = await adapter.requestDevice();

            // Simple compute benchmark: matrix multiplication
            const size = 256;
            const workgroupSize = 16;

            const shaderCode = `
                @group(0) @binding(0) var<storage, read> input: array<f32>;
                @group(0) @binding(1) var<storage, read_write> output: array<f32>;

                @compute @workgroup_size(${workgroupSize}, ${workgroupSize})
                fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
                    let index = global_id.y * ${size}u + global_id.x;
                    var sum: f32 = 0.0;
                    for (var i: u32 = 0u; i < ${size}u; i = i + 1u) {
                        sum = sum + input[global_id.y * ${size}u + i] * input[i * ${size}u + global_id.x];
                    }
                    output[index] = sum;
                }
            `;

            const shaderModule = device.createShaderModule({ code: shaderCode });

            // Create buffers
            const inputBuffer = device.createBuffer({
                size: size * size * 4,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
            });

            const outputBuffer = device.createBuffer({
                size: size * size * 4,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
            });

            // Create bind group layout and pipeline
            const bindGroupLayout = device.createBindGroupLayout({
                entries: [
                    { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                    { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }
                ]
            });

            const pipelineLayout = device.createPipelineLayout({
                bindGroupLayouts: [bindGroupLayout]
            });

            const pipeline = device.createComputePipeline({
                layout: pipelineLayout,
                compute: { module: shaderModule, entryPoint: 'main' }
            });

            const bindGroup = device.createBindGroup({
                layout: bindGroupLayout,
                entries: [
                    { binding: 0, resource: { buffer: inputBuffer } },
                    { binding: 1, resource: { buffer: outputBuffer } }
                ]
            });

            // Run benchmark
            const startTime = performance.now();

            const commandEncoder = device.createCommandEncoder();
            const passEncoder = commandEncoder.beginComputePass();
            passEncoder.setPipeline(pipeline);
            passEncoder.setBindGroup(0, bindGroup);
            passEncoder.dispatchWorkgroups(size / workgroupSize, size / workgroupSize);
            passEncoder.end();

            device.queue.submit([commandEncoder.finish()]);
            await device.queue.onSubmittedWorkDone();

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Cleanup
            inputBuffer.destroy();
            outputBuffer.destroy();
            device.destroy();

            // Convert duration to score (lower is better)
            // Typical range: 1-100ms, map to 100-0 score
            const score = Math.max(0, Math.min(100, 100 - duration));

            return Math.round(score);
        } catch (error) {
            console.error('GPU benchmark failed:', error);
            return 0;
        }
    }


    private static getCachedProfile(): HardwareProfile | null {
        try {
            const cached = localStorage.getItem(this.CACHE_KEY);
            if (!cached) return null;

            const profile: HardwareProfile = JSON.parse(cached);

            // Check if cache is still valid
            if (Date.now() - profile.timestamp > this.CACHE_DURATION_MS) {
                return null;
            }

            return profile;
        } catch (error) {
            console.error('Failed to read cached profile:', error);
            return null;
        }
    }


    private static cacheProfile(profile: HardwareProfile): void {
        try {
            localStorage.setItem(this.CACHE_KEY, JSON.stringify(profile));
        } catch (error) {
            console.error('Failed to cache profile:', error);
        }
    }


    static clearCache(): void {
        console.log('[Hardware Detection] Clearing hardware profile cache...');
        try {
            localStorage.removeItem(this.CACHE_KEY);
            console.log('[Hardware Detection] ✓ Cache cleared successfully');
        } catch (error) {
            console.error('[Hardware Detection] ✗ Failed to clear cache:', error);
        }
    }

    static async forceRefresh(): Promise<HardwareProfile> {
        console.log('[Hardware Detection] Force refresh requested - clearing cache and re-detecting...');
        this.clearCache();
        return await this.detectCapabilities();
    }

    static setManualRAMOverride(ramGB: number | null): void {
        const key = 'hardware-manual-ram-override';
        if (ramGB === null) {
            localStorage.removeItem(key);
            console.log('[Hardware Detection] ✓ Manual RAM override removed');
        } else {
            localStorage.setItem(key, ramGB.toString());
            console.log(`[Hardware Detection] ✓ Manual RAM override set to ${ramGB} GB`);
        }
        this.clearCache(); // Clear cache to force re-detection
    }

    private static getManualRAMOverride(): number | null {
        const key = 'hardware-manual-ram-override';
        try {
            const value = localStorage.getItem(key);
            if (value) {
                const ram = parseFloat(value);
                if (!isNaN(ram) && ram > 0) {
                    return ram;
                }
            }
        } catch (error) {
            console.error('[Hardware Detection] Failed to read manual RAM override:', error);
        }
        return null;
    }
}
