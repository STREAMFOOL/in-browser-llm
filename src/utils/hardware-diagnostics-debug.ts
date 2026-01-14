// Debug utilities for hardware diagnostics
// Expose these to window for easy console access

import { HardwareDiagnostics } from './hardware-diagnostics';

export function setupHardwareDiagnosticsDebug(): void {
    // Expose debug utilities to window for console access
    (window as any).hardwareDebug = {
        clearCache: () => {
            HardwareDiagnostics.clearCache();
            console.log('✓ Hardware cache cleared. Reload the page to re-detect.');
        },

        forceRefresh: async () => {
            console.log('🔄 Force refreshing hardware profile...');
            const profile = await HardwareDiagnostics.forceRefresh();
            console.log('✓ Hardware profile refreshed:', profile);
            return profile;
        },

        setRAM: async (ramGB: number) => {
            if (typeof ramGB !== 'number' || ramGB <= 0) {
                console.error('❌ Invalid RAM value. Must be a positive number (e.g., 16 for 16GB)');
                return;
            }
            HardwareDiagnostics.setManualRAMOverride(ramGB);
            console.log(`✓ RAM manually set to ${ramGB} GB. Refreshing profile...`);
            const profile = await HardwareDiagnostics.forceRefresh();
            console.log('✓ Hardware profile updated:', profile);
            return profile;
        },

        clearRAM: async () => {
            HardwareDiagnostics.setManualRAMOverride(null);
            console.log('✓ Manual RAM override removed. Refreshing profile...');
            const profile = await HardwareDiagnostics.forceRefresh();
            console.log('✓ Hardware profile updated:', profile);
            return profile;
        },

        showProfile: async () => {
            const profile = await HardwareDiagnostics.detectCapabilities();
            console.log('📊 Current Hardware Profile:');
            console.table({
                'RAM': profile.ram !== null ? `${profile.ram} GB` : 'Unknown',
                'RAM Detection': profile.ramDetectionMethod,
                'CPU Cores': profile.cpuCores,
                'Storage': `${profile.storageAvailable.toFixed(2)} GB`,
                'Storage Detection': profile.storageDetectionMethod,
                'GPU VRAM': `${profile.gpuVRAM.toFixed(2)} GB`,
                'WebGPU': profile.webGPUSupported ? 'Yes' : 'No',
                'GPU Score': profile.gpuPerformanceScore,
                'Browser': profile.browserName,
                'Timestamp': new Date(profile.timestamp).toLocaleString()
            });
            return profile;
        },

        help: () => {
            console.log(`
🔧 Hardware Diagnostics Debug Commands:

  hardwareDebug.clearCache()     - Clear cached hardware profile
  hardwareDebug.forceRefresh()   - Clear cache and re-detect hardware
  hardwareDebug.setRAM(16)       - Manually set RAM to 16 GB (or any value)
  hardwareDebug.clearRAM()       - Remove manual RAM override
  hardwareDebug.showProfile()    - Display current hardware profile
  hardwareDebug.help()           - Show this help message

Example usage:
  > await hardwareDebug.setRAM(16)      // Set RAM to 16 GB
  > await hardwareDebug.forceRefresh()  // Re-detect all hardware
  > await hardwareDebug.showProfile()   // Show current profile

Note: The browser's deviceMemory API is capped at 8GB for privacy.
Use setRAM() to manually specify your actual RAM if you have more.
            `);
        }
    };

    console.log('🔧 Hardware diagnostics debug tools loaded. Type "hardwareDebug.help()" for commands.');
}
