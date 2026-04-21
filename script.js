// ===== USA Studium – Script =====

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

  // === Generate appointment date options (2 days ahead, next 14 days) ===
  const dateSelect = document.getElementById('appointmentDate');
  
  const generateDates = (lang) => {
    if (!dateSelect) return;
    
    // Preserve the first disabled placeholder option if it exists
    const firstOption = dateSelect.querySelector('option[disabled]');
    dateSelect.innerHTML = '';
    if (firstOption) {
      dateSelect.appendChild(firstOption);
    }
    
    const today = new Date();
    const dayNamesCZ = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
    const monthNamesCZ = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
    
    const dayNamesEN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNamesEN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    for (let i = 2; i <= 15; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const dayName = lang === 'cz' ? dayNamesCZ[date.getDay()] : dayNamesEN[date.getDay()];
      const day = date.getDate();
      const month = lang === 'cz' ? monthNamesCZ[date.getMonth()] : monthNamesEN[date.getMonth()];
      
      const option = document.createElement('option');
      const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
      option.value = dateStr;
      
      if (lang === 'cz') {
        option.textContent = `${dayName} ${day}. ${month}`;
      } else {
        option.textContent = `${dayName}, ${month} ${day}`;
      }
      
      dateSelect.appendChild(option);
    }
  };
  
  // Initial generation
  generateDates('cz');

  // === Form handling ===
  const contactForm = document.getElementById('contactForm');
  const formSuccess = document.getElementById('formSuccess');
  
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Collect form data
      const formData = new FormData(contactForm);
      const data = {};
      formData.forEach((value, key) => {
        data[key] = value;
      });
      
      console.log('Form submitted:', data);
      
      // Simulate submission
      const submitBtn = document.getElementById('submitBtn');
      submitBtn.textContent = 'Odesílám...';
      submitBtn.disabled = true;
      
      setTimeout(() => {
        contactForm.style.display = 'none';
        formSuccess.classList.add('show');
        formSuccess.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 1200);
    });
  }

  // === Language Switcher ===
  const langBtns = document.querySelectorAll('.lang-btn');
  const translatableElements = document.querySelectorAll('[data-cz][data-en]');
  
  // Set initial language based on button state (Defaults to CZ)
  let currentLang = 'cz';

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
        generateDates(currentLang);
      }
    });
  });
});
