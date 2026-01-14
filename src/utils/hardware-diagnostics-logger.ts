// Logging utilities for hardware diagnostics and feature gate decisions

import type { HardwareProfile } from './hardware-diagnostics';

export interface DiagnosticLog {
    check: string;
    result: string | number | boolean;
    method: string;
    browser: string;
    timestamp: number;
}

export class HardwareDiagnosticsLogger {
    private static readonly LOGS_KEY = 'hardware-diagnostics-logs';
    private static readonly MAX_LOGS = 100;

    static logHardwareCheck(
        check: string,
        result: string | number | boolean,
        method: string,
        browser: string
    ): void {
        const log: DiagnosticLog = {
            check,
            result,
            method,
            browser,
            timestamp: Date.now()
        };

        console.log(`[Hardware] ${check}: ${result} (method: ${method}, browser: ${browser})`);

        // Store in localStorage for debugging
        try {
            const logs = this.getLogs();
            logs.push(log);

            // Keep only the most recent logs
            if (logs.length > this.MAX_LOGS) {
                logs.splice(0, logs.length - this.MAX_LOGS);
            }

            localStorage.setItem(this.LOGS_KEY, JSON.stringify(logs));
        } catch (error) {
            console.error('Failed to store diagnostic log:', error);
        }
    }

    static logHardwareProfile(profile: HardwareProfile): void {
        console.log('[Hardware Profile]', {
            ram: profile.ram,
            ramDetectionMethod: profile.ramDetectionMethod,
            cpuCores: profile.cpuCores,
            storageAvailable: profile.storageAvailable,
            storageDetectionMethod: profile.storageDetectionMethod,
            gpuVRAM: profile.gpuVRAM,
            webGPUSupported: profile.webGPUSupported,
            gpuPerformanceScore: profile.gpuPerformanceScore,
            browserName: profile.browserName,
            timestamp: new Date(profile.timestamp).toISOString()
        });
    }

    static logFeatureGateDecision(feature: string, enabled: boolean, reason?: string): void {
        const status = enabled ? '✓' : '✗';
        const message = reason ? `${status} ${feature}: ${reason}` : `${status} ${feature}`;
        console.log(`[Feature Gate] ${message}`);
    }

    static getLogs(): DiagnosticLog[] {
        try {
            const logs = localStorage.getItem(this.LOGS_KEY);
            return logs ? JSON.parse(logs) : [];
        } catch (error) {
            console.error('Failed to retrieve diagnostic logs:', error);
            return [];
        }
    }

    static clearLogs(): void {
        try {
            localStorage.removeItem(this.LOGS_KEY);
        } catch (error) {
            console.error('Failed to clear diagnostic logs:', error);
        }
    }
}
