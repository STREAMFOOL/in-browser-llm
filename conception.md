Prerequisites
To use the built-in LLM, these are the requirements:

    Chrome Version: Chrome 127 or higher.
    Enable Flags: Enable chrome://flags/#optimization-guide-on-device-model and chrome://flags/#prompt-api-for-gemini-nano.
    Model Status: Use window.ai.canCreateTextSession() to check if the model is downloaded. 

Basic HTML/JS Implementation
This example demonstrates a basic chat application using the Prompt API. 
index.html
html

<!DOCTYPE html>
<html lang="en">
<head>
    <title>In-Chrome LLM App</title>
    <style>
        body { font-family: sans-serif; padding: 20px; }
        #response { white-space: pre-wrap; background: #f4f4f4; padding: 10px; margin-top: 10px; }
    </style>
</head>
<body>
    <h1>Chrome Gemini Nano Chat</h1>
    <input type="text" id="userInput" placeholder="Ask something...">
    <button onclick="askAI()">Send</button>
    <div id="response"></div>

    <script src="app.js"></script>
</body>
</html>

Use code with caution.
app.js
javascript

async function askAI() {
    const input = document.getElementById('userInput').value;
    const responseDiv = document.getElementById('response');

    try {
        // Check availability and create session
        const capabilities = await ai.languageModel.capabilities();
        if (capabilities.available === 'no') {
            responseDiv.innerText = "Built-in AI is not available on this device.";
            return;
        }

        const session = await ai.languageModel.create();
        
        // Use stream for real-time feedback
        const stream = session.promptStreaming(input);
        responseDiv.innerText = "";
        
        for await (const chunk of stream) {
            responseDiv.innerText = chunk;
        }
    } catch (err) {
        responseDiv.innerText = "Error: " + err.message;
    }
}

Use code with caution.
Specialized Built-in APIs
Chrome provides task-specific APIs: 

    Summarizer API: Use ai.summarizer.create() to condense text.
    Writer/Rewriter API: For formalizing or expanding text.
    Language Detector API: To identify the language of a string. 

Alternative: WebLLM (WebGPU) 
If the built-in Gemini Nano is restricted or a different model is needed, use WebLLM. It uses WebGPU to run models locally in the browser. 

    Library: WebLLM on GitHub
    Advantage: Supports multiple open-source models and runs on any browser supporting WebGPU, not just Chrome. 

Best Practices

    Model Caching: The first call to create() triggers a ~2GB download if the model isn't present. A loading indicator should be provided.
    Streaming: Use promptStreaming() for better user experience, as local inference can take several seconds.
    Privacy: Because the LLM runs locally, no data leaves the user's machine. 