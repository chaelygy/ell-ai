/**
 * =====================================================================
 *  ELL_AI FACE • Quantum Cyber-Biometric Frontend
 *  Palette: Cyber Cyan (#00f5ff), Electric Azure (#0077ff), Navy Slate
 * =====================================================================
 */

const CLOUD_BACKEND_URL = 'https://change-mariah-opponents-meter.trycloudflare.com';

const isFileProtocol = window.location.protocol === 'file:';
const isLocal = Boolean(
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '' ||
    isFileProtocol
);

let defaultApi = 'http://localhost:5000';
if (!isLocal) {
    defaultApi = CLOUD_BACKEND_URL;
} else if (!isFileProtocol && window.location.origin && window.location.origin !== 'null') {
    defaultApi = window.location.origin;
} else {
    defaultApi = 'http://localhost:5000';
}

const customApi = localStorage.getItem('faceid_backend_url');
let API_BASE = (customApi ? customApi.replace(/\/$/, '') : defaultApi);
const WEBCAM_INTERVAL_MS = 1300;
const JPEG_QUALITY = 0.88;

function configureServerUrl() {
    const current = localStorage.getItem('faceid_backend_url') || API_BASE;
    const input = prompt(
        "Pengaturan URL Backend Server ELL_AI FACE:\n" +
        "• Lokal: http://localhost:5000\n" +
        "• Cloudflare: https://xxxx.trycloudflare.com\n\n" +
        "URL saat ini:",
        current
    );
    if (input !== null) {
        const clean = input.trim().replace(/\/$/, '');
        if (clean) {
            localStorage.setItem('faceid_backend_url', clean);
        } else {
            localStorage.removeItem('faceid_backend_url');
        }
        window.location.reload();
    }
}

// State
let currentMode = 'webcam';
let webcamStream = null;
let webcamActive = false;
let captureInterval = null;
let isProcessing = false;
let registeredPersons = [];

const elements = {
    navStatus: document.getElementById('navStatus'),
    statPersons: document.getElementById('statPersons'),
    btnWebcam: document.getElementById('btnWebcam'),
    btnUpload: document.getElementById('btnUpload'),
    panelTitle: document.getElementById('panelTitle'),
    webcamControls: document.getElementById('webcamControls'),
    webcamWrapper: document.getElementById('webcamWrapper'),
    uploadWrapper: document.getElementById('uploadWrapper'),
    webcamVideo: document.getElementById('webcamVideo'),
    overlayCanvas: document.getElementById('overlayCanvas'),
    scanLine: document.getElementById('scanLine'),
    videoPlaceholder: document.getElementById('videoPlaceholder'),
    btnStartCam: document.getElementById('btnStartCam'),
    btnStopCam: document.getElementById('btnStopCam'),
    uploadZone: document.getElementById('uploadZone'),
    fileInput: document.getElementById('fileInput'),
    uploadedPreview: document.getElementById('uploadedPreview'),
    uploadedImage: document.getElementById('uploadedImage'),
    uploadOverlayCanvas: document.getElementById('uploadOverlayCanvas'),
    faceCount: document.getElementById('faceCount'),
    perfTime: document.getElementById('perfTime'),
    processingIndicator: document.getElementById('processingIndicator'),
    resultsList: document.getElementById('resultsList'),
    modelEngine: document.getElementById('modelEngine'),
    detectorEngine: document.getElementById('detectorEngine'),
    thresholdVal: document.getElementById('thresholdVal'),
    btnRefreshDb: document.getElementById('btnRefreshDb'),
    personsList: document.getElementById('personsList'),
    searchPersons: document.getElementById('vaultSearchInput') || document.getElementById('searchPersons')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkServerHealth();
    loadPersons();
    setupEventListeners();
    initCyberGlow();
    setInterval(checkServerHealth, 8000);
});

