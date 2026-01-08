import { GeminiController, type InitStep, type DetailedAvailability } from '../gemini-controller';
import { ProviderManager } from '../provider-manager';
import type { ModelProvider, ChatSession } from '../model-provider';
import { HardwareDiagnostics, type HardwareProfile, type Feature } from '../hardware-diagnostics';
import { type Message } from '../chat-ui';

export interface SessionConfig {
    temperature: number;
    topK: number;
    enabledFeatures: Feature[];
}

export interface SessionManagerCallbacks {
    onInitMessage: (message: Message) => void;
    onUpdateInitMessage: (messageId: string, content: string) => void;
    onProviderReady: (provider: ModelProvider) => void;
    onSessionCreated: (session: ChatSession) => void;
    onHardwareProfileDetected: (profile: HardwareProfile) => void;
    onFeaturesFiltered: (supported: Feature[], unsupported: Feature[]) => void;
}

export class SessionManager {
    private geminiController: GeminiController;
    private providerManager: ProviderManager;
    private callbacks: SessionManagerCallbacks;
    private activeProvider: ModelProvider | null = null;
    private currentSession: ChatSession | null = null;
    private hardwareProfile: HardwareProfile | null = null;
    private messageIdCounter: number;

    constructor(
        geminiController: GeminiController,
        providerManager: ProviderManager,
        callbacks: SessionManagerCallbacks,
        messageIdCounter: number = 0
    ) {
        this.geminiController = geminiController;
        this.providerManager = providerManager;
        this.callbacks = callbacks;
        this.messageIdCounter = messageIdCounter;
    }

    getActiveProvider(): ModelProvider | null {
        return this.activeProvider;
    }

    getCurrentSession(): ChatSession | null {
        return this.currentSession;
    }

    getHardwareProfile(): HardwareProfile | null {
        return this.hardwareProfile;
    }

    getMessageIdCounter(): number {
        return this.messageIdCounter;
    }

    async initialize(config: SessionConfig): Promise<void> {
        await this.detectHardwareCapabilities(config);
        await this.initializeProvider(config);
    }

    private async detectHardwareCapabilities(config: SessionConfig): Promise<void> {
        try {
            this.hardwareProfile = await HardwareDiagnostics.detectCapabilities();
            console.log('Hardware profile detected:', this.hardwareProfile);

            this.callbacks.onHardwareProfileDetected(this.hardwareProfile);

            const supportedFeatures = config.enabledFeatures.filter(
                feature => HardwareDiagnostics.canSupport(feature, this.hardwareProfile!)
            );

            if (supportedFeatures.length < config.enabledFeatures.length) {
                const unsupportedFeatures = config.enabledFeatures.filter(
                    f => !supportedFeatures.includes(f)
                );
                console.warn('Some features disabled due to hardware limitations:', unsupportedFeatures);
                this.callbacks.onFeaturesFiltered(supportedFeatures, unsupportedFeatures);
            }
        } catch (error) {
            console.error('Failed to detect hardware capabilities:', error);
        }
    }

    private async initializeProvider(config: SessionConfig): Promise<void> {
        const initMessageId = `msg-${this.messageIdCounter++}`;
        const initMessage: Message = {
            id: initMessageId,
            role: 'assistant',
            content: this.renderInitializationStatus([], 'checking'),
            timestamp: Date.now()
        };
        this.callbacks.onInitMessage(initMessage);

        try {
            const availability = await this.geminiController.checkDetailedAvailability();

            if (availability.status === 'readily') {
                await this.initializeChromeProvider(initMessageId, availability, config);
            } else if (availability.status === 'after-download') {
                console.warn('Gemini model downloading');
                await this.startModelDownload(initMessageId, config);
            } else {
                console.warn('Chrome AI not available:', availability.reason, '- trying WebLLM fallback');
                await this.tryWebLLMFallback(initMessageId, availability, config);
            }
        } catch (error) {
            console.error('Failed to initialize session:', error);
            await this.tryWebLLMFallback(initMessageId, undefined, config);
        }
    }

