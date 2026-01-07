/**
 * Browser Compatibility Checker
 * Validates browser environment meets minimum requirements
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

export interface CompatibilityResult {
    compatible: boolean;
    checks: {
        chromeVersion: VersionCheck;
        promptAPI: APICheck;
        storage: StorageCheck;
        hardware: HardwareCheck;
    };
    errors: string[];
    warnings: string[];
}

export interface VersionCheck {
    passed: boolean;
    detected: number | null;
    required: number;
    message: string;
}

export interface APICheck {
    passed: boolean;
    available: boolean;
    message: string;
}

export interface StorageCheck {
    passed: boolean;
    available: number; // GB
    required: number; // GB
    message: string;
}

export interface HardwareCheck {
    ram: number | null; // GB
    cpuCores: number | null;
}

export class BrowserCompatibilityChecker {
    private static readonly MIN_CHROME_VERSION = 127;
    private static readonly MIN_STORAGE_GB = 22;

    /**
     * Check Chrome version
     * Requirements: 1.1, 1.5
     */
    static checkChromeVersion(): VersionCheck {
        const userAgent = navigator.userAgent;
        const chromeMatch = userAgent.match(/Chrome\/(\d+)/);

        if (!chromeMatch) {
            return {
                passed: false,
                detected: null,
                required: this.MIN_CHROME_VERSION,
                message: 'Chrome browser not detected. This application requires Chrome 127 or higher.'
            };
        }

        const version = parseInt(chromeMatch[1], 10);
        const passed = version >= this.MIN_CHROME_VERSION;

        return {
            passed,
            detected: version,
            required: this.MIN_CHROME_VERSION,
            message: passed
                ? `Chrome ${version} detected (compatible)`
                : `Chrome ${version} detected. Please upgrade to Chrome ${this.MIN_CHROME_VERSION} or higher.`
        };
    }

    /**
     * Check Prompt API availability
     * Requirements: 1.2
     */
    static checkPromptAPI(): APICheck {
        const available = typeof window !== 'undefined' &&
            'ai' in window &&
            window.ai !== null &&
            'languageModel' in (window.ai as any);

        return {
            passed: available,
            available,
            message: available
                ? 'Prompt API (window.ai.languageModel) is available'
                : 'Prompt API not available. Please enable chrome://flags/#prompt-api-for-gemini-nano'
        };
    }

    /**
     * Check storage availability
     * Requirements: 1.3, 1.6
     */
    static async checkStorage(): Promise<StorageCheck> {
        if (!navigator.storage || !navigator.storage.estimate) {
            return {
                passed: false,
                available: 0,
                required: this.MIN_STORAGE_GB,
                message: 'Storage API not available'
            };
        }

        try {
            const estimate = await navigator.storage.estimate();
            const availableBytes = (estimate.quota || 0) - (estimate.usage || 0);
            const availableGB = availableBytes / (1024 ** 3);
            const passed = availableGB >= this.MIN_STORAGE_GB;

            return {
                passed,
                available: Math.round(availableGB * 10) / 10,
                required: this.MIN_STORAGE_GB,
                message: passed
                    ? `${availableGB.toFixed(1)} GB available (sufficient)`
                    : `Only ${availableGB.toFixed(1)} GB available. ${this.MIN_STORAGE_GB} GB required for model downloads.`
            };
        } catch (error) {
            return {
                passed: false,
                available: 0,
                required: this.MIN_STORAGE_GB,
                message: `Failed to check storage: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }

    /**
     * Detect hardware capabilities
     * Requirements: 1.4
     */
    static detectHardware(): HardwareCheck {
        const ram = (navigator as any).deviceMemory || null;
        const cpuCores = navigator.hardwareConcurrency || null;

        return {
            ram,
            cpuCores
        };
    }

    /**
     * Run all compatibility checks
     * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
     */
    static async checkCompatibility(): Promise<CompatibilityResult> {
        const chromeVersion = this.checkChromeVersion();
        const promptAPI = this.checkPromptAPI();
        const storage = await this.checkStorage();
        const hardware = this.detectHardware();

        const errors: string[] = [];
        const warnings: string[] = [];

        // Collect errors for failed checks
        if (!chromeVersion.passed) {
            errors.push(chromeVersion.message);
        }

        if (!promptAPI.passed) {
            errors.push(promptAPI.message);
        }

        // Storage is a warning, not a hard error
        if (!storage.passed) {
            warnings.push(storage.message);
        }

        const compatible = chromeVersion.passed && promptAPI.passed;

        return {
            compatible,
            checks: {
                chromeVersion,
                promptAPI,
                storage,
                hardware
            },
            errors,
            warnings
        };
    }
}
