const DB_NAME = 'RevAuditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'audits_store';
let CURRENT_PROFILE = 'Kinnex';

const db = {
    _db: null,
    open() {
        return new Promise((resolve, reject) => {
            if (this._db) return resolve(this._db);
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(new Error('Could not open database.'));
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = (e) => {
                this._db = e.target.result;
                resolve(this._db);
            };
        });
    },
    async get(key) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = (e) => resolve(e.target.result);
        });
    },
    async set(key, data) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(data, key);
            request.onsuccess = (e) => resolve();
        });
    },
    async getAllKeys() {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAllKeys();
            request.onsuccess = (e) => resolve(e.target.result);
        });
    },
    async deleteKey(key) {
        const db = await this.open();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);
            request.onsuccess = (e) => resolve();
        });
    }
};

let documents = [];
let auditState = 'idle';
let confirmCallback = null;

const els = {
    status: document.getElementById('auditStatusLabel'),
    progress: document.getElementById('auditProgressBar'),
    startBtn: document.getElementById('startAuditBtn'),
    abortBtn: document.getElementById('abortAuditBtn'),
    addDocBtn: document.getElementById('addDocBtn'),
    importBtn: document.getElementById('importLegacyBtn'),
    printBtn: document.getElementById('printBtn'),
    leftTableBody: document.querySelector('#leftTable tbody'),
    rightTableBody: document.querySelector('#rightTable tbody'),
    
    profileBtn: document.getElementById('currentProfileBtn'),
    profileModal: document.getElementById('profileModal'),
    profileList: document.getElementById('profileList'),
    profileClose: document.getElementById('profileCloseBtn'),
    newProfileInput: document.getElementById('newProfileInput'),
    createProfileBtn: document.getElementById('createProfileBtn'),

    docModal: document.getElementById('docEditModal'),
    docEditId: document.getElementById('editDocIdHidden'),
    docGroup: document.getElementById('editDocGroup'),
    docName: document.getElementById('editDocName'),
    docUrl: document.getElementById('editDocUrl'),
    docRev: document.getElementById('editDocRev'),
    docDate: document.getElementById('editDocDate'),
    docPrevRev: document.getElementById('editDocPrevRev'),
    docPrevDate: document.getElementById('editDocPrevDate'),
    saveDocBtn: document.getElementById('saveDocBtn'),
    deleteDocBtn: document.getElementById('deleteDocBtn'),
    docClose: document.getElementById('docEditCloseBtn'),

    alertModal: document.getElementById('auditAlertModal'),
    alertTitle: document.getElementById('auditAlertTitle'),
    alertMsg: document.getElementById('auditAlertMessage'),
    alertClose: document.getElementById('auditAlertCloseBtn'),
    alertOk: document.getElementById('auditAlertOkBtn'),

    confirmModal: document.getElementById('auditConfirmModal'),
    confirmTitle: document.getElementById('auditConfirmTitle'),
    confirmMsg: document.getElementById('auditConfirmMessage'),
    confirmCancel: document.getElementById('auditConfirmCancelBtn'),
    confirmOk: document.getElementById('auditConfirmOkBtn')
};

// --- ALERT & CONFIRM UI ---
function showAlert(title, msg) {
    els.alertTitle.textContent = title;
    els.alertMsg.textContent = msg;
    els.alertModal.setAttribute('aria-hidden', 'false');
    els.alertOk.focus();
}
function closeAlert() { els.alertModal.setAttribute('aria-hidden', 'true'); }
els.alertClose.addEventListener('click', closeAlert);
els.alertOk.addEventListener('click', closeAlert);

function showConfirm(title, msg, onConfirm) {
    confirmCallback = onConfirm;
    els.confirmTitle.textContent = title;
    els.confirmMsg.textContent = msg;
    els.confirmModal.setAttribute('aria-hidden', 'false');
}
function closeConfirm() {
    confirmCallback = null;
    els.confirmModal.setAttribute('aria-hidden', 'true');
}
els.confirmCancel.addEventListener('click', closeConfirm);
els.confirmOk.addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
    closeConfirm();
});

