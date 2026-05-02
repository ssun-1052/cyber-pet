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

  function getURL(path) { return chrome.runtime.getURL(path); }

  function getUniquePets(pets) {
    const seen = new Set();
    return pets.filter(p => seen.has(p.name) ? false : (seen.add(p.name), true));
  }

  // ── Dex render ──────────────────────────────────────────────────────────────

  function render(pets) {
    const grid     = document.getElementById('dex-grid');
    const empty    = document.getElementById('empty-state');
    const subtitle = document.getElementById('subtitle');

    grid.innerHTML = '';
    const unique = getUniquePets(pets);

    if (unique.length === 0) {
      empty.classList.remove('hidden');
      subtitle.textContent = '포획한 펫 0마리';
      return;
    }

    empty.classList.add('hidden');
    subtitle.textContent = `포획한 펫 ${unique.length}마리`;

    for (const pet of unique) {
      const card = document.createElement('div');
      card.className = 'dex-card';

      const img = document.createElement('img');
      img.className = 'dex-card-image';
      img.src = getURL(`assets/pets/${pet.file}`);
      img.alt = pet.name;

      const label = document.createElement('span');
      label.className = 'dex-card-name';
      label.textContent = PET_DISPLAY_NAMES[pet.name] ?? pet.name;

      card.appendChild(img);
      card.appendChild(label);
      grid.appendChild(card);
    }
  }

  // ── Dex window ──────────────────────────────────────────────────────────────

  document.getElementById('open-dex-btn').addEventListener('click', () => {
    chrome.windows.create({
      url:    chrome.runtime.getURL('dex.html'),
      type:   'popup',
      width:  640,
      height: 520,
    });
  });

  // ── House toggle ─────────────────────────────────────────────────────────────

  const houseBtn = document.getElementById('toggle-house-btn');

  function setHouseBtn(visible) {
    houseBtn.textContent = visible ? '하우스 닫기' : '사이버 하우스';
    houseBtn.classList.toggle('active', visible);
  }

  houseBtn.addEventListener('click', () => {
    chrome.storage.local.get({ houseVisible: false }, ({ houseVisible }) => {
      const next = !houseVisible;
      chrome.storage.local.set({ houseVisible: next });
      setHouseBtn(next);
    });
  });

  // ── Init ────────────────────────────────────────────────────────────────────

  chrome.storage.local.get({ pets: [], houseVisible: false }, ({ pets, houseVisible }) => {
    render(pets);
    setHouseBtn(houseVisible);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.pets)         render(changes.pets.newValue ?? []);
    if (changes.houseVisible) setHouseBtn(changes.houseVisible.newValue ?? false);
  });
})();