function initCyberGlow() {
    const canvas = document.createElement('canvas');
    canvas.className = 'cyber-ambient-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '0';
    canvas.style.opacity = '0.4';
    document.body.insertBefore(canvas, document.body.firstChild);

    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    const particles = Array.from({ length: 32 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 70 + 20,
        dx: (Math.random() - 0.5) * 0.45,
        dy: (Math.random() - 0.5) * 0.35,
        alpha: Math.random() * 0.14 + 0.04
    }));

    function animate() {
        ctx.clearRect(0, 0, width, height);
        particles.forEach(p => {
            p.x += p.dx;
            p.y += p.dy;
            if (p.x < -100) p.x = width + 100;
            if (p.x > width + 100) p.x = -100;
            if (p.y < -100) p.y = height + 100;
            if (p.y > height + 100) p.y = -100;

            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
            grad.addColorStop(0, `rgba(0, 245, 255, ${p.alpha})`);
            grad.addColorStop(0.6, `rgba(0, 119, 255, ${p.alpha * 0.5})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        });
        requestAnimationFrame(animate);
    }
    animate();
}

function setupEventListeners() {
    if (elements.btnWebcam) elements.btnWebcam.addEventListener('click', () => switchMode('webcam'));
    if (elements.btnUpload) elements.btnUpload.addEventListener('click', () => switchMode('upload'));
    
    const searchEl = document.getElementById('vaultSearchInput') || elements.searchPersons;
    if (searchEl) {
        searchEl.addEventListener('input', (e) => filterPersons(e.target.value));
    }

    if (elements.uploadZone) {
        elements.uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            elements.uploadZone.classList.add('drag-over');
        });
        elements.uploadZone.addEventListener('dragleave', () => {
            elements.uploadZone.classList.remove('drag-over');
        });
        elements.uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            elements.uploadZone.classList.remove('drag-over');
            if (e.dataTransfer.files.length > 0) {
                processUploadedFile(e.dataTransfer.files[0]);
            }
        });
    }

    window.addEventListener('resize', () => {
        if (webcamActive) syncCanvasSize();
    });
}

async function checkServerHealth() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`${API_BASE}/api/status`, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            const count = data.total_persons || data.persons_count || (data.persons ? data.persons.length : '24');
            updateServerStatus(true, `Aktif (${count} ID)`);
            if (elements.statPersons) {
                elements.statPersons.textContent = count;
            }
            if (data.model_name && elements.modelEngine) elements.modelEngine.textContent = data.model_name;
            if (data.detector && elements.detectorEngine) elements.detectorEngine.textContent = data.detector;
            if (data.threshold && elements.thresholdVal) elements.thresholdVal.textContent = parseFloat(data.threshold).toFixed(4);
        } else {
            updateServerStatus(false, 'Server Error');
        }
    } catch (err) {
        updateServerStatus(false, 'Offline (Klik untuk setting)');
    }
}

function updateServerStatus(online, text) {
    if (!elements.navStatus) return;
    const dot = elements.navStatus.querySelector('.status-beacon') || elements.navStatus.querySelector('.status-dot');
    const label = elements.navStatus.querySelector('.status-text');
    if (dot) {
        dot.className = `status-beacon ${online ? 'online' : 'offline'}`;
    }
    if (label) label.textContent = text;
}

async function loadPersons() {
    try {
        const res = await fetch(`${API_BASE}/api/persons`);
        if (res.ok) {
            const data = await res.json();
            registeredPersons = data.persons || [];
            renderPersonsList(registeredPersons);
            if (elements.statPersons) elements.statPersons.textContent = registeredPersons.length;
        }
    } catch (err) {
        console.warn('Could not load persons:', err);
    }
}

function renderPersonsList(persons) {
    const listEl = document.getElementById('personsList') || elements.personsList;
    if (!listEl) return;
    if (!persons || persons.length === 0) {
        listEl.innerHTML = `<div class="empty-dossier"><p>Tidak ada identitas yang cocok</p></div>`;
        return;
    }
    listEl.innerHTML = persons.map(p => `
        <div class="roster-card">
            <div class="roster-avatar">${getInitials(p.name)}</div>
            <div class="roster-info">
                <span class="roster-name">${escapeHtml(p.name)}</span>
                <span class="roster-sub">${p.photos || p.samples || 50} Vektor Biometrik</span>
            </div>
        </div>
    `).join('');
}

function filterPersons(query) {
    const q = (query || '').toLowerCase().trim();
    const filtered = registeredPersons.filter(p => p.name.toLowerCase().includes(q));
    renderPersonsList(filtered);
}

function switchMode(mode) {
    if (currentMode === mode) return;
    currentMode = mode;

    if (mode === 'webcam') {
        elements.btnWebcam.classList.add('active');
        elements.btnUpload.classList.remove('active');
        elements.webcamWrapper.classList.remove('hidden');
        elements.uploadWrapper.classList.add('hidden');
        elements.panelTitle.textContent = 'Sensor Kamera Real-Time';
        elements.webcamControls.classList.remove('hidden');
        removeUpload();
    } else {
        elements.btnUpload.classList.add('active');
        elements.btnWebcam.classList.remove('active');
        elements.uploadWrapper.classList.remove('hidden');
        elements.webcamWrapper.classList.add('hidden');
        elements.panelTitle.textContent = 'Neural Photo Ingest';
        elements.webcamControls.classList.add('hidden');
        stopWebcam();
    }
    clearResults();
}

async function startWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            },
            audio: false
        });

        webcamStream = stream;
        elements.webcamVideo.srcObject = stream;
        webcamActive = true;

        elements.webcamVideo.onloadedmetadata = () => {
            elements.webcamVideo.play();
            syncCanvasSize();
            elements.videoPlaceholder.classList.add('hidden');
            elements.scanLine.classList.remove('hidden');
            elements.btnStartCam.classList.add('hidden');
            elements.btnStopCam.classList.remove('hidden');
            startCaptureLoop();
        };
    } catch (err) {
        alert('Gagal mengakses sensor kamera: ' + err.message);
    }
}

function stopWebcam() {
    webcamActive = false;
    if (captureInterval) clearInterval(captureInterval);
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    if (elements.webcamVideo) elements.webcamVideo.srcObject = null;
    if (elements.videoPlaceholder) elements.videoPlaceholder.classList.remove('hidden');
    if (elements.scanLine) elements.scanLine.classList.add('hidden');
    if (elements.btnStartCam) elements.btnStartCam.classList.remove('hidden');
    if (elements.btnStopCam) elements.btnStopCam.classList.add('hidden');

    if (elements.overlayCanvas) {
        const ctx = elements.overlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, elements.overlayCanvas.width, elements.overlayCanvas.height);
    }
    clearResults();
}

function syncCanvasSize() {
    const video = elements.webcamVideo;
    if (video.videoWidth && video.videoHeight) {
        elements.overlayCanvas.width = video.videoWidth;
        elements.overlayCanvas.height = video.videoHeight;
    }
}

function startCaptureLoop() {
    if (captureInterval) clearInterval(captureInterval);
    captureInterval = setInterval(captureAndSendFrame, WEBCAM_INTERVAL_MS);
    captureAndSendFrame();
}

async function captureAndSendFrame() {
    if (!webcamActive || isProcessing) return;
    const video = elements.webcamVideo;
    if (video.readyState < 2) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(video, 0, 0);

    const imageData = tempCanvas.toDataURL('image/jpeg', JPEG_QUALITY);
    await sendForRecognition(imageData, 'webcam');
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) processUploadedFile(file);
}

function processUploadedFile(file) {
    if (!file.type.startsWith('image/')) {
        alert('File harus berupa gambar (JPG, PNG, WEBP).');
        return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
        const imageData = e.target.result;
        elements.uploadedImage.src = imageData;
        elements.uploadZone.classList.add('hidden');
        elements.uploadedPreview.classList.remove('hidden');

        elements.uploadedImage.onload = async () => {
            const img = elements.uploadedImage;
            elements.uploadOverlayCanvas.width = img.naturalWidth;
            elements.uploadOverlayCanvas.height = img.naturalHeight;
            await sendForRecognition(imageData, 'upload');
        };
    };
    reader.readAsDataURL(file);
}

function removeUpload() {
    elements.uploadedImage.src = '';
    elements.uploadedPreview.classList.add('hidden');
    elements.uploadZone.classList.remove('hidden');
    elements.fileInput.value = '';
    if (elements.uploadOverlayCanvas) {
        const ctx = elements.uploadOverlayCanvas.getContext('2d');
        ctx.clearRect(0, 0, elements.uploadOverlayCanvas.width, elements.uploadOverlayCanvas.height);
    }
    clearResults();
}

async function sendForRecognition(imageData, source) {
    if (isProcessing) return;
    isProcessing = true;
    if (elements.processingIndicator) elements.processingIndicator.classList.remove('hidden');

    try {
        const res = await fetch(`${API_BASE}/api/recognize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageData })
        });

        const data = await res.json();
        if (data.error) {
            console.error('Recognition error:', data.error);
        } else {
            displayResults(data.faces, data.processing_time_ms);
            if (source === 'webcam') {
                drawBoundingBoxes(elements.overlayCanvas, data.faces, true);
            } else {
                drawBoundingBoxes(elements.uploadOverlayCanvas, data.faces, false);
            }
        }
    } catch (err) {
        console.error('Network error:', err);
    } finally {
        isProcessing = false;
        if (elements.processingIndicator) elements.processingIndicator.classList.add('hidden');
    }
}

