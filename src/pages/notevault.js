const DB_NAME = 'NoteVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'notes_store';
let CURRENT_PROFILE_KEY = 'default_notes'; 
const LEGACY_STORAGE_KEY = "notevault.v1.notes"; 

const db = {
  _db: null,

  open() {
    return new Promise((resolve, reject) => {
      if (this._db) return resolve(this._db);
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = (e) => reject(new Error('Could not open database.'));
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
      request.onerror = (e) => reject(new Error('Could not get notes.'));
      request.onsuccess = (e) => resolve(e.target.result);
    });
  },

  async set(key, data) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data, key);
      request.onerror = (e) => reject(new Error('Could not save notes.'));
      request.onsuccess = (e) => resolve(e.target.result);
    });
  },

  async getAllKeys() {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();
      request.onerror = (e) => reject(new Error('Could not get keys.'));
      request.onsuccess = (e) => resolve(e.target.result);
    });
  },

  async deleteKey(key) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onerror = (e) => reject(new Error('Could not delete profile.'));
      request.onsuccess = (e) => resolve();
    });
  }
};

let notes = [];
let selectedNoteId = null;
let selectedImageId = null;
let imageViewerZoom = 1;

const els = {
  notesList: document.getElementById("notesList"),
  searchInput: document.getElementById("searchInput"),
  appMain: document.querySelector(".app-main"),
  viewer: document.getElementById("viewer"),
  viewerTitle: document.getElementById("viewerTitle"),
  addNoteBtn: document.getElementById("addNoteBtn"),
  copyNoteBtn: document.getElementById("copyNoteBtn"), 
  saveNoteBtn: document.getElementById("saveNoteBtn"), 
  deleteNoteBtn: document.getElementById("deleteNoteBtn"),
  partIdInput: document.getElementById("partIdInput"),
  notesInput: document.getElementById("notesInput"),
  addImageBtn: document.getElementById("addImageBtn"),
  imageInput: document.getElementById("imageInput"),
  imagesContainer: document.getElementById("imagesContainer"),
  imageCaptionInput: document.getElementById("imageCaptionInput"),
  noteListItemTemplate: document.getElementById("noteListItemTemplate"),
  expandBtn: document.getElementById("expandBtn"),
  printBtn: document.getElementById("printBtn"), 
  exportDataBtn: document.getElementById("exportDataBtn"),
  importDataBtn: document.getElementById("importDataBtn"),
  currentProfileBtn: document.getElementById("currentProfileBtn"),
  profileModal: document.getElementById("profileModal"),
  profileCloseBtn: document.getElementById("profileCloseBtn"),
  profileList: document.getElementById("profileList"),
  newProfileInput: document.getElementById("newProfileInput"),
  createProfileBtn: document.getElementById("createProfileBtn"),
  appAlertModal: document.getElementById("appAlertModal"),
  appAlertTitle: document.getElementById("appAlertTitle"),
  appAlertMessage: document.getElementById("appAlertMessage"),
  appAlertCloseBtn: document.getElementById("appAlertCloseBtn"),
  appAlertOkBtn: document.getElementById("appAlertOkBtn"),
  appConfirmModal: document.getElementById("appConfirmModal"),
  appConfirmTitle: document.getElementById("appConfirmTitle"),
  appConfirmMessage: document.getElementById("appConfirmMessage"),
  appConfirmCancelBtn: document.getElementById("appConfirmCancelBtn"),
  appConfirmOkBtn: document.getElementById("appConfirmOkBtn"),
  cropperModal: document.getElementById("cropperModal"),
  cropperImage: document.getElementById("cropperImage"),
  cropperStage: document.querySelector(".cropper-stage"),
  cropBox: document.getElementById("cropBox"),
  cropSizeRange: document.getElementById("cropSizeRange"), 
  cropperCloseBtn: document.getElementById("cropperCloseBtn"),
  cropperCancelBtn: document.getElementById("cropperCancelBtn"),
  cropperApplyBtn: document.getElementById("cropperApplyBtn"),
  cropMinusBtn: document.getElementById("cropMinusBtn"),
  cropPlusBtn: document.getElementById("cropPlusBtn"),
  cropCenterBtn: document.getElementById("cropCenterBtn"),
  imageViewerModal: document.getElementById("imageViewerModal"),
  modalViewerImage: document.getElementById("modalViewerImage"),
  modalViewerCloseBtn: document.getElementById("modalViewerCloseBtn"),
};

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

let confirmCallback = null;

function showAppAlert(title, message) {
  els.appAlertTitle.textContent = title;
  els.appAlertMessage.textContent = message;
  els.appAlertModal.setAttribute("aria-hidden", "false");
  els.appAlertOkBtn.focus();
}

