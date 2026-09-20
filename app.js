/**
 * PROGRAMME REGISTRATION PORTAL - APP LOGIC
 * Supports Browser LocalStorage, REST API Backend, and Live Firebase Firestore Cloud Database.
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- STATE & CONSTANTS ---
  const STORAGE_KEY = 'programme_registrations_db';
  let unsubscribeRealtime = null;
  
  // Programmes that require "Topic"
  const TOPIC_PROGRAMMES = [
    'Malayalam Speech',
    'Kathaprasangam',
    'Conversation Malayalam'
  ];

  // Programmes that require "First line of the song"
  const SONG_PROGRAMMES = [
    'Madh Song',
    'Mappilappattu',
    'Group Song'
  ];

  // --- DOM ELEMENTS ---
  const navModeIndicator = document.getElementById('navModeIndicator');
  const participantView = document.getElementById('participantView');
  const hostView = document.getElementById('hostView');
  const footerLinks = document.getElementById('footerLinks');

  // Form Elements
  const registrationForm = document.getElementById('registrationForm');
  const participantNameInput = document.getElementById('participantName');
  const programmeSelect = document.getElementById('programmeSelect');
  const dynamicDetailGroup = document.getElementById('dynamicDetailGroup');
  const dynamicDetailLabel = document.getElementById('dynamicDetailLabel');
  const dynamicLabelText = document.getElementById('dynamicLabelText');
  const dynamicDetailIcon = document.getElementById('dynamicDetailIcon');
  const detailInput = document.getElementById('detailInput');
  const dynamicHelpText = document.getElementById('dynamicHelpText');

  // Success Screen Elements
  const successCard = document.getElementById('successCard');
  const registeredName = document.getElementById('registeredName');
  const registeredProgramme = document.getElementById('registeredProgramme');
  const registeredDetailHeader = document.getElementById('registeredDetailHeader');
  const registeredDetailText = document.getElementById('registeredDetailText');
  const newRegistrationBtn = document.getElementById('newRegistrationBtn');

  // Host View Elements
  const participantLinkInput = document.getElementById('participantLinkInput');
  const copyLinkBtn = document.getElementById('copyLinkBtn');
  const copyBtnText = document.getElementById('copyBtnText');
  const searchInput = document.getElementById('searchInput');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const addSampleDataBtn = document.getElementById('addSampleDataBtn');
  const clearDataBtn = document.getElementById('clearDataBtn');
  const totalCountEl = document.getElementById('totalCount');
  const lastRegistrationTimeEl = document.getElementById('lastRegistrationTime');
  const spreadsheetTable = document.getElementById('spreadsheetTable');
  const spreadsheetBody = document.getElementById('spreadsheetBody');
  const emptyState = document.getElementById('emptyState');

  // --- INITIALIZATION ---
  initApp();

  function initApp() {
    const currentView = getActiveView();
    setupRoutingUI(currentView);
    setupEventListeners();

    if (currentView === 'host') {
      renderHostDashboard();
    }
  }

  // --- ROUTING / VIEW MODE DETECTION ---
  function getActiveView() {
    const urlParams = new URLSearchParams(window.location.search);
    const pathname = window.location.pathname.toLowerCase();

    if (urlParams.get('view') === 'host' || pathname.endsWith('/host')) {
      return 'host';
    }
    return 'participant';
  }

  function setupRoutingUI(view) {
    if (view === 'host') {
      hostView.classList.remove('hidden');
      participantView.classList.add('hidden');

      navModeIndicator.innerHTML = `
        <span class="badge-mode badge-host">
          <i class="fa-solid fa-lock"></i> Host Admin Portal
        </span>
      `;

      footerLinks.innerHTML = `
        <span>Viewing Host Dashboard. </span>
        <a href="${getParticipantUrl()}" id="switchViewLink"><i class="fa-solid fa-user-pen"></i> Go to Participant Registration Page</a>
      `;
    } else {
      participantView.classList.remove('hidden');
      hostView.classList.add('hidden');

      navModeIndicator.innerHTML = `
        <span class="badge-mode badge-participant">
          <i class="fa-solid fa-user"></i> Participant Registration
        </span>
      `;

      footerLinks.innerHTML = `
        <a href="${getHostUrl()}"><i class="fa-solid fa-shield-halved"></i> Host Admin Login / View</a>
      `;
    }
  }

  function getParticipantUrl() {
    const origin = window.location.origin;
    if (origin.startsWith('http')) {
      return origin + '/register';
    }
    return window.location.protocol + '//' + window.location.host + window.location.pathname + '?view=register';
  }

  function getHostUrl() {
    const origin = window.location.origin;
    if (origin.startsWith('http')) {
      return origin + '/host';
    }
    return window.location.protocol + '//' + window.location.host + window.location.pathname + '?view=host';
  }


  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    programmeSelect.addEventListener('change', handleProgrammeChange);
    registrationForm.addEventListener('submit', handleFormSubmit);
    newRegistrationBtn.addEventListener('click', resetFormView);

    if (copyLinkBtn) {
      copyLinkBtn.addEventListener('click', handleCopyLink);
    }
    if (searchInput) {
      searchInput.addEventListener('input', handleSearch);
    }
    if (exportCsvBtn) {
      exportCsvBtn.addEventListener('click', exportToCsv);
    }
    if (addSampleDataBtn) {
      addSampleDataBtn.addEventListener('click', addSampleData);
    }
    if (clearDataBtn) {
      clearDataBtn.addEventListener('click', clearAllRegistrations);
    }

    // Local Storage cross-tab listener
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && getActiveView() === 'host' && !db) {
        renderHostDashboard();
      }
    });
  }


  // --- DYNAMIC FIELD LOGIC (TOPIC vs FIRST LINE OF THE SONG) ---
  function handleProgrammeChange() {
    const selectedProgramme = programmeSelect.value;

    if (!selectedProgramme) {
      dynamicDetailGroup.classList.add('hidden');
      detailInput.removeAttribute('required');
      return;
    }

    dynamicDetailGroup.classList.remove('hidden');
    detailInput.setAttribute('required', 'true');
    detailInput.value = '';

    if (TOPIC_PROGRAMMES.includes(selectedProgramme)) {
      dynamicLabelText.textContent = 'Topic';
      dynamicDetailIcon.className = 'fa-solid fa-heading';
      detailInput.placeholder = 'Enter the topic of your speech / presentation';
      dynamicHelpText.textContent = 'Provide the exact topic you will present.';
    } else if (SONG_PROGRAMMES.includes(selectedProgramme)) {
      dynamicLabelText.textContent = 'First line of the song';
      dynamicDetailIcon.className = 'fa-solid fa-music';
      detailInput.placeholder = 'Enter the first line of the song';
      dynamicHelpText.textContent = 'Provide the opening line or title line of the song.';
    } else {
      dynamicLabelText.textContent = 'Detail';
      dynamicDetailIcon.className = 'fa-solid fa-align-left';
      detailInput.placeholder = 'Enter detail';
      dynamicHelpText.textContent = 'Provide programme detail.';
    }
  }


  // --- FORM SUBMISSION & STORAGE ---
  async function handleFormSubmit(e) {
    e.preventDefault();

    const name = participantNameInput.value.trim();
    const programme = programmeSelect.value;
    const detail = detailInput.value.trim();
    const isTopic = TOPIC_PROGRAMMES.includes(programme);
    const detailTypeLabel = isTopic ? 'Topic' : 'First line of the song';

    if (!name || !programme || !detail) {
      alert('Please fill out all required fields.');
      return;
    }

    const newRecord = {
      id: Date.now().toString(),
      name: name,
      programme: programme,
      detail: detail,
      detailType: detailTypeLabel,
      timestamp: new Date().toISOString()
    };

    // Save Record (Cloud Firebase + Local Fallbacks)
    await saveRegistrationRecord(newRecord);

    // Display Confirmation Screen
    registeredName.textContent = name;
    registeredProgramme.textContent = programme;
    registeredDetailHeader.textContent = detailTypeLabel + ':';
    registeredDetailText.textContent = detail;

    registrationForm.classList.add('hidden');
    successCard.classList.remove('hidden');
    successCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetFormView() {
    registrationForm.reset();
    dynamicDetailGroup.classList.add('hidden');
    detailInput.removeAttribute('required');
    successCard.classList.add('hidden');
    registrationForm.classList.remove('hidden');
  }


  // --- STORAGE ENGINE (FIREBASE FIRESTORE + REST API + LOCAL STORAGE) ---
  async function saveRegistrationRecord(record) {
    // 1. Try Firebase Firestore
    if (typeof db !== 'undefined' && db !== null) {
      try {
        await db.collection('registrations').add(record);
        console.log('✅ Record saved to Firebase Firestore!');
      } catch (err) {
        console.error('Firestore save error:', err);
      }
    }

    // 2. Try REST API Server if running locally
    try {
      await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
    } catch (err) {}

    // 3. Always update Local Storage
    const existingData = getStoredRegistrations();
    existingData.push(record);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData));
  }

  function getStoredRegistrations() {
    try {
      const dataStr = localStorage.getItem(STORAGE_KEY);
      return dataStr ? JSON.parse(dataStr) : [];
    } catch (err) {
      return [];
    }
  }

  async function fetchAllRegistrations() {
    // 1. Check Firebase Firestore
    if (typeof db !== 'undefined' && db !== null) {
      try {
        const snapshot = await db.collection('registrations').get();
        const firebaseRecords = [];
        snapshot.forEach(doc => {
          firebaseRecords.push({ id: doc.id, ...doc.data() });
        });
        // Sort chronologically by timestamp
        firebaseRecords.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
        
        if (firebaseRecords.length > 0) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(firebaseRecords));
          return firebaseRecords;
        }
      } catch (err) {
        console.warn('Firestore fetch failed, falling back to local data:', err);
      }
    }

    // 2. Try API endpoint
    try {
      const res = await fetch('/api/registrations');
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    } catch (err) {}

    // 3. Fallback to Local Storage
    return getStoredRegistrations();
  }


  // --- HOST DASHBOARD RENDER & REAL-TIME SPREADSHEET VIEW ---
  async function renderHostDashboard() {
    participantLinkInput.value = getParticipantUrl();

    // Enable Real-time listener if Firebase Cloud is connected
    if (typeof db !== 'undefined' && db !== null) {
      if (unsubscribeRealtime) unsubscribeRealtime();

      unsubscribeRealtime = db.collection('registrations').onSnapshot((snapshot) => {
        const liveRecords = [];
        snapshot.forEach(doc => {
          liveRecords.push({ id: doc.id, ...doc.data() });
        });
        liveRecords.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(liveRecords));
        renderSpreadsheetRows(liveRecords);
      }, (err) => {
        console.error("Firebase Realtime Listener Error:", err);
      });
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

    const lastRecord = records[records.length - 1];
    if (lastRecord && lastRecord.timestamp) {
      const d = new Date(lastRecord.timestamp);
      lastRegistrationTimeEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + d.toLocaleDateString() + ')';
    } else {
      lastRegistrationTimeEl.textContent = 'N/A';
    }

    records.forEach((record, index) => {
      const tr = document.createElement('tr');
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
          <strong>[${escapeHtml(record.detailType || 'Topic/Song')}]</strong> ${escapeHtml(record.detail)}
        </td>
        <td class="col-time">${dateStr}</td>
      `;
      spreadsheetBody.appendChild(tr);
    });
  }


  // --- COPY LINK HANDLER ---
  function handleCopyLink() {
    const linkText = participantLinkInput.value;
    if (!linkText) return;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(linkText).then(showCopySuccess).catch(() => fallbackCopy(linkText));
    } else {
      fallbackCopy(linkText);
    }
  }

  function fallbackCopy(text) {
    participantLinkInput.select();
    participantLinkInput.setSelectionRange(0, 99999);
    try {
      document.execCommand('copy');
      showCopySuccess();
    } catch (err) {
      alert('Registration Link:\n' + text);
    }
  }

  function showCopySuccess() {
    copyBtnText.textContent = 'Copied!';
    copyLinkBtn.style.backgroundColor = '#10b981';
    
    setTimeout(() => {
      copyBtnText.textContent = 'Copy Link';
      copyLinkBtn.style.backgroundColor = '';
    }, 2500);
  }


  // --- SEARCH & FILTER ---
  async function handleSearch() {
    const query = searchInput.value.toLowerCase().trim();
    const allRecords = await fetchAllRegistrations();

    if (!query) {
      renderSpreadsheetRows(allRecords);
      return;
    }

    const filtered = allRecords.filter(r => 
      r.name.toLowerCase().includes(query) ||
      r.programme.toLowerCase().includes(query) ||
      r.detail.toLowerCase().includes(query) ||
      (r.detailType && r.detailType.toLowerCase().includes(query))
    );

    renderSpreadsheetRows(filtered);
  }


  // --- EXPORT TO CSV ---
  async function exportToCsv() {
    const records = await fetchAllRegistrations();
    if (!records || records.length === 0) {
      alert('No registrations available to export.');
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += `"Sl. No.","Participant Name","Programme","Detail Type","Topic / First Line of Song","Registration Time"\n`;

    records.forEach((r, idx) => {
      const timeStr = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';
      const row = [
        idx + 1,
        `"${escapeCsv(r.name)}"`,
        `"${escapeCsv(r.programme)}"`,
        `"${escapeCsv(r.detailType || '')}"`,
        `"${escapeCsv(r.detail)}"`,
        `"${escapeCsv(timeStr)}"`
      ];
      csvContent += row.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Programme_Registrations_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function escapeCsv(str) {
    return str ? str.replace(/"/g, '""') : '';
  }


  // --- DATA MANAGEMENT ---
  async function addSampleData() {
    const sampleRecords = [
      {
        id: '1',
        name: 'Ahammad Firoz',
        programme: 'Malayalam Speech',
        detail: 'Importance of Modern Education in Youth',
        detailType: 'Topic',
        timestamp: new Date(Date.now() - 3600000 * 3).toISOString()
      },
      {
        id: '2',
        name: 'Fathima Raniya',
        programme: 'Madh Song',
        detail: 'Aalamangal Seyyum Rasool',
        detailType: 'First line of the song',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: '3',
        name: 'Mohammed Bilal',
        programme: 'Kathaprasangam',
        detail: 'Veera Pazhassi Raja',
        detailType: 'Topic',
        timestamp: new Date(Date.now() - 3600000 * 1).toISOString()
      },
      {
        id: '4',
        name: 'Suhail & Team',
        programme: 'Group Song',
        detail: 'Assalamu Alaika Ya Rasoolallah',
        detailType: 'First line of the song',
        timestamp: new Date().toISOString()
      }
    ];

    for (const r of sampleRecords) {
      await saveRegistrationRecord(r);
    }
    renderHostDashboard();
  }

  async function clearAllRegistrations() {
    if (confirm('Are you sure you want to clear all registered participants?')) {
      localStorage.removeItem(STORAGE_KEY);
      
      if (typeof db !== 'undefined' && db !== null) {
        try {
          const snapshot = await db.collection('registrations').get();
          snapshot.forEach(doc => doc.ref.delete());
        } catch (e) {}
      }

      try {
        await fetch('/api/clear', { method: 'POST' });
      } catch (err) {}

      renderHostDashboard();
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#039;");
  }

});
