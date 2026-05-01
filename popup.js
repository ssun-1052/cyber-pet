(() => {
  'use strict';

  const PET_DISPLAY_NAMES = {
    RABBIT: 'Rabbit',
    squirrel: 'Squirrel',
    UNICORN: 'Unicorn',
  };

  function getURL(path) {
    return chrome.runtime.getURL(path);
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
    subtitle.textContent = `포획한 펫 ${pets.length}마리`;

    // Group by pet name and count
    const counts = {};
    const firstSeen = {};
    for (const pet of pets) {
      counts[pet.name] = (counts[pet.name] || 0) + 1;
      if (!firstSeen[pet.name]) firstSeen[pet.name] = pet;
    }

    // Sort by most caught
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    for (const [name, count] of sorted) {
      const card = document.createElement('div');
      card.className = 'dex-card';
      card.title = `${PET_DISPLAY_NAMES[name] ?? name} × ${count}`;

      const img = document.createElement('img');
      img.className = 'dex-card-image';
      img.src = getURL(`assets/pets/${firstSeen[name].file}`);
      img.alt = name;

      const label = document.createElement('span');
      label.className = 'dex-card-name';
      label.textContent = PET_DISPLAY_NAMES[name] ?? name;

      const badge = document.createElement('span');
      badge.className = 'dex-card-count';
      badge.textContent = `×${count}`;

      card.appendChild(img);
      card.appendChild(label);
      card.appendChild(badge);
      grid.appendChild(card);
    }
  }

  // 도감 열기 버튼
  document.getElementById('open-dex-btn').addEventListener('click', () => {
    chrome.windows.create({
      url: chrome.runtime.getURL('dex.html'),
      type: 'popup',
      width: 640,
      height: 520,
    });
  });

  // Load pets from storage on open
  chrome.storage.local.get({ pets: [] }, (data) => {
    render(data.pets);
  });

  // Live-update if storage changes while popup is open
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pets) {
      render(changes.pets.newValue ?? []);
    }
  });
})();