function closeAppAlert() {
  els.appAlertModal.setAttribute("aria-hidden", "true");
}

function showAppConfirm(title, message, onConfirm, danger = false) {
  confirmCallback = onConfirm;
  els.appConfirmTitle.textContent = title;
  els.appConfirmMessage.textContent = message;
  
  if (danger) {
    els.appConfirmOkBtn.classList.add("danger");
    els.appConfirmOkBtn.classList.remove("primary");
  } else {
    els.appConfirmOkBtn.classList.add("primary");
    els.appConfirmOkBtn.classList.remove("danger");
  }
  
  els.appConfirmModal.setAttribute("aria-hidden", "false");
  els.appConfirmCancelBtn.focus();
}

function closeAppConfirm() {
  confirmCallback = null;
  els.appConfirmModal.setAttribute("aria-hidden", "true");
}

els.appAlertCloseBtn.addEventListener("click", closeAppAlert);
els.appAlertOkBtn.addEventListener("click", closeAppAlert);
els.appConfirmCancelBtn.addEventListener("click", closeAppConfirm);
els.appConfirmOkBtn.addEventListener("click", () => {
  if (confirmCallback) confirmCallback();
  closeAppConfirm();
});

let cropperState = {
  imageId: null,
  naturalWidth: 0,
  naturalHeight: 0,
  imgRect: null,
  crop: { x: 0, y: 0, size: 100 },
  zoom: 1,
};

async function openCropper(imgObj) {
  if (!imgObj.originalDataUrl) {
    imgObj.originalDataUrl = imgObj.dataUrl;
    await saveNotes();
  }
  els.cropperImage.src = imgObj.originalDataUrl || imgObj.dataUrl;
  cropperState.imageId = imgObj.id;
  els.cropperModal.setAttribute("aria-hidden", "false");
  selectedImageId = imgObj.id;
  setZoom(1);
  
  requestAnimationFrame(() => {
    const rect = getDisplayedImageRect();
    cropperState.imgRect = rect;
    cropperState.naturalWidth = els.cropperImage.naturalWidth;
    cropperState.naturalHeight = els.cropperImage.naturalHeight;
    
    if (imgObj.lastCrop) {
        const s = imgObj.lastCrop.relSize * rect.width;
        const x = rect.left + (imgObj.lastCrop.relX * rect.width);
        const y = rect.top + (imgObj.lastCrop.relY * rect.height);
        positionCropBox(x, y, s);
    } else {
        const size = Math.min(rect.width, rect.height) * 0.6;
        const x = rect.left + (rect.width - size) / 2;
        const y = rect.top + (rect.height - size) / 2;
        positionCropBox(x, y, size);
    }
    
    syncCropControls();
  });
}

function closeCropper() {
  els.cropperModal.setAttribute("aria-hidden", "true");
}

function positionCropBox(viewX, viewY, viewSize) {
  const container = els.cropperStage.getBoundingClientRect();
  const imageRect = getDisplayedImageRect();
  const cb = els.cropBox;
  const maxSize = Math.min(imageRect.width, imageRect.height);
  const size = Math.max(20, Math.min(viewSize, maxSize));
  const minLeft = imageRect.left;
  const minTop = imageRect.top;
  const maxLeft = imageRect.right - size;
  const maxTop = imageRect.bottom - size;
  const x = Math.max(minLeft, Math.min(viewX, maxLeft));
  const y = Math.max(minTop, Math.min(viewY, maxTop));
  cb.style.left = `${x - container.left}px`;
  cb.style.top = `${y - container.top}px`;
  cb.style.width = `${size}px`;
  cb.style.height = `${size}px`;
  cropperState.crop = { x, y, size };
  syncCropControls();
}

const interaction = {
  active: false,
  mode: null,
  startX: 0,
  startY: 0,
  startRect: null,
  resizeAnchor: { x: 0, y: 0 },
  resizeCorner: null
};

els.cropBox.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  e.stopPropagation(); 
  
  const target = e.target;
  const isHandle = target.classList.contains('handle');
  
  interaction.active = true;
  interaction.startX = e.clientX;
  interaction.startY = e.clientY;
  interaction.startRect = els.cropBox.getBoundingClientRect();
  
  if (isHandle) {
    interaction.mode = 'resize';
    interaction.resizeCorner = target.dataset.corner || (target.classList.contains('nw') ? 'nw' : target.classList.contains('ne') ? 'ne' : target.classList.contains('sw') ? 'sw' : 'se');
    
    const rect = interaction.startRect;
    if (interaction.resizeCorner === 'nw') interaction.resizeAnchor = { x: rect.right, y: rect.bottom };
    if (interaction.resizeCorner === 'ne') interaction.resizeAnchor = { x: rect.left, y: rect.bottom };
    if (interaction.resizeCorner === 'sw') interaction.resizeAnchor = { x: rect.right, y: rect.top };
    if (interaction.resizeCorner === 'se') interaction.resizeAnchor = { x: rect.left, y: rect.top };
    
  } else {
    interaction.mode = 'move';
  }
  
  els.cropBox.setPointerCapture(e.pointerId);
});

