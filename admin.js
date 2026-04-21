// ===== ADMIN CRM – JavaScript =====

// ===== SUPABASE CONFIG =====
const SUPABASE_URL = 'https://zkhinefqbebozbtxlzgf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpraGluZWZxYmVib3pidHhsemdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3Nzg5OTIsImV4cCI6MjA5MjM1NDk5Mn0.E9xrvHCxdPpT_wCF_Tlwu2lbYiqwNMgje2Ux201slY8';
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

let mockClients = [];

// ===== AUTH LOGIC =====
document.addEventListener('DOMContentLoaded', function() {
  var loginOverlay = document.getElementById('loginOverlay');
  var loginBtn = document.getElementById('loginBtn');
  var logoutBtn = document.getElementById('logoutBtn');

  // Přihlášení – přímý click handler, žádný form submit
  if (loginBtn) {
    loginBtn.onclick = async function() {
      var email = document.getElementById('loginEmail').value;
      var password = document.getElementById('loginPassword').value;
      var loginError = document.getElementById('loginError');

      if (!email || !password) {
        loginError.style.display = 'block';
        loginError.textContent = 'Vyplň e-mail i heslo.';
        return;
      }

      loginBtn.textContent = 'Ověřuji...';
      loginBtn.disabled = true;
      loginError.style.display = 'none';

      try {
        var result = await db.auth.signInWithPassword({ email: email, password: password });
        if (result.error) {
          console.error('Login error:', result.error.message);
          loginError.style.display = 'block';
          loginError.textContent = result.error.message.includes('Email not confirmed')
            ? 'E-mail není ověřen. Vypni Confirm email v Supabase.'
            : 'Chybný e-mail nebo heslo.';
        }
      } catch (err) {
        console.error('Login exception:', err);
        loginError.style.display = 'block';
        loginError.textContent = 'Chyba připojení k serveru.';
      }

      loginBtn.textContent = 'Přihlásit se';
      loginBtn.disabled = false;
    };
  }

  // Odhlášení
  if (logoutBtn) {
    logoutBtn.onclick = async function() {
      await db.auth.signOut();
    };
  }

  // Kontrola stavu přihlášení
  async function checkAuth() {
    if (!db) return;
    try {
      var sess = await db.auth.getSession();
      if (sess.data.session) {
        loginOverlay.classList.remove('active');
        fetchLeads();
        fetchSettings();
      } else {
        loginOverlay.classList.add('active');
      }
    } catch (e) {
      console.error('checkAuth error:', e);
      loginOverlay.classList.add('active');
    }
  }

  // Listener na změnu auth stavu
  if (db) {
    db.auth.onAuthStateChange(function(event, session) {
      if (session) {
        loginOverlay.classList.remove('active');
        fetchLeads();
        fetchSettings();
      } else {
        loginOverlay.classList.add('active');
      }
    });
  }

  checkAuth();
});


// ===== FETCH DATA =====
async function fetchLeads() {
  if (!db) return;
  const { data, error } = await db
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching leads:', error);
    return;
  }
  
  // Transform DB format to app format
  mockClients = data.map(lead => ({
    id: lead.id,
    firstName: lead.first_name,
    lastName: lead.last_name,
    email: lead.email,
    phone: lead.phone,
    goal: lead.goal,
    status: lead.status || 'new',
    date: lead.created_at || '2025-01-01',
    nextMeeting: lead.appointment_date && lead.appointment_time ? {
      date: lead.appointment_date,
      time: lead.appointment_time
    } : null,
    notes: lead.notes || [],
    materials: lead.materials || []
  }));
  
  if (currentView === 'dashboard') renderDashboard();
  if (currentView === 'leads') renderLeadsTable();
  if (currentView === 'clients') renderClientsTable();
}

let availableSlots = {};

async function fetchSettings() {
  if (!db) return;
  const { data, error } = await db.from('settings').select('available_slots').eq('id', 1).single();
  if (data && data.available_slots) {
    availableSlots = data.available_slots;
  }
  if (currentView === 'calendar') renderTimeSlots();
}

async function saveSettings() {
  if (!db) return;
  await db.from('settings').upsert({ id: 1, available_slots: availableSlots });
}

// ===== STATE =====
let currentView = 'dashboard';
let currentClientId = null;
let currentFilter = 'all';