    private async initializeChromeProvider(
        initMessageId: string,
        availability: DetailedAvailability,
        config: SessionConfig
    ): Promise<void> {
        this.callbacks.onUpdateInitMessage(
            initMessageId,
            this.renderInitializationStatus(availability.steps, 'success', availability)
        );

        this.activeProvider = await this.providerManager.autoSelectProvider();
        if (this.activeProvider) {
            this.currentSession = await this.activeProvider.createSession({
                temperature: config.temperature,
                topK: config.topK
            });
            console.log('Chrome Gemini session initialized');

            this.callbacks.onProviderReady(this.activeProvider);
            this.callbacks.onSessionCreated(this.currentSession);

            this.callbacks.onUpdateInitMessage(
                initMessageId,
                '👋 Hello! I\'m your local AI assistant powered by Chrome\'s built-in AI. All processing happens on your device for complete privacy. How can I help you today?'
            );
        }
    }

    private async startModelDownload(initMessageId: string, config: SessionConfig): Promise<void> {
        try {
            this.activeProvider = await this.providerManager.autoSelectProvider();
            if (this.activeProvider) {
                this.currentSession = await this.activeProvider.createSession({
                    temperature: config.temperature,
                    topK: config.topK
                });

                this.callbacks.onProviderReady(this.activeProvider);
                this.callbacks.onSessionCreated(this.currentSession);

                this.callbacks.onUpdateInitMessage(
                    initMessageId,
                    '👋 Hello! I\'m your local AI assistant. All processing happens on your device for complete privacy. How can I help you today?'
                );
            } else {
                await this.tryWebLLMFallback(initMessageId, undefined, config);
            }
        } catch (error) {
            console.error('Failed to download model:', error);
            await this.tryWebLLMFallback(initMessageId, undefined, config);
        }
    }

