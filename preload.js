const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    // Note Vault IPC
    printToPdf: (filename) => ipcRenderer.send('print-to-pdf', filename),
    exportData: (notes, filename) => ipcRenderer.send('export-data', notes, filename),
    importData: () => ipcRenderer.send('import-data'),
    onPdfExportStarted: (callback) => ipcRenderer.on('pdf-export-started', () => callback()),
    onPdfExportComplete: (callback) => ipcRenderer.on('pdf-export-complete', () => callback()),
    onDataLoaded: (callback) => ipcRenderer.on('data-loaded', (event, data, filename) => callback(data, filename)),
    
    // Revision Auditor IPC
    importLegacyExcel: () => ipcRenderer.send('import-legacy-excel'),
    onLegacyExcelImported: (callback) => ipcRenderer.on('legacy-excel-imported', (event, docs) => callback(docs)),
    startNativeAudit: (links) => ipcRenderer.send('start-native-audit', links),
    resumeAudit: () => ipcRenderer.send('resume-audit'),
    abortAudit: () => ipcRenderer.send('abort-audit'),
    onAuditStatus: (callback) => ipcRenderer.on('audit-status', (event, status) => callback(status)),
    onAuditProgress: (callback) => ipcRenderer.on('audit-progress', (event, pct) => callback(pct)),
    onAuditValidationFailed: (callback) => ipcRenderer.on('audit-validation-failed', (event, msg) => callback(msg)),
    onAuditFinished: (callback) => ipcRenderer.on('audit-finished', (event, msg) => callback(msg)),
    onAuditDeadLink: (callback) => ipcRenderer.on('audit-dead-link', (event, id) => callback(id)),
    onAuditError: (callback) => ipcRenderer.on('audit-error', (event, msg) => callback(msg)),
});