import type { HardwareProfile } from '../utils/hardware-diagnostics';
import { HardwareDiagnostics } from '../utils/hardware-diagnostics';
import type { Settings } from './settings-manager';
import { DEFAULT_SETTINGS } from './settings-manager';

export class DefaultsCalculator {
    private static readonly HARDWARE_PROFILE_HASH_KEY = '__hardware_profile_hash__';
    private static readonly DEFAULTS_APPLIED_KEY = '__defaults_applied__';

    /**
     * Calculate hardware-based default settings
     */
    static calculateDefaults(hardwareProfile: HardwareProfile): Partial<Settings> {
        const defaults: Partial<Settings> = {
            enableTextChat: true, // Always enabled
        };

        // Enable image generation if hardware supports it
        if (HardwareDiagnostics.canSupport('image-generation', hardwareProfile)) {
            defaults.enableImageGeneration = true;
        }

        // Enable vision if hardware supports it
        if (HardwareDiagnostics.canSupport('vision', hardwareProfile)) {
            defaults.enableVision = true;
        }

        return defaults;
    }

    /**
     * Generate a hash of the hardware profile for change detection
     */
    static hashHardwareProfile(profile: HardwareProfile): string {
        const key = `${profile.ram || 'unknown'}-${profile.gpuVRAM}-${profile.webGPUSupported}-${profile.storageAvailable}`;
        return btoa(key);
    }

    /**
     * Check if this is the first run (defaults not yet applied)
     */
    static async isFirstRun(loadSetting: (key: string) => Promise<any>): Promise<boolean> {
        const defaultsApplied = await loadSetting(DefaultsCalculator.DEFAULTS_APPLIED_KEY);
        return defaultsApplied === undefined;
    }

    /**
     * Check if hardware profile has changed since last run
     */
    static async hasHardwareChanged(
        hardwareProfile: HardwareProfile,
        loadSetting: (key: string) => Promise<any>
    ): Promise<boolean> {
        const currentHash = DefaultsCalculator.hashHardwareProfile(hardwareProfile);
        const storedHash = await loadSetting(DefaultsCalculator.HARDWARE_PROFILE_HASH_KEY);

        return storedHash !== undefined && storedHash !== currentHash;
    }

    /**
     * Apply hardware-based defaults (only on first run)
     */
    static async applyDefaultsIfNeeded(
        hardwareProfile: HardwareProfile,
        loadSetting: (key: string) => Promise<any>,
        saveSetting: (key: string, value: any) => Promise<void>
    ): Promise<boolean> {
        const isFirst = await DefaultsCalculator.isFirstRun(loadSetting);

        if (!isFirst) {
            // Not first run - respect user's existing settings
            return false;
        }

        // First run - apply hardware-based defaults
        const defaults = DefaultsCalculator.calculateDefaults(hardwareProfile);

        for (const [key, value] of Object.entries(defaults)) {
            await saveSetting(key, value);
        }

        // Mark defaults as applied
        await saveSetting(DefaultsCalculator.DEFAULTS_APPLIED_KEY, true);

        // Store hardware profile hash
        const hash = DefaultsCalculator.hashHardwareProfile(hardwareProfile);
        await saveSetting(DefaultsCalculator.HARDWARE_PROFILE_HASH_KEY, hash);

        return true;
    }

    /**
     * Update hardware profile hash (call when hardware changes are detected)
     */
    static async updateHardwareProfileHash(
        hardwareProfile: HardwareProfile,
        saveSetting: (key: string, value: any) => Promise<void>
    ): Promise<void> {
        const hash = DefaultsCalculator.hashHardwareProfile(hardwareProfile);
        await saveSetting(DefaultsCalculator.HARDWARE_PROFILE_HASH_KEY, hash);
    }

    /**
     * Get merged settings (defaults + stored + hardware-based)
     */
    static async getMergedSettings(
        hardwareProfile: HardwareProfile | null,
        loadSetting: (key: string) => Promise<any>,
        saveSetting: (key: string, value: any) => Promise<void>
    ): Promise<Settings> {
        // Start with default settings
        const settings: Settings = { ...DEFAULT_SETTINGS };

        // Apply hardware-based defaults if first run
        if (hardwareProfile) {
            await DefaultsCalculator.applyDefaultsIfNeeded(
                hardwareProfile,
                loadSetting,
                saveSetting
            );
        }

        // Load each setting from storage (overrides defaults)
        for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>) {
            const value = await loadSetting(key);
            if (value !== undefined) {
                (settings as any)[key] = value;
            }
        }

        return settings;
    }
}
