import type { DetailedAvailability } from "../providers/gemini-controller";

export function getTroubleshootingGuide(reason: DetailedAvailability['reason']): string {
    switch (reason) {
        case 'unsupported-browser':
            return `**Browser Not Supported**

This feature requires **Google Chrome** (not Brave, Edge, or other Chromium browsers).

Please download and use Google Chrome version 138 or higher.`;

        case 'api-not-available':
            return `**Chrome AI APIs Not Found**

Your Chrome version may be too old or the APIs aren't available.

**Requirements:**

- Google Chrome 138 or higher

- macOS 13+ (Ventura), Windows 10/11, or Linux

To check your version, type \`chrome://version\` in the address bar.`;

        case 'flags-disabled':
            return `**Chrome Flags Not Enabled**

You need to enable the experimental AI features:

1. Open \`chrome://flags\` in Chrome

2. Search for and enable these flags:

- \`#optimization-guide-on-device-model\` → **Enabled**

- \`#prompt-api-for-gemini-nano\` → **Enabled**

3. Click **Relaunch** to restart Chrome

After restart, the model will begin downloading automatically.`;

        case 'model-downloading':
            return `**Model Downloading**

The AI model is being downloaded to your device. This is a one-time download of approximately 2GB.

Please wait for the download to complete. You can check progress at \`chrome://on-device-internals\`.`;

        case 'model-not-downloaded':
            return `**Model Not Available**

The model hasn't been downloaded yet.

**To trigger download:**

1. Go to \`chrome://on-device-internals\`

2. Check the **Model Status** tab for any errors

3. Make sure you have at least 22GB free disk space

4. Try restarting Chrome

If issues persist, try disabling and re-enabling the flags in \`chrome://flags\`.`;

        case 'error':
        default:
            return `**Unexpected Error**

Something went wrong during initialization.

**Try these steps:**

1. Refresh the page

2. Restart Chrome completely

3. Check \`chrome://on-device-internals\` for model status

4. Check the browser console for detailed error messages`;
    }
}