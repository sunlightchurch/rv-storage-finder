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

  function href(id) {
    return `${base}cities/${id}/`;
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
        empty.textContent = 'No city or ZIP matches yet.';
        list.append(empty);
        return;
      }
      found.forEach((city, index) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = href(city.id);
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
  });

  document.querySelectorAll('[data-filter-bar]').forEach((bar) => {
    const root = bar.closest('[data-filter-root]') || document;
    const cards = [...root.querySelectorAll('[data-listing]')];
    const empty = root.querySelector('[data-filter-empty]');
    bar.addEventListener('click', (event) => {
      const button = event.target.closest('[data-filter]');
      if (!button || !bar.contains(button)) return;
      event.preventDefault();
      const filter = button.getAttribute('data-filter');
      bar.querySelectorAll('[data-filter]').forEach((item) => {
        item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
      });
      let shown = 0;
      cards.forEach((card) => {
        const ok = filter === 'all' || card.getAttribute(`data-${filter}`) === 'true';
        card.hidden = !ok;
        if (ok) shown += 1;
      });
      if (empty) empty.hidden = shown !== 0;
    });
  });
})();