    private async tryWebLLMFallback(
        initMessageId: string,
        chromeAvailability?: DetailedAvailability,
        config?: SessionConfig
    ): Promise<void> {
        console.debug('enter tryWebLLMFallback, chromeAvailability=', chromeAvailability);

        const fallbackSteps: InitStep[] = [
            { id: 'chrome', label: 'Chrome AI not available', status: 'failed', error: chromeAvailability?.errorMessage || 'Not supported' },
            { id: 'webllm', label: 'Trying WebLLM fallback...', status: 'running' },
        ];

        console.debug('updateMessage checking fallback=', fallbackSteps);
        this.callbacks.onUpdateInitMessage(
            initMessageId,
            this.renderFallbackStatus(fallbackSteps, 'checking')
        );

        try {
            console.debug('check webllm provider');
            const webllmProvider = this.providerManager.getProvider('webllm');
            if (!webllmProvider) {
                throw new Error('WebLLM provider not registered');
            }

            console.debug('check webllm availability');
            const webllmAvailability = await webllmProvider.checkAvailability();
            console.log('WebLLM availability check result:', webllmAvailability);

            if (!webllmAvailability.available) {
                fallbackSteps[1] = { id: 'webllm', label: 'WebLLM not available', status: 'failed', error: webllmAvailability.reason };
                this.callbacks.onUpdateInitMessage(
                    initMessageId,
                    this.renderFallbackStatus(fallbackSteps, 'failed', chromeAvailability)
                );
                console.warn('WebLLM unavailable. Reason:', webllmAvailability.reason);
                return;
            }

            console.debug('initialize WebLLM with progress monitoring');
            fallbackSteps[1] = { id: 'webllm', label: 'Initializing WebLLM...', status: 'running' };
            this.callbacks.onUpdateInitMessage(
                initMessageId,
                this.renderFallbackStatus(fallbackSteps, 'downloading')
            );

            const timestamp = Date.now();
            const progressInterval = setInterval(() => {
                const timespan = Date.now() - timestamp;
                console.debug(`${timespan} millis monitoring WebLLM initialization`);

                const progress = webllmProvider.getProgress();
                if (progress) {
                    const percentage = progress.percentage || 0;
                    const phase = progress.phase || 'downloading';
                    const currentFile = progress.currentFile || '';

                    fallbackSteps[1] = {
                        id: 'webllm',
                        label: `${phase === 'downloading' ? 'Downloading' : 'Loading'} WebLLM model... ${percentage}%`,
                        status: 'running',
                        error: currentFile
                    };

                    this.callbacks.onUpdateInitMessage(
                        initMessageId,
                        this.renderFallbackStatus(fallbackSteps, 'downloading')
                    );
                }
            }, 500);

            try {
                console.debug('initializing WebLLM');
                await webllmProvider.initialize();
                clearInterval(progressInterval);

                this.activeProvider = webllmProvider;
                this.currentSession = await webllmProvider.createSession({
                    temperature: config?.temperature || 0.7,
                    topK: config?.topK || 40
                });

                fallbackSteps[1] = { id: 'webllm', label: 'WebLLM ready', status: 'passed' };
            } catch (initError) {
                console.error(initError, 'ERROR while initializing WebLLM');
                clearInterval(progressInterval);
                throw initError;
            }

            console.debug('Update provider indicator');
            this.callbacks.onProviderReady(this.activeProvider);
            this.callbacks.onSessionCreated(this.currentSession);

            console.log('WebLLM session initialized as fallback');
            this.callbacks.onUpdateInitMessage(
                initMessageId,
                '👋 Hello! I\'m your local AI assistant powered by WebLLM. Chrome\'s built-in AI wasn\'t available, so I\'m using WebGPU instead. All processing still happens on your device for complete privacy. How can I help you today?'
            );
        } catch (error) {
            console.error('WebLLM fallback failed:', error);
            fallbackSteps[1] = {
                id: 'webllm',
                label: 'WebLLM initialization failed',
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
            this.callbacks.onUpdateInitMessage(
                initMessageId,
                this.renderFallbackStatus(fallbackSteps, 'failed', chromeAvailability)
            );
        }
    }

    async switchProvider(providerName: string, config: SessionConfig): Promise<void> {
        if (this.currentSession && this.activeProvider) {
            await this.activeProvider.destroySession(this.currentSession);
            this.currentSession = null;
        }

        await this.providerManager.setActiveProvider(providerName);
        this.activeProvider = this.providerManager.getActiveProvider();

        if (this.activeProvider) {
            this.currentSession = await this.activeProvider.createSession({
                temperature: config.temperature,
                topK: config.topK
            });

            this.callbacks.onProviderReady(this.activeProvider);
            this.callbacks.onSessionCreated(this.currentSession);
        }
    }

    async recreateSession(config: SessionConfig): Promise<void> {
        if (this.activeProvider && this.currentSession) {
            await this.activeProvider.destroySession(this.currentSession);
            this.currentSession = await this.activeProvider.createSession({
                temperature: config.temperature,
                topK: config.topK
            });
            this.callbacks.onSessionCreated(this.currentSession);
            console.log('Session recreated with new settings');
        }
    }

    private renderInitializationStatus(
        steps: InitStep[],
        status: 'checking' | 'success' | 'failed' | 'downloading',
        availability?: DetailedAvailability,
        downloadPercent?: number
    ): string {
        const statusIcons: Record<InitStep['status'], string> = {
            pending: '⏳',
            running: '🔄',
            passed: '✅',
            failed: '❌',
            skipped: '⏭️'
        };

        const displaySteps = steps.length > 0 ? steps : [
            { id: 'browser', label: 'Checking browser compatibility', status: 'running' as const },
            { id: 'api', label: 'Checking Prompt API availability', status: 'pending' as const },
            { id: 'flags', label: 'Verifying Chrome flags enabled', status: 'pending' as const },
            { id: 'model', label: 'Checking model status', status: 'pending' as const },
        ];

        let header = '🔧 **Initializing AI Assistant**';
        if (status === 'success') {
            header = '✅ **Initialization Complete**';
        } else if (status === 'failed') {
            header = '⚠️ **Initialization Failed**';
        } else if (status === 'downloading') {
            header = '📥 **Downloading AI Model**';
        }

        const stepsList = displaySteps.map(step => {
            const icon = statusIcons[step.status];
            let line = `- ${icon} ${step.label}`;
            if (step.error) {
                line += ` — _${step.error}_`;
            }
            return line;
        }).join('\n');

        let content = `${header}\n\n${stepsList}`;

        if (status === 'downloading' && downloadPercent !== undefined) {
            const filled = Math.round(downloadPercent / 5);
            const empty = 20 - filled;
            const progressBar = `\n\n**Progress:** ${'█'.repeat(filled)}${'░'.repeat(empty)} ${downloadPercent}%`;
            content += progressBar;
        }

        if (status === 'failed' && availability) {
            content += '\n\n---\n\n';
            content += this.getTroubleshootingGuide(availability.reason);
        }

        return content;
    }

    private renderFallbackStatus(
        steps: InitStep[],
        status: 'checking' | 'downloading' | 'failed',
        chromeAvailability?: DetailedAvailability
    ): string {
        const statusIcons: Record<InitStep['status'], string> = {
            pending: '⏳',
            running: '🔄',
            passed: '✅',
            failed: '❌',
            skipped: '⏭️'
        };

        let header = '🔄 **Trying Alternative AI Provider**';
        if (status === 'failed') {
            header = '⚠️ **No AI Provider Available**';
        } else if (status === 'downloading') {
            header = '📥 **Downloading WebLLM Model**';
        }

        const stepsList = steps.map(step => {
            const icon = statusIcons[step.status];
            let line = `- ${icon} ${step.label}`;
            if (step.error) {
                line += ` — _${step.error}_`;
            }
            return line;
        }).join('\n');

        let content = `${header}\n\n${stepsList}`;

        if (status === 'failed') {
            content += '\n\n---\n\n';
            content += this.getNoProviderGuide(chromeAvailability?.reason);
        }

        return content;
    }

    private getTroubleshootingGuide(reason?: DetailedAvailability['reason']): string {
        // Import from troubleshoot.ts would be better, but keeping inline for now
        return `**Troubleshooting Guide**\n\nPlease check the browser requirements and try again.`;
    }

    private getNoProviderGuide(chromeReason?: DetailedAvailability['reason']): string {
        let guide = `**No AI Provider Available**\n\n`;
        guide += `Neither Chrome's built-in AI nor WebLLM could be initialized.\n\n`;

        const userAgent = navigator.userAgent.toLowerCase();
        const isChrome = userAgent.includes('chrome') && !userAgent.includes('edg') && !userAgent.includes('brave');

        if (isChrome) {
            guide += `**You're using Chrome - Enable Built-in AI**\n\n`;
            if (chromeReason === 'api-not-available' || chromeReason === 'flags-disabled') {
                guide += `1. Open \`chrome://flags\` in Chrome\n`;
                guide += `2. Enable \`#optimization-guide-on-device-model\` → **Enabled BypassPerfRequirement**\n`;
                guide += `3. Enable \`#prompt-api-for-gemini-nano\` → **Enabled**\n`;
                guide += `4. Click **Relaunch** to restart Chrome\n\n`;
            }
        }

        guide += `**System Requirements:**\n`;
        guide += `- At least 22GB free disk space\n`;
        guide += `- WebGPU-capable GPU (for WebLLM)\n`;
        guide += `- Up-to-date GPU drivers\n`;

        return guide;
    }

    async dispose(): Promise<void> {
        if (this.currentSession && this.activeProvider) {
            await this.activeProvider.destroySession(this.currentSession);
            this.currentSession = null;
        }
        this.activeProvider = null;
    }
}
