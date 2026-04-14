const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: "MetraSync Dashboard",
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// --- NOTE VAULT IPC HANDLERS ---
ipcMain.on('print-to-pdf', async (event, partId) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    event.sender.send('pdf-export-started');
    
    try {
        const safeName = partId.replace(/[^a-z0-9]/gi, '_');
        const pdfPath = await dialog.showSaveDialog(win, {
            title: 'Save Note as PDF',
            defaultPath: `${safeName}.pdf`,
            filters: [{ name: 'PDF', extensions: ['pdf'] }]
        });

        if (pdfPath.filePath) {
            const pdfData = await win.webContents.printToPDF({
                printBackground: true,
                pageSize: 'Letter'
            });
            fs.writeFileSync(pdfPath.filePath, pdfData);
        }
    } catch (error) {
        console.error('Failed to save PDF:', error);
    } finally {
        event.sender.send('pdf-export-complete');
    }
});

ipcMain.on('export-data', async (event, data, filename) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    try {
        const savePath = await dialog.showSaveDialog(win, {
            title: 'Export Profile',
            defaultPath: filename,
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (savePath.filePath) {
            fs.writeFileSync(savePath.filePath, JSON.stringify(data, null, 2));
        }
    } catch (err) { 
        console.error('Export failed:', err); 
    }
});

ipcMain.on('import-data', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    try {
        const openPath = await dialog.showOpenDialog(win, {
            title: 'Import Profile',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile']
        });
        if (!openPath.canceled && openPath.filePaths.length > 0) {
            const fileContent = fs.readFileSync(openPath.filePaths[0], 'utf-8');
            event.sender.send('data-loaded', fileContent);
        }
    } catch (err) { 
        console.error('Import failed:', err); 
    }
});