window.addEventListener("pointermove", (e) => {
  if (!interaction.active) return;
  e.preventDefault();
  
  if (interaction.mode === 'move') {
    const dx = e.clientX - interaction.startX;
    const dy = e.clientY - interaction.startY;
    positionCropBox(interaction.startRect.left + dx, interaction.startRect.top + dy, interaction.startRect.width);
  } 
  else if (interaction.mode === 'resize') {
    const imgRect = els.cropperImage.getBoundingClientRect();
    const cx = Math.max(imgRect.left, Math.min(e.clientX, imgRect.right));
    const cy = Math.max(imgRect.top, Math.min(e.clientY, imgRect.bottom));
    
    const newSize = Math.max(20, Math.min(
      Math.min(imgRect.width, imgRect.height),
      Math.max(Math.abs(cx - interaction.resizeAnchor.x), Math.abs(cy - interaction.resizeAnchor.y))
    ));
    
    let x = interaction.resizeAnchor.x;
    let y = interaction.resizeAnchor.y;
    
    if (interaction.resizeCorner === 'nw') { x = interaction.resizeAnchor.x - newSize; y = interaction.resizeAnchor.y - newSize; }
    if (interaction.resizeCorner === 'ne') { x = interaction.resizeAnchor.x;           y = interaction.resizeAnchor.y - newSize; }
    if (interaction.resizeCorner === 'sw') { x = interaction.resizeAnchor.x - newSize; y = interaction.resizeAnchor.y; }
    if (interaction.resizeCorner === 'se') { x = interaction.resizeAnchor.x;           y = interaction.resizeAnchor.y; }
    
    positionCropBox(x, y, newSize);
  }
});

window.addEventListener("pointerup", (e) => {
  interaction.active = false;
  interaction.mode = null;
});

els.cropBox.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const delta = Math.sign(e.deltaY);
    const rect = els.cropBox.getBoundingClientRect();
    const newSize = rect.width * (1 - 0.08 * delta);
    positionCropBox(rect.left, rect.top, newSize);
  },
  { passive: false }
);

els.cropperImage.addEventListener("click", (e) => {
  const stage = getDisplayedImageRect();
  const cbRect = els.cropBox.getBoundingClientRect();
  const size = cbRect.width;
  const targetX = e.clientX - size / 2;
  const targetY = e.clientY - size / 2;
  positionCropBox(targetX, targetY, size);
});

els.cropBox.addEventListener("keydown", (e) => {
  const rect = els.cropBox.getBoundingClientRect();
  const step = e.shiftKey ? 10 : 2;
  if (e.key === "ArrowLeft") {
    e.preventDefault();
    positionCropBox(rect.left - step, rect.top, rect.width);
  }
  if (e.key === "ArrowRight") {
    e.preventDefault();
    positionCropBox(rect.left + step, rect.top, rect.width);
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    positionCropBox(rect.left, rect.top - step, rect.width);
  }
  if (e.key === "ArrowDown") {
    e.preventDefault();
    positionCropBox(rect.left, rect.top + step, rect.width);
  }
  if (e.key === "-" || e.key === "_") {
    e.preventDefault();
    positionCropBox(rect.left, rect.top, rect.width * 0.92);
  }
  if (e.key === "=" || e.key === "+") {
    e.preventDefault();
    positionCropBox(rect.left, rect.top, rect.width * 1.08);
  }
});

function syncCropControls() {
  const stage = getDisplayedImageRect();
  const minSize = Math.max(40, Math.min(80, Math.min(stage.width, stage.height) * 0.08));
  const maxSize = Math.min(stage.width, stage.height);
  els.cropSizeRange.min = String(Math.floor(minSize));
  els.cropSizeRange.max = String(Math.floor(maxSize));
  els.cropSizeRange.value = String(Math.floor(els.cropBox.getBoundingClientRect().width));
}

