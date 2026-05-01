(() => {
  'use strict';

  const PETS = ['RABBIT', 'squirrel', 'UNICORN'];
  const HABITATS = ['habitat1', 'habitat2'];
  const HABITAT_LIFETIME_MS = 2000;
  const SPAWN_INTERVAL_MS = 5000;
  const HABITAT_SIZE = 120;
  const MARGIN = 20;

  let activeHabitat = null;
  let disappearTimer = null;
  let spawnInterval = null;

  // 컨텍스트가 살아있는지 확인 — 재로드 후 무효화 감지
  function isContextAlive() {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  }

  function getURL(path) {
    return chrome.runtime.getURL(path);
  }

  function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randomPosition() {
    const maxX = window.innerWidth - HABITAT_SIZE - MARGIN;
    const maxY = window.innerHeight - HABITAT_SIZE - MARGIN;
    return {
      x: Math.max(MARGIN, Math.floor(Math.random() * maxX)),
      y: Math.max(MARGIN, Math.floor(Math.random() * maxY)),
    };
  }

  function spawnHabitat() {
    // 컨텍스트 무효화 시 인터벌 정리 후 중단
    if (!isContextAlive()) {
      clearInterval(spawnInterval);
      return;
    }

    if (activeHabitat) return;

    const habitatName = randomItem(HABITATS);
    const petName = randomItem(PETS);
    const { x, y } = randomPosition();

    const el = document.createElement('div');
    el.id = 'cyber-pet-habitat';
    el.style.left = x + 'px';
    el.style.top = y + 'px';

    const img = document.createElement('img');
    img.src = getURL(`assets/habitats/${habitatName}.svg`);
    img.alt = 'Cyber Pet Habitat';
    el.appendChild(img);

    el.addEventListener('click', () => onCatch(el, petName), { once: true });

    document.documentElement.appendChild(el);
    activeHabitat = { el, petName };

    disappearTimer = setTimeout(() => dismissHabitat(el), HABITAT_LIFETIME_MS);
  }

  function dismissHabitat(el) {
    if (!el || !el.parentNode) return;
    el.style.animation = 'cyberPetFadeOut 0.35s ease forwards';
    el.addEventListener('animationend', () => el.remove(), { once: true });
    activeHabitat = null;
  }

  function onCatch(el, petName) {
    clearTimeout(disappearTimer);
    activeHabitat = null;

    const img = el.querySelector('img');

    // 1단계: 클릭 플래시 (0.2s) — 수축 정점(80ms)에서 이미지 교체
    el.classList.add('catching');
    setTimeout(() => {
      if (!isContextAlive()) return;
      img.src = getURL(`assets/pets/${petName}.svg`);
      img.alt = petName;
    }, 80);

    // 2단계: 바운스
    setTimeout(() => {
      el.classList.remove('catching');
      el.classList.add('caught');
    }, 200);

    // 3단계: 위로 날아가며 사라짐 (200ms flash + 1000ms bounce)
    setTimeout(() => {
      el.classList.remove('caught');
      el.classList.add('releasing');
      el.addEventListener('animationend', () => el.remove(), { once: true });
    }, 1200);

    if (!isContextAlive()) return;
    savePet(petName);
    showToast(`포획 성공! ${petName} 을(를) 잡았습니다 ✦`);
  }

  function savePet(petName) {
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      name: petName,
      file: `${petName}.svg`,
      caughtAt: Date.now(),
    };

    chrome.storage.local.get({ pets: [] }, (data) => {
      const updated = [entry, ...data.pets];
      chrome.storage.local.set({ pets: updated });
    });
  }

  function showToast(message) {
    const existing = document.getElementById('cyber-pet-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'cyber-pet-toast';
    toast.textContent = message;
    document.documentElement.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'cyberPetToastOut 0.3s ease forwards';
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 2200);
  }

  spawnHabitat();
  spawnInterval = setInterval(spawnHabitat, SPAWN_INTERVAL_MS);
})();
