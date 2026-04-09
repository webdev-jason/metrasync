const { contextBridge, ipcRenderer } = require('electron');

// We use the contextBridge to expose specific, safe APIs to the frontend
contextBridge.exposeInMainWorld('api', {
    // We will add functions here later, like:
    // runPythonScript: (scriptName) => ipcRenderer.invoke('run-python', scriptName)
});