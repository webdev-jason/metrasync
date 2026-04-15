const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { chromium } = require('playwright');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        title: "MetraSync Dashboard",
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.maximize();
    mainWindow.show();

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

// --- GENERAL IPC ---
ipcMain.on('print-to-pdf', async (event, filename) => {
     try {
         event.reply('pdf-export-started');
         
         const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
             title: 'Save PDF',
             defaultPath: `${filename}.pdf`,
             filters: [{ name: 'PDFs', extensions: ['pdf'] }]
         });

         if (canceled || !filePath) {
             event.reply('pdf-export-complete');
             return;
         }

         const pdfOptions = { marginsType: 0, printBackground: true, printSelectionOnly: false, landscape: false };
         const pdfBuffer = await mainWindow.webContents.printToPDF(pdfOptions);
         fs.writeFileSync(filePath, pdfBuffer);
         
         event.reply('pdf-export-complete');
     } catch (error) {
         console.error('PDF generation failed:', error);
         event.reply('pdf-export-complete');
     }
});

// --- NOTE VAULT IPC ---
ipcMain.on('import-data', async (event) => {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Import Note Vault Profile',
            filters: [{ name: 'JSON Files', extensions: ['json'] }],
            properties: ['openFile']
        });

        if (canceled || filePaths.length === 0) return;

        const fileContent = fs.readFileSync(filePaths[0], 'utf-8');
        const fileName = path.basename(filePaths[0], '.json').replace('_notevault', '');
        
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

// --- NATIVE REVISION AUDITOR IPC ---
let auditBrowser = null;
let auditIsRunning = false;
let auditStartPermission = false;

function formatDate(val) {
    if (!val) return '';
    if (val instanceof Date) {
        return `${val.getMonth()+1}/${val.getDate()}/${val.getFullYear()}`;
    }
    return val.toString();
}

ipcMain.on('import-legacy-excel', async (event) => {
    try {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Select Legacy Excel Source',
            filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
            properties: ['openFile']
        });

        if (canceled || filePaths.length === 0) return;

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.readFile(filePaths[0]);
        const ws = wb.worksheets[0];

        let docs = [];
        // Map Col A to 'Left Column' and Col G to 'Right Column' to preserve layout
        const scanCols = [
            { id: 1, rev: 2, date: 3, prevRev: 4, prevDate: 5, group: 'Left Column' },
            { id: 7, rev: 8, date: 9, prevRev: 10, prevDate: 11, group: 'Right Column' }
        ];

        for (let c of scanCols) {
            for (let r = 3; r <= 100; r++) {
                const idCell = ws.getRow(r).getCell(c.id);
                if (idCell && idCell.value && idCell.hyperlink) {
                    docs.push({
                        id: 'doc_' + Math.random().toString(36).substr(2, 9),
                        group: c.group,
                        docId: idCell.value.text || idCell.value.toString(),
                        url: idCell.hyperlink,
                        rev: formatDate(ws.getRow(r).getCell(c.rev).value),
                        date: formatDate(ws.getRow(r).getCell(c.date).value),
                        prevRev: formatDate(ws.getRow(r).getCell(c.prevRev).value),
                        prevDate: formatDate(ws.getRow(r).getCell(c.prevDate).value),
                        status: 'ok' // Default status
                    });
                }
            }
        }
        event.reply('legacy-excel-imported', docs);
    } catch (error) {
        console.error(error);
        event.reply('audit-error', 'Failed to read Excel file. Make sure it is not open in another program.');
    }
});

ipcMain.on('start-native-audit', async (event, links) => {
    auditIsRunning = true;
    auditStartPermission = false;

    if (!links || links.length === 0) {
        event.reply('audit-finished', 'No documents to scan.');
        return;
    }

    try {
        event.reply('audit-status', 'Launching Browser...');
        auditBrowser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
        const context = await auditBrowser.newContext({ noViewport: true });
        const page = await context.newPage();

        try { await page.goto(links[0].url); } catch (e) {}

        // Login Pause Loop
        while (auditIsRunning) {
            event.reply('audit-status', 'WAITING: Log in to Laserfiche, then click START.');
            while (!auditStartPermission) {
                if (!auditIsRunning) break;
                await new Promise(r => setTimeout(r, 500));
            }
            if (!auditIsRunning) break;

            try {
                const title = (await page.title()).toLowerCase();
                const currentUrl = page.url().toLowerCase();
                if (title.includes("login") || title.includes("sign in") || currentUrl.includes("login")) {
                    event.reply('audit-validation-failed', "Login Screen Detected!\n\nPlease log in to Laserfiche, then click 'START AUDIT' again.");
                    auditStartPermission = false;
                    continue;
                }
            } catch (e) {}
            break;
        }

        if (!auditIsRunning) {
            if (auditBrowser) await auditBrowser.close();
            event.reply('audit-finished', 'User Aborted Audit.');
            return;
        }

        event.reply('audit-status', 'Audit Started...');
        
        for (let i = 0; i < links.length; i++) {
            if (!auditIsRunning) break;
            const item = links[i];
            event.reply('audit-status', `Checking: ${item.docId}`);
            event.reply('audit-progress', Math.floor((i / links.length) * 100));

            let isDead = false;
            try {
                await page.goto(item.url);
                await page.waitForLoadState('domcontentloaded');
                const title = (await page.title()).toLowerCase();
                let bodyText = "";
                try { bodyText = (await page.innerText("body")).toLowerCase(); } catch (e) {}

                if (title.includes("entry not found") || title.includes("404") || title.includes("login") || title.includes("application error") || bodyText.includes("entry not found")) {
                    isDead = true;
                }
            } catch (e) {
                isDead = true;
            }

            if (isDead) {
                event.reply('audit-dead-link', item.id);
            }
        }

        if (auditBrowser) await auditBrowser.close();

        if (!auditIsRunning) {
            event.reply('audit-finished', 'User Aborted Audit.');
        } else {
            event.reply('audit-progress', 100);
            event.reply('audit-finished', 'Audit Complete!');
        }

    } catch (error) {
        console.error(error);
        event.reply('audit-error', error.toString());
        if (auditBrowser) { try { await auditBrowser.close(); } catch(e){} }
    }
});

ipcMain.on('resume-audit', () => { auditStartPermission = true; });

ipcMain.on('abort-audit', async () => {
    auditIsRunning = false;
    if (auditBrowser) {
        try { await auditBrowser.close(); } catch (e) {}
    }
});