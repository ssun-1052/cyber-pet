(() => {
  'use strict';

  // ── Constants ───────────────────────────────────────────────────────────────

  const PETS     = ['RABBIT', 'squirrel', 'UNICORN'];
  const HABITATS = ['habitat1', 'habitat2'];
  const HABITAT_LIFETIME_MS = 2000;
  const SPAWN_INTERVAL_MS   = 5000;
  const HABITAT_SIZE = 120;
  const MARGIN = 20;

  const HOUSE_W        = 200;
  const HOUSE_H        = 150;
  const HOUSE_HEADER_H = 24;
  const PET_SIZE       = 36;
  const BASE_SPEED     = 0.038; // px per ms

  // ── Shared state ────────────────────────────────────────────────────────────

  let activeHabitat  = null;
  let disappearTimer = null;
  let spawnInterval  = null;

  let houseEl        = null;
  let housePets      = [];   // { name, file, el, img, x, y, vx, vy }
  let houseRafId     = null;
  let houseLastTime  = null;

  // ── Utilities ───────────────────────────────────────────────────────────────

  function isContextAlive() {
    try { return !!chrome.runtime?.id; } catch { return false; }
  }

  function getURL(path) { return chrome.runtime.getURL(path); }

  function randomItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function randomPosition() {
    const maxX = window.innerWidth  - HABITAT_SIZE - MARGIN;
    const maxY = window.innerHeight - HABITAT_SIZE - MARGIN;
    return {
      x: Math.max(MARGIN, Math.floor(Math.random() * maxX)),
      y: Math.max(MARGIN, Math.floor(Math.random() * maxY)),
    };
  }

  function getUniquePets(pets) {
    const seen = new Set();
    return pets.filter(p => seen.has(p.name) ? false : (seen.add(p.name), true));
  }

  // ── Habitat / spawn ─────────────────────────────────────────────────────────

  function spawnHabitat() {
    if (!isContextAlive()) { clearInterval(spawnInterval); return; }
    if (activeHabitat) return;

    const habitatName = randomItem(HABITATS);
    const petName     = randomItem(PETS);
    const { x, y }   = randomPosition();

    const el = document.createElement('div');
    el.id = 'cyber-pet-habitat';
    el.style.left = x + 'px';
    el.style.top  = y + 'px';

    const img = document.createElement('img');
    img.src = getURL(`assets/habitats/${habitatName}.svg`);
    img.alt = 'habitat';
    el.appendChild(img);

    el.addEventListener('click', () => onCatch(el, petName), { once: true });
    document.documentElement.appendChild(el);
    activeHabitat = { el, petName };
    disappearTimer = setTimeout(() => dismissHabitat(el), HABITAT_LIFETIME_MS);
  }

  function dismissHabitat(el) {
    if (!el?.parentNode) return;
    el.style.animation = 'cyberPetFadeOut 0.35s ease forwards';
    el.addEventListener('animationend', () => el.remove(), { once: true });
    activeHabitat = null;
  }

  // ── Catch ───────────────────────────────────────────────────────────────────

  function onCatch(el, petName) {
    clearTimeout(disappearTimer);
    activeHabitat = null;

    const img = el.querySelector('img');

    // 1. Flash + image swap at peak of squish
    el.classList.add('catching');
    setTimeout(() => {
      if (!isContextAlive()) return;
      img.src = getURL(`assets/pets/${petName}.svg`);
      img.alt = petName;
    }, 80);

    // 2. Bounce
    setTimeout(() => {
      el.classList.remove('catching');
      el.classList.add('caught');
    }, 200);

    // 3. Fly away
    setTimeout(() => {
      el.classList.remove('caught');
      el.classList.add('releasing');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 1200);

    if (!isContextAlive()) return;

    chrome.storage.local.get({ pets: [] }, (data) => {
      if (data.pets.some(p => p.name === petName)) {
        showToast(`이미 포획한 펫이에요!`);
        return;
      }
      const entry = {
        id:       Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        name:     petName,
        file:     `${petName}.svg`,
        caughtAt: Date.now(),
      };
      chrome.storage.local.set({ pets: [entry, ...data.pets] });
      showToast(`포획 성공! ${petName} 을(를) 잡았습니다 ✦`);
    });
  }

  // ── Toast ───────────────────────────────────────────────────────────────────

  function showToast(message) {
    document.getElementById('cyber-pet-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'cyber-pet-toast';
    toast.textContent = message;
    document.documentElement.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'cyberPetToastOut 0.3s ease forwards';
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 2200);
  }

  // ── House ───────────────────────────────────────────────────────────────────

  function createHouse(uniquePets) {
    if (houseEl) return;

    houseEl = document.createElement('div');
    houseEl.id = 'cyber-pet-house';

    // Header bar
    const header = document.createElement('div');
    header.id = 'cyber-pet-house-header';

    const title = document.createElement('span');
    title.id = 'cyber-pet-house-title';
    title.textContent = 'CYBER HOUSE';

    const closeBtn = document.createElement('button');
    closeBtn.id = 'cyber-pet-house-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => {
      if (isContextAlive()) chrome.storage.local.set({ houseVisible: false });
      else destroyHouse();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    houseEl.appendChild(header);

    // Arena
    const arena = document.createElement('div');
    arena.id = 'cyber-pet-house-arena';
    houseEl.appendChild(arena);

    // Empty hint
    const hint = document.createElement('p');
    hint.id = 'cyber-pet-house-hint';
    hint.textContent = '펫을 포획해보세요';
    arena.appendChild(hint);

    document.documentElement.appendChild(houseEl);

    housePets = [];
    addPetsToHouse(uniquePets);
    startHouseAnimation();
  }

  function destroyHouse() {
    stopHouseAnimation();
    houseEl?.remove();
    houseEl = null;
    housePets = [];
  }

  function addPetsToHouse(uniquePets) {
    if (!houseEl) return;
    const arena = document.getElementById('cyber-pet-house-arena');
    if (!arena) return;

    const currentNames = new Set(housePets.map(p => p.name));

    for (const pet of uniquePets) {
      if (currentNames.has(pet.name)) continue;

      // Remove empty hint
      document.getElementById('cyber-pet-house-hint')?.remove();

      const petEl = document.createElement('div');
      petEl.className = 'house-pet';

      const img = document.createElement('img');
      img.src = getURL(`assets/pets/${pet.file}`);
      img.alt = pet.name;
      petEl.appendChild(img);
      arena.appendChild(petEl);

      const arenaH = HOUSE_H - HOUSE_HEADER_H;
      const maxX   = HOUSE_W - PET_SIZE - 4;
      const maxY   = arenaH  - PET_SIZE - 4;
      const x      = 4 + Math.random() * (maxX - 8);
      const y      = 4 + Math.random() * (maxY - 8);
      const angle  = Math.random() * Math.PI * 2;
      const speed  = BASE_SPEED * (0.6 + Math.random() * 0.8);

      petEl.style.left = x + 'px';
      petEl.style.top  = y + 'px';

      petEl.addEventListener('click', () => onHousePetClick(petEl));

      housePets.push({ name: pet.name, el: petEl, img, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
      currentNames.add(pet.name);
    }
  }

  function startHouseAnimation() {
    houseLastTime = null;
    const arenaH = HOUSE_H - HOUSE_HEADER_H;
    const minX = 4, minY = 4;
    const maxX = HOUSE_W - PET_SIZE - 4;
    const maxY = arenaH  - PET_SIZE - 4;

    function tick(ts) {
      if (!houseEl) return;
      if (!houseLastTime) houseLastTime = ts;
      const dt = Math.min(ts - houseLastTime, 50);
      houseLastTime = ts;

      for (const p of housePets) {
        if (p.el.classList.contains('jumping')) continue;

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Bounce off walls with slight randomness so pets don't get stuck
        if (p.x <= minX) { p.x = minX; p.vx =  Math.abs(p.vx) * (0.85 + Math.random() * 0.3); }
        if (p.x >= maxX) { p.x = maxX; p.vx = -Math.abs(p.vx) * (0.85 + Math.random() * 0.3); }
        if (p.y <= minY) { p.y = minY; p.vy =  Math.abs(p.vy) * (0.85 + Math.random() * 0.3); }
        if (p.y >= maxY) { p.y = maxY; p.vy = -Math.abs(p.vy) * (0.85 + Math.random() * 0.3); }

        // Flip sprite based on horizontal direction
        p.img.style.transform = p.vx < 0 ? 'scaleX(-1)' : '';
        p.el.style.left = p.x + 'px';
        p.el.style.top  = p.y + 'px';
      }

      houseRafId = requestAnimationFrame(tick);
    }
    houseRafId = requestAnimationFrame(tick);
  }

  function stopHouseAnimation() {
    if (houseRafId) { cancelAnimationFrame(houseRafId); houseRafId = null; }
  }

  function onHousePetClick(petEl) {
    if (petEl.classList.contains('jumping')) return;
    petEl.classList.add('jumping');

    const heart = document.createElement('span');
    heart.className = 'house-pet-heart';
    heart.textContent = '♥';
    petEl.appendChild(heart);

    setTimeout(() => {
      petEl.classList.remove('jumping');
      heart.remove();
    }, 650);
  }

  // ── Storage listeners ───────────────────────────────────────────────────────

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !isContextAlive()) return;

    if (changes.houseVisible) {
      if (changes.houseVisible.newValue) {
        chrome.storage.local.get({ pets: [] }, ({ pets }) => createHouse(getUniquePets(pets)));
      } else {
        destroyHouse();
      }
    }

    if (changes.pets && houseEl) {
      addPetsToHouse(getUniquePets(changes.pets.newValue ?? []));
    }
  });

  // ── Init ────────────────────────────────────────────────────────────────────

  chrome.storage.local.get({ houseVisible: false, pets: [] }, ({ houseVisible, pets }) => {
    if (houseVisible) createHouse(getUniquePets(pets));
  });

  spawnHabitat();
  spawnInterval = setInterval(spawnHabitat, SPAWN_INTERVAL_MS);
})();
