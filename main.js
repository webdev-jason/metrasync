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

// ==========================================
// METRASYNC APP BACKEND PIPELINE
// ==========================================

ipcMain.on('import-data', async (event) => {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Import Note Vault Profile',
            filters: [{ name: 'JSON Files', extensions: ['json'] }],
            properties: ['openFile']
        });

        if (canceled || filePaths.length === 0) return;

        const fileContent = fs.readFileSync(filePaths[0], 'utf-8');
        
        // Extract the filename (e.g., "Jason" from "Jason_notevault.json")
        const fileName = path.basename(filePaths[0], '.json').replace('_notevault', '');
        
        // Send both the data and the filename back
        event.reply('data-loaded', fileContent, fileName);
    } catch (error) {
        console.error('Failed to read file:', error);
        event.reply('data-loaded', '{}', 'error');
    }
});

ipcMain.on('export-data', async (event, notes, defaultFilename) => {
    try {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Export Note Vault Profile',
            defaultPath: defaultFilename,
            filters: [{ name: 'JSON Files', extensions: ['json'] }]
        });

        if (canceled || !filePath) return;

        fs.writeFileSync(filePath, JSON.stringify(notes, null, 2));
    } catch (error) {
        console.error('Failed to save file:', error);
    }
});

ipcMain.on('print-to-pdf', async (event, partId) => {
     try {
         event.reply('pdf-export-started');
         
         const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
             title: 'Save Inspection PDF',
             defaultPath: `${partId}_inspection.pdf`,
             filters: [{ name: 'PDFs', extensions: ['pdf'] }]
         });

         if (canceled || !filePath) {
             event.reply('pdf-export-complete');
             return;
         }

         const pdfOptions = {
             marginsType: 0,
             printBackground: true,
             printSelectionOnly: false,
             landscape: false
         };

         const pdfBuffer = await mainWindow.webContents.printToPDF(pdfOptions);
         fs.writeFileSync(filePath, pdfBuffer);
         
         event.reply('pdf-export-complete');
     } catch (error) {
         console.error('PDF generation failed:', error);
         event.reply('pdf-export-complete');
     }
});