// Bounding box: Cyber Cyan & Electric Azure HUD Reticle
function drawBoundingBoxes(canvas, faces, isMirrored) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    faces.forEach(face => {
        let { x, y, w: bw, h: bh } = face.bbox;
        if (isMirrored) {
            x = w - x - bw;
        }

        const isRecognized = face.name !== 'Unknown';
        const color = isRecognized ? '#00f5ff' : '#f43f5e';
        const glowColor = isRecognized ? 'rgba(0, 245, 255, 0.7)' : 'rgba(244, 63, 94, 0.6)';

        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 16;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        const cornerLen = Math.min(bw, bh) * 0.25;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(x, y + cornerLen);
        ctx.lineTo(x, y);
        ctx.lineTo(x + cornerLen, y);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(x + bw - cornerLen, y);
        ctx.lineTo(x + bw, y);
        ctx.lineTo(x + bw, y + cornerLen);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(x, y + bh - cornerLen);
        ctx.lineTo(x, y + bh);
        ctx.lineTo(x + cornerLen, y + bh);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(x + bw - cornerLen, y + bh);
        ctx.lineTo(x + bw, y + bh);
        ctx.lineTo(x + bw, y + bh - cornerLen);
        ctx.stroke();

        // Thin perimeter frame
        ctx.shadowBlur = 0;
        ctx.strokeStyle = isRecognized ? 'rgba(0, 245, 255, 0.28)' : 'rgba(244, 63, 94, 0.28)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, bw, bh);

        // Cyber Tag
        const label = isRecognized 
            ? `${face.name} • ${face.confidence}%` 
            : 'TARGET TIDAK DIKENAL';
        
        ctx.font = `700 ${Math.max(13, bw * 0.058)}px "Space Grotesk", sans-serif`;
        const textMetrics = ctx.measureText(label);
        const textW = textMetrics.width + 20;
        const textH = Math.max(26, bw * 0.08);
        const labelY = y - textH - 8;

        ctx.fillStyle = isRecognized ? 'rgba(0, 245, 255, 0.95)' : 'rgba(244, 63, 94, 0.95)';
        roundRect(ctx, x, labelY, textW, textH, 6);
        ctx.fill();

        ctx.fillStyle = isRecognized ? '#040814' : '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + 10, labelY + textH / 2);
    });
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

