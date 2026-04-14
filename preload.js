const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    
    importData: () => ipcRenderer.send('import-data'),
    exportData: (notes, filename) => ipcRenderer.send('export-data', notes, filename),
    printToPdf: (partId) => ipcRenderer.send('print-to-pdf', partId),
    
    // Updated to receive the filename string
    onDataLoaded: (callback) => ipcRenderer.on('data-loaded', (event, data, filename) => callback(data, filename)),
    onPdfExportStarted: (callback) => ipcRenderer.on('pdf-export-started', () => callback()),
    onPdfExportComplete: (callback) => ipcRenderer.on('pdf-export-complete', () => callback())

});