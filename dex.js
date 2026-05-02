(() => {
  'use strict';

  const PET_DISPLAY_NAMES = {
    rabbit:    'Rabbit',
    squirrel:  'Squirrel',
    UNICORN:   'Unicorn',
    Dolphin:   'Dolphin',
    Donkey:    'Donkey',
    capybara:  'Capybara',
    crocodile: 'Crocodile',
    dog:       'Dog',
  };

  function getURL(path) {
    return chrome.runtime.getURL(path);
  }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  }

  function render(pets) {
    const grid = document.getElementById('dex-grid');
    const empty = document.getElementById('empty-state');
    const subtitle = document.getElementById('subtitle');

    grid.innerHTML = '';

    if (pets.length === 0) {
      empty.classList.remove('hidden');
      subtitle.textContent = '포획한 펫 0마리';
      return;
    }

    empty.classList.add('hidden');
    subtitle.textContent = `포획한 펫 총 ${pets.length}마리`;

    // Group by name
    const counts = {};
    const firstSeen = {};
    const lastSeen = {};
    for (const pet of pets) {
      counts[pet.name] = (counts[pet.name] || 0) + 1;
      if (!firstSeen[pet.name] || pet.caughtAt < firstSeen[pet.name].caughtAt) {
        firstSeen[pet.name] = pet;
      }
      if (!lastSeen[pet.name] || pet.caughtAt > lastSeen[pet.name].caughtAt) {
        lastSeen[pet.name] = pet;
      }
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    for (const [name, count] of sorted) {
      const card = document.createElement('div');
      card.className = 'dex-card';

      const img = document.createElement('img');
      img.className = 'dex-card-image';
      img.src = getURL(`assets/pets/${firstSeen[name].file}`);
      img.alt = name;

      const info = document.createElement('div');
      info.className = 'dex-card-info';

      const label = document.createElement('span');
      label.className = 'dex-card-name';
      label.textContent = PET_DISPLAY_NAMES[name] ?? name;

      const meta = document.createElement('span');
      meta.className = 'dex-card-meta';
      meta.textContent = `마지막 포획 ${formatDate(lastSeen[name].caughtAt)}`;

      const badge = document.createElement('span');
      badge.className = 'dex-card-count';
      badge.textContent = `×${count}`;

      info.appendChild(label);
      info.appendChild(meta);
      card.appendChild(img);
      card.appendChild(info);
      card.appendChild(badge);
      grid.appendChild(card);
    }
  }

  chrome.storage.local.get({ pets: [] }, (data) => {
    render(data.pets);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pets) {
      render(changes.pets.newValue ?? []);
    }
  });
})();
