/**
 * PROGRAMME REGISTRATION PORTAL — APP LOGIC
 * Fixes: host routing for file:// protocol, multi-programme checkbox support
 */

document.addEventListener('DOMContentLoaded', () => {

  const STORAGE_KEY = 'programme_registrations_db';
  let unsubscribeRealtime = null;

  // Programmes that need "Topic" vs "First line of song"
  const TOPIC_PROGRAMMES  = ['Malayalam Speech', 'Kathaprasangam', 'Conversation Malayalam'];
  const SONG_PROGRAMMES   = ['Madh Song', 'Mappilappattu', 'Group Song'];

  // ── DOM refs ────────────────────────────────────────────────────────────────
  const navModeIndicator     = document.getElementById('navModeIndicator');
  const participantView      = document.getElementById('participantView');
  const hostView             = document.getElementById('hostView');
  const footerLinks          = document.getElementById('footerLinks');

  const registrationForm     = document.getElementById('registrationForm');
  const participantNameInput = document.getElementById('participantName');
  const programmeError       = document.getElementById('programmeError');
  const successCard          = document.getElementById('successCard');
  const registeredName       = document.getElementById('registeredName');
  const registrationSummaryBox = document.getElementById('registrationSummaryBox');
  const newRegistrationBtn   = document.getElementById('newRegistrationBtn');

  const participantLinkInput = document.getElementById('participantLinkInput');
  const copyLinkBtn          = document.getElementById('copyLinkBtn');
  const copyBtnText          = document.getElementById('copyBtnText');
  const searchInput          = document.getElementById('searchInput');
  const exportCsvBtn         = document.getElementById('exportCsvBtn');
  const addSampleDataBtn     = document.getElementById('addSampleDataBtn');
  const clearDataBtn         = document.getElementById('clearDataBtn');
  const totalCountEl         = document.getElementById('totalCount');
  const lastRegistrationTimeEl = document.getElementById('lastRegistrationTime');
  const spreadsheetTable     = document.getElementById('spreadsheetTable');
  const spreadsheetBody      = document.getElementById('spreadsheetBody');
  const emptyState           = document.getElementById('emptyState');

  // ── INIT ────────────────────────────────────────────────────────────────────
  initApp();

  function initApp() {
    const view = getActiveView();
    setupRoutingUI(view);
    setupEventListeners();
    if (view === 'host') renderHostDashboard();
  }

  // ── ROUTING ─────────────────────────────────────────────────────────────────
  // Works for both http:// server AND file:// direct open
  function getActiveView() {
    const params  = new URLSearchParams(window.location.search);
    const hash    = window.location.hash.toLowerCase();   // supports #host / #register
    const path    = window.location.pathname.toLowerCase();

    if (
      params.get('view') === 'host' ||
      hash === '#host' ||
      hash === '#/host' ||
      path.endsWith('/host') ||
      path.endsWith('/host.html')
    ) {
      return 'host';
    }
    return 'participant';
  }

  function getParticipantUrl() {
    // For file:// protocol use hash-based routing so links are clickable
    if (window.location.protocol === 'file:') {
      return window.location.href.split('?')[0].split('#')[0] + '?view=register';
    }
    return window.location.origin + '/register';
  }

  function getHostUrl() {
    if (window.location.protocol === 'file:') {
      return window.location.href.split('?')[0].split('#')[0] + '?view=host';
    }
    return window.location.origin + '/host';
  }

  function setupRoutingUI(view) {
    if (view === 'host') {
      hostView.classList.remove('hidden');
      participantView.classList.add('hidden');
      navModeIndicator.innerHTML = `
        <span class="badge-mode badge-host">
          <i class="fa-solid fa-lock"></i> Host Admin Portal
        </span>`;
      footerLinks.innerHTML = `
        <a href="${getParticipantUrl()}">
          <i class="fa-solid fa-user-pen"></i> Go to Participant Registration Page
        </a>`;
    } else {
      participantView.classList.remove('hidden');
      hostView.classList.add('hidden');
      navModeIndicator.innerHTML = `
        <span class="badge-mode badge-participant">
          <i class="fa-solid fa-user"></i> Participant Registration
        </span>`;
      footerLinks.innerHTML = `
        <a href="${getHostUrl()}">
          <i class="fa-solid fa-shield-halved"></i> Host Admin Dashboard
        </a>`;
    }
  }

  // ── EVENT LISTENERS ─────────────────────────────────────────────────────────
  function setupEventListeners() {
    // Programme checkboxes → show/hide detail input
    document.querySelectorAll('.programme-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const row    = cb.closest('.programme-row');
        const detail = row.querySelector('.programme-detail');
        const input  = row.querySelector('.detail-input');
        if (cb.checked) {
          detail.classList.remove('hidden');
          input.setAttribute('required', 'true');
        } else {
          detail.classList.add('hidden');
          input.removeAttribute('required');
          input.value = '';
        }
        programmeError.classList.add('hidden');
      });
    });

    registrationForm.addEventListener('submit', handleFormSubmit);
    newRegistrationBtn.addEventListener('click', resetFormView);

    if (copyLinkBtn)     copyLinkBtn.addEventListener('click', handleCopyLink);
    if (searchInput)     searchInput.addEventListener('input', handleSearch);
    if (exportCsvBtn)    exportCsvBtn.addEventListener('click', exportToCsv);
    if (addSampleDataBtn) addSampleDataBtn.addEventListener('click', addSampleData);
    if (clearDataBtn)    clearDataBtn.addEventListener('click', clearAllRegistrations);

    // Cross-tab local storage sync (when Firebase is not configured)
    window.addEventListener('storage', e => {
      if (e.key === STORAGE_KEY && getActiveView() === 'host' && !isFirebaseReady()) {
        renderHostDashboard();
      }
    });
  }

  // ── FORM SUBMISSION ─────────────────────────────────────────────────────────
  async function handleFormSubmit(e) {
    e.preventDefault();

    const name = participantNameInput.value.trim();
    if (!name) { participantNameInput.focus(); return; }

    // Collect all checked programmes with their detail
    const selectedProgrammes = [];
    document.querySelectorAll('.programme-row').forEach(row => {
      const cb     = row.querySelector('.programme-check');
      const input  = row.querySelector('.detail-input');
      if (cb.checked) {
        const prog       = cb.value;
        const detailVal  = input ? input.value.trim() : '';
        const detailType = TOPIC_PROGRAMMES.includes(prog) ? 'Topic' : 'First line of the song';
        selectedProgrammes.push({ programme: prog, detail: detailVal, detailType });
      }
    });

    if (selectedProgrammes.length === 0) {
      programmeError.classList.remove('hidden');
      return;
    }

    // Check all selected programmes have their detail filled
    let missingDetail = false;
    document.querySelectorAll('.programme-row').forEach(row => {
      const cb    = row.querySelector('.programme-check');
      const input = row.querySelector('.detail-input');
      if (cb.checked && input && !input.value.trim()) {
        input.focus();
        input.style.borderColor = '#ef4444';
        missingDetail = true;
      }
    });
    if (missingDetail) return;

    // Build records — one row per programme per participant
    const timestamp = new Date().toISOString();
    const records   = selectedProgrammes.map(p => ({
      id:          Date.now().toString() + Math.random().toString(36).slice(2),
      name,
      programme:   p.programme,
      detail:      p.detail,
      detailType:  p.detailType,
      timestamp
    }));

    for (const r of records) {
      await saveRegistrationRecord(r);
    }

    // Show success
    registeredName.textContent = name;
    registrationSummaryBox.innerHTML = records.map(r => `
      <div class="summary-row">
        <span class="summary-programme">${escapeHtml(r.programme)}</span>
        <span class="summary-detail"><strong>${escapeHtml(r.detailType)}:</strong> ${escapeHtml(r.detail)}</span>
      </div>
    `).join('');

    registrationForm.classList.add('hidden');
    successCard.classList.remove('hidden');
    successCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetFormView() {
    registrationForm.reset();
    // Hide all detail inputs
    document.querySelectorAll('.programme-detail').forEach(d => d.classList.add('hidden'));
    document.querySelectorAll('.detail-input').forEach(i => {
      i.removeAttribute('required');
      i.style.borderColor = '';
    });
    programmeError.classList.add('hidden');
    successCard.classList.add('hidden');
    registrationForm.classList.remove('hidden');
  }

  // ── STORAGE (Firebase → REST API → localStorage) ────────────────────────────
  function isFirebaseReady() {
    return typeof db !== 'undefined' && db !== null;
  }

  async function saveRegistrationRecord(record) {
    // 1. Firebase Firestore
    if (isFirebaseReady()) {
      try {
        await db.collection('registrations').add(record);
      } catch (err) {
        console.error('Firestore save error:', err);
      }
    }
    // 2. Local REST API (when server.ps1 is running)
    try {
      await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
    } catch (_) {}
    // 3. Always localStorage
    const existing = getStoredRegistrations();
    existing.push(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  }

  function getStoredRegistrations() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (_) {
      return [];
    }
  }

  async function fetchAllRegistrations() {
    // 1. Firebase
    if (isFirebaseReady()) {
      try {
        const snap    = await db.collection('registrations').get();
        const records = [];
        snap.forEach(doc => records.push({ id: doc.id, ...doc.data() }));
        records.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
        if (records.length > 0) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
          return records;
        }
      } catch (err) {
        console.warn('Firestore fetch failed:', err);
      }
    }
    // 2. REST API
    try {
      const res = await fetch('/api/registrations');
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    } catch (_) {}
    // 3. localStorage
    return getStoredRegistrations();
  }

  // ── HOST DASHBOARD ───────────────────────────────────────────────────────────
  async function renderHostDashboard() {
    participantLinkInput.value = getParticipantUrl();

    if (isFirebaseReady()) {
      // Real-time listener
      if (unsubscribeRealtime) unsubscribeRealtime();
      unsubscribeRealtime = db.collection('registrations').onSnapshot(snap => {
        const records = [];
        snap.forEach(doc => records.push({ id: doc.id, ...doc.data() }));
        records.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
        renderSpreadsheetRows(records);
      }, err => console.error('Firestore listener error:', err));
    } else {
      const records = await fetchAllRegistrations();
      renderSpreadsheetRows(records);
    }
  }

  function renderSpreadsheetRows(records) {
    spreadsheetBody.innerHTML = '';

    if (!records || records.length === 0) {
      spreadsheetTable.classList.add('hidden');
      emptyState.classList.remove('hidden');
      totalCountEl.textContent = '0';
      lastRegistrationTimeEl.textContent = 'None';
      return;
    }

    spreadsheetTable.classList.remove('hidden');
    emptyState.classList.add('hidden');
    totalCountEl.textContent = records.length;

    const last = records[records.length - 1];
    if (last && last.timestamp) {
      const d = new Date(last.timestamp);
      lastRegistrationTimeEl.textContent =
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        ' (' + d.toLocaleDateString() + ')';
    }

    records.forEach((record, index) => {
      const tr      = document.createElement('tr');
      const dateStr = record.timestamp
        ? new Date(record.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'Just now';

      tr.innerHTML = `
        <td class="col-num">${index + 1}</td>
        <td class="col-name">${escapeHtml(record.name)}</td>
        <td class="col-programme">
          <span class="programme-tag">${escapeHtml(record.programme)}</span>
        </td>
        <td class="col-detail">
          <span class="detail-type-badge">${escapeHtml(record.detailType || '')}</span>
          ${escapeHtml(record.detail)}
        </td>
        <td class="col-time">${dateStr}</td>
      `;
      spreadsheetBody.appendChild(tr);
    });
  }

  // ── COPY LINK ────────────────────────────────────────────────────────────────
  function handleCopyLink() {
    const text = participantLinkInput.value;
    if (!text) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(showCopySuccess).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    participantLinkInput.select();
    participantLinkInput.setSelectionRange(0, 99999);
    try { document.execCommand('copy'); showCopySuccess(); }
    catch (_) { alert('Copy this link:\n' + text); }
  }

  function showCopySuccess() {
    copyBtnText.textContent = 'Copied!';
    copyLinkBtn.style.backgroundColor = '#10b981';
    setTimeout(() => {
      copyBtnText.textContent = 'Copy Link';
      copyLinkBtn.style.backgroundColor = '';
    }, 2500);
  }

  // ── SEARCH ───────────────────────────────────────────────────────────────────
  async function handleSearch() {
    const q       = searchInput.value.toLowerCase().trim();
    const records = await fetchAllRegistrations();
    if (!q) { renderSpreadsheetRows(records); return; }
    renderSpreadsheetRows(records.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.programme.toLowerCase().includes(q) ||
      r.detail.toLowerCase().includes(q)
    ));
  }

  // ── EXPORT CSV ───────────────────────────────────────────────────────────────
  async function exportToCsv() {
    const records = await fetchAllRegistrations();
    if (!records || records.length === 0) { alert('No registrations to export.'); return; }

    let csv = '"Sl. No.","Participant Name","Programme","Detail Type","Topic / First Line of Song","Registered At"\n';
    records.forEach((r, i) => {
      const t = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';
      csv += [i + 1, q(r.name), q(r.programme), q(r.detailType || ''), q(r.detail), q(t)].join(',') + '\n';
    });

    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
    a.download = `Programme_Registrations_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function q(s) { return '"' + (s || '').replace(/"/g, '""') + '"'; }

  // ── SAMPLE DATA ──────────────────────────────────────────────────────────────
  async function addSampleData() {
    const samples = [
      { name: 'Ahammad Firoz',  programme: 'Malayalam Speech',     detail: 'Importance of Modern Education', detailType: 'Topic' },
      { name: 'Fathima Raniya', programme: 'Madh Song',            detail: 'Aalamangal Seyyum Rasool',       detailType: 'First line of the song' },
      { name: 'Fathima Raniya', programme: 'Mappilappattu',        detail: 'Ponnana Maanathu Ninnoru',       detailType: 'First line of the song' },
      { name: 'Mohammed Bilal', programme: 'Kathaprasangam',       detail: 'Veera Pazhassi Raja',            detailType: 'Topic' },
      { name: 'Suhail & Team',  programme: 'Group Song',           detail: 'Assalamu Alaika Ya Rasoolallah', detailType: 'First line of the song' },
    ];
    const now = new Date().toISOString();
    for (const s of samples) {
      await saveRegistrationRecord({ ...s, id: Date.now().toString() + Math.random(), timestamp: now });
    }
    renderHostDashboard();
  }

  // ── CLEAR DATA ───────────────────────────────────────────────────────────────
  async function clearAllRegistrations() {
    if (!confirm('Clear ALL registrations? This cannot be undone.')) return;
    localStorage.removeItem(STORAGE_KEY);
    if (isFirebaseReady()) {
      try {
        const snap = await db.collection('registrations').get();
        snap.forEach(doc => doc.ref.delete());
      } catch (_) {}
    }
    try { await fetch('/api/clear', { method: 'POST' }); } catch (_) {}
    renderHostDashboard();
  }

  // ── UTILS ────────────────────────────────────────────────────────────────────
  function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  }

});