// --- RENDER TABLES ---
function renderTables() {
    els.leftTableBody.innerHTML = '';
    els.rightTableBody.innerHTML = '';

    documents.forEach(doc => {
        const tr = document.createElement('tr');
        if (doc.status === 'dead') tr.classList.add('status-dead');

        tr.innerHTML = `
            <td><a href="${doc.url}" target="_blank" style="color:inherit; text-decoration:none;">${doc.docId}</a></td>
            <td>${doc.rev}</td>
            <td>${doc.date}</td>
            <td>${doc.prevRev}</td>
            <td>${doc.prevDate}</td>
            <td class="no-print"><button class="edit-btn" data-id="${doc.id}"><i class="fa-solid fa-pen"></i></button></td>
        `;

        tr.querySelector('.edit-btn').addEventListener('click', () => openDocModal(doc));

        if (doc.group === 'Left Column') els.leftTableBody.appendChild(tr);
        else els.rightTableBody.appendChild(tr);
    });
}

async function saveData() {
    await db.set(CURRENT_PROFILE, documents);
    renderTables();
}

// --- DOCUMENT MODAL ---
function openDocModal(doc = null) {
    els.docModal.setAttribute('aria-hidden', 'false');
    if (doc) {
        els.docEditId.value = doc.id;
        els.docGroup.value = doc.group;
        els.docName.value = doc.docId;
        els.docUrl.value = doc.url;
        els.docRev.value = doc.rev;
        els.docDate.value = doc.date;
        els.docPrevRev.value = doc.prevRev;
        els.docPrevDate.value = doc.prevDate;
        els.deleteDocBtn.style.display = 'block';
    } else {
        els.docEditId.value = '';
        els.docGroup.value = 'Left Column';
        els.docName.value = '';
        els.docUrl.value = '';
        els.docRev.value = '';
        els.docDate.value = '';
        els.docPrevRev.value = '';
        els.docPrevDate.value = '';
        els.deleteDocBtn.style.display = 'none';
    }
}
function closeDocModal() { els.docModal.setAttribute('aria-hidden', 'true'); }
els.docClose.addEventListener('click', closeDocModal);
els.addDocBtn.addEventListener('click', () => openDocModal());

els.saveDocBtn.addEventListener('click', async () => {
    const id = els.docEditId.value || 'doc_' + Math.random().toString(36).substr(2, 9);
    const newDoc = {
        id: id,
        group: els.docGroup.value,
        docId: els.docName.value.trim(),
        url: els.docUrl.value.trim(),
        rev: els.docRev.value.trim(),
        date: els.docDate.value.trim(),
        prevRev: els.docPrevRev.value.trim(),
        prevDate: els.docPrevDate.value.trim(),
        status: 'ok' // Editing resets status
    };

    const existingIndex = documents.findIndex(d => d.id === id);
    if (existingIndex >= 0) documents[existingIndex] = newDoc;
    else documents.push(newDoc);

    await saveData();
    closeDocModal();
});

els.deleteDocBtn.addEventListener('click', () => {
    showConfirm("Delete Document", "Are you sure you want to remove this document from the audit list?", async () => {
        documents = documents.filter(d => d.id !== els.docEditId.value);
        await saveData();
        closeDocModal();
    });
});

// --- PROFILE MANAGEMENT ---
async function switchProfile(name) {
    await saveData();
    CURRENT_PROFILE = name;
    localStorage.setItem('revauditor_profile', name);
    els.profileBtn.textContent = `Profile: ${name}`;
    documents = (await db.get(name)) || [];
    renderTables();
    els.profileModal.setAttribute('aria-hidden', 'true');
}

async function renderProfiles() {
    els.profileList.innerHTML = '';
    let keys = await db.getAllKeys();
    if (keys.length === 0) {
        await db.set('Kinnex', []);
        await db.set('Quattro', []);
        keys = ['Kinnex', 'Quattro'];
    }

    keys.forEach(key => {
        const item = document.createElement('div');
        item.className = 'profile-list-item';
        
        const switchBtn = document.createElement('button');
        switchBtn.className = `profile-switch-btn ${key === CURRENT_PROFILE ? 'active' : ''}`;
        switchBtn.textContent = key;
        switchBtn.onclick = () => switchProfile(key);

        const delBtn = document.createElement('button');
        delBtn.className = 'profile-delete-btn danger';
        delBtn.textContent = 'Delete';
        delBtn.onclick = () => {
            showConfirm("Delete Profile?", `Permanently delete profile "${key}"?`, async () => {
                await db.deleteKey(key);
                if (key === CURRENT_PROFILE) await switchProfile((await db.getAllKeys())[0]);
                else renderProfiles();
            });
        };
        if (keys.length === 1) delBtn.disabled = true;

        item.appendChild(switchBtn);
        item.appendChild(delBtn);
        els.profileList.appendChild(item);
    });
}

