const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Outbound calls
    printToPdf: (partId) => ipcRenderer.send('print-to-pdf', partId),
    exportData: (data, filename) => ipcRenderer.send('export-data', data, filename),
    importData: () => ipcRenderer.send('import-data'),
    
    // Inbound listeners (Cleans up old listeners automatically on page reload)
    onPdfExportStarted: (callback) => {
        ipcRenderer.removeAllListeners('pdf-export-started');
        ipcRenderer.on('pdf-export-started', () => callback());
    },
    onPdfExportComplete: (callback) => {
        ipcRenderer.removeAllListeners('pdf-export-complete');
        ipcRenderer.on('pdf-export-complete', () => callback());
    },
    onDataLoaded: (callback) => {
        ipcRenderer.removeAllListeners('data-loaded');
        ipcRenderer.on('data-loaded', (event, data) => callback(data));
    }
});