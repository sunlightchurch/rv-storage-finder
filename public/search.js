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
      if (!found.length) {
        const empty = document.createElement('li');
        empty.className = 'search-empty';
        empty.textContent = 'No listed city has that name. Press Search for nearest facilities.';
        list.append(empty);
        return;
      }
      found.forEach((city, index) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = href(city);
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
        const active = list.querySelector('a.is-active');
        if (active) {
          event.preventDefault();
          window.location.href = active.href;
          return;
        }
        const city = bestCity(input.value);
        if (city) {
          event.preventDefault();
          window.location.href = href(city);
        }
      });
    }
  });

  const header = document.querySelector('.site-header');
  if (header) {
    const pin = () => {
      document.documentElement.style.setProperty('--header-sticky', `${header.offsetHeight}px`);
    };
    pin();
    window.addEventListener('resize', pin);
  }

  document.querySelectorAll('[data-filter-bar]').forEach((bar) => {
    const root = bar.closest('[data-filter-root]') || document;
    const cards = [...root.querySelectorAll('[data-listing]')];
    const empty = root.querySelector('[data-filter-empty]');
    const count = root.querySelector('[data-filter-count]');
    const lengthInput = bar.querySelector('[data-min-length]');
    const total = cards.length;

    function apply() {
      const keys = [...bar.querySelectorAll('[data-filter]')]
        .filter((button) => button.getAttribute('data-filter') !== 'all' && button.getAttribute('aria-pressed') === 'true')
        .map((button) => button.getAttribute('data-filter'));
      const minLength = Number(lengthInput && lengthInput.value);
      const useLength = Number.isFinite(minLength) && minLength > 0;
      let shown = 0;
      let unknownLength = 0;
      cards.forEach((card) => {
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
        let text = `${shown} of ${total} ${noun}`;
        if (useLength && unknownLength) {
          text += `. ${unknownLength} ${unknownLength === 1 ? 'has' : 'have'} no published length, so ${unknownLength === 1 ? 'it is' : 'they are'} not ruled out`;
        }
        count.textContent = text;
      }
    }

    bar.addEventListener('click', (event) => {
      const button = event.target.closest('[data-filter]');
      if (!button || !bar.contains(button)) return;
      event.preventDefault();
      const filter = button.getAttribute('data-filter');
      if (filter === 'all') {
        bar.querySelectorAll('[data-filter]').forEach((item) => {
          item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
        });
      } else {
        const next = button.getAttribute('aria-pressed') !== 'true';
        button.setAttribute('aria-pressed', next ? 'true' : 'false');
        const any = [...bar.querySelectorAll('[data-filter]')].some(
          (item) => item.getAttribute('data-filter') !== 'all' && item.getAttribute('aria-pressed') === 'true',
        );
        const all = bar.querySelector('[data-filter="all"]');
        if (all) all.setAttribute('aria-pressed', any ? 'false' : 'true');
      }
      apply();
    });

    if (lengthInput) lengthInput.addEventListener('input', apply);
    apply();
  });
})();
