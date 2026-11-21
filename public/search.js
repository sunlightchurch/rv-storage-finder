(function () {
  const indexNode = document.getElementById('city-index');
  if (!indexNode || !indexNode.textContent) return;
  const cities = JSON.parse(indexNode.textContent);
  const base = document.documentElement.getAttribute('data-base') || '/';

  function matches(city, query) {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    if (city.city.toLowerCase().includes(q)) return true;
    if (city.state.toLowerCase().includes(q)) return true;
    if (city.code.toLowerCase() === q) return true;
    if (city.metro.toLowerCase().includes(q)) return true;
    const digits = q.replace(/\D/g, '');
    if (digits.length >= 3 && city.zips.some((zip) => zip.startsWith(digits))) return true;
    return false;
  }

  function href(city) {
    const target = city.path || `cities/${city.id}/`;
    return `${base}${String(target).replace(/^\//, '')}`;
  }

  function isVehicle(value) {
    return ['rv', 'boat', 'trailer', 'car', 'covered', 'enclosed', 'indoor', 'open'].includes(value);
  }

  function filterKey(type) {
    return type === 'indoor' ? 'enclosed' : type;
  }

  const states = [
    { name: 'Florida', code: 'FL', slug: 'florida' },
    { name: 'Arizona', code: 'AZ', slug: 'arizona' },
    { name: 'Texas', code: 'TX', slug: 'texas' },
    { name: 'Georgia', code: 'GA', slug: 'georgia' },
    { name: 'Nevada', code: 'NV', slug: 'nevada' },
    { name: 'North Carolina', code: 'NC', slug: 'north-carolina' },
    { name: 'California', code: 'CA', slug: 'california' },
    { name: 'South Carolina', code: 'SC', slug: 'south-carolina' },
    { name: 'Tennessee', code: 'TN', slug: 'tennessee' },
  ];

  function bestState(query) {
    const q = normPlace(query);
    if (!q) return null;
    return states.find((state) => normPlace(state.name) === q || state.code.toLowerCase() === q || state.slug === q) || null;
  }

  function currentType(form) {
    const select = form && form.querySelector('select[name="type"]');
    if (select && select.value && isVehicle(select.value)) return select.value;
    const checked = form && form.querySelector('input[name="type"]:checked');
    if (checked && checked.value) return checked.value;
    const hidden = form && form.querySelector('input[type="hidden"][name="type"]');
    if (hidden && hidden.value && isVehicle(hidden.value)) return hidden.value;
    const fromUrl = new URLSearchParams(window.location.search).get('type') || '';
    return isVehicle(fromUrl) ? fromUrl : '';
  }

  function withType(url, type) {
    if (!type) return url;
    const next = new URL(url, window.location.origin);
    next.searchParams.set('type', type);
    return `${next.pathname}${next.search}${next.hash}`;
  }

  function pageHref(urlPath) {
    return `${base}${String(urlPath).replace(/^\//, '')}`;
  }

  function normPlace(value) {
    return String(value)
      .toLowerCase()
      .replace(/\./g, '')
      .replace(/\bsaint\b/g, 'st')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function queryZip(value) {
    const match = String(value).trim().match(/^(\d{5})(?:-\d{4})?$/);
    return match ? match[1] : null;
  }

  function bestCity(query) {
    const q = normPlace(query);
    if (!q || queryZip(query)) return null;
    const exact = cities.filter((city) => {
      const name = normPlace(city.city);
      return name === q || `${name} ${city.code.toLowerCase()}` === q || normPlace(`${city.city}, ${city.code}`) === q;
    });
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return null;
    if (q.length < 4) return null;
    const prefix = cities.filter((city) => normPlace(city.city).startsWith(q));
    return prefix.length === 1 ? prefix[0] : null;
  }

  document.querySelectorAll('[data-city-search]').forEach((input) => {
    const list = document.getElementById(input.getAttribute('aria-controls') || '');
    if (!list) return;
    let active = -1;

    function render() {
      const found = cities.filter((city) => matches(city, input.value)).slice(0, 8);
      list.innerHTML = '';
      active = -1;
      if (!input.value.trim()) {
        list.hidden = true;
        input.setAttribute('aria-expanded', 'false');
        return;
      }
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      const stateHit = bestState(input.value);
      if (stateHit) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = pageHref(`states/${stateHit.slug}/`);
        link.id = `${input.id}-opt-state`;
        link.setAttribute('role', 'option');
        link.textContent = `${stateHit.name} — state`;
        item.append(link);
        list.append(item);
      }
      if (!found.length && !stateHit) {
        const empty = document.createElement('li');
        empty.className = 'search-empty';
        empty.textContent = 'No listed city has that name. Press Search for nearest facilities.';
        list.append(empty);
        return;
      }
      found.forEach((city, index) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = withType(href(city), currentType(input.form));
        link.id = `${input.id}-opt-${index}`;
        link.setAttribute('role', 'option');
        link.textContent = `${city.city}, ${city.code}`;
        item.append(link);
        list.append(item);
      });
    }

    input.addEventListener('input', render);
    input.addEventListener('keydown', (event) => {
      const options = [...list.querySelectorAll('a')];
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!options.length) return;
        event.preventDefault();
        active = event.key === 'ArrowDown' ? Math.min(options.length - 1, active + 1) : Math.max(0, active - 1);
        options.forEach((option, index) => option.classList.toggle('is-active', index === active));
        input.setAttribute('aria-activedescendant', options[active].id);
      }
      if (event.key === 'Enter' && active >= 0 && options[active]) {
        event.preventDefault();
        window.location.href = options[active].href;
      }
      if (event.key === 'Escape') {
        list.hidden = true;
        input.setAttribute('aria-expanded', 'false');
      }
    });

    const form = input.form;
    if (form) {
      form.addEventListener('submit', (event) => {
        const hidden = form.querySelector('input[type="hidden"][name="type"]');
        if (hidden && !hidden.value) hidden.disabled = true;
        const active = list.querySelector('a.is-active');
        const type = currentType(form);
        if (active) {
          event.preventDefault();
          window.location.href = withType(active.href, type);
          return;
        }
        const stateHit = bestState(input.value);
        if (stateHit) {
          event.preventDefault();
          window.location.href = pageHref(`states/${stateHit.slug}/`);
          return;
        }
        const city = bestCity(input.value);
        if (city) {
          event.preventDefault();
          window.location.href = withType(href(city), type);
        }
      });
      form.querySelectorAll('.type-pills input').forEach((choice) => {
        choice.addEventListener('click', () => {
          if (choice.dataset.was === '1') {
            choice.checked = false;
            choice.dataset.was = '0';
          } else {
            form.querySelectorAll('.type-pills input').forEach((item) => {
              item.dataset.was = '0';
            });
            choice.dataset.was = '1';
          }
          render();
        });
      });
    }
  });

  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('[data-popular-city]') : null;
    if (!link) return;
    const type = currentType(link.closest('form'));
    if (!type) return;
    event.preventDefault();
    window.location.href = withType(link.href, type);
  });

  const urlType = new URLSearchParams(window.location.search).get('type') || '';
  if (isVehicle(urlType)) {
    document.querySelectorAll('input[type="hidden"][name="type"]').forEach((input) => {
      if (!input.value) input.value = urlType;
    });
    const copy = {
      rv: 'Showing facilities that list RV storage.',
      boat: 'Showing facilities that list boat storage.',
      trailer: 'Showing facilities whose pages mention a trailer.',
      car: 'Showing facilities whose pages mention a car or vehicle storage.',
    };
    document.querySelectorAll('[data-type-note]').forEach((note) => {
      note.hidden = false;
      const text = note.querySelector('[data-type-copy]');
      if (text) text.textContent = copy[urlType];
      const hub = note.querySelector('[data-boat-hub]');
      if (hub) hub.hidden = urlType !== 'boat';
    });
  }

  const header = document.querySelector('.site-header');
  if (header) {
    const pin = () => {
      document.documentElement.style.setProperty('--header-sticky', `${header.offsetHeight}px`);
    };
    pin();
    window.addEventListener('resize', pin);
    const searchToggle = header.querySelector('[data-search-toggle]');
    const navToggle = header.querySelector('[data-nav-toggle]');
    searchToggle?.addEventListener('click', () => {
      const open = !header.classList.contains('is-search-open');
      header.classList.toggle('is-search-open', open);
      searchToggle.setAttribute('aria-expanded', String(open));
      if (open) header.querySelector('#header-q')?.focus();
    });
    navToggle?.addEventListener('click', () => {
      const open = !header.classList.contains('is-nav-open');
      header.classList.toggle('is-nav-open', open);
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }

  document.querySelectorAll('[data-sheet-open]').forEach((button) => {
    const root = button.closest('[data-filter-root]') || document;
    const sheet = root.querySelector('[data-sheet]');
    if (!sheet) return;
    const openSheet = () => {
      sheet.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      document.body.classList.add('sheet-open');
    };
    const closeSheet = () => {
      sheet.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('sheet-open');
    };
    button.addEventListener('click', openSheet);
    sheet.querySelectorAll('[data-sheet-close]').forEach((control) => {
      control.addEventListener('click', closeSheet);
    });
    sheet.addEventListener('click', (event) => {
      if (event.target === sheet) closeSheet();
    });
  });

  const refreshers = [];
  let zipTable = null;

  function milesBetween(a, b) {
    const toRad = (value) => (value * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 3958.8 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  async function censusZips() {
    if (zipTable) return zipTable;
    const response = await fetch(pageHref('zcta.csv'));
    if (!response.ok) return null;
    zipTable = new Map();
    for (const line of (await response.text()).split('\n')) {
      const [zip, lat, lng] = line.split(',');
      if (!zip || zip === 'zip') continue;
      zipTable.set(zip, { lat: Number(lat), lng: Number(lng) });
    }
    return zipTable;
  }

  document.querySelectorAll('[data-filter-bar]').forEach((bar) => {
    const root = bar.closest('[data-filter-root]') || document;
    const cards = [...root.querySelectorAll('[data-listing]')];
    cards.forEach((card, index) => {
      if (!card.dataset.order) card.dataset.order = String(index);
    });
    const empty = root.querySelector('[data-filter-empty]');
    const count = root.querySelector('[data-filter-count]');
    const status = root.querySelector('[data-sort-status]');
    const lengthInput = bar.querySelector('[data-min-length]');
    const sortSelect = bar.querySelector('[data-sort]');
    const zipInput = root.querySelector('[data-distance-zip]');
    const distancePanel = root.querySelector('[data-distance-panel]');
    const filterOpen = bar.querySelector('[data-sheet-open]');
    const list = root.querySelector('[data-listing-list]');
    const total = cards.length;
    const params = new URLSearchParams(window.location.search);
    let urlType = isVehicle(params.get('type') || '') ? params.get('type') : '';
    if (urlType) {
      const button = bar.querySelector(`[data-filter="${urlType}"]`);
      if (button) {
        bar.querySelectorAll('[data-filter]').forEach((item) => {
          item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
        });
      }
    }

    function sortValue() {
      return sortSelect ? sortSelect.value : 'default';
    }

    function apply() {
      const keys = [...bar.querySelectorAll('[data-filter]')]
        .filter((button) => button.getAttribute('data-filter') !== 'all' && button.getAttribute('aria-pressed') === 'true')
        .map((button) => button.getAttribute('data-filter'));
      const typed = urlType ? filterKey(urlType) : '';
      if (typed && !keys.includes(typed)) keys.push(typed);
      const minLength = Number(lengthInput && lengthInput.value);
      const useLength = Number.isFinite(minLength) && minLength > 0;
      const mode = sortValue();
      const ranked = [...cards].sort((a, b) => {
        const orderA = Number(a.dataset.order);
        const orderB = Number(b.dataset.order);
        if (mode === 'price-asc' || mode === 'price-desc') {
          const priceA = a.getAttribute('data-monthly');
          const priceB = b.getAttribute('data-monthly');
          const left = priceA ? Number(priceA) : null;
          const right = priceB ? Number(priceB) : null;
          if (left == null && right == null) return orderA - orderB;
          if (left == null) return 1;
          if (right == null) return -1;
          return mode === 'price-asc' ? left - right || orderA - orderB : right - left || orderA - orderB;
        }
        if (mode === 'distance') {
          const left = a.dataset.miles ? Number(a.dataset.miles) : null;
          const right = b.dataset.miles ? Number(b.dataset.miles) : null;
          if (left == null && right == null) return orderA - orderB;
          if (left == null) return 1;
          if (right == null) return -1;
          return left - right || orderA - orderB;
        }
        return orderA - orderB;
      });
      if (list) ranked.forEach((card) => list.append(card));
      let shown = 0;
      let unknownLength = 0;
      ranked.forEach((card) => {
        const attrs = keys.every((key) => card.getAttribute(`data-${key}`) === 'true');
        const published = card.getAttribute('data-max-length');
        const tooShort = useLength && published && Number(published) < minLength;
        const ok = attrs && !tooShort;
        card.hidden = !ok;
        if (!ok) return;
        shown += 1;
        if (useLength && !published) unknownLength += 1;
      });
      if (empty) empty.hidden = shown !== 0;
      if (count) {
        const noun = shown === 1 ? 'facility' : 'facilities';
        const span = shown ? `1–${shown}` : '0';
        let text = `${span} of ${total} ${noun}`;
        if (useLength && unknownLength) {
          text += `. ${unknownLength} ${unknownLength === 1 ? 'has' : 'have'} no published length, so ${unknownLength === 1 ? 'it is' : 'they are'} not ruled out`;
        }
        count.textContent = text;
      }
      if (distancePanel) distancePanel.hidden = mode !== 'distance';
      if (filterOpen) {
        const active = keys.length + (useLength ? 1 : 0);
        filterOpen.textContent = active ? `Filters · ${active}` : 'Filters';
      }
      if (status) {
        if (mode === 'price-asc' || mode === 'price-desc') {
          status.textContent = 'Lowest published monthly price first. Lots without a monthly price stay last.';
        } else if (mode === 'distance' && !cards.some((card) => card.dataset.miles)) {
          status.textContent = 'Use your location, or enter a ZIP. Lots without a point stay last.';
        } else if (mode === 'distance') {
          status.textContent = 'Nearest first. Lots without a point stay last.';
        } else {
          status.textContent = '';
        }
      }
      if (window.refreshResultMap) window.refreshResultMap();
    }

    async function measureZip() {
      const zip = (zipInput?.value || '').replace(/\D/g, '').slice(0, 5);
      if (zip.length !== 5) return;
      const table = await censusZips();
      const origin = table && table.get(zip);
      if (!origin || !Number.isFinite(origin.lat)) {
        if (status) status.textContent = 'That ZIP is not in the Census table. Try a ZIP from a listed facility.';
        return;
      }
      cards.forEach((card) => {
        const lat = Number(card.getAttribute('data-lat'));
        const lng = Number(card.getAttribute('data-lng'));
        let point = null;
        if (card.hasAttribute('data-lat') && Number.isFinite(lat) && Number.isFinite(lng)) {
          point = { lat, lng };
        } else {
          const cardZip = card.getAttribute('data-zip');
          const centroid = cardZip && table.get(cardZip);
          if (centroid && Number.isFinite(centroid.lat)) point = centroid;
        }
        if (!point) delete card.dataset.miles;
        else card.dataset.miles = String(milesBetween(origin, point));
      });
      if (sortSelect) sortSelect.value = 'distance';
      apply();
    }

    bar.addEventListener('click', (event) => {
      const button = event.target.closest('[data-filter]');
      if (!button || !bar.contains(button)) return;
      event.preventDefault();
      const filter = button.getAttribute('data-filter');
      if (filter === 'all') {
        urlType = '';
        bar.querySelectorAll('[data-filter]').forEach((item) => {
          item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
        });
      } else {
        const next = button.getAttribute('aria-pressed') !== 'true';
        button.setAttribute('aria-pressed', next ? 'true' : 'false');
        if (filter === urlType && !next) urlType = '';
        const any = [...bar.querySelectorAll('[data-filter]')].some(
          (item) => item.getAttribute('data-filter') !== 'all' && item.getAttribute('aria-pressed') === 'true',
        );
        const all = bar.querySelector('[data-filter="all"]');
        if (all) all.setAttribute('aria-pressed', any ? 'false' : 'true');
      }
      apply();
    });

    if (lengthInput) lengthInput.addEventListener('input', apply);
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        if (sortSelect.value === 'distance' && zipInput && zipInput.value.replace(/\D/g, '').length === 5) {
          measureZip();
          return;
        }
        apply();
      });
    }
    if (zipInput && !zipInput.closest('[data-distance-form]')) {
      zipInput.addEventListener('change', measureZip);
    }
    root.querySelector('[data-zip-go]')?.addEventListener('click', measureZip);
    root.querySelector('[data-near-me-lite]')?.addEventListener('click', () => {
      if (!navigator.geolocation) {
        if (status) status.textContent = 'This browser cannot share a location. Enter a ZIP instead.';
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const origin = { lat: position.coords.latitude, lng: position.coords.longitude };
          const table = await censusZips();
          cards.forEach((card) => {
            const lat = Number(card.getAttribute('data-lat'));
            const lng = Number(card.getAttribute('data-lng'));
            let point = null;
            if (card.hasAttribute('data-lat') && Number.isFinite(lat) && Number.isFinite(lng)) {
              point = { lat, lng };
            } else if (table) {
              const cardZip = card.getAttribute('data-zip');
              const centroid = cardZip && table.get(cardZip);
              if (centroid && Number.isFinite(centroid.lat)) point = centroid;
            }
            if (!point) delete card.dataset.miles;
            else card.dataset.miles = String(milesBetween(origin, point));
          });
          if (sortSelect) sortSelect.value = 'distance';
          apply();
        },
        () => {
          if (status) status.textContent = 'Location was blocked. Enter a ZIP instead.';
        },
        { enableHighAccuracy: false, timeout: 8000 },
      );
    });
    refreshers.push(apply);
    apply();
  });

  window.refreshListingFilters = () => {
    refreshers.forEach((apply) => apply());
  };

  function closeMenus(except) {
    document.querySelectorAll('[data-menu]').forEach((menu) => {
      if (menu === except) return;
      const button = menu.querySelector('[aria-expanded]');
      const panel = menu.querySelector('[data-menu-panel]');
      if (button) button.setAttribute('aria-expanded', 'false');
      if (panel) panel.hidden = true;
    });
  }

  document.querySelectorAll('[data-menu]').forEach((menu) => {
    const button = menu.querySelector('[aria-expanded]');
    const panel = menu.querySelector('[data-menu-panel]');
    if (!button || !panel) return;
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') === 'true';
      closeMenus(menu);
      button.setAttribute('aria-expanded', open ? 'false' : 'true');
      panel.hidden = open;
    });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenus();
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        button.setAttribute('aria-expanded', 'true');
        panel.hidden = false;
        panel.querySelector('a')?.focus();
      }
    });
  });
  document.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('[data-menu]')) return;
    closeMenus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenus();
  });

  function markPins(id) {
    document.querySelectorAll('[data-pins]').forEach((pin) => {
      const ids = (pin.getAttribute('data-pins') || '').split(' ');
      pin.classList.toggle('is-hot', Boolean(id) && ids.includes(id));
    });
  }
  document.addEventListener('mouseover', (event) => {
    const card = event.target instanceof Element ? event.target.closest('[data-listing]') : null;
    markPins(card ? card.id : '');
  });
  document.addEventListener('focusin', (event) => {
    const card = event.target instanceof Element ? event.target.closest('[data-listing]') : null;
    if (card) markPins(card.id);
  });

  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const seen = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        seen.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    document.querySelectorAll('.listing, .state-card, .place-link').forEach((card) => {
      card.classList.add('will-enter');
      seen.observe(card);
    });
  }
})();