// ===== DOM REFS =====
const views = document.querySelectorAll('.view');
const sidebarLinks = document.querySelectorAll('.sidebar-link');
const clientPanel = document.getElementById('clientPanel');
const clientOverlay = document.getElementById('clientOverlay');
const pageTitle = document.getElementById('pageTitle');
const pageSubtitle = document.getElementById('pageSubtitle');

// ===== NAVIGATION =====
function switchView(viewName) {
  currentView = viewName;

  views.forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${viewName}`).classList.add('active');

  sidebarLinks.forEach(link => {
    link.classList.toggle('active', link.dataset.view === viewName);
  });

  const titles = {
    dashboard: ['Přehled', 'Vítej zpět, Veroniko 👋'],
    leads: ['Poptávky', 'Správa příchozích kontaktů'],
    calendar: ['Kalendář', 'Správa dostupných termínů'],
    clients: ['Klienti', 'Všichni tvoji klienti']
  };

  pageTitle.textContent = titles[viewName][0];
  pageSubtitle.textContent = titles[viewName][1];

  // Render view-specific content
  if (viewName === 'leads') renderLeadsTable();
  if (viewName === 'clients') renderClientsTable();
  if (viewName === 'calendar') renderTimeSlots();
  if (viewName === 'dashboard') renderDashboard();
}

// Sidebar click handlers
sidebarLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    switchView(link.dataset.view);
  });
});

// "Zobrazit vše" links
document.querySelectorAll('.card-header-action[data-view]').forEach(el => {
  el.addEventListener('click', () => switchView(el.dataset.view));
});

// ===== HELPERS =====
function getInitials(first, last) {
  return (first[0] + last[0]).toUpperCase();
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return { day: '-', month: '-' };
  const d = new Date(dateStr);
  return {
    day: d.getDate(),
    month: d.toLocaleDateString('cs-CZ', { month: 'short' }).replace('.', '')
  };
}

function getStatusLabel(status) {
  const labels = { new: 'Nový', contacted: 'Nakontaktováno', scheduled: 'Schůzka', closed: 'Uzavřeno' };
  return labels[status] || status;
}

function getAvatarColor(index) {
  const colors = ['', 'green', 'blue', 'yellow', ''];
  return colors[index % colors.length];
}

function getClient(id) {
  return mockClients.find(c => c.id === id);
}

// ===== DASHBOARD =====
function renderDashboard() {
  // Stats
  const newLeads = mockClients.filter(c => c.status === 'new').length;
  const closed = mockClients.filter(c => c.status === 'closed').length;
  const scheduled = mockClients.filter(c => c.nextMeeting).length;
  const total = mockClients.length;
  const convRate = total > 0 ? Math.round((closed / total) * 100) : 0;

  document.getElementById('statLeads').textContent = newLeads;
  document.getElementById('statClosed').textContent = closed;
  document.getElementById('statMeetings').textContent = scheduled;
  document.getElementById('statConversion').textContent = convRate + '%';
  document.getElementById('leadsBadge').textContent = newLeads;

  // Recent leads table (last 4)
  const tbody = document.getElementById('dashboardTableBody');
  tbody.innerHTML = '';
  const recent = [...mockClients].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);

  recent.forEach((client, i) => {
    const tr = document.createElement('tr');
    tr.onclick = () => openClientPanel(client.id);
    tr.innerHTML = `
      <td>
        <div class="client-cell">
          <div class="client-avatar ${getAvatarColor(i)}">${getInitials(client.firstName, client.lastName)}</div>
          <div>
            <div class="client-name">${client.firstName} ${client.lastName}</div>
            <div class="client-email">${client.email}</div>
          </div>
        </div>
      </td>
      <td><span class="status-badge ${client.status}">${getStatusLabel(client.status)}</span></td>
      <td>${formatDate(client.date)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Upcoming meetings
  const meetingsEl = document.getElementById('upcomingMeetings');
  const withMeetings = mockClients.filter(c => c.nextMeeting).sort((a, b) => new Date(a.nextMeeting.date) - new Date(b.nextMeeting.date));

  if (withMeetings.length === 0) {
    meetingsEl.innerHTML = '<div class="empty-state"><p>Žádné schůzky naplánované</p></div>';
  } else {
    meetingsEl.innerHTML = withMeetings.map(client => {
      const d = formatDateShort(client.nextMeeting.date);
      return `
        <div class="meeting-item" onclick="openClientPanel(${client.id})">
          <div class="meeting-date-box">
            <span class="day">${d.day}</span>
            <span class="month">${d.month}</span>
          </div>
          <div class="meeting-info">
            <h4>${client.firstName} ${client.lastName}</h4>
            <p>Konzultace</p>
          </div>
          <span class="meeting-time">${client.nextMeeting.time}</span>
        </div>
      `;
    }).join('');
  }

  // Activity feed
  const feedEl = document.getElementById('activityFeed');
  const activities = [
    { color: 'blue', text: '<strong>Jakub Procházka</strong> poslal novou poptávku', time: 'Před 2 hodinami' },
    { color: 'green', text: '<strong>Eliška Dvořáková</strong> přijata na UNC Asheville 🎉', time: 'Před 5 dny' },
    { color: 'yellow', text: 'Schůzka s <strong>Martinem Krejčím</strong> naplánována', time: 'Před týdnem' },
    { color: 'purple', text: '<strong>Anna Svobodová</strong> nakontaktována', time: 'Před 5 dny' },
    { color: 'blue', text: '<strong>Tomáš Novák</strong> poslal novou poptávku', time: 'Před 2 dny' }
  ];

  feedEl.innerHTML = activities.map(a => `
    <div class="activity-item">
      <div class="activity-dot ${a.color}"></div>
      <div>
        <div class="activity-text">${a.text}</div>
        <div class="activity-time">${a.time}</div>
      </div>
    </div>
  `).join('');
}

// ===== LEADS TABLE =====
function renderLeadsTable() {
  const tbody = document.getElementById('leadsTableBody');
  tbody.innerHTML = '';

  let filtered = [...mockClients];
  if (currentFilter !== 'all') {
    filtered = filtered.filter(c => c.status === currentFilter);
  }

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  filtered.forEach((client, i) => {
    const tr = document.createElement('tr');
    tr.onclick = () => openClientPanel(client.id);
    tr.innerHTML = `
      <td>
        <div class="client-cell">
          <div class="client-avatar ${getAvatarColor(i)}">${getInitials(client.firstName, client.lastName)}</div>
          <div class="client-name">${client.firstName} ${client.lastName}</div>
        </div>
      </td>
      <td>${client.email}</td>
      <td>${client.phone}</td>
      <td><span class="status-badge ${client.status}">${getStatusLabel(client.status)}</span></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${client.goal}</td>
      <td>${formatDate(client.date)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderLeadsTable();
  });
});

// ===== CLIENTS TABLE =====
function renderClientsTable() {
  const tbody = document.getElementById('clientsTableBody');
  tbody.innerHTML = '';

  mockClients.forEach((client, i) => {
    const meetingStr = client.nextMeeting
      ? `${formatDate(client.nextMeeting.date)} ${client.nextMeeting.time}`
      : '—';
    const tr = document.createElement('tr');
    tr.onclick = () => openClientPanel(client.id);
    tr.innerHTML = `
      <td>
        <div class="client-cell">
          <div class="client-avatar ${getAvatarColor(i)}">${getInitials(client.firstName, client.lastName)}</div>
          <div>
            <div class="client-name">${client.firstName} ${client.lastName}</div>
            <div class="client-email">${client.email}</div>
          </div>
        </div>
      </td>
      <td>${client.email}</td>
      <td><span class="status-badge ${client.status}">${getStatusLabel(client.status)}</span></td>
      <td>${meetingStr}</td>
      <td>${client.notes.length}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== TIME SLOTS =====
function formatSlotDate(dateStr) {
  // Očekává format YYYY-MM-DD
  const dateObj = new Date(dateStr);
  const dayNames = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
  const monthNames = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
  return `${dayNames[dateObj.getDay()]} ${dateObj.getDate()}. ${monthNames[dateObj.getMonth()]}`;
}

function renderTimeSlots() {
  const container = document.getElementById('timeSlotsContainer');
  container.innerHTML = '';
  
  // Sort dates
  const sortedDates = Object.keys(availableSlots).sort();

  sortedDates.forEach(dateStr => {
    const times = availableSlots[dateStr];
    if (times.length === 0) return; // Ukazujeme jen dny "s" časy
    
    const row = document.createElement('div');
    row.className = 'time-slot-row';
    row.innerHTML = `
      <div class="time-slot-day">${formatSlotDate(dateStr)}</div>
      <div class="time-slot-times">
        ${times.map(t => `<span class="time-chip" onclick="removeTimeSlot('${dateStr}', '${t}')" title="Smazat">${t} <small style="opacity:0.5; margin-left:5px">×</small></span>`).join('')}
      </div>
    `;
    container.appendChild(row);
  });
}

window.removeTimeSlot = function(day, time) {
  availableSlots[day] = availableSlots[day].filter(t => t !== time);
  if (availableSlots[day].length === 0) {
    delete availableSlots[day];
  }
  renderTimeSlots();
  saveSettings();
};

// UI for adding exact date & time
document.addEventListener('DOMContentLoaded', () => {
  const addSlotBtn = document.getElementById('addSlotBtn');
  const addSlotUI = document.getElementById('addSlotUI');
  const cancelNewSlotBtn = document.getElementById('cancelNewSlotBtn');
  const saveNewSlotBtn = document.getElementById('saveNewSlotBtn');
  const newSlotDate = document.getElementById('newSlotDate');
  const newSlotTime = document.getElementById('newSlotTime');

  if(addSlotBtn) {
    addSlotBtn.addEventListener('click', () => {
      addSlotUI.style.display = 'flex';
      // Předvyplnit dnešní datum
      const d = new Date();
      newSlotDate.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    });
  }

  if(cancelNewSlotBtn) {
    cancelNewSlotBtn.addEventListener('click', () => {
      addSlotUI.style.display = 'none';
    });
  }

  if(saveNewSlotBtn) {
    saveNewSlotBtn.addEventListener('click', () => {
      const dateVal = newSlotDate.value;
      const timeVal = newSlotTime.value;
      if (!dateVal || !timeVal) {
        alert('Vyber prosím datum i čas.');
        return;
      }
      
      if (!availableSlots[dateVal]) {
        availableSlots[dateVal] = [];
      }
      if (!availableSlots[dateVal].includes(timeVal)) {
        availableSlots[dateVal].push(timeVal);
        availableSlots[dateVal].sort();
      }
      
      addSlotUI.style.display = 'none';
      newSlotTime.value = '';
      
      renderTimeSlots();
      saveSettings();
    });
  }
});

// ===== CLIENT PANEL =====
function openClientPanel(clientId) {
  currentClientId = clientId;
  const client = getClient(clientId);
  if (!client) return;

  // Fill profile
  document.getElementById('panelAvatar').textContent = getInitials(client.firstName, client.lastName);
  document.getElementById('panelName').textContent = `${client.firstName} ${client.lastName}`;
  document.getElementById('panelEmail').textContent = client.email;
  document.getElementById('panelPhone').textContent = client.phone;
  document.getElementById('panelDate').textContent = formatDate(client.date);
  document.getElementById('panelGoal').textContent = client.goal;
  document.getElementById('panelStatus').value = client.status;

  // Next meeting
  if (client.nextMeeting) {
    const d = formatDateShort(client.nextMeeting.date);
    document.getElementById('panelMeetDay').textContent = d.day;
    document.getElementById('panelMeetMonth').textContent = d.month;
    document.getElementById('panelMeetTitle').textContent = 'Konzultace';
    document.getElementById('panelMeetTime').textContent = `${formatDate(client.nextMeeting.date)} v ${client.nextMeeting.time}`;
  } else {
    document.getElementById('panelMeetDay').textContent = '-';
    document.getElementById('panelMeetMonth').textContent = '-';
    document.getElementById('panelMeetTitle').textContent = 'Žádná naplánovaná';
    document.getElementById('panelMeetTime').textContent = 'Klikni na Upravit pro přidání';
  }

  // Hide edit grid
  document.getElementById('meetingEditGrid').classList.remove('active');

  // Notes
  renderNotes(client);

  // Materials
  renderMaterials(client);

  // Show panel
  clientPanel.classList.add('active');
  clientOverlay.classList.add('active');
}

function closeClientPanel() {
  clientPanel.classList.remove('active');
  clientOverlay.classList.remove('active');
  currentClientId = null;
}

document.getElementById('clientPanelClose').addEventListener('click', closeClientPanel);
document.getElementById('clientOverlay').addEventListener('click', closeClientPanel);

// Status change
document.getElementById('panelStatus').addEventListener('change', async function() {
  const client = getClient(currentClientId);
  if (client) {
    const oldStatus = client.status;
    client.status = this.value;
    
    // Save to Supabase
    if (db) {
      const { error } = await db
        .from('leads')
        .update({ status: client.status })
        .eq('id', client.id);
        
      if (error) {
        console.error('Error updating status:', error);
        client.status = oldStatus; // revert on error
        this.value = oldStatus;
        return;
      }
    }
    
    // Re-render active views
    if (currentView === 'dashboard') renderDashboard();
    if (currentView === 'leads') renderLeadsTable();
    if (currentView === 'clients') renderClientsTable();
  }
});

// ===== NOTES =====
function renderNotes(client) {
  const notesList = document.getElementById('notesList');
  if (client.notes.length === 0) {
    notesList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Zatím žádné poznámky</p>';
  } else {
    notesList.innerHTML = client.notes.map(note => `
      <div class="note-item">
        <div class="note-date">${formatDate(note.date)}</div>
        <div class="note-text">${note.text}</div>
      </div>
    `).join('');
  }
}

document.getElementById('addNoteBtn').addEventListener('click', async () => {
  const input = document.getElementById('noteInput');
  const text = input.value.trim();
  if (!text || !currentClientId) return;

  const client = getClient(currentClientId);
  const newNote = {
    text: text,
    date: new Date().toISOString().split('T')[0]
  };
  
  const updatedNotes = [...(client.notes || []), newNote];
  
  // Save to Supabase
  if (db) {
    const { error } = await db
      .from('leads')
      .update({ notes: updatedNotes })
      .eq('id', client.id);
      
    if (error) {
      console.error('Error saving note:', error);
      return;
    }
  }

  client.notes = updatedNotes;
  input.value = '';
  renderNotes(client);
  if (currentView === 'clients') renderClientsTable();
});

// Enter key for notes
document.getElementById('noteInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('addNoteBtn').click();
  }
});

// ===== MATERIALS =====
function renderMaterials(client) {
  const list = document.getElementById('materialsList');
  if (client.materials.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Žádné materiály</p>';
  } else {
    list.innerHTML = client.materials.map(m => `
      <div class="material-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span>${m.name}</span>
        <span class="material-date">${formatDate(m.date)}</span>
      </div>
    `).join('');
  }
}

// ===== MEETING EDIT =====
document.getElementById('editMeetingBtn').addEventListener('click', () => {
  const grid = document.getElementById('meetingEditGrid');
  grid.classList.toggle('active');

  const client = getClient(currentClientId);
  if (client && client.nextMeeting) {
    document.getElementById('meetingDateInput').value = client.nextMeeting.date;
    document.getElementById('meetingTimeInput').value = client.nextMeeting.time;
  }
});

document.getElementById('saveMeetingBtn').addEventListener('click', async () => {
  const date = document.getElementById('meetingDateInput').value;
  const time = document.getElementById('meetingTimeInput').value;

  if (!date || !time || !currentClientId) return;

  const client = getClient(currentClientId);
  
  // Save to Supabase
  if (db) {
    const { error } = await db
      .from('leads')
      .update({
        appointment_date: date,
        appointment_time: time
      })
      .eq('id', client.id);
      
    if (error) {
      console.error('Error saving meeting:', error);
      return;
    }
  }

  client.nextMeeting = { date, time };

  // Update panel
  const d = formatDateShort(date);
  document.getElementById('panelMeetDay').textContent = d.day;
  document.getElementById('panelMeetMonth').textContent = d.month;
  document.getElementById('panelMeetTitle').textContent = 'Konzultace';
  document.getElementById('panelMeetTime').textContent = `${formatDate(date)} v ${time}`;
  document.getElementById('meetingEditGrid').classList.remove('active');

  // Re-render
  if (currentView === 'dashboard') renderDashboard();
  if (currentView === 'clients') renderClientsTable();
});

// ===== SEARCH =====
document.getElementById('searchInput').addEventListener('input', function() {
  const query = this.value.toLowerCase();
  if (!query) {
    switchView(currentView);
    return;
  }

  // Simple search in current table
  const tables = document.querySelectorAll('.data-table tbody');
  tables.forEach(tbody => {
    const rows = tbody.querySelectorAll('tr');
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(query) ? '' : 'none';
    });
  });
});

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeClientPanel();
  }
});

// ===== INIT =====
renderDashboard();
