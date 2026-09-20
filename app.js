/**
 * PROGRAMME REGISTRATION PORTAL — APP LOGIC v3
 * - Bulletproof host routing (file://, http://, Vercel)
 * - Host password lock (default: host1234, changeable)
 * - Participant edit mode after registration
 * - Firebase optional (app fully works without it)
 */

(function () {
  'use strict';

  // ── CONSTANTS ────────────────────────────────────────────────
  const STORAGE_KEY    = 'preg_registrations';
  const PASSWORD_KEY   = 'preg_host_password';
  const SESSION_KEY    = 'preg_host_authed';
  const DEFAULT_PW     = 'host1234';

  const TOPIC_PROGS = ['Malayalam Speech', 'Kathaprasangam', 'Conversation Malayalam'];

  // ── STATE ────────────────────────────────────────────────────
  let editingIds  = [];   // IDs of records currently being edited
  let editingName = '';
  let unsubscribe = null;

  // ── HELPERS ─────────────────────────────────────────────────
  const $  = id => document.getElementById(id);
  const esc = s  => !s ? '' :
    s.replace(/&/g,'&amp;').replace(/</g,'&lt;')
     .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  function getStoredPassword () {
    return localStorage.getItem(PASSWORD_KEY) || DEFAULT_PW;
  }

  function getStoredRegistrations () {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch (_) { return []; }
  }

  function saveAllToStorage (records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  function isFirebaseReady () {
    return !window._firebaseLoadError &&
           typeof db !== 'undefined' && db !== null;
  }

  // ── ROUTING ─────────────────────────────────────────────────
  function getView () {
    const p = new URLSearchParams(window.location.search);
    const h = window.location.hash.replace('#','').toLowerCase();
    const n = window.location.pathname.toLowerCase();
    if (p.get('view') === 'host' || h === 'host' || n.endsWith('/host'))
      return 'host';
    return 'participant';
  }

  function baseUrl () {
    // file:// → use the .html file path
    // http://  → use origin
    if (window.location.protocol === 'file:') {
      return window.location.pathname; // just the path, search/hash stripped
    }
    return window.location.origin;
  }

  function getParticipantUrl () {
    if (window.location.protocol === 'file:') {
      const base = window.location.href.split('?')[0].split('#')[0];
      return base + '?view=register';
    }
    return window.location.origin + '/register';
  }

  function getHostUrl () {
    if (window.location.protocol === 'file:') {
      const base = window.location.href.split('?')[0].split('#')[0];
      return base + '?view=host';
    }
    return window.location.origin + '/host';
  }

  // ── INIT ─────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const view = getView();

    if (view === 'host') {
      initHostView();
    } else {
      initParticipantView();
    }
  });

  // ════════════════════════════════════════════════════════════
  //  PARTICIPANT VIEW
  // ════════════════════════════════════════════════════════════
  function initParticipantView () {
    $('participantView').classList.remove('hidden');
    $('hostView').classList.add('hidden');

    $('navModeIndicator').innerHTML = `
      <span class="badge-mode badge-participant">
        <i class="fa-solid fa-user"></i> Participant Registration
      </span>`;

    $('footerLinks').innerHTML =
      `<a href="${getHostUrl()}"><i class="fa-solid fa-shield-halved"></i> Host Admin Dashboard</a>`;

    // Checkbox → reveal detail input
    document.querySelectorAll('.programme-check').forEach(cb => {
      cb.addEventListener('change', () => {
        const row   = cb.closest('.programme-row');
        const det   = row.querySelector('.prog-detail');
        const inp   = row.querySelector('.detail-input');
        if (cb.checked) {
          det.classList.remove('hidden');
          inp.focus();
        } else {
          det.classList.add('hidden');
          inp.value = '';
          inp.style.borderColor = '';
        }
        $('programmeError').classList.add('hidden');
      });
    });

    $('registrationForm').addEventListener('submit', handleFormSubmit);
    $('newRegistrationBtn').addEventListener('click', resetToNewRegistration);
    $('editRegistrationBtn').addEventListener('click', handleEditClick);
  }

  // ── FORM SUBMIT ──────────────────────────────────────────────
  async function handleFormSubmit (e) {
    e.preventDefault();

    const name = $('participantName').value.trim();
    if (!name) {
      $('nameError').classList.remove('hidden');
      $('participantName').focus();
      return;
    }
    $('nameError').classList.add('hidden');

    // Collect checked programmes
    const selected = [];
    let hasError   = false;

    document.querySelectorAll('.programme-row').forEach(row => {
      const cb  = row.querySelector('.programme-check');
      const inp = row.querySelector('.detail-input');
      if (!cb.checked) return;

      const detail = inp.value.trim();
      if (!detail) {
        inp.style.borderColor = '#ef4444';
        inp.focus();
        hasError = true;
        return;
      }
      inp.style.borderColor = '';

      const isTopicProg = TOPIC_PROGS.includes(cb.value);
      selected.push({
        programme:  cb.value,
        detail,
        detailType: isTopicProg ? 'Topic' : 'First line of the song'
      });
    });

    if (selected.length === 0) {
      $('programmeError').classList.remove('hidden');
      return;
    }
    if (hasError) return;

    const timestamp = new Date().toISOString();

    // If editing — remove old records first
    if (editingIds.length > 0) {
      await deleteRecordsByIds(editingIds);
      editingIds = [];
    }

    // Build new records (one per programme)
    const newRecords = selected.map(p => ({
      id:         Date.now().toString(36) + Math.random().toString(36).slice(2),
      name,
      programme:  p.programme,
      detail:     p.detail,
      detailType: p.detailType,
      timestamp
    }));

    for (const r of newRecords) {
      await saveRecord(r);
    }

    // Stash IDs for possible re-edit
    editingIds  = newRecords.map(r => r.id);
    editingName = name;

    showSuccessCard(name, newRecords, editingIds.length > 0);
  }

  function showSuccessCard (name, records, isEdit) {
    $('registeredName').textContent = name;
    $('successTitle').textContent   = isEdit
      ? 'Registration Updated!'
      : 'Registration Successful!';

    $('registrationSummaryBox').innerHTML = records.map(r => `
      <div class="summary-row">
        <span class="summary-programme">${esc(r.programme)}</span>
        <span class="summary-detail">
          <strong>${esc(r.detailType)}:</strong> ${esc(r.detail)}
        </span>
      </div>`).join('');

    $('registrationForm').classList.add('hidden');
    $('successCard').classList.remove('hidden');
    $('successCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── EDIT CLICK ───────────────────────────────────────────────
  function handleEditClick () {
    // Pre-fill form with previously submitted data
    const allRecords = getStoredRegistrations();
    const myRecords  = allRecords.filter(r => editingIds.includes(r.id));

    // Reset checkboxes
    document.querySelectorAll('.programme-check').forEach(cb => {
      cb.checked = false;
      const row = cb.closest('.programme-row');
      row.querySelector('.prog-detail').classList.add('hidden');
      row.querySelector('.detail-input').value = '';
    });

    // Re-check and fill
    myRecords.forEach(r => {
      const cb = document.querySelector(`.programme-check[value="${CSS.escape(r.programme)}"]`);
      if (!cb) return;
      cb.checked = true;
      const row  = cb.closest('.programme-row');
      row.querySelector('.prog-detail').classList.remove('hidden');
      row.querySelector('.detail-input').value = r.detail;
    });

    $('participantName').value = editingName;
    $('submitBtnText').textContent = 'Update Registration';

    $('successCard').classList.add('hidden');
    $('registrationForm').classList.remove('hidden');
  }

  // ── RESET TO FRESH FORM ──────────────────────────────────────
  function resetToNewRegistration () {
    editingIds  = [];
    editingName = '';

    $('registrationForm').reset();
    document.querySelectorAll('.prog-detail').forEach(d => d.classList.add('hidden'));
    document.querySelectorAll('.detail-input').forEach(i => {
      i.value = '';
      i.style.borderColor = '';
    });
    $('programmeError').classList.add('hidden');
    $('nameError').classList.add('hidden');
    $('submitBtnText').textContent = 'Register Now';

    $('successCard').classList.add('hidden');
    $('registrationForm').classList.remove('hidden');
  }


  // ════════════════════════════════════════════════════════════
  //  HOST VIEW — PASSWORD GATE
  // ════════════════════════════════════════════════════════════
  function initHostView () {
    // Check if already authenticated this session
    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      showHostDashboard();
    } else {
      showPasswordModal();
    }
  }

  function showPasswordModal () {
    const overlay = $('passwordOverlay');
    overlay.classList.remove('hidden');

    $('hostPasswordInput').value = '';
    $('passwordError').classList.add('hidden');
    setTimeout(() => $('hostPasswordInput').focus(), 100);

    $('submitPasswordBtn').onclick = checkPassword;
    $('hostPasswordInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') checkPassword();
    });
  }

  function checkPassword () {
    const entered = $('hostPasswordInput').value;
    if (entered === getStoredPassword()) {
      sessionStorage.setItem(SESSION_KEY, '1');
      $('passwordOverlay').classList.add('hidden');
      showHostDashboard();
    } else {
      $('passwordError').classList.remove('hidden');
      $('hostPasswordInput').value = '';
      $('hostPasswordInput').focus();
    }
  }

  function showHostDashboard () {
    $('hostView').classList.remove('hidden');
    $('participantView').classList.add('hidden');

    $('navModeIndicator').innerHTML = `
      <span class="badge-mode badge-host">
        <i class="fa-solid fa-lock"></i> Host Admin Portal
      </span>`;

    $('footerLinks').innerHTML =
      `<a href="${getParticipantUrl()}"><i class="fa-solid fa-user-pen"></i> Participant Registration Page</a>`;

    $('participantLinkInput').value = getParticipantUrl();

    // Wire up host buttons
    $('copyLinkBtn').addEventListener('click', handleCopyLink);
    $('searchInput').addEventListener('input', handleSearch);
    $('exportCsvBtn').addEventListener('click', exportToCsv);
    $('addSampleDataBtn').addEventListener('click', addSampleData);
    $('clearDataBtn').addEventListener('click', clearAllRegistrations);
    $('changePasswordBtn').addEventListener('click', showChangePasswordModal);

    loadAndRenderDashboard();
  }

  // ── CHANGE PASSWORD MODAL ────────────────────────────────────
  function showChangePasswordModal () {
    $('changePasswordOverlay').classList.remove('hidden');
    $('currentPasswordInput').value = '';
    $('newPasswordInput').value     = '';
    $('confirmPasswordInput').value = '';
    $('changePwError').classList.add('hidden');
    $('changePwSuccess').classList.add('hidden');
    setTimeout(() => $('currentPasswordInput').focus(), 100);

    $('savePasswordBtn').onclick = doChangePassword;
    $('cancelPasswordBtn').onclick = () => {
      $('changePasswordOverlay').classList.add('hidden');
    };
  }

  function doChangePassword () {
    const current  = $('currentPasswordInput').value;
    const newPw    = $('newPasswordInput').value;
    const confirm  = $('confirmPasswordInput').value;
    const errEl    = $('changePwError');
    const okEl     = $('changePwSuccess');

    errEl.classList.add('hidden');
    okEl.classList.add('hidden');

    if (current !== getStoredPassword()) {
      errEl.textContent = 'Current password is incorrect.';
      errEl.classList.remove('hidden');
      return;
    }
    if (newPw.length < 4) {
      errEl.textContent = 'New password must be at least 4 characters.';
      errEl.classList.remove('hidden');
      return;
    }
    if (newPw !== confirm) {
      errEl.textContent = 'Passwords do not match.';
      errEl.classList.remove('hidden');
      return;
    }

    localStorage.setItem(PASSWORD_KEY, newPw);
    okEl.classList.remove('hidden');
    setTimeout(() => $('changePasswordOverlay').classList.add('hidden'), 1500);
  }

  // ── LOAD & RENDER DASHBOARD ──────────────────────────────────
  async function loadAndRenderDashboard () {
    if (isFirebaseReady()) {
      // Real-time Firestore listener
      if (unsubscribe) unsubscribe();
      try {
        unsubscribe = db.collection('registrations').onSnapshot(snap => {
          const records = [];
          snap.forEach(doc => records.push({ id: doc.id, ...doc.data() }));
          records.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
          saveAllToStorage(records);
          renderRows(records);
        }, err => {
          console.warn('Firestore listener failed, falling back:', err);
          renderRows(getStoredRegistrations());
        });
      } catch (err) {
        renderRows(getStoredRegistrations());
      }
    } else {
      renderRows(getStoredRegistrations());
    }
  }

  function renderRows (records) {
    const tbody      = $('spreadsheetBody');
    const table      = $('spreadsheetTable');
    const empty      = $('emptyState');
    const totalEl    = $('totalCount');
    const lastEl     = $('lastRegistrationTime');

    tbody.innerHTML = '';

    if (!records || records.length === 0) {
      table.classList.add('hidden');
      empty.classList.remove('hidden');
      totalEl.textContent = '0';
      lastEl.textContent  = '—';
      return;
    }

    table.classList.remove('hidden');
    empty.classList.add('hidden');
    totalEl.textContent = records.length;

    const last = records[records.length - 1];
    if (last && last.timestamp) {
      const d = new Date(last.timestamp);
      lastEl.textContent =
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        ' · ' + d.toLocaleDateString();
    }

    records.forEach((r, i) => {
      const tr     = document.createElement('tr');
      const dtStr  = r.timestamp
        ? new Date(r.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';

      tr.innerHTML = `
        <td class="col-num">${i + 1}</td>
        <td class="col-name">${esc(r.name)}</td>
        <td class="col-programme"><span class="programme-tag">${esc(r.programme)}</span></td>
        <td class="col-detail">
          <span class="detail-type-badge">${esc(r.detailType || '')}</span>
          ${esc(r.detail)}
        </td>
        <td class="col-time">${dtStr}</td>`;
      tbody.appendChild(tr);
    });
  }

  // ── SEARCH ───────────────────────────────────────────────────
  function handleSearch () {
    const q   = $('searchInput').value.toLowerCase().trim();
    const all = getStoredRegistrations();
    if (!q) { renderRows(all); return; }
    renderRows(all.filter(r =>
      (r.name      || '').toLowerCase().includes(q) ||
      (r.programme || '').toLowerCase().includes(q) ||
      (r.detail    || '').toLowerCase().includes(q)
    ));
  }

  // ── COPY LINK ────────────────────────────────────────────────
  function handleCopyLink () {
    const text = $('participantLinkInput').value;
    if (!text) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(flashCopied).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy (text) {
    const inp = $('participantLinkInput');
    inp.select();
    inp.setSelectionRange(0, 99999);
    try { document.execCommand('copy'); flashCopied(); }
    catch (_) { alert('Copy this link:\n' + text); }
  }

  function flashCopied () {
    const btn  = $('copyLinkBtn');
    const span = $('copyBtnText');
    span.textContent          = 'Copied!';
    btn.style.backgroundColor = '#10b981';
    setTimeout(() => {
      span.textContent          = 'Copy Link';
      btn.style.backgroundColor = '';
    }, 2500);
  }

  // ── STORAGE: SAVE ────────────────────────────────────────────
  async function saveRecord (record) {
    // 1. Firebase
    if (isFirebaseReady()) {
      try { await db.collection('registrations').add(record); }
      catch (e) { console.error('Firestore save error:', e); }
    }
    // 2. REST API (local server)
    try {
      await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
    } catch (_) {}
    // 3. localStorage (always)
    const all = getStoredRegistrations();
    all.push(record);
    saveAllToStorage(all);
  }

  // ── STORAGE: DELETE ──────────────────────────────────────────
  async function deleteRecordsByIds (ids) {
    // localStorage
    const all     = getStoredRegistrations();
    const updated = all.filter(r => !ids.includes(r.id));
    saveAllToStorage(updated);

    // Firebase
    if (isFirebaseReady()) {
      try {
        const snap = await db.collection('registrations')
          .where('id', 'in', ids).get();
        snap.forEach(doc => doc.ref.delete());
      } catch (_) {}
    }
  }

  // ── SAMPLE DATA ──────────────────────────────────────────────
  async function addSampleData () {
    const samples = [
      { name:'Ahammad Firoz',   programme:'Malayalam Speech',    detail:'Importance of Modern Education',      detailType:'Topic' },
      { name:'Fathima Raniya',  programme:'Madh Song',           detail:'Aalamangal Seyyum Rasool',            detailType:'First line of the song' },
      { name:'Fathima Raniya',  programme:'Mappilappattu',       detail:'Ponnana Maanathu Ninnoru',            detailType:'First line of the song' },
      { name:'Mohammed Bilal',  programme:'Kathaprasangam',      detail:'Veera Pazhassi Raja',                 detailType:'Topic' },
      { name:'Suhail & Team',   programme:'Group Song',          detail:'Assalamu Alaika Ya Rasoolallah',      detailType:'First line of the song' },
    ];
    const ts = new Date().toISOString();
    for (const s of samples) {
      await saveRecord({
        ...s,
        id: Date.now().toString(36) + Math.random().toString(36).slice(2),
        timestamp: ts
      });
    }
    loadAndRenderDashboard();
  }

  // ── CLEAR ALL ────────────────────────────────────────────────
  async function clearAllRegistrations () {
    if (!confirm('Clear ALL registrations? This cannot be undone.')) return;
    localStorage.removeItem(STORAGE_KEY);
    if (isFirebaseReady()) {
      try {
        const snap = await db.collection('registrations').get();
        snap.forEach(doc => doc.ref.delete());
      } catch (_) {}
    }
    try { await fetch('/api/clear', { method: 'POST' }); } catch (_) {}
    renderRows([]);
  }

  // ── EXPORT CSV ───────────────────────────────────────────────
  async function exportToCsv () {
    const records = getStoredRegistrations();
    if (!records.length) { alert('No registrations to export.'); return; }

    let csv = '"Sl. No.","Participant Name","Programme","Detail Type","Topic / First Line","Registered At"\n';
    records.forEach((r, i) => {
      const t = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';
      csv += [i+1, q(r.name), q(r.programme), q(r.detailType||''), q(r.detail), q(t)].join(',') + '\n';
    });

    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
    a.download = `Registrations_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  function q (s) { return '"' + (s||'').replace(/"/g,'""') + '"'; }

})();
