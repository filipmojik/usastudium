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
  if (currentView === 'calendar') renderCalendar();
  renderClientSublist();
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
  const { error } = await db.from('settings').upsert({ id: 1, available_slots: availableSlots });
  if (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
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
    leads: ['Rezervace', 'Správa příchozích rezervací'],
    calendar: ['Kalendář', 'Schůzky a dostupné termíny'],
    clients: ['Klienti', 'Všichni tvoji klienti']
  };

  pageTitle.textContent = titles[viewName][0];
  pageSubtitle.textContent = titles[viewName][1];

  // Render view-specific content
  if (viewName === 'leads') renderLeadsTable();
  if (viewName === 'clients') renderClientsTable();
  if (viewName === 'calendar') { renderCalendar(); renderTimeSlots(); }
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
  const todayStr = new Date().toISOString().split('T')[0];
  const withMeetings = mockClients
    .filter(c => c.nextMeeting && c.nextMeeting.date >= todayStr)
    .sort((a, b) => new Date(a.nextMeeting.date) - new Date(b.nextMeeting.date));

  if (withMeetings.length === 0) {
    meetingsEl.innerHTML = '<div class="empty-state"><p>Žádné schůzky naplánované</p></div>';
  } else {
    meetingsEl.innerHTML = withMeetings.slice(0, 5).map(client => {
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

// ===== CLIENT SIDEBAR SUBLIST =====
function renderClientSublist() {
  const list = document.getElementById('clientSublist');
  if (!list) return;
  list.innerHTML = '';

  const sorted = [...mockClients].sort((a, b) => {
    const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
    const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  if (sorted.length === 0) {
    list.innerHTML = '<div class="sidebar-sublist-empty">Zatím žádní klienti</div>';
    return;
  }

  sorted.forEach(client => {
    const item = document.createElement('a');
    item.href = '#';
    item.className = 'sidebar-sublist-item';
    item.innerHTML = `
      <span class="sidebar-sublist-avatar">${getInitials(client.firstName, client.lastName)}</span>
      <span class="sidebar-sublist-name">${client.firstName} ${client.lastName}</span>
    `;
    item.onclick = (e) => {
      e.preventDefault();
      openClientPanel(client.id);
    };
    list.appendChild(item);
  });
}

// ===== MEETINGS CALENDAR =====
let calendarCurrentDate = new Date();

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const label = document.getElementById('calendarMonthLabel');
  if (!grid || !label) return;

  const year = calendarCurrentDate.getFullYear();
  const month = calendarCurrentDate.getMonth();
  const monthNames = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
  label.textContent = `${monthNames[month]} ${year}`;

  // Build meeting map: date -> [clients]
  const meetingMap = {};
  mockClients.forEach(c => {
    if (c.nextMeeting && c.nextMeeting.date) {
      if (!meetingMap[c.nextMeeting.date]) meetingMap[c.nextMeeting.date] = [];
      meetingMap[c.nextMeeting.date].push(c);
    }
  });

  grid.innerHTML = '';

  // Weekday headers (Mon-first)
  const weekdays = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];
  weekdays.forEach(w => {
    const h = document.createElement('div');
    h.className = 'cal-weekday';
    h.textContent = w;
    grid.appendChild(h);
  });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Adjust: JS getDay() = 0=Sunday, convert to Monday-first
  const firstWeekday = (firstDay.getDay() + 6) % 7;
  const todayIso = new Date().toISOString().split('T')[0];

  // Empty cells before month starts
  for (let i = 0; i < firstWeekday; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day cal-day-empty';
    grid.appendChild(empty);
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const meetings = meetingMap[dateStr] || [];
    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (dateStr === todayIso) cell.classList.add('cal-day-today');
    if (meetings.length > 0) cell.classList.add('cal-day-has-meetings');

    cell.innerHTML = `
      <div class="cal-day-num">${d}</div>
      ${meetings.slice(0, 2).map(m => `<div class="cal-day-meeting">${m.nextMeeting.time} ${m.firstName}</div>`).join('')}
      ${meetings.length > 2 ? `<div class="cal-day-more">+${meetings.length - 2}</div>` : ''}
    `;

    if (meetings.length > 0) {
      cell.style.cursor = 'pointer';
      cell.onclick = () => showDayDetail(dateStr, meetings);
    }

    grid.appendChild(cell);
  }

  document.getElementById('calendarDayDetail').innerHTML = '';
}

function showDayDetail(dateStr, meetings) {
  const detail = document.getElementById('calendarDayDetail');
  const dateObj = new Date(dateStr + 'T00:00:00');
  const dayName = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'][dateObj.getDay()];

  detail.innerHTML = `
    <h4 class="cal-detail-title">${dayName} ${dateObj.getDate()}. ${dateObj.getMonth() + 1}. ${dateObj.getFullYear()}</h4>
    <div class="cal-detail-list">
      ${meetings.sort((a, b) => a.nextMeeting.time.localeCompare(b.nextMeeting.time)).map(m => `
        <div class="cal-detail-item" onclick="openClientPanel(${m.id})">
          <span class="cal-detail-time">${m.nextMeeting.time}</span>
          <div class="cal-detail-client">
            <div class="client-avatar">${getInitials(m.firstName, m.lastName)}</div>
            <div>
              <div class="client-name">${m.firstName} ${m.lastName}</div>
              <div class="client-email">${m.email}</div>
            </div>
          </div>
          <span class="status-badge ${m.status}">${getStatusLabel(m.status)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  const prev = document.getElementById('calPrevBtn');
  const next = document.getElementById('calNextBtn');
  const today = document.getElementById('calTodayBtn');
  if (prev) prev.addEventListener('click', () => { calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1); renderCalendar(); });
  if (next) next.addEventListener('click', () => { calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1); renderCalendar(); });
  if (today) today.addEventListener('click', () => { calendarCurrentDate = new Date(); renderCalendar(); });
});

// ===== TIME SLOTS =====
function formatSlotDate(dateStr) {
  // Očekává format YYYY-MM-DD
  const dateObj = new Date(dateStr);
  const dayNames = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
  const monthNames = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
  return `${dayNames[dateObj.getDay()]} ${dateObj.getDate()}. ${monthNames[dateObj.getMonth()]}`;
}

// Convert Czech time (HH:MM) to user's local time (−7h from CZ)
const USER_OFFSET_HOURS = -7;
function czToLocal(czTime) {
  const [h, m] = czTime.split(':').map(Number);
  let localH = h + USER_OFFSET_HOURS;
  if (localH < 0) localH += 24;
  if (localH >= 24) localH -= 24;
  return `${String(localH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function renderTimeSlots() {
  const container = document.getElementById('timeSlotsContainer');
  if (!container) return;
  container.innerHTML = '';

  const sortedDates = Object.keys(availableSlots).sort();

  // Filter out past dates
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingDates = sortedDates.filter(d => d >= todayStr && availableSlots[d].length > 0);

  if (upcomingDates.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>Zatím žádné aktivní termíny. Přidej nový termín výše.</p></div>';
    return;
  }

  upcomingDates.forEach(dateStr => {
    const times = [...availableSlots[dateStr]].sort();

    const row = document.createElement('div');
    row.className = 'time-slot-row';
    row.innerHTML = `
      <div class="time-slot-day">${formatSlotDate(dateStr)}</div>
      <div class="time-slot-times">
        ${times.map(t => `<span class="time-chip" onclick="removeTimeSlot('${dateStr}', '${t}')" title="Smazat – ČR ${t} / u tebe ${czToLocal(t)}">${t} <small class="tc-local">(${czToLocal(t)})</small> <small>×</small></span>`).join('')}
      </div>
    `;
    container.appendChild(row);
  });
}

window.removeTimeSlot = async function(day, time) {
  availableSlots[day] = availableSlots[day].filter(t => t !== time);
  if (availableSlots[day].length === 0) {
    delete availableSlots[day];
  }
  renderTimeSlots();
  await saveSettings();
};

// ===== NEW SLOT ADD UI =====
let selectedQuickTimes = new Set();

document.addEventListener('DOMContentLoaded', () => {
  const newSlotDate = document.getElementById('newSlotDate');
  const newSlotCustomTime = document.getElementById('newSlotCustomTime');
  const quickpicks = document.getElementById('slotTimeQuickpicks');
  const saveNewSlotBtn = document.getElementById('saveNewSlotBtn');
  const feedback = document.getElementById('slotAddFeedback');

  if (!newSlotDate || !saveNewSlotBtn) return;

  // Prefill today's date
  const today = new Date();
  newSlotDate.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  newSlotDate.min = newSlotDate.value;

  // Generate 30-minute interval quick-picks (09:00 – 20:30 Czech time)
  if (quickpicks) {
    const slots = [];
    for (let h = 9; h <= 20; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`);
      slots.push(`${String(h).padStart(2, '0')}:30`);
    }
    quickpicks.innerHTML = slots.map(t =>
      `<button type="button" class="time-pick" data-time="${t}" title="ČR ${t} / u tebe ${czToLocal(t)}">
        <span class="tp-cz">${t}</span>
        <span class="tp-local">${czToLocal(t)}</span>
      </button>`
    ).join('');

    quickpicks.querySelectorAll('.time-pick').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.time;
        if (selectedQuickTimes.has(t)) {
          selectedQuickTimes.delete(t);
          btn.classList.remove('selected');
        } else {
          selectedQuickTimes.add(t);
          btn.classList.add('selected');
        }
      });
    });
  }

  // Live-convert custom time input
  const customHint = document.getElementById('newSlotCustomHint');
  if (newSlotCustomTime && customHint) {
    const updateHint = () => {
      const v = newSlotCustomTime.value;
      customHint.textContent = v ? `ČR ${v} → u tebe ${czToLocal(v)}` : '';
    };
    newSlotCustomTime.addEventListener('input', updateHint);
  }

  const showFeedback = (msg, isError = false) => {
    feedback.textContent = msg;
    feedback.className = 'slot-add-feedback ' + (isError ? 'error' : 'success');
    setTimeout(() => { feedback.textContent = ''; feedback.className = 'slot-add-feedback'; }, 3500);
  };

  saveNewSlotBtn.addEventListener('click', async () => {
    const dateVal = newSlotDate.value;
    const customTime = newSlotCustomTime.value;
    const times = new Set(selectedQuickTimes);
    if (customTime) times.add(customTime);

    if (!dateVal) {
      showFeedback('Vyber datum.', true);
      return;
    }
    if (times.size === 0) {
      showFeedback('Vyber alespoň jeden čas.', true);
      return;
    }

    if (!availableSlots[dateVal]) availableSlots[dateVal] = [];
    let added = 0;
    times.forEach(t => {
      if (!availableSlots[dateVal].includes(t)) {
        availableSlots[dateVal].push(t);
        added++;
      }
    });
    availableSlots[dateVal].sort();

    saveNewSlotBtn.disabled = true;
    saveNewSlotBtn.textContent = 'Ukládám...';
    try {
      await saveSettings();
      showFeedback(added > 0 ? `Přidáno ${added} termínů.` : 'Termíny už existují.');

      // Reset selection
      selectedQuickTimes.clear();
      quickpicks.querySelectorAll('.time-pick').forEach(b => b.classList.remove('selected'));
      newSlotCustomTime.value = '';
      renderTimeSlots();
    } catch (err) {
      console.error(err);
      showFeedback('Chyba při ukládání.', true);
    } finally {
      saveNewSlotBtn.disabled = false;
      saveNewSlotBtn.textContent = 'Přidat vybrané termíny';
    }
  });
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
  if (!client.materials || client.materials.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Žádné materiály</p>';
  } else {
    list.innerHTML = client.materials.map((m, idx) => `
      <div class="material-item">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        ${m.url ? `<a href="${m.url}" target="_blank" rel="noopener" class="material-name">${m.name}</a>` : `<span class="material-name">${m.name}</span>`}
        <span class="material-date">${formatDate(m.date)}</span>
        <button class="material-remove" data-idx="${idx}" title="Smazat">×</button>
      </div>
    `).join('');

    list.querySelectorAll('.material-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        await removeMaterial(client, idx);
      });
    });
  }
}

