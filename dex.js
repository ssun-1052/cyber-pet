(() => {
  'use strict';

  const PET_DISPLAY_NAMES = {
    rabbit:    'Rabbit',
    squirrel:  'Squirrel',
    Dolphin:   'Dolphin',
    Donkey:    'Donkey',
    capybara:  'Capybara',
    crocodile: 'Crocodile',
    dog:       'Dog',
  };

  const EVOLVE_COUNT = 5;

  function getURL(path) { return chrome.runtime.getURL(path); }

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  }

  function render(pets) {
    const grid     = document.getElementById('dex-grid');
    const empty    = document.getElementById('empty-state');
    const subtitle = document.getElementById('subtitle');

    grid.innerHTML = '';

    if (pets.length === 0) {
      empty.classList.remove('hidden');
      subtitle.textContent = '포획한 펫 0마리';
      return;
    }

    empty.classList.add('hidden');
    subtitle.textContent = `포획한 펫 총 ${pets.length}마리`;

    for (const pet of pets) {
      const card = document.createElement('div');
      card.className = 'dex-card' + (pet.evolved ? ' evolved' : '');

      const img = document.createElement('img');
      img.className = 'dex-card-image';
      img.src = getURL(`assets/pets/${pet.file}`);
      img.alt = pet.name;

      const info = document.createElement('div');
      info.className = 'dex-card-info';

      const label = document.createElement('span');
      label.className = 'dex-card-name';
      label.textContent = PET_DISPLAY_NAMES[pet.name] ?? pet.name;

      const meta = document.createElement('span');
      meta.className = 'dex-card-meta';
      meta.textContent = `첫 포획 ${formatDate(pet.firstCaughtAt ?? Date.now())}`;

      // 진행도
      const progress = document.createElement('div');
      progress.className = 'dex-card-progress';

      if (pet.evolved) {
        const badge = document.createElement('span');
        badge.className = 'dex-evolved-badge';
        badge.textContent = '✦ 진화 완료';
        progress.appendChild(badge);
      } else {
        const count = pet.count ?? 1;
        for (let i = 0; i < EVOLVE_COUNT; i++) {
          const dot = document.createElement('span');
          dot.className = 'progress-dot' + (i < count ? ' filled' : '');
          progress.appendChild(dot);
        }
      }

      info.appendChild(label);
      info.appendChild(meta);
      info.appendChild(progress);
      card.appendChild(img);
      card.appendChild(info);
      grid.appendChild(card);
    }
  }

  chrome.storage.local.get({ pets: [] }, ({ pets }) => render(pets));

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pets) render(changes.pets.newValue ?? []);
  });
})();
