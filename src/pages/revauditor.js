(() => {
    function initRevAuditor() {
        // Find the specific wrapper for this tool
        const wrapper = document.querySelector('.revauditor-wrapper');
        if (!wrapper) {
            setTimeout(initRevAuditor, 50);
            return;
        }

        // Prevent multiple initializations if the SPA re-evaluates the script
        if (wrapper.dataset.initialized === 'true') return;
        wrapper.dataset.initialized = 'true';

        // --- CSS KILLSWITCH FOR SPA TAB SWITCHING ---
        // Automatically disables revauditor.css when looking at Note Vault to prevent layout bleed
        const styleLink = document.querySelector('link[href*="revauditor.css"]');
        if (styleLink) {
            setInterval(() => {
                const currentWrapper = document.querySelector('.revauditor-wrapper');
                // Check if wrapper is currently visible on the screen
                const isVisible = currentWrapper && currentWrapper.offsetWidth > 0;
                if (styleLink.disabled !== !isVisible) {
                    styleLink.disabled = !isVisible;
                }
            }, 100);
        }

        const DB_NAME = 'RevAuditor_Vault'; // Renamed to guarantee no cross-contamination
        const DB_VERSION = 1;
        const STORE_NAME = 'audits_store';
        
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
            }
        };

        let auditDocs = [];
        let auditState = 'idle';
        let confirmCallback = null;
        let CURRENT_PROFILE = localStorage.getItem('revauditor_toggle') === 'Quattro' ? 'Quattro' : 'Kinnex';

        // SCOPED DOM QUERY: Only grabs elements inside the Auditor to protect Note Vault
        const getEl = (id) => wrapper.querySelector(`#${id}`);

        // --- UI FUNCTIONS ---
        function showAlert(title, msg) {
            const t = getEl('auditAlertTitle'), m = getEl('auditAlertMessage'), modal = getEl('auditAlertModal'), ok = getEl('auditAlertOkBtn');
            if (t) t.textContent = title;
            if (m) m.textContent = msg;
            if (modal) modal.setAttribute('aria-hidden', 'false');
            if (ok) ok.focus();
        }
        function closeAlert() {
            const modal = getEl('auditAlertModal');
            if (modal) modal.setAttribute('aria-hidden', 'true');
        }

        function showConfirm(title, msg, onConfirm) {
            confirmCallback = onConfirm;
            const t = getEl('auditConfirmTitle'), m = getEl('auditConfirmMessage'), modal = getEl('auditConfirmModal');
            if (t) t.textContent = title;
            if (m) m.textContent = msg;
            if (modal) modal.setAttribute('aria-hidden', 'false');
        }
        function closeConfirm() {
            confirmCallback = null;
            const modal = getEl('auditConfirmModal');
            if (modal) modal.setAttribute('aria-hidden', 'true');
        }

        function renderTables() {
            const left = getEl('leftTable')?.querySelector('tbody');
            const right = getEl('rightTable')?.querySelector('tbody');
            if (!left || !right) return; 

            left.innerHTML = '';
            right.innerHTML = '';

            auditDocs.forEach(doc => {
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
                if (doc.group === 'Left Column') left.appendChild(tr);
                else right.appendChild(tr);
            });
        }

        async function saveData() {
            await db.set(CURRENT_PROFILE, auditDocs);
            renderTables();
        }

        function openDocModal(doc = null) {
            const modal = getEl('docEditModal');
            if (!modal) return;
            modal.setAttribute('aria-hidden', 'false');
            
            if (doc) {
                getEl('editDocIdHidden').value = doc.id;
                getEl('editDocGroup').value = doc.group;
                getEl('editDocName').value = doc.docId;
                getEl('editDocUrl').value = doc.url;
                getEl('editDocRev').value = doc.rev;
                getEl('editDocDate').value = doc.date;
                getEl('editDocPrevRev').value = doc.prevRev;
                getEl('editDocPrevDate').value = doc.prevDate;
                getEl('deleteDocBtn').style.display = 'block';
            } else {
                getEl('editDocIdHidden').value = '';
                getEl('editDocGroup').value = 'Left Column';
                getEl('editDocName').value = '';
                getEl('editDocUrl').value = '';
                getEl('editDocRev').value = '';
                getEl('editDocDate').value = '';
                getEl('editDocPrevRev').value = '';
                getEl('editDocPrevDate').value = '';
                getEl('deleteDocBtn').style.display = 'none';
            }
        }

        function closeDocModal() {
            const modal = getEl('docEditModal');
            if (modal) modal.setAttribute('aria-hidden', 'true');
        }

        async function switchProfile(name) {
            await saveData();
            CURRENT_PROFILE = name;
            localStorage.setItem('revauditor_toggle', name);
            
            const btnK = getEl('btnProfileKinnex');
            const btnQ = getEl('btnProfileQuattro');
            
            if (btnK && btnQ) {
                if (name === 'Kinnex') {
                    btnK.style.background = '#1976d2';
                    btnK.style.color = '#ffffff';
                    btnQ.style.background = 'transparent';
                    btnQ.style.color = '#cccccc';
                } else {
                    btnQ.style.background = '#1976d2';
                    btnQ.style.color = '#ffffff';
                    btnK.style.background = 'transparent';
                    btnK.style.color = '#cccccc';
                }
            }

            auditDocs = (await db.get(name)) || [];
            renderTables();
        }

        // --- SCOPED EVENT DELEGATION ---
        // Attaching to 'wrapper' instead of 'document' ensures we NEVER hijack Note Vault's buttons
        wrapper.addEventListener('click', async (e) => {
            try {
                if (e.target.closest('#auditAlertCloseBtn') || e.target.closest('#auditAlertOkBtn')) closeAlert();
                if (e.target.closest('#auditConfirmCancelBtn')) closeConfirm();
                if (e.target.closest('#auditConfirmOkBtn')) {
                    if (confirmCallback) confirmCallback();
                    closeConfirm();
                }

                if (e.target.closest('#docEditCloseBtn')) closeDocModal();
                if (e.target.closest('#addDocBtn')) openDocModal();
                
                const editBtn = e.target.closest('.edit-btn');
                if (editBtn) {
                    const id = editBtn.getAttribute('data-id');
                    const doc = auditDocs.find(d => d.id === id);
                    if (doc) openDocModal(doc);
                }

                if (e.target.closest('#saveDocBtn')) {
                    const id = getEl('editDocIdHidden').value || 'doc_' + Math.random().toString(36).substr(2, 9);
                    const newDoc = {
                        id: id,
                        group: getEl('editDocGroup').value,
                        docId: getEl('editDocName').value.trim(),
                        url: getEl('editDocUrl').value.trim(),
                        rev: getEl('editDocRev').value.trim(),
                        date: getEl('editDocDate').value.trim(),
                        prevRev: getEl('editDocPrevRev').value.trim(),
                        prevDate: getEl('editDocPrevDate').value.trim(),
                        status: 'ok' 
                    };

                    const existingIndex = auditDocs.findIndex(d => d.id === id);
                    if (existingIndex >= 0) auditDocs[existingIndex] = newDoc;
                    else auditDocs.push(newDoc);

                    await saveData();
                    closeDocModal();
                }

                if (e.target.closest('#deleteDocBtn')) {
                    showConfirm("Delete Document", "Are you sure you want to remove this document from the audit list?", async () => {
                        auditDocs = auditDocs.filter(d => d.id !== getEl('editDocIdHidden').value);
                        await saveData();
                        closeDocModal();
                    });
                }

                if (e.target.closest('#btnProfileKinnex')) {
                    if (CURRENT_PROFILE !== 'Kinnex' && auditState === 'idle') switchProfile('Kinnex');
                }
                if (e.target.closest('#btnProfileQuattro')) {
                    if (CURRENT_PROFILE !== 'Quattro' && auditState === 'idle') switchProfile('Quattro');
                }

                if (e.target.closest('#printBtn')) {
                    if (window.api && window.api.printToPdf) window.api.printToPdf(`${CURRENT_PROFILE}_Audit_Report`);
                }

                if (e.target.closest('#startAuditBtn')) {
                    const startBtn = getEl('startAuditBtn');
                    const abortBtn = getEl('abortAuditBtn');
                    const btnK = getEl('btnProfileKinnex');
                    const btnQ = getEl('btnProfileQuattro');
                    const status = getEl('auditStatusLabel');
                    const prog = getEl('auditProgressBar');

                    if (auditState === 'idle') {
                        auditDocs.forEach(d => d.status = 'ok'); 
                        await saveData();
                        auditState = 'scanning';
                        
                        if(btnK) btnK.disabled = true;
                        if(btnQ) btnQ.disabled = true;
                        if(startBtn) {
                            startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> SCANNING...';
                            startBtn.disabled = true;
                            startBtn.style.background = '';
                        }
                        if(abortBtn) abortBtn.disabled = false;
                        
                        if (window.api && window.api.startNativeAudit) window.api.startNativeAudit(auditDocs);
                        
                    } else if (auditState === 'waiting') {
                        auditState = 'scanning';
                        if(startBtn) {
                            startBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> SCANNING...';
                            startBtn.style.background = '';
                            startBtn.style.color = '';
                            startBtn.disabled = true;
                        }
                        if (window.api && window.api.resumeAudit) window.api.resumeAudit();
                        
                    } else if (auditState === 'finished') {
                        auditState = 'idle';
                        if(btnK) btnK.disabled = false;
                        if(btnQ) btnQ.disabled = false;
                        if(startBtn) {
                            startBtn.innerHTML = '<i class="fa-solid fa-play"></i> Start Audit';
                            startBtn.style.background = '';
                        }
                        if(status) status.textContent = 'Ready to scan.';
                        if(prog) prog.style.width = '0%';
                    }
                }

                if (e.target.closest('#abortAuditBtn')) {
                    const status = getEl('auditStatusLabel');
                    const startBtn = getEl('startAuditBtn');
                    const abortBtn = getEl('abortAuditBtn');
                    
                    if(status) status.textContent = 'Aborting...';
                    if(startBtn) startBtn.disabled = true;
                    if(abortBtn) abortBtn.disabled = true;
                    if (window.api && window.api.abortAudit) window.api.abortAudit();
                }
            } catch (err) {
                console.error("RevAuditor Click Error:", err);
            }
        });

        // --- IPC LISTENERS (Bound once globally, executed safely) ---
        if (!window.__revAuditorIpcBound && window.api) {
            
            // Helper to always find the active wrapper in case SPA refreshed the DOM
            const getActiveEl = (selector) => {
                const w = document.querySelector('.revauditor-wrapper');
                return w ? w.querySelector(selector) : null;
            };

            window.api.onAuditStatus((status) => {
                const el = getActiveEl('#auditStatusLabel');
                if (el) el.textContent = status;
            });
            
            window.api.onAuditProgress((pct) => {
                const el = getActiveEl('#auditProgressBar');
                if (el) el.style.width = `${pct}%`;
            });
            
            window.api.onAuditDeadLink(async (id) => {
                const doc = auditDocs.find(d => d.id === id);
                if (doc) {
                    doc.status = 'dead';
                    await saveData(); 
                }
            });

            window.api.onAuditValidationFailed((msg) => {
                auditState = 'waiting';
                const status = getActiveEl('#auditStatusLabel');
                const startBtn = getActiveEl('#startAuditBtn');
                const modal = getActiveEl('#auditAlertModal');
                const t = getActiveEl('#auditAlertTitle');
                const m = getActiveEl('#auditAlertMessage');
                
                if (t) t.textContent = "Login Required";
                if (m) m.textContent = msg;
                if (modal) modal.setAttribute('aria-hidden', 'false');
                
                if(status) status.textContent = "Waiting for Laserfiche Login...";
                if(startBtn) {
                    startBtn.innerHTML = '<i class="fa-solid fa-forward"></i> RESUME AUDIT';
                    startBtn.style.background = '#f39c12'; 
                    startBtn.style.color = '#fff';
                    startBtn.disabled = false;
                }
            });

            window.api.onAuditFinished((msg) => {
                auditState = 'finished';
                const status = getActiveEl('#auditStatusLabel');
                const startBtn = getActiveEl('#startAuditBtn');
                const abortBtn = getActiveEl('#abortAuditBtn');
                
                if(status) status.textContent = msg;
                if(startBtn) {
                    startBtn.innerHTML = '<i class="fa-solid fa-check"></i> ACKNOWLEDGE';
                    startBtn.disabled = false;
                    startBtn.style.background = 'var(--accent)'; 
                }
                if(abortBtn) abortBtn.disabled = true;
            });

            window.api.onAuditError((msg) => {
                auditState = 'finished';
                const status = getActiveEl('#auditStatusLabel');
                const startBtn = getActiveEl('#startAuditBtn');
                const abortBtn = getActiveEl('#abortAuditBtn');
                const modal = getActiveEl('#auditAlertModal');
                const t = getActiveEl('#auditAlertTitle');
                const m = getActiveEl('#auditAlertMessage');
                
                if (t) t.textContent = "Error";
                if (m) m.textContent = msg;
                if (modal) modal.setAttribute('aria-hidden', 'false');

                if(status) status.textContent = "Error Occurred";
                if(startBtn) {
                    startBtn.innerHTML = '<i class="fa-solid fa-check"></i> ACKNOWLEDGE';
                    startBtn.disabled = false;
                    startBtn.style.background = 'var(--accent)';
                }
                if(abortBtn) abortBtn.disabled = true;
            });

            window.__revAuditorIpcBound = true;
        }

        // --- INITIALIZE ---
        setTimeout(async () => {
            try {
                let keys = await db.getAllKeys();
                if (!keys.includes('Kinnex')) await db.set('Kinnex', []);
                if (!keys.includes('Quattro')) await db.set('Quattro', []);
                await switchProfile(CURRENT_PROFILE);
            } catch (e) {
                console.error("RevAuditor Init Error:", e);
            }
        }, 50);
    }

    // Fire initialization
    initRevAuditor();
})();