// ===== USA Studium – Script =====

// ===== SUPABASE CONFIG =====
const SUPABASE_URL = 'https://zkhinefqbebozbtxlzgf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpraGluZWZxYmVib3pidHhsemdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3Nzg5OTIsImV4cCI6MjA5MjM1NDk5Mn0.E9xrvHCxdPpT_wCF_Tlwu2lbYiqwNMgje2Ux201slY8';
const db = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
document.addEventListener('DOMContentLoaded', () => {
  // === Navigation scroll effect ===
  const nav = document.getElementById('navbar');
  
  const handleNavScroll = () => {
    if (window.scrollY > 50) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  };
  
  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll();

  // === Mobile menu toggle ===
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    
    const spans = navToggle.querySelectorAll('span');
    if (navLinks.classList.contains('open')) {
      spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
      spans[1].style.opacity = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    } else {
      spans[0].style.transform = 'none';
      spans[1].style.opacity = '1';
      spans[2].style.transform = 'none';
    }
  });
  
  // Close mobile menu on link click
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      const spans = navToggle.querySelectorAll('span');
      spans[0].style.transform = 'none';
      spans[1].style.opacity = '1';
      spans[2].style.transform = 'none';
    });
  });

  // === Smooth scroll for anchor links ===
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        const offset = nav.offsetHeight + 20;
        const position = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({
          top: position,
          behavior: 'smooth'
        });
      }
    });
  });

  // === Appointment slot picker ===
  let availableSlotsFront = {};
  let selectedDate = null;
  let selectedTime = null;
  let currentLang = 'cz';

  const datePicker = document.getElementById('datePicker');
  const timePicker = document.getElementById('timePicker');
  const timePickerGroup = document.getElementById('timePickerGroup');
  const dateHiddenInput = document.getElementById('appointmentDate');
  const timeHiddenInput = document.getElementById('appointmentTime');

  const dayNamesCZ = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
  const monthNamesCZ = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
  const dayNamesEN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNamesEN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNamesCZShort = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];

  // ===== 24h booking lead time =====
  // Slot times are stored in Czech time. Customer must be able to book at
  // least 24h in advance (CZ wall clock). Works regardless of viewer timezone.
  const BOOKING_LEAD_HOURS = 24;

  function czCutoff(leadHours) {
    const future = new Date(Date.now() + leadHours * 3600 * 1000);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Prague',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(future);
    const g = t => parts.find(p => p.type === t).value;
    return {
      dateStr: `${g('year')}-${g('month')}-${g('day')}`,
      timeStr: `${g('hour')}:${g('minute')}`
    };
  }

  function isSlotBookable(dateStr, time) {
    const c = czCutoff(BOOKING_LEAD_HOURS);
    if (dateStr > c.dateStr) return true;
    if (dateStr < c.dateStr) return false;
    return time >= c.timeStr;
  }

  function renderDatePicker(lang) {
    if (!datePicker) return;
    datePicker.innerHTML = '';

    const sortedDates = Object.keys(availableSlotsFront)
      .filter(d => availableSlotsFront[d].some(t => isSlotBookable(d, t)))
      .sort();

    if (sortedDates.length === 0) {
      const emptyMsg = lang === 'cz'
        ? 'Momentálně nejsou volné termíny. Napiš mi e-mail a domluvíme se individuálně.'
        : 'No available dates right now. Email me and we can arrange something.';
      datePicker.innerHTML = `<div class="slot-picker-empty">${emptyMsg}</div>`;
      timePickerGroup.style.display = 'none';
      dateHiddenInput.value = '';
      timeHiddenInput.value = '';
      return;
    }

    sortedDates.forEach(dateStr => {
      const dateObj = new Date(dateStr + 'T00:00:00');
      const dayShort = lang === 'cz' ? dayNamesCZShort[dateObj.getDay()] : dayNamesEN[dateObj.getDay()];
      const day = dateObj.getDate();
      const month = lang === 'cz' ? monthNamesCZ[dateObj.getMonth()] : monthNamesEN[dateObj.getMonth()];

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'slot-date-card';
      if (dateStr === selectedDate) card.classList.add('selected');
      card.dataset.date = dateStr;
      card.innerHTML = `
        <span class="slot-date-weekday">${dayShort}</span>
        <span class="slot-date-day">${day}</span>
        <span class="slot-date-month">${month}</span>
      `;
      card.addEventListener('click', () => {
        selectedDate = dateStr;
        selectedTime = null;
        dateHiddenInput.value = dateStr;
        timeHiddenInput.value = '';
        renderDatePicker(currentLang);
        renderTimePicker();
      });
      datePicker.appendChild(card);
    });

    // If previously selected date no longer exists, reset
    if (selectedDate && !sortedDates.includes(selectedDate)) {
      selectedDate = null;
      selectedTime = null;
      dateHiddenInput.value = '';
      timeHiddenInput.value = '';
      timePickerGroup.style.display = 'none';
    }
  }

  function renderTimePicker() {
    if (!timePicker || !timePickerGroup) return;

    if (!selectedDate || !availableSlotsFront[selectedDate] || availableSlotsFront[selectedDate].length === 0) {
      timePickerGroup.style.display = 'none';
      return;
    }

    const bookableTimes = [...availableSlotsFront[selectedDate]]
      .filter(t => isSlotBookable(selectedDate, t))
      .sort();

    if (bookableTimes.length === 0) {
      timePickerGroup.style.display = 'none';
      return;
    }

    timePickerGroup.style.display = '';
    timePicker.innerHTML = '';

    bookableTimes.forEach(time => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'slot-time-chip';
      if (time === selectedTime) chip.classList.add('selected');
      chip.textContent = time;
      chip.addEventListener('click', () => {
        selectedTime = time;
        timeHiddenInput.value = time;
        timePicker.querySelectorAll('.slot-time-chip').forEach(c => c.classList.remove('selected'));
        chip.classList.add('selected');
      });
      timePicker.appendChild(chip);
    });
  }

  function renderFrontendDates(lang) {
    renderDatePicker(lang);
    renderTimePicker();
  }

  async function fetchSettingsFront() {
    if (!db) return;
    const { data: set } = await db.from('settings').select('available_slots').eq('id', 1).single();
    if (set && set.available_slots) {
      availableSlotsFront = set.available_slots;
    }
  }

  fetchSettingsFront().then(() => {
    renderFrontendDates('cz');
  });

  // Real-time sync: listen for changes in settings table
  if (db) {
    db.channel('settings-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
        if (payload.new && payload.new.available_slots) {
          availableSlotsFront = payload.new.available_slots;
          renderFrontendDates(currentLang);
        }
      })
      .subscribe();
  }

  // Fallback: refetch slots when user returns to tab
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      fetchSettingsFront().then(() => renderFrontendDates(currentLang));
    }
  });

  // === Form handling ===
  const contactForm = document.getElementById('contactForm');
  const formSuccess = document.getElementById('formSuccess');
  
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById('submitBtn');
      const originalText = submitBtn.innerHTML;

      // Validate slot selection (hidden inputs aren't validated natively)
      if (!dateHiddenInput.value || !timeHiddenInput.value) {
        const msg = currentLang === 'cz'
          ? 'Prosím vyber datum i čas schůzky.'
          : 'Please select both a date and a time.';
        alert(msg);
        return;
      }

      submitBtn.textContent = 'Odesílám...';
      submitBtn.disabled = true;

      // Collect form data
      const formData = new FormData(contactForm);
      const data = {};
      formData.forEach((value, key) => {
        data[key] = value;
      });
      
      try {
        if (!db) {
          throw new Error('Supabase is not initialized. Please check your keys.');
        }

        // Combine date and time for nextMeeting if needed, but in the mock we have them separate. 
        // For now let's insert into a simplified structure or the one matching mockClients.
        const { error } = await db
          .from('leads')
          .insert([
            {
              first_name: data.firstName,
              last_name: data.lastName,
              email: data.email,
              phone: data.phone,
              goal: data.goal,
              appointment_date: data.appointmentDate,
              appointment_time: data.appointmentTime,
              status: 'new'
            }
          ]);

        if (error) throw error;

        contactForm.style.display = 'none';
        formSuccess.classList.add('show');
        formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });

      } catch (err) {
        console.error('Error submitting form:', err);
        alert('Došlo k chybě při odesílání formuláře. Zkuste to prosím znovu nebo mě kontaktujte napřímo.');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
      }
    });
  }

  // === Language Switcher ===
  const langBtns = document.querySelectorAll('.lang-btn');
  const translatableElements = document.querySelectorAll('[data-cz][data-en]');

  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active class
      langBtns.forEach(b => b.classList.remove('lang-btn-active'));
      btn.classList.add('lang-btn-active');
      
      const targetLang = btn.getAttribute('data-lang');
      if (targetLang !== currentLang) {
        currentLang = targetLang;
        // Update all text content
        translatableElements.forEach(el => {
          el.innerHTML = el.getAttribute(`data-${currentLang}`);
        });
        
        // Change form placeholders if needed
        const inputs = document.querySelectorAll('input[data-cz-ph], textarea[data-cz-ph]');
        inputs.forEach(input => {
          input.placeholder = input.getAttribute(`data-${currentLang}-ph`);
        });
        
        // Update dates in dropdown
        renderFrontendDates(currentLang);
      }
    });
  });

});