els.profileBtn.addEventListener('click', async () => {
    await renderProfiles();
    els.profileModal.setAttribute('aria-hidden', 'false');
});
els.profileClose.addEventListener('click', () => els.profileModal.setAttribute('aria-hidden', 'true'));
els.createProfileBtn.addEventListener('click', async () => {
    const name = els.newProfileInput.value.trim().replace(/[^a-z0-9-_ ]/gi, "_");
    if (!name) return;
    const keys = await db.getAllKeys();
    if (keys.includes(name)) return showAlert("Error", "Profile already exists.");
    await db.set(name, []);
    await switchProfile(name);
});

// --- IPC CONTROLS ---
els.importBtn.addEventListener('click', () => window.api.importLegacyExcel());
window.api.onLegacyExcelImported(async (docs) => {
    if (docs.length === 0) return showAlert("Notice", "No valid links found in the selected Excel file.");
    showConfirm("Import Success", `Found ${docs.length} documents. Replace current profile data?`, async () => {
        documents = docs;
        await saveData();
    });
});

els.printBtn.addEventListener('click', () => window.api.printToPdf(`${CURRENT_PROFILE}_Audit_Report`));

els.startBtn.addEventListener('click', async () => {
    if (auditState === 'idle') {
        documents.forEach(d => d.status = 'ok'); // Reset statuses
        await saveData();
        auditState = 'scanning';
        els.startBtn.textContent = 'SCANNING...';
        els.startBtn.disabled = true;
        els.abortBtn.disabled = false;
        window.api.startNativeAudit(documents);
    } else if (auditState === 'waiting') {
        auditState = 'scanning';
        els.startBtn.textContent = 'SCANNING...';
        els.startBtn.disabled = true;
        window.api.resumeAudit();
    } else if (auditState === 'finished') {
        auditState = 'idle';
        els.startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start Audit';
        els.startBtn.style.background = '';
        els.status.textContent = 'Ready to scan.';
        els.progress.style.width = '0%';
    }
});

els.abortBtn.addEventListener('click', () => {
    els.status.textContent = 'Aborting...';
    els.startBtn.disabled = true;
    els.abortBtn.disabled = true;
    window.api.abortAudit();
});

window.api.onAuditStatus((status) => els.status.textContent = status);
window.api.onAuditProgress((pct) => els.progress.style.width = `${pct}%`);
window.api.onAuditDeadLink(async (id) => {
    const doc = documents.find(d => d.id === id);
    if (doc) {
        doc.status = 'dead';
        await saveData(); // Re-renders yellow row instantly
    }
});
window.api.onAuditValidationFailed((msg) => {
    auditState = 'waiting';
    showAlert("Login Required", msg);
    els.status.textContent = "Waiting for Login...";
    els.startBtn.textContent = "RESUME AUDIT";
    els.startBtn.disabled = false;
});
window.api.onAuditFinished((msg) => {
    auditState = 'finished';
    els.status.textContent = msg;
    els.startBtn.textContent = "ACKNOWLEDGE";
    els.startBtn.disabled = false;
    els.startBtn.style.background = 'var(--accent)'; 
    els.abortBtn.disabled = true;
});
window.api.onAuditError((msg) => {
    auditState = 'finished';
    els.status.textContent = "Error Occurred";
    showAlert("Error", msg);
    els.startBtn.textContent = "ACKNOWLEDGE";
    els.startBtn.disabled = false;
    els.startBtn.style.background = 'var(--accent)';
    els.abortBtn.disabled = true;
});

// --- INIT ---
(async () => {
    let keys = await db.getAllKeys();
    if (keys.length === 0) {
        await db.set('Kinnex', []);
        await db.set('Quattro', []);
    }
    const last = localStorage.getItem('revauditor_profile');
    await switchProfile(last && keys.includes(last) ? last : 'Kinnex');
})();