els.cropMinusBtn?.addEventListener("click", () => {
  const rect = els.cropBox.getBoundingClientRect();
  positionCropBox(rect.left, rect.top, rect.width * 0.92);
});
els.cropPlusBtn?.addEventListener("click", () => {
  const rect = els.cropBox.getBoundingClientRect();
  positionCropBox(rect.left, rect.top, rect.width * 1.08);
});
els.cropCenterBtn?.addEventListener("click", () => {
  const stage = getDisplayedImageRect();
  const size = els.cropBox.getBoundingClientRect().width;
  const x = stage.left + (stage.width - size) / 2;
  const y = stage.top + (stage.height - size) / 2;
  positionCropBox(x, y, size);
});
els.cropSizeRange?.addEventListener("input", (e) => {
  const rect = els.cropBox.getBoundingClientRect();
  const size = Number(e.target.value) || rect.width;
  positionCropBox(rect.left, rect.top, size);
});

function setZoom(z) {
  const zoom = Math.max(0.25, Math.min(z, 3));
  cropperState.zoom = zoom;
  els.cropperImage.style.setProperty('--crop-zoom', String(zoom));
  const rect = els.cropBox.getBoundingClientRect();
  positionCropBox(rect.left, rect.top, rect.width);
}

if (!els.cropBox.querySelector('.handle')) {
  ['nw','ne','sw','se'].forEach(dir => {
    const h = document.createElement('div');
    h.className = `handle ${dir}`;
    h.dataset.corner = dir;
    els.cropBox.appendChild(h);
  });
}

function getDisplayedImageRect() {
  const stage = els.cropperStage.getBoundingClientRect();
  const natW = cropperState.naturalWidth || 1;
  const natH = cropperState.naturalHeight || 1;
  const fit = Math.min(stage.width / natW, stage.height / natH) * cropperState.zoom;
  const w = natW * fit;
  const h = natH * fit;
  const left = stage.left + (stage.width - w) / 2;
  const top = stage.top + (stage.height - h) / 2;
  return { left, top, width: w, height: h, right: left + w, bottom: top + h };
}

els.cropperApplyBtn.addEventListener("click", async () => {
  const note = notes.find((n) => n.id === selectedNoteId);
  if (!note) return;
  const img = note.images.find((i) => i.id === cropperState.imageId);
  if (!img) return;

  const stage = getDisplayedImageRect();
  const { x, y, size } = cropperState.crop;
  const relX = (x - stage.left) / stage.width;
  const relY = (y - stage.top) / stage.height;
  const relSize = size / stage.width; 

  const sx = Math.max(0, Math.min(cropperState.naturalWidth - 1, relX * cropperState.naturalWidth));
  const sy = Math.max(0, Math.min(cropperState.naturalHeight - 1, relY * cropperState.naturalHeight));
  const sSize = Math.min(cropperState.naturalWidth, cropperState.naturalHeight, relSize * cropperState.naturalWidth);

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(els.cropperImage, sx, sy, sSize, sSize, 0, 0, 1024, 1024);
  img.dataUrl = canvas.toDataURL("image/jpeg", 0.92);

  img.lastCrop = { relX, relY, relSize };

  note.updatedAt = Date.now();
  await saveNotes();
  closeCropper();
  renderAll();
});

els.cropperCloseBtn.addEventListener("click", closeCropper);
els.cropperCancelBtn.addEventListener("click", closeCropper);

function closeImageViewer() {
  els.imageViewerModal.setAttribute("aria-hidden", "true");
  els.modalViewerImage.src = ""; 
  imageViewerZoom = 1;
  els.modalViewerImage.style.transform = 'scale(1)';
}
els.modalViewerCloseBtn.addEventListener("click", closeImageViewer);
els.imageViewerModal.addEventListener("click", (e) => {
  if (e.target === els.imageViewerModal) {
    closeImageViewer();
  }
});

els.imageViewerModal.addEventListener("wheel", (e) => {
  e.preventDefault(); 
  const delta = e.deltaY > 0 ? -0.1 : 0.1; 
  imageViewerZoom = Math.max(0.5, Math.min(imageViewerZoom + delta, 5));
  els.modalViewerImage.style.transform = `scale(${imageViewerZoom})`;
}, { passive: false });

// ==========================================
// SECURE IPC CALLS
// ==========================================

els.printBtn.addEventListener("click", () => {
  const note = notes.find(n => n.id === selectedNoteId);
  const partId = note ? note.partId : 'Note';
  window.api.printToPdf(partId);
});

els.exportDataBtn.addEventListener("click", () => {
  const filename = `${CURRENT_PROFILE_KEY}_notevault.json`;
  window.api.exportData(notes, filename);
});

els.importDataBtn.addEventListener("click", () => {
  window.api.importData();
});

window.api.onPdfExportStarted(() => {
  const header = document.querySelector('.viewer-header');
  if (header) header.classList.add('printing');
});

window.api.onPdfExportComplete(() => {
  const header = document.querySelector('.viewer-header');
  if (header) header.classList.remove('printing');
});

window.api.onDataLoaded(async (jsonContent, filename) => {
  try {
    const loadedData = JSON.parse(jsonContent);
    if (!Array.isArray(loadedData)) {
      showAppAlert("Error", "The selected file does not contain a valid list of notes.");
      return;
    }

    let profileName = filename || `Imported_Profile`;
    profileName = profileName.replace(/[^a-z0-9-_ ]/gi, "_");

    showAppConfirm(
      "Import Profile?",
      `Found ${loadedData.length} notes in file.\n\nCreate a new profile named '${profileName}' with these notes?`,
      async () => {
        await db.set(profileName, loadedData);
        await switchProfile(profileName, true);
        showAppAlert("Success", `Profile '${profileName}' has been imported successfully.`);
      }
    );

  } catch (e) {
    console.error("Import failed:", e);
    showAppAlert("Error", "Error parsing file. Is it a valid JSON file?");
  }
});
// ==========================================

async function loadNotes() {
  const notesFromDB = await db.get(CURRENT_PROFILE_KEY);
  return Array.isArray(notesFromDB) ? notesFromDB : [];
}

async function saveNotes() {
  try {
    await db.set(CURRENT_PROFILE_KEY, notes);
  } catch (e) {
    console.error("Fatal error saving to IndexedDB:", e);
    showAppAlert("Database Error", "FATAL ERROR: Could not save notes. " + e.message);
  }
}

function updateProfileUI() {
  els.currentProfileBtn.textContent = `Profile: ${CURRENT_PROFILE_KEY}`;
}

async function switchProfile(newKey, close = true) {
  if (newKey === CURRENT_PROFILE_KEY) {
     if (!close) renderProfileList();
     return;
  }

  await saveNotes(); 

  CURRENT_PROFILE_KEY = newKey;
  localStorage.setItem('last_profile', newKey);

  selectedNoteId = null; 
  notes = await loadNotes(); 
  
  renderAll();
  updateProfileUI();
  
  if (close) {
    closeProfileModal();
  } else {
    renderProfileList();
    els.newProfileInput.value = "";
    els.newProfileInput.focus();
  }
}

function deleteProfile(keyToDelete) {
  if (keyToDelete === CURRENT_PROFILE_KEY) {
    showAppAlert("Cannot Delete", "You cannot delete the active profile. Switch to another one first.");
    return;
  }
  
  showAppConfirm(
    "Delete Profile?", 
    `Are you sure you want to delete profile "${keyToDelete}"? This cannot be undone.`, 
    async () => {
      await db.deleteKey(keyToDelete);
      await renderProfileList(); 
      setTimeout(() => {
        if (els.newProfileInput) els.newProfileInput.focus();
      }, 50);
    },
    true 
  );
}

async function createProfile() {
  const name = els.newProfileInput.value.trim();
  if (!name) return;

  const safeName = name.replace(/[^a-z0-9-_ ]/gi, "_");

  const keys = await db.getAllKeys();
  if (keys.includes(safeName)) {
    showAppAlert("Error", "Profile name already exists.");
    return;
  }

  await db.set(safeName, []);
  await switchProfile(safeName, false);
}

async function renderProfileList() {
  els.profileList.innerHTML = "";
  const keys = await db.getAllKeys();

  keys.forEach(key => {
    if (key === 'default_notes' || key === 'all_notes') {
      return; 
    }

    const item = document.createElement('div');
    item.className = 'profile-list-item';
    
    const switchBtn = document.createElement('button');
    switchBtn.className = `profile-switch-btn ${key === CURRENT_PROFILE_KEY ? 'active' : ''}`;
    switchBtn.textContent = key;
    switchBtn.onclick = () => switchProfile(key, false);

    const delBtn = document.createElement('button');
    delBtn.className = 'profile-delete-btn danger';
    delBtn.textContent = 'Delete';
    delBtn.onclick = () => deleteProfile(key);

    if (keys.length === 1) delBtn.disabled = true;

    item.appendChild(switchBtn);
    item.appendChild(delBtn);
    els.profileList.appendChild(item);
  });
}

function openProfileModal() {
  renderProfileList();
  els.profileModal.setAttribute("aria-hidden", "false");
}
function closeProfileModal() {
  els.profileModal.setAttribute("aria-hidden", "true");
}

