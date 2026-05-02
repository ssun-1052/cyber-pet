(() => {
  'use strict';

  // ── Constants ───────────────────────────────────────────────────────────────

  const PETS     = ['rabbit', 'squirrel', 'Dolphin', 'Donkey', 'capybara', 'crocodile', 'dog'];
  const HABITATS = ['habitat1', 'habitat2', 'habitat3'];
  const HABITAT_LIFETIME_MS = 2000;
  const SPAWN_INTERVAL_MS   = 5000;
  const HABITAT_SIZE = 120;
  const MARGIN = 20;
  const EVOLVE_COUNT = 5;

  const HOUSE_W        = 300;
  const HOUSE_H        = 250;
  const HOUSE_HEADER_H = 28;
  const PET_SIZE       = 81;
  const BASE_SPEED     = 0.038;

  // ── Shared state ────────────────────────────────────────────────────────────

  let activeHabitat  = null;
  let disappearTimer = null;
  let spawnInterval  = null;

  let houseEl       = null;
  let housePets     = [];   // { name, el, img, x, y, vx, vy }
  let houseRafId    = null;
  let houseLastTime = null;

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

  // pets 배열은 이미 name 기준 unique (1종 1항목)
  function petFile(pet) {
    return pet.evolved ? `${pet.name}_v2.svg` : `${pet.name}.svg`;
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

    // 1. Flash + image swap
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
      const existing = data.pets.find(p => p.name === petName);

      // 이미 진화 완료
      if (existing?.evolved) {
        showToast(`✨ ${petName}은(는) 이미 진화 완료!`);
        return;
      }

      let updatedPets;

      if (!existing) {
        // 첫 포획
        updatedPets = [...data.pets, {
          name:          petName,
          file:          `${petName}.svg`,
          count:         1,
          evolved:       false,
          firstCaughtAt: Date.now(),
        }];
        showToast(`포획 성공! ${petName} 을(를) 잡았습니다 ✦`);
      } else {
        const newCount  = existing.count + 1;
        const willEvolve = newCount >= EVOLVE_COUNT;
        updatedPets = data.pets.map(p => p.name === petName ? {
          ...p,
          count:   newCount,
          evolved: willEvolve,
          file:    willEvolve ? `${petName}_v2.svg` : p.file,
        } : p);

        if (willEvolve) {
          showToast(`✨ ${petName} 진화 완료! Level Up!`);
        } else {
          showToast(`${petName} ${newCount}번째 포획! (${newCount}/${EVOLVE_COUNT})`);
        }
      }

      chrome.storage.local.set({ pets: updatedPets });
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

  function createHouse(pets) {
    if (houseEl) return;

    houseEl = document.createElement('div');
    houseEl.id = 'cyber-pet-house';

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

    const arena = document.createElement('div');
    arena.id = 'cyber-pet-house-arena';
    houseEl.appendChild(arena);

    const hint = document.createElement('p');
    hint.id = 'cyber-pet-house-hint';
    hint.textContent = '펫을 포획해보세요';
    arena.appendChild(hint);

    houseEl.style.backgroundImage = `url(${getURL('assets/background/bg-1.svg')})`;
    document.documentElement.appendChild(houseEl);

    chrome.storage.local.get({ houseX: 20, houseY: 20 }, ({ houseX, houseY }) => {
      houseEl.style.left = houseX + 'px';
      houseEl.style.top  = houseY + 'px';
    });
    applyDrag(houseEl, header);

    housePets = [];
    addPetsToHouse(pets);
    startHouseAnimation();
  }

  function destroyHouse() {
    stopHouseAnimation();
    houseEl?.remove();
    houseEl = null;
    housePets = [];
  }

  function applyDrag(el, handle) {
    let startX, startY, startLeft, startTop;

    handle.addEventListener('mousedown', (e) => {
      if (e.target.id === 'cyber-pet-house-close') return;
      e.preventDefault();
      startX    = e.clientX;
      startY    = e.clientY;
      startLeft = parseInt(el.style.left, 10) || 20;
      startTop  = parseInt(el.style.top,  10) || 20;
      el.style.transition = 'none';

      function onMove(e) {
        const newLeft = Math.max(0, Math.min(window.innerWidth  - HOUSE_W, startLeft + e.clientX - startX));
        const newTop  = Math.max(0, Math.min(window.innerHeight - HOUSE_H, startTop  + e.clientY - startY));
        el.style.left = newLeft + 'px';
        el.style.top  = newTop  + 'px';
      }

      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup',   onUp);
        if (isContextAlive()) {
          chrome.storage.local.set({
            houseX: parseInt(el.style.left, 10),
            houseY: parseInt(el.style.top,  10),
          });
        }
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });
  }

  function addPetsToHouse(pets) {
    if (!houseEl) return;
    const arena = document.getElementById('cyber-pet-house-arena');
    if (!arena) return;

    const currentNames = new Set(housePets.map(p => p.name));

    for (const pet of pets) {
      if (currentNames.has(pet.name)) continue;

      document.getElementById('cyber-pet-house-hint')?.remove();

      const petEl = document.createElement('div');
      petEl.className = 'house-pet';

      const img = document.createElement('img');
      img.src = getURL(`assets/pets/${petFile(pet)}`);
      img.alt = pet.name;
      petEl.appendChild(img);
      arena.appendChild(petEl);

      const arenaH = HOUSE_H - HOUSE_HEADER_H;
      const x = 4 + Math.random() * (HOUSE_W - PET_SIZE - 8);
      const y = 4 + Math.random() * (arenaH  - PET_SIZE - 8);
      const angle = Math.random() * Math.PI * 2;
      const speed = BASE_SPEED * (0.6 + Math.random() * 0.8);

      petEl.style.left = x + 'px';
      petEl.style.top  = y + 'px';

      petEl.addEventListener('click', () => onHousePetClick(petEl));

      housePets.push({ name: pet.name, el: petEl, img, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
      currentNames.add(pet.name);
    }
  }

  function updateHousePetImage(petName, newFile) {
    const hp = housePets.find(p => p.name === petName);
    if (!hp) return;
    hp.img.src = getURL(`assets/pets/${newFile}`);
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
        if (p.el.classList.contains('jumping') || p.el.classList.contains('evolving')) continue;

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.x <= minX) { p.x = minX; p.vx =  Math.abs(p.vx) * (0.85 + Math.random() * 0.3); }
        if (p.x >= maxX) { p.x = maxX; p.vx = -Math.abs(p.vx) * (0.85 + Math.random() * 0.3); }
        if (p.y <= minY) { p.y = minY; p.vy =  Math.abs(p.vy) * (0.85 + Math.random() * 0.3); }
        if (p.y >= maxY) { p.y = maxY; p.vy = -Math.abs(p.vy) * (0.85 + Math.random() * 0.3); }

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
    if (petEl.classList.contains('jumping') || petEl.classList.contains('evolving')) return;
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

  // ── Evolution effect ─────────────────────────────────────────────────────────

  function triggerEvolutionEffect(petEl, newFile) {
    petEl.classList.add('evolving');

    // 이미지 교체
    const img = petEl.querySelector('img');
    if (img) img.src = getURL(`assets/pets/${newFile}`);

    // 파티클 8개
    for (let i = 0; i < 8; i++) {
      const spark = document.createElement('span');
      spark.className = 'house-pet-spark';
      spark.style.setProperty('--angle', `${i * 45}deg`);
      petEl.appendChild(spark);
    }

    // Level Up! 텍스트
    const levelUp = document.createElement('span');
    levelUp.className = 'house-pet-levelup';
    levelUp.textContent = 'Level Up!';
    petEl.appendChild(levelUp);

    setTimeout(() => {
      petEl.classList.remove('evolving');
      petEl.querySelectorAll('.house-pet-spark, .house-pet-levelup').forEach(e => e.remove());
    }, 1600);
  }

  // ── Storage listeners ───────────────────────────────────────────────────────

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !isContextAlive()) return;

    if (changes.houseVisible) {
      if (changes.houseVisible.newValue) {
        chrome.storage.local.get({ pets: [] }, ({ pets }) => createHouse(pets));
      } else {
        destroyHouse();
      }
    }

    if (changes.pets) {
      const newPets = changes.pets.newValue ?? [];
      const oldPets = changes.pets.oldValue ?? [];

      if (houseEl) {
        // 새로 추가된 펫
        addPetsToHouse(newPets);

        // 진화 감지 → 연출 + 이미지 교체
        for (const np of newPets) {
          if (!np.evolved) continue;
          const op = oldPets.find(p => p.name === np.name);
          if (op && !op.evolved) {
            const hp = housePets.find(p => p.name === np.name);
            if (hp) triggerEvolutionEffect(hp.el, np.file);
          }
        }
      }
    }
  });

  // ── Init ────────────────────────────────────────────────────────────────────

  // 구버전 데이터 마이그레이션
  const RETIRED_PETS = new Set(['UNICORN']);
  const NAME_ALIASES = { RABBIT: 'rabbit' };

  chrome.storage.local.get({ pets: [] }, ({ pets }) => {
    // 구버전: { id, name, file, caughtAt } → 신버전: { name, file, count, evolved, firstCaughtAt }
    const isLegacy = pets.length > 0 && !('count' in pets[0]);

    let migrated = pets;

    if (isLegacy) {
      // 중복 제거 후 신규 포맷 변환
      const seen = new Set();
      migrated = pets
        .filter(p => {
          const name = NAME_ALIASES[p.name] ?? p.name;
          if (RETIRED_PETS.has(name) || seen.has(name)) return false;
          seen.add(name);
          return true;
        })
        .map(p => {
          const name = NAME_ALIASES[p.name] ?? p.name;
          return { name, file: `${name}.svg`, count: 1, evolved: false, firstCaughtAt: p.caughtAt ?? Date.now() };
        });
      chrome.storage.local.set({ pets: migrated });
    } else {
      // 퇴역 펫 + 별칭 정리
      const cleaned = migrated
        .filter(p => !RETIRED_PETS.has(p.name))
        .map(p => NAME_ALIASES[p.name]
          ? { ...p, name: NAME_ALIASES[p.name], file: p.evolved ? `${NAME_ALIASES[p.name]}_v2.svg` : `${NAME_ALIASES[p.name]}.svg` }
          : p
        );
      if (JSON.stringify(cleaned) !== JSON.stringify(migrated)) {
        chrome.storage.local.set({ pets: cleaned });
        migrated = cleaned;
      }
    }

    chrome.storage.local.get({ houseVisible: false }, ({ houseVisible }) => {
      if (houseVisible) createHouse(migrated);
    });
  });

  spawnHabitat();
  spawnInterval = setInterval(spawnHabitat, SPAWN_INTERVAL_MS);
})();
