

export { LocalAIAssistant, notify, dismissNotification, clearAllNotifications } from './component/index';

// Auto-register the component when imported
import './component/index';

// Setup hardware diagnostics debug tools in development
import { setupHardwareDiagnosticsDebug } from './utils/hardware-diagnostics-debug';
setupHardwareDiagnosticsDebug();