els.currentProfileBtn.addEventListener("click", openProfileModal);
els.profileCloseBtn.addEventListener("click", closeProfileModal);
els.createProfileBtn.addEventListener("click", createProfile);


function generateId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

// FIX: ensureSelection now sorts the array alphabetically before selecting the first note
function ensureSelection() {
  const note = notes.find((n) => n.id === selectedNoteId);
  if (!note) {
    const filterText = els.searchInput.value.toLowerCase().trim();
    
    // Get all notes matching the filter
    let filteredNotes = notes.filter(n => {
      if (filterText === "") return true;
      return n.partId.toLowerCase().startsWith(filterText); 
    });

    // Apply the exact same alphabetical sorting used in the UI list
    filteredNotes.sort((a, b) => {
      const idA = (a.partId || "").toLowerCase();
      const idB = (b.partId || "").toLowerCase();
      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
    });

    // Select the first note from the SORTED list
    selectedNoteId = (filteredNotes.length > 0) ? filteredNotes[0].id : null;
  }
}

function createNoteContentView(note) {
  const frag = document.createDocumentFragment();

  const partId = document.createElement("div");
  partId.className = "print-part-id"; 
  partId.textContent = note.partId || "Untitled";
  frag.appendChild(partId);

  const body = document.createElement("div");
  body.className = "note-body";
  body.textContent = note.body || "";
  frag.appendChild(body);

  const imagesWrap = document.createElement("div");
  imagesWrap.className = "images";
  note.images.forEach((img) => {
    const card = document.createElement("div");
    card.className = "image-card";
    const frame = document.createElement("div");
    frame.className = "image-frame";
    const image = document.createElement("img");
    image.src = img.dataUrl;
    frame.appendChild(image);
    card.appendChild(frame);
    const captionText = (img.caption || "").trim();
    if (captionText.length > 0) {
      const cap = document.createElement("div");
      cap.className = "caption";
      cap.textContent = captionText;
      card.appendChild(cap);
    }
    imagesWrap.appendChild(card);

    card.addEventListener("click", () => {
      els.modalViewerImage.src = img.dataUrl;
      els.imageViewerModal.setAttribute("aria-hidden", "false");
    });
  });
  frag.appendChild(imagesWrap);
  return frag;
}

function renderNotesList() {
  const filterText = els.searchInput.value.toLowerCase().trim();
  els.notesList.innerHTML = "";
  
  notes
    .filter(note => {
      if (filterText === "") return true;
      return note.partId.toLowerCase().startsWith(filterText);
    })
    .sort((a, b) => {
      const idA = (a.partId || "").toLowerCase();
      const idB = (b.partId || "").toLowerCase();
      return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
    })
    .forEach((note) => {
      const clone = els.noteListItemTemplate.content.firstElementChild.cloneNode(true);
      const thumb = clone.querySelector(".thumb");
      const content = createNoteContentView(note);
      const scaleWrapper = document.createElement('div');
      scaleWrapper.className = 'thumb-scale-wrap';
      scaleWrapper.appendChild(content);
      thumb.innerHTML = "";
      thumb.appendChild(scaleWrapper);
      const title = clone.querySelector(".title");
      if (note.id === selectedNoteId) clone.classList.add("active");
      els.notesList.appendChild(clone);
      if (title) {
        title.textContent = note.partId || "Untitled";
        requestAnimationFrame(() => {
          title.style.fontSize = '14px';
          let fontSize = 14;
          const containerWidth = title.clientWidth;
          let textWidth = title.scrollWidth;
          while (textWidth > containerWidth && fontSize > 8) {
            fontSize--;
            title.style.fontSize = `${fontSize}px`;
            textWidth = title.scrollWidth;
          }
        });
      }
      clone.addEventListener("click", () => {
        selectedNoteId = note.id;
        selectedImageId = null;
        renderAll();
      });
    });
}

function renderViewer() {
  const note = notes.find((n) => n.id === selectedNoteId);
  if (!note) {
    els.viewerTitle.textContent = "—";
    els.viewer.innerHTML = '<div class="muted">Select or create a note to view.</div>';
    return;
  }
  els.viewerTitle.textContent = note.partId || "Untitled";
  const content = createNoteContentView(note);
  els.viewer.innerHTML = "";
  els.viewer.appendChild(content);
}

