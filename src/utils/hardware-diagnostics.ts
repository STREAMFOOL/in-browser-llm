

export interface HardwareProfile {
    ram: number;              // GB
    cpuCores: number;
    storageAvailable: number; // GB
    gpuVRAM: number;          // GB (estimated)
    webGPUSupported: boolean;
    gpuPerformanceScore: number; // 0-100
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
            minStorage: 2,
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


    static async detectCapabilities(): Promise<HardwareProfile> {
        // Check cache first
        const cached = this.getCachedProfile();
        if (cached) {
            return cached;
        }

        // Detect RAM (Requirement 6.1)
        const ram = (navigator as any).deviceMemory || 4; // Default to 4GB if unavailable

        // Detect CPU cores (Requirement 6.2)
        const cpuCores = navigator.hardwareConcurrency || 2; // Default to 2 cores

        // Detect available storage (Requirement 6.3)
        const storageAvailable = await this.detectStorage();

        // Detect GPU VRAM and WebGPU support (Requirement 6.4)
        const { gpuVRAM, webGPUSupported } = await this.detectGPU();

        // Benchmark GPU performance
        const gpuPerformanceScore = webGPUSupported ? await this.benchmarkGPU() : 0;

        const profile: HardwareProfile = {
            ram,
            cpuCores,
            storageAvailable,
            gpuVRAM,
            webGPUSupported,
            gpuPerformanceScore,
            timestamp: Date.now()
        };

        // Cache the profile
        this.cacheProfile(profile);

        return profile;
    }


    static canSupport(feature: Feature, profile: HardwareProfile): boolean {
        const requirements = this.FEATURE_REQUIREMENTS[feature];

        // Check all requirements
        if (profile.ram < requirements.minRAM) return false;
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
        if (profile.ram >= 16) {
            maxContextLength = 8192;
        } else if (profile.ram >= 8) {
            maxContextLength = 4096;
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


    private static async detectStorage(): Promise<number> {
        if (!navigator.storage || !navigator.storage.estimate) {
            return 0;
        }

        try {
            // Request persistent storage to potentially increase quota
            if (navigator.storage.persist) {
                await navigator.storage.persist();
            }

            const estimate = await navigator.storage.estimate();
            const availableBytes = (estimate.quota || 0) - (estimate.usage || 0);
            return availableBytes / (1024 ** 3); // Convert to GB
        } catch (error) {
            console.error('Failed to detect storage:', error);
            return 0;
        }
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
        try {
            localStorage.removeItem(this.CACHE_KEY);
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    }
}