async function removeMaterial(client, idx) {
  const material = client.materials[idx];
  if (!confirm(`Smazat "${material.name}"?`)) return;

  const updated = client.materials.filter((_, i) => i !== idx);

  // Delete from storage if it had a path
  if (db && material.path) {
    await db.storage.from('client-files').remove([material.path]);
  }

  if (db) {
    const { error } = await db.from('leads').update({ materials: updated }).eq('id', client.id);
    if (error) { alert('Chyba při mazání.'); return; }
  }
  client.materials = updated;
  renderMaterials(client);
}

// File upload
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileUploadInput');
  const fileLabel = document.getElementById('fileUploadLabel');
  if (!fileInput) return;

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentClientId) return;
    const client = getClient(currentClientId);
    if (!client) return;

    const originalLabel = fileLabel.textContent;
    fileLabel.textContent = 'Nahrávám...';
    fileInput.disabled = true;

    try {
      if (!db) throw new Error('DB není dostupná.');

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${client.id}/${Date.now()}-${safeName}`;

      const { error: upErr } = await db.storage
        .from('client-files')
        .upload(path, file, { upsert: false });

      if (upErr) {
        if (upErr.message && upErr.message.toLowerCase().includes('bucket')) {
          alert('Storage bucket "client-files" neexistuje. Vytvoř ho v Supabase dashboardu (Storage → New bucket → name: client-files, public).');
        } else {
          alert('Chyba nahrávání: ' + upErr.message);
        }
        throw upErr;
      }

      const { data: urlData } = db.storage.from('client-files').getPublicUrl(path);

      const newMaterial = {
        name: file.name,
        path: path,
        url: urlData.publicUrl,
        size: file.size,
        date: new Date().toISOString().split('T')[0]
      };

      const updated = [...(client.materials || []), newMaterial];
      const { error: dbErr } = await db.from('leads').update({ materials: updated }).eq('id', client.id);
      if (dbErr) throw dbErr;

      client.materials = updated;
      renderMaterials(client);
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      fileLabel.textContent = originalLabel;
      fileInput.disabled = false;
      fileInput.value = '';
    }
  });
});

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