function renderEditor() {
  const note = notes.find((n) => n.id === selectedNoteId);
  const isNew = !note;
  els.deleteNoteBtn.disabled = isNew;
  if (isNew) {
    els.partIdInput.value = "";
    els.notesInput.value = "";
    els.imagesContainer.innerHTML = "";
    return;
  }
  els.partIdInput.value = note.partId;
  els.notesInput.value = note.body;
  els.imagesContainer.innerHTML = "";
  note.images.forEach((img) => {
    const card = document.createElement("div");
    card.className = "img-card";
    if (img.id === selectedImageId) card.classList.add("active");
    const image = document.createElement("img");
    image.src = img.dataUrl;
    const caption = document.createElement("div");
    caption.className = "caption";
    caption.textContent = img.caption || "";
    const actions = document.createElement("div");
    actions.className = "img-actions";
    const cropBtn = document.createElement("button");
    cropBtn.textContent = "Crop";
    cropBtn.type = "button";
    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "danger";
    delBtn.type = "button";
    actions.appendChild(cropBtn);
    actions.appendChild(delBtn);
    card.appendChild(image);
    card.appendChild(actions);
    card.appendChild(caption);
    card.addEventListener("click", () => {
      selectedImageId = img.id;
      els.imageCaptionInput.value = img.caption || "";
      renderEditor();
    });
    cropBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openCropper(img);
    });
    delBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeImage(img.id);
    });
    els.imagesContainer.appendChild(card);
  });
  const selectedImg = note.images.find((i) => i.id === selectedImageId);
  els.imageCaptionInput.value = selectedImg ? selectedImg.caption || "" : "";
}

function renderAll() {
  ensureSelection();
  renderNotesList();
  renderViewer();
  renderEditor();
  updateProfileUI();
}

async function createNote() {
  const newNote = {
    id: generateId("note"),
    partId: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    body: "",
    images: [],
  };
  notes.unshift(newNote);
  selectedNoteId = newNote.id;
  selectedImageId = null;
  await saveNotes();
  renderAll();
}

async function saveCurrentNote() {
  const note = notes.find((n) => n.id === selectedNoteId);
  if (!note) return;
  note.partId = els.partIdInput.value.trim() || "Untitled";
  note.body = els.notesInput.value;
  note.updatedAt = Date.now();
  await saveNotes();
  renderAll();
}

function deleteCurrentNote() {
  if (!selectedNoteId) return;
  
  showAppConfirm(
    "Delete Note?",
    "Are you sure you want to delete this note? This action cannot be undone.",
    async () => {
      const idx = notes.findIndex((n) => n.id === selectedNoteId);
      if (idx >= 0) notes.splice(idx, 1);
      selectedNoteId = null;
      selectedImageId = null;
      await saveNotes();
      renderAll();
    },
    true 
  );
}

async function copyCurrentNote() {
  const originalNote = notes.find(n => n.id === selectedNoteId);
  if (!originalNote) return;

  const newImages = originalNote.images.map(img => {
    const clone = { ...img, id: generateId("img") };
    if (img.lastCrop) clone.lastCrop = { ...img.lastCrop };
    return clone;
  });

  const newNote = {
    ...originalNote,
    id: generateId("note"), 
    partId: `${originalNote.partId} (COPY)`, 
    images: newImages,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  notes.push(newNote);

  selectedNoteId = newNote.id;
  selectedImageId = null; 

  await saveNotes();
  renderAll();

  setTimeout(() => {
     const list = document.getElementById("notesList");
     if (list) list.scrollTop = list.scrollHeight;
  }, 50);
}
els.copyNoteBtn.addEventListener("click", copyCurrentNote);
els.saveNoteBtn.addEventListener("click", saveCurrentNote);

async function addImagesFromFiles(fileList) {
  const note = notes.find((n) => n.id === selectedNoteId);
  if (!note) return;
  const files = Array.from(fileList || []);
  if (files.length === 0) return;
  
  const maxSize = 50 * 1024 * 1024;
  const oversized = files.filter(f => f.size > maxSize);
  if (oversized.length > 0) {
    if (!confirm(`${oversized.length} file(s) are larger than 50MB. Large images may cause performance issues. Continue anyway?`)) {
      els.imageInput.value = "";
      return;
    }
  }
  
  let pending = files.length;
  let hasError = false;
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = String(reader.result);
        const compressed = await compressDataUrl(data, { maxWidth: 3000, maxHeight: 3000, quality: 0.88 });
        note.images.push({
          id: generateId("img"),
          dataUrl: compressed,
          originalDataUrl: compressed,
          caption: "",
        });
        if (--pending === 0 && !hasError) {
          note.updatedAt = Date.now();
          try {
            await saveNotes();
            renderAll();
          } catch (err) {
            console.error("Error saving notes:", err);
            alert("Error saving notes. Trying a smaller optimized version...");
            const startIdx = Math.max(0, note.images.length - files.length);
            for (let i = startIdx; i < note.images.length; i++) {
              const img = note.images[i];
              const smaller = await compressDataUrl(img.dataUrl, { maxWidth: 1800, maxHeight: 1800, quality: 0.8 });
              img.dataUrl = smaller;
              img.originalDataUrl = smaller;
            }
            try {
              await saveNotes();
              renderAll();
            } catch (err2) {
              console.error("Save still failed after recompressing:", err2);
              alert("Still too large to save in browser storage.");
              note.images.splice(note.images.length - files.length);
              renderAll();
            }
          }
        }
      } catch (err) {
        console.error("Error processing image:", err);
        hasError = true;
        if (--pending === 0) {
          alert("Error adding one or more images. Some images may be too large.");
          renderAll();
        }
      }
    };
    reader.onerror = () => {
      console.error("Error reading file:", file.name);
      hasError = true;
      if (--pending === 0) {
        alert("Error reading one or more files. Please try again.");
        renderAll();
      }
    };
    reader.readAsDataURL(file);
  });
  els.imageInput.value = "";
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function compressDataUrl(dataUrl, opts) {
  const { maxWidth = 3000, maxHeight = 3000, quality = 0.88, type = 'image/jpeg' } = opts || {};
  try {
    const img = await loadImageFromDataUrl(dataUrl);
    const scale = Math.min(1, Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight));
    const targetW = Math.max(1, Math.round(img.naturalWidth * scale));
    const targetH = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return canvas.toDataURL(type, quality);
  } catch (e) {
    console.warn('compressDataUrl fallback to original due to error', e);
    return dataUrl;
  }
}