function displayResults(faces, processingTime) {
    if (elements.faceCount) elements.faceCount.textContent = `${faces.length} wajah`;
    if (elements.perfTime) elements.perfTime.textContent = `${Math.round(processingTime)} ms`;

    if (!elements.resultsList) return;
    if (faces.length === 0) {
        elements.resultsList.innerHTML = `
            <div class="empty-dossier">
                <div class="empty-reticle-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                </div>
                <h4>Tidak Ada Wajah Terdeteksi</h4>
                <p>Arahkan kamera ke wajah atau upload foto beresolusi jelas.</p>
            </div>
        `;
        return;
    }

    const sorted = [...faces].sort((a, b) => {
        if (a.name === 'Unknown' && b.name !== 'Unknown') return 1;
        if (a.name !== 'Unknown' && b.name === 'Unknown') return -1;
        return b.confidence - a.confidence;
    });

    elements.resultsList.innerHTML = sorted.map(face => {
        const isRecognized = face.name !== 'Unknown';
        const cardClass = isRecognized ? 'recognized' : 'unknown';
        const initials = isRecognized ? getInitials(face.name) : '?';
        const confidenceText = isRecognized ? `${face.confidence}% Akurasi` : 'Tidak Terdaftar';
        const distanceText = `Dist: ${face.distance}`;

        return `
            <div class="face-card ${cardClass}">
                <div class="face-avatar">${initials}</div>
                <div class="face-info">
                    <div class="face-name">${escapeHtml(face.name)}</div>
                    <div class="face-meta">
                        <span class="face-confidence">${confidenceText}</span>
                        <span class="face-distance">${distanceText}</span>
                    </div>
                    ${isRecognized ? `
                        <div class="confidence-bar-container">
                            <div class="confidence-bar" style="width: ${face.confidence}%"></div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function clearResults() {
    if (elements.faceCount) elements.faceCount.textContent = '0 wajah';
    if (elements.perfTime) elements.perfTime.textContent = '- ms';
    if (elements.resultsList) {
        elements.resultsList.innerHTML = `
            <div class="empty-dossier" id="emptyState">
                <div class="empty-reticle-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M8 15s1.5 2 4 2 4-2 4-2"/>
                        <line x1="9" y1="9" x2="9.01" y2="9"/>
                        <line x1="15" y1="9" x2="15.01" y2="9"/>
                    </svg>
                </div>
                <h4>Menunggu Deteksi Wajah</h4>
                <p>Nyalakan kamera atau upload foto untuk verifikasi biometrik ELL_AI FACE.</p>
            </div>
        `;
    }
}

function getInitials(name) {
    return name.split(' ')
        .filter(w => w.length > 0)
        .map(w => w[0].toUpperCase())
        .slice(0, 2)
        .join('');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
