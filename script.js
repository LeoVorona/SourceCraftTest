/* ==========================================================================
   SimpleWebPage — интерактив лендинга
   Блоки: утилиты → тема → шапка/навигация → появление блоков → счётчики →
   аккордеон → слайдер → калькулятор → форма → canvas-фон
   ========================================================================== */
(function () {
  'use strict';

  var $ = function (selector, root) { return (root || document).querySelector(selector); };
  var $$ = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  /* ---------- Форматирование чисел ---------- */
  var numberFmt = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

  function formatMoney(value) {
    if (value >= 1000000) {
      return (value / 1000000).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' млн ₽';
    }
    if (value >= 10000) {
      return numberFmt.format(Math.round(value / 1000)) + ' тыс. ₽';
    }
    return numberFmt.format(Math.round(value)) + ' ₽';
  }

  /* ---------- 1. Тема ---------- */
  (function initTheme() {
    var toggle = $('#themeToggle');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!toggle) return;

    function sync(theme) {
      var isDark = theme === 'dark';
      root.setAttribute('data-theme', theme);
      toggle.setAttribute('aria-pressed', String(isDark));
      toggle.setAttribute('aria-label', isDark ? 'Включить светлую тему' : 'Включить тёмную тему');
      if (meta) meta.setAttribute('content', isDark ? '#060d18' : '#f5f8fc');
    }

    sync(root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');

    toggle.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      sync(next);
      try { localStorage.setItem('swp-theme', next); } catch (e) { /* приватный режим */ }
    });
  })();

  /* ---------- 2. Шапка, прогресс скролла, активный пункт меню ---------- */
  (function initHeader() {
    var header = $('#siteHeader');
    var progress = $('#scrollProgress');
    var navLinks = $$('.nav__link');
    var sections = navLinks
      .map(function (link) {
        var id = link.getAttribute('href');
        var el = id && id.charAt(0) === '#' ? $(id) : null;
        return el ? { link: link, el: el } : null;
      })
      .filter(Boolean);

    var ticking = false;

    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;

      if (header) header.classList.toggle('is-scrolled', y > 8);

      if (progress) {
        var ratio = docHeight > 0 ? Math.min(1, Math.max(0, y / docHeight)) : 0;
        progress.style.width = (ratio * 100).toFixed(2) + '%';
      }

      var probe = y + (header ? header.offsetHeight : 76) + 60;
      var current = null;
      sections.forEach(function (item) {
        if (item.el.offsetTop <= probe) current = item;
      });

      navLinks.forEach(function (link) {
        link.classList.toggle('is-active', Boolean(current) && current.link === link);
      });

      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(onScroll);
      }
    }, { passive: true });

    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
  })();

  /* ---------- 3. Мобильное меню ---------- */
  (function initMenu() {
    var burger = $('#burger');
    var nav = $('#primaryNav');
    if (!burger || !nav) return;

    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
      document.body.classList.toggle('no-scroll', open);
    }

    burger.addEventListener('click', function () {
      setOpen(!nav.classList.contains('is-open'));
    });

    nav.addEventListener('click', function (event) {
      if (event.target.closest('a')) setOpen(false);
    });

    document.addEventListener('click', function (event) {
      if (!nav.classList.contains('is-open')) return;
      if (nav.contains(event.target) || burger.contains(event.target)) return;
      setOpen(false);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        burger.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 980 && nav.classList.contains('is-open')) setOpen(false);
    });
  })();

  /* ---------- 4. Плавный скролл по якорям с учётом шапки ---------- */
  (function initAnchors() {
    var header = $('#siteHeader');

    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (!link) return;

      var hash = link.getAttribute('href');
      if (!hash || hash === '#') return;

      var target = document.getElementById(hash.slice(1));
      if (!target) return;

      event.preventDefault();

      var offset = (header ? header.offsetHeight : 76) + 12;
      var top = target.getBoundingClientRect().top + window.pageYOffset - offset;

      window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'auto' : 'smooth' });

      if (history.replaceState) history.replaceState(null, '', hash);
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
  })();

  /* ---------- 5. Появление блоков при скролле ---------- */
  (function initReveal() {
    var items = $$('.reveal');
    if (!items.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    var groups = new Map();
    items.forEach(function (el) {
      var parent = el.parentElement;
      var list = groups.get(parent) || [];
      list.push(el);
      groups.set(parent, list);
    });

    groups.forEach(function (list) {
      list.forEach(function (el, index) {
        el.style.transitionDelay = Math.min(index, 6) * 70 + 'ms';
      });
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { observer.observe(el); });
  })();

  /* ---------- 6. Анимированные счётчики ---------- */
  (function initCounters() {
    var counters = $$('[data-count]');
    if (!counters.length) return;

    function animate(el) {
      var target = parseInt(el.getAttribute('data-count'), 10) || 0;
      if (reduceMotion) {
        el.textContent = numberFmt.format(target);
        return;
      }

      var duration = 1400;
      var start = null;

      function step(timestamp) {
        if (start === null) start = timestamp;
        var progress = Math.min(1, (timestamp - start) / duration);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = numberFmt.format(Math.round(target * eased));
        if (progress < 1) window.requestAnimationFrame(step);
      }

      window.requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) {
      counters.forEach(animate);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        animate(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.5 });

    counters.forEach(function (el) { observer.observe(el); });
  })();

  /* ---------- 7. Аккордеон FAQ ---------- */
  (function initFaq() {
    var items = $$('.faq__item');
    if (!items.length) return;

    items.forEach(function (item) {
      var button = $('.faq__q', item);
      if (!button) return;

      button.addEventListener('click', function () {
        var isOpen = item.classList.contains('is-open');

        items.forEach(function (other) {
          other.classList.remove('is-open');
          var otherButton = $('.faq__q', other);
          if (otherButton) otherButton.setAttribute('aria-expanded', 'false');
        });

        if (!isOpen) {
          item.classList.add('is-open');
          button.setAttribute('aria-expanded', 'true');
        }
      });
    });
  })();

  /* ---------- 8. Слайдер кейсов ---------- */
  (function initCases() {
    var viewport = $('#casesViewport');
    var track = $('#casesTrack');
    var prev = $('#casesPrev');
    var next = $('#casesNext');
    var dotsWrap = $('#casesDots');
    if (!viewport || !track) return;

    var slides = $$('.case', track);
    var total = slides.length;
    if (total < 2) return;

    var index = 0;
    var dots = [];

    if (dotsWrap) {
      slides.forEach(function (slide, i) {
        var dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'cases__dot';
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', 'Кейс ' + (i + 1) + ' из ' + total);
        dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
        dot.addEventListener('click', function () { goTo(i); });
        dotsWrap.appendChild(dot);
        dots.push(dot);
      });
    }

    function goTo(nextIndex) {
      index = (nextIndex + total) % total;
      track.style.transform = 'translateX(-' + index * 100 + '%)';

      dots.forEach(function (dot, i) {
        dot.classList.toggle('is-active', i === index);
        dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
      });

      slides.forEach(function (slide, i) {
        slide.setAttribute('aria-hidden', i === index ? 'false' : 'true');
      });

      viewport.setAttribute('aria-label', 'Кейс ' + (index + 1) + ' из ' + total);
    }

    if (prev) prev.addEventListener('click', function () { goTo(index - 1); });
    if (next) next.addEventListener('click', function () { goTo(index + 1); });

    viewport.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(index - 1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); goTo(index + 1); }
    });

    var startX = null;
    var startY = null;

    viewport.addEventListener('pointerdown', function (event) {
      startX = event.clientX;
      startY = event.clientY;
    });

    viewport.addEventListener('pointerup', function (event) {
      if (startX === null) return;
      var dx = event.clientX - startX;
      var dy = event.clientY - startY;
      startX = null;

      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
        goTo(dx < 0 ? index + 1 : index - 1);
      }
    });

    viewport.addEventListener('pointercancel', function () { startX = null; });

    goTo(0);
  })();

  /* ---------- 9. Калькулятор эффекта ---------- */
  (function initCalculator() {
    var units = $('#calcUnits');
    var hours = $('#calcHours');
    var cost = $('#calcCost');
    if (!units || !hours || !cost) return;

    var unitsOut = $('#calcUnitsOut');
    var hoursOut = $('#calcHoursOut');
    var costOut = $('#calcCostOut');
    var annualOut = $('#calcAnnual');
    var monthlyOut = $('#calcMonthly');
    var savedOut = $('#calcSaved');
    var paybackOut = $('#calcPayback');

    var REDUCTION = 0.37;        // снижение потерь от простоев
    var INVEST_BASE = 900000;    // условная стоимость внедрения на контур
    var INVEST_PER_UNIT = 500000;

    function setFill(input) {
      var min = parseFloat(input.min) || 0;
      var max = parseFloat(input.max) || 100;
      var value = parseFloat(input.value) || 0;
      var pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
      input.style.setProperty('--fill', pct.toFixed(1) + '%');
    }

    function formatPayback(months) {
      if (!isFinite(months) || months <= 0) return '—';
      if (months < 1) return 'менее месяца';
      if (months < 24) return Math.round(months) + ' мес.';
      var years = months / 12;
      return years.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) + ' года';
    }

    function update() {
      var unitCount = parseInt(units.value, 10);
      var hoursPerUnit = parseInt(hours.value, 10);
      var costPerHour = parseInt(cost.value, 10);

      var monthlyLoss = unitCount * hoursPerUnit * costPerHour;
      var monthlySaving = monthlyLoss * REDUCTION;
      var annualSaving = monthlySaving * 12;
      var investment = INVEST_BASE + unitCount * INVEST_PER_UNIT;
      var payback = monthlySaving > 0 ? investment / monthlySaving : Infinity;

      if (unitsOut) unitsOut.textContent = numberFmt.format(unitCount) + ' ед.';
      if (hoursOut) hoursOut.textContent = hoursPerUnit + ' ч';
      if (costOut) costOut.textContent = formatMoney(costPerHour);

      if (annualOut) annualOut.textContent = formatMoney(annualSaving);
      if (monthlyOut) monthlyOut.textContent = formatMoney(monthlyLoss);
      if (savedOut) savedOut.textContent = formatMoney(monthlySaving);
      if (paybackOut) paybackOut.textContent = formatPayback(payback);

      [units, hours, cost].forEach(setFill);
    }

    [units, hours, cost].forEach(function (input) {
      input.addEventListener('input', update);
      input.addEventListener('change', update);
    });

    update();
  })();

  /* ---------- 10. Форма заявки ---------- */
  (function initForm() {
    var form = $('#leadForm');
    if (!form) return;

    var success = $('#formSuccess');

    var rules = {
      fName: {
        validate: function (value) { return value.trim().length >= 2; },
        message: 'Укажите имя — минимум 2 символа'
      },
      fEmail: {
        validate: function (value) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()); },
        message: 'Введите корректный e-mail, например name@company.ru'
      },
      fPhone: {
        validate: function (value) {
          if (!value.trim()) return true;
          var digits = value.replace(/\D/g, '');
          return digits.length >= 11;
        },
        message: 'Введите номер полностью: +7 (___) ___-__-__'
      },
      fConsent: {
        validate: function (_, field) { return field.checked; },
        message: 'Без согласия на обработку данных заявку отправить нельзя'
      }
    };

    function fieldWrapper(input) { return input.closest('.field'); }

    function showError(input, message) {
      var wrapper = fieldWrapper(input);
      var error = wrapper ? $('.field__error', wrapper) : null;
      if (wrapper) wrapper.classList.add('is-invalid');
      if (error) error.textContent = message;
      input.setAttribute('aria-invalid', 'true');
    }

    function clearError(input) {
      var wrapper = fieldWrapper(input);
      var error = wrapper ? $('.field__error', wrapper) : null;
      if (wrapper) wrapper.classList.remove('is-invalid');
      if (error) error.textContent = '';
      input.removeAttribute('aria-invalid');
    }

    function check(input) {
      var rule = rules[input.id];
      if (!rule) return true;
      var ok = rule.validate(input.value, input);
      if (ok) clearError(input);
      else showError(input, rule.message);
      return ok;
    }

    Object.keys(rules).forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      input.addEventListener('blur', function () { check(input); });
      input.addEventListener('input', function () {
        if (fieldWrapper(input) && fieldWrapper(input).classList.contains('is-invalid')) check(input);
      });
      input.addEventListener('change', function () { check(input); });
    });

    var phone = $('#fPhone');
    if (phone) {
      phone.addEventListener('input', function () {
        var digits = phone.value.replace(/\D/g, '');
        if (!digits) { phone.value = ''; return; }
        if (digits.charAt(0) === '8') digits = '7' + digits.slice(1);
        if (digits.charAt(0) !== '7') digits = '7' + digits;
        digits = digits.slice(0, 11);

        var out = '+7';
        if (digits.length > 1) out += ' (' + digits.slice(1, 4);
        if (digits.length >= 5) out += ') ' + digits.slice(4, 7);
        if (digits.length >= 8) out += '-' + digits.slice(7, 9);
        if (digits.length >= 10) out += '-' + digits.slice(9, 11);
        phone.value = out;
      });
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var valid = true;
      var firstInvalid = null;

      Object.keys(rules).forEach(function (id) {
        var input = document.getElementById(id);
        if (!input) return;
        if (!check(input)) {
          valid = false;
          if (!firstInvalid) firstInvalid = input;
        }
      });

      if (!valid) {
        if (success) success.hidden = true;
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      if (success) success.hidden = false;
      form.reset();
      $$('.field', form).forEach(function (wrapper) { wrapper.classList.remove('is-invalid'); });
      $$('.field__error', form).forEach(function (error) { error.textContent = ''; });
      $$('.range', form).forEach(function () { /* заглушка на будущее */ });
      if (success) success.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  })();

  /* ---------- 11. Анимация нейросети на canvas ---------- */
  (function initCanvas() {
    var canvas = $('#neuralCanvas');
    if (!canvas || reduceMotion) return;

    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var width = 0;
    var height = 0;
    var dpr = 1;
    var nodes = [];
    var frame = null;
    var active = true;
    var lastTime = 0;

    function isDark() { return root.getAttribute('data-theme') === 'dark'; }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    function build() {
      var count = Math.round(Math.min(70, Math.max(26, width / 18)));
      nodes = [];
      for (var i = 0; i < count; i += 1) {
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.28,
          vy: (Math.random() - 0.5) * 0.28,
          r: Math.random() * 1.6 + 1.1
        });
      }
    }

    function draw(timestamp) {
      if (!active) { frame = null; return; }
      if (!lastTime) lastTime = timestamp;
      var delta = Math.min(48, timestamp - lastTime) / 16.67;
      lastTime = timestamp;

      ctx.clearRect(0, 0, width, height);

      var dark = isDark();
      var lineBase = dark ? '96, 165, 250' : '37, 99, 235';
      var dotColor = dark ? '#7dd3fc' : '#2563eb';
      var linkDistance = Math.min(170, Math.max(110, width / 7));

      for (var i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        node.x += node.vx * delta;
        node.y += node.vy * delta;

        if (node.x < -20) node.x = width + 20;
        if (node.x > width + 20) node.x = -20;
        if (node.y < -20) node.y = height + 20;
        if (node.y > height + 20) node.y = -20;

        for (var j = i + 1; j < nodes.length; j += 1) {
          var other = nodes[j];
          var dx = node.x - other.x;
          var dy = node.y - other.y;
          var distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > linkDistance) continue;
          var alpha = (1 - distance / linkDistance) * (dark ? 0.3 : 0.22);
          ctx.strokeStyle = 'rgba(' + lineBase + ', ' + alpha.toFixed(3) + ')';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(node.x, node.y);
          ctx.lineTo(other.x, other.y);
          ctx.stroke();
        }
      }

      for (var k = 0; k < nodes.length; k += 1) {
        var point = nodes[k];
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.r, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.globalAlpha = dark ? 0.55 : 0.4;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      frame = window.requestAnimationFrame(draw);
    }

    function start() {
      if (frame === null) {
        active = true;
        lastTime = 0;
        frame = window.requestAnimationFrame(draw);
      }
    }

    function stop() {
      active = false;
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
        frame = null;
      }
    }

    resize();

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 180);
    });

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) start();
          else stop();
        });
      }, { threshold: 0.05 });
      observer.observe(canvas);
    } else {
      start();
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else start();
    });
  })();

  /* ---------- 12. Год в подвале ---------- */
  (function initYear() {
    var year = $('#currentYear');
    if (year) year.textContent = String(new Date().getFullYear());
  })();
})();