async function removeImage(imageId) {
  const note = notes.find((n) => n.id === selectedNoteId);
  if (!note) return;
  const idx = note.images.findIndex((i) => i.id === imageId);
  if (idx >= 0) note.images.splice(idx, 1);
  if (selectedImageId === imageId) selectedImageId = null;
  note.updatedAt = Date.now();
  await saveNotes();
  renderAll();
}

els.addNoteBtn.addEventListener("click", createNote);
els.deleteNoteBtn.addEventListener("click", deleteCurrentNote);
els.addImageBtn.addEventListener("click", () => els.imageInput.click());
els.imageInput.addEventListener("change", (e) => addImagesFromFiles(e.target.files));

const triggerAutosave = debounce(async () => {
  await saveNotes();
}, 1000);

function handleNoteInput() {
  const note = notes.find((n) => n.id === selectedNoteId);
  if (!note) return;
  
  note.partId = els.partIdInput.value; 
  note.body = els.notesInput.value;
  note.updatedAt = Date.now();
  
  triggerAutosave();
}

els.partIdInput.addEventListener("input", handleNoteInput);
els.notesInput.addEventListener("input", handleNoteInput);

els.imageCaptionInput.addEventListener("input", (e) => {
  const note = notes.find((n) => n.id === selectedNoteId);
  if (!note) return;
  const img = note.images.find((i) => i.id === selectedImageId);
  if (!img) return;
  
  img.caption = e.target.value;
  note.updatedAt = Date.now();
  triggerAutosave();
  const activeCard = document.querySelector('.img-card.active .caption');
  if(activeCard) activeCard.textContent = img.caption;
});

els.searchInput.addEventListener("input", renderNotesList);
els.imagesContainer.addEventListener("wheel", (e) => {
  if (e.deltaY !== 0) {
    e.preventDefault();
    els.imagesContainer.scrollLeft += e.deltaY;
  }
}, { passive: false });
els.expandBtn.addEventListener("click", () => {
  const isExpanded = els.appMain.classList.toggle("view-expanded");
  els.expandBtn.textContent = isExpanded ? "Collapse Note" : "Expand Note";
});

(async () => {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
         const migrated = parsed.map(note => {
           return note; 
         });
         await db.set('default_notes', migrated);
         localStorage.removeItem(LEGACY_STORAGE_KEY);
      }
    }
  } catch (e) { console.error(e); }

  const keys = await db.getAllKeys();
  const lastUsed = localStorage.getItem('last_profile');

  if (lastUsed && keys.includes(lastUsed)) {
    CURRENT_PROFILE_KEY = lastUsed;
  } else if (keys.length > 0) {
    CURRENT_PROFILE_KEY = keys[0];
    localStorage.setItem('last_profile', CURRENT_PROFILE_KEY);
  } else {
    CURRENT_PROFILE_KEY = 'default_notes';
    await db.set(CURRENT_PROFILE_KEY, []);
    localStorage.setItem('last_profile', CURRENT_PROFILE_KEY);
  }

  notes = await loadNotes();
  updateProfileUI();
  renderAll();
})();