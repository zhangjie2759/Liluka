(() => {
  'use strict';

  const VERSION = 'v0.11.3';
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const DPR_MAX = 2;
  const STORAGE_KEY = 'next_room_v0113_save';

  const ASSET_BASES = ['assets/', './', 'images/'];

  const GHOSTS = [
    { name: '猼訑', file: '猼訑.png', type: 'normal', speed: 1.05, fire: 1, desc: '警觉又狡猾，喜欢躲在门后观察人。' },
    { name: '赤鱬', file: '赤鱬.png', type: 'thin', speed: 1.62, fire: 2, desc: '细长灵活，动作很快，最擅长突然贴近。' },
    { name: '当康', file: '当康.png', type: 'heavy', speed: 0.86, fire: 2, desc: '体型敦实，压迫感强，逼近时像重物挪动。' },
    { name: '混沌', file: '混沌.png', type: 'heavy', speed: 0.98, fire: 3, desc: '轮廓混乱，越盯着看越分不清它的形状。' },
    { name: '九尾狐', file: '九尾狐.png', type: 'normal', speed: 1.24, fire: 3, ghostEye: true, desc: '擅长迷惑视线，被封印后会短暂开启鬼眼。' },
    { name: '夔牛', file: '夔牛.png', type: 'heavy', speed: 1.02, fire: 3, desc: '独脚震地，虽然不快，但每次靠近都很有压迫。' },
    { name: '麒麟', file: '麒麟.png', type: 'normal', speed: 1.10, fire: 3, desc: '外表庄重，但在门后出现时往往并不吉利。' },
    { name: '穷奇', file: '穷奇.png', type: 'thin', speed: 1.78, fire: 4, desc: '凶性外露，判断失误时最容易被它扑出门。' },
    { name: '饕餮', file: '饕餮.png', type: 'heavy', speed: 1.12, fire: 5, desc: '贪婪巨口，虽然笨重，但存在感异常强烈。' },
    { name: '狰', file: '狰.png', type: 'normal', speed: 1.36, fire: 4, desc: '神情凶狠，常常伴着成群鬼火一起出现。' },
    { name: '烛阴', file: '烛阴.png', type: 'thin', speed: 1.92, fire: 5, desc: '危险等级极高，速度极快，几乎不给人反应时间。' }
  ];

  const PEOPLE = [
    { name: '1号人物', file: '1号人物.png', scale: 1.14, desc: '一个看起来有点拘谨的普通住客。' },
    { name: '2号人物', file: '2号人物.png', desc: '总像在发呆，但目前没有发现异常。' },
    { name: '3号人物', file: '3号人物.png', desc: '动作有点夸张，容易让人误以为是鬼。' },
    { name: '4号人物', file: '4号人物.png', desc: '门后最常见的住客之一，神态比较平静。' },
    { name: '5号人物', file: '5号人物.png', desc: '经常保持奇怪姿势，但本质上只是普通人。' },
    { name: '6号人物', file: '6号人物.png', desc: '喜欢独自待着，容易制造出尴尬气氛。' },
    { name: '7号人物', file: '7号人物.png', desc: '看起来心事重重，常常在角落停留。' },
    { name: '8号人物', file: '8号人物.png', desc: '表情有点空，但目前还算安全。' },
    { name: '9号人物', file: '9号人物.png', desc: '动作松弛，属于让人放松警惕的类型。' },
    { name: '10号人物', file: '10号人物.png', desc: '气质最怪的一位普通住客，最容易被误封。' }
  ];

  const GHOST_FIRE_FILES = ['鬼火1.png', '鬼火2.png', '鬼火3.png', '鬼火4.png', '鬼火5.png'];

  const BOSS_CONFIGS = [
    { stage: 1, time: 7.0, seals: 16 },
    { stage: 2, time: 6.5, seals: 20 },
    { stage: 3, time: 6.0, seals: 24 },
    { stage: 4, time: 5.8, seals: 28 },
    { stage: 5, time: 5.5, seals: 30 }
  ];

  const state = {
    screen: 'menu',
    lastScreen: 'menu',
    difficulty: 'normal',
    room: 1,
    mode: 'normal',
    content: null,
    door: 0,
    snapTarget: null,
    draggingDoor: false,
    dragStartX: 0,
    dragStartDoor: 0,
    danger: 0,
    sealFlash: 0,
    transition: 0,
    transitionFadeContent: true,
    pendingNextRoom: 2,
    resultReason: '',
    ghostEye: 0,
    eyeFx: 0,
    bossDefeated: {},
    bossWindowSeen: {},
    toast: null,
    galleryTab: 'ghosts',
    save: loadSave(),
    pointer: { x: 0, y: 0, down: false },
    layout: null,
    t: 0
  };

  const assets = {};
  const allAssetFiles = [
    '封印按钮.png',
    ...PEOPLE.map(p => p.file),
    ...GHOSTS.map(g => g.file),
    ...GHOST_FIRE_FILES
  ];

  function loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) throw new Error('no save');
      const data = JSON.parse(raw);
      return {
        bestRoom: Number(data.bestRoom || 1),
        ghosts: data.ghosts || {},
        people: data.people || {}
      };
    } catch (e) {
      return { bestRoom: 1, ghosts: {}, people: {} };
    }
  }

  function saveGame() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.save));
    } catch (e) {}
  }

  function loadImageWithFallback(file) {
    let baseIndex = 0;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => { assets[file] = img; };
    img.onerror = () => {
      baseIndex += 1;
      if (baseIndex < ASSET_BASES.length) {
        img.src = ASSET_BASES[baseIndex] + file;
      } else {
        assets[file] = null;
      }
    };
    img.src = ASSET_BASES[baseIndex] + file;
    assets[file] = img;
  }

  allAssetFiles.forEach(loadImageWithFallback);

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
    const w = Math.max(320, window.innerWidth || document.documentElement.clientWidth || 390);
    const h = Math.max(520, window.innerHeight || document.documentElement.clientHeight || 760);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.layout = computeLayout(w, h);
  }

  window.addEventListener('resize', resize);
  resize();

  function computeLayout(w, h) {
    const topH = Math.max(78, Math.min(94, h * 0.10));
    const bottomH = Math.max(112, Math.min(136, h * 0.145));
    const gameTop = topH;
    const gameBottom = h - bottomH;
    const gameH = gameBottom - gameTop;

    const doorH = clamp(Math.min(gameH * 0.80, w * 1.26, 610), 370, 610);
    const doorW = doorH * 0.64;
    const doorX = (w - doorW) / 2;
    const doorY = gameTop + Math.max(24, (gameH - doorH) * 0.34);

    const bigHole = { x: doorX, y: doorY, w: doorW, h: doorH };
    const bigDoor = { x: doorX, y: doorY, w: doorW, h: doorH };

    const smallScale = 0.36;
    const smallDoor = {
      w: doorW * smallScale,
      h: doorH * smallScale,
      x: (w - doorW * smallScale) / 2,
      y: doorY + doorH * 0.34
    };
    const smallHole = { ...smallDoor };
    const smallWall = {
      x: smallHole.x - smallHole.w * 0.64,
      y: smallHole.y - smallHole.h * 0.48,
      w: smallHole.w * 2.28,
      h: smallHole.h * 1.56
    };

    return {
      w, h, topH, bottomH, gameTop, gameBottom, gameH,
      bigDoor, bigHole, smallDoor, smallHole, smallWall,
      home: { x: 10, y: 16, w: 64, h: 36 },
      galleryButton: { x: w - 86, y: 16, w: 76, h: 36 },
      sealButton: { x: w / 2 - 88, y: h - 124, w: 176, h: 82 },
      bossButton: { x: w / 2 - 132, y: h - 118, w: 264, h: 76 }
    };
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function randItem(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function startRun(difficulty) {
    state.screen = 'game';
    state.difficulty = difficulty;
    state.room = 1;
    state.mode = 'normal';
    state.door = 0;
    state.snapTarget = null;
    state.draggingDoor = false;
    state.danger = 0;
    state.sealFlash = 0;
    state.transition = 0;
    state.transitionFadeContent = true;
    state.pendingNextRoom = 2;
    state.resultReason = '';
    state.ghostEye = 0;
    state.eyeFx = 0;
    state.bossDefeated = {};
    state.bossWindowSeen = {};
    state.toast = null;
    createContent();
  }

  function bossStageForRoom(room) {
    return Math.floor((room - 1) / 25) + 1;
  }

  function bossWindow(room) {
    const stage = bossStageForRoom(room);
    const end = stage * 25;
    const start = end - 5;
    return { stage, start, end, forced: room === end, active: room >= start && room <= end };
  }

  function bossConfig(stage) {
    return BOSS_CONFIGS[Math.min(stage, BOSS_CONFIGS.length) - 1] || { stage, time: 5.5, seals: 30 };
  }


  function bossGhostForStage(stage) {
    return GHOSTS[(stage * 2 + 6) % GHOSTS.length];
  }

  function currentStageProgress(room = state.room) {
    const stage = bossStageForRoom(room);
    const index = ((room - 1) % 25) + 1;
    return { stage, index, ratio: index / 25, boss: bossGhostForStage(stage) };
  }

  function ghostDangerSpeed(g) {
    const typeBoost = g.type === 'thin' ? 1.18 : g.type === 'heavy' ? 0.92 : 1;
    return (g.speed || 1) * typeBoost;
  }

  function ghostApproachStep() {
    const raw = clamp(state.danger, 0, 1);
    const steps = 7;
    const index = Math.floor(raw * steps);
    const local = raw * steps - index;
    const kick = Math.sin(local * Math.PI) * 0.055;
    return clamp(index / steps + kick, 0, 1);
  }

  function createContent() {
    const room = state.room;
    const win = bossWindow(room);

    state.mode = 'normal';
    state.door = 0;
    state.snapTarget = null;
    state.draggingDoor = false;
    state.danger = 0;
    state.sealFlash = 0;

    if (win.active && !state.bossDefeated[win.stage]) {
      const chance = win.forced ? 1 : (0.26 + (room - win.start) * 0.11);
      if (Math.random() < chance) {
        const bossGhost = bossGhostForStage(win.stage);
        state.content = {
          type: 'boss',
          stage: win.stage,
          bossGhost,
          cfg: bossConfig(win.stage),
          seen: false,
          bossSeen: false,
          hits: 0,
          talismans: [],
          forced: win.forced,
          passTimer: 0
        };
        return;
      }
    }

    const r = Math.random();
    const ghostChance = clamp(0.44 + room * 0.004, 0.44, 0.72);
    const personChance = room < 8 ? 0.34 : 0.28;

    if (r < ghostChance) {
      const count = ghostCountForRoom(room);
      const ghosts = pickGhosts(count, room);
      state.content = {
        type: 'ghost',
        ghosts,
        requiredSeals: count,
        sealed: 0,
        seen: false,
        passTimer: 0,
        talismans: []
      };
    } else if (r < ghostChance + personChance) {
      const person = randItem(PEOPLE);
      state.content = {
        type: 'person',
        person,
        seen: false,
        passTimer: 0,
        talismans: []
      };
    } else {
      state.content = {
        type: 'empty',
        seen: false,
        passTimer: 0,
        talismans: []
      };
    }
  }

  function ghostCountForRoom(room) {
    if (room < 25) return 1;
    if (room < 50) return Math.random() < 0.34 ? 2 : 1;
    const r = Math.random();
    if (r < 0.22) return 3;
    if (r < 0.58) return 2;
    return 1;
  }

  function pickGhosts(count, room) {
    const unlockCount = clamp(4 + Math.floor(room / 8), 4, GHOSTS.length);
    const pool = GHOSTS.slice(0, unlockCount);
    const picked = [];
    while (picked.length < count) {
      const g = randItem(pool);
      if (!picked.includes(g)) picked.push(g);
    }
    return picked;
  }

  function markSeenContent() {
    const c = state.content;
    if (!c || c.seen) return;
    c.seen = true;
    if (c.type === 'ghost') {
      c.ghosts.forEach(g => { state.save.ghosts[g.name] = true; });
      saveGame();
    } else if (c.type === 'person') {
      state.save.people[c.person.name] = true;
      saveGame();
    } else if (c.type === 'boss') {
      state.save.ghosts[c.bossGhost.name] = true;
      saveGame();
    }
  }

  function setToast(text, time = 1.4) {
    state.toast = { text, time };
  }

  function update(dt) {
    state.t += dt;
    if (state.toast) {
      state.toast.time -= dt;
      if (state.toast.time <= 0) state.toast = null;
    }
    if (state.ghostEye > 0 && state.screen === 'game') {
      state.ghostEye = Math.max(0, state.ghostEye - dt);
    }
    if (state.eyeFx > 0 && state.screen === 'game') {
      state.eyeFx = Math.max(0, state.eyeFx - dt);
    }

    if (state.screen !== 'game') return;

    if (state.mode === 'transition') {
      state.transition += dt * 1.08;
      if (state.transition >= 1) finishAdvance();
      return;
    }

    if (state.mode === 'sealSuccess') {
      state.sealFlash += dt;
      if (state.sealFlash >= 0.72) {
        if (state.content && state.content.talismans) state.content.talismans = [];
        startAdvance({ toRoom: state.pendingNextRoom, fadeContent: true });
      }
      return;
    }

    if (state.snapTarget !== null && !state.draggingDoor && state.mode === 'normal') {
      const direction = state.snapTarget > state.door ? 1 : -1;
      const speed = 1.85;
      state.door += direction * speed * dt;
      if ((direction > 0 && state.door >= state.snapTarget) || (direction < 0 && state.door <= state.snapTarget)) {
        state.door = state.snapTarget;
        state.snapTarget = null;
      }
      state.door = clamp(state.door, 0, 1);
    }

    const c = state.content;
    if (!c) return;

    if (state.door > 0.08) markSeenContent();

    if (state.mode === 'bossFight') {
      updateBossFight(dt);
      return;
    }

    if (c.type === 'ghost') {
      if (state.door > 0.055) {
        const base = 0.30 + Math.min(state.room, 90) * 0.0038;
        const speediest = Math.max(...c.ghosts.map(ghostDangerSpeed));
        const multi = 1 + (c.ghosts.length - 1) * 0.28;
        const easySlow = state.difficulty === 'easy' && c.ghosts.some(g => g.type === 'thin') ? 0.72 : 1;
        const openFactor = 0.72 + state.door * 0.76;
        state.danger += dt * base * speediest * multi * easySlow * openFactor;
      } else {
        state.danger = 0;
      }
      if (state.danger >= 1) {
        gameOver('门开太久，鬼冲出来了');
      }
    } else if (c.type === 'person' || c.type === 'empty') {
      if (state.door >= 0.92) {
        c.passTimer += dt;
        if (c.passTimer > 0.25) startAdvance({ toRoom: state.room + 1 });
      } else {
        c.passTimer = 0;
      }
    } else if (c.type === 'boss') {
      if (state.door > 0.12) c.bossSeen = true;
      if (c.bossSeen && state.door < 0.04 && !state.draggingDoor && state.snapTarget === null) {
        beginBossFight();
      }
    }
  }

  function beginBossFight() {
    state.mode = 'bossFight';
    state.door = 0.06;
    state.snapTarget = null;
    state.danger = 0;
    setToast('Boss开始顶门！', 1.1);
  }

  function updateBossFight(dt) {
    const c = state.content;
    if (!c || c.type !== 'boss') return;
    const hpRatio = 1 - c.hits / c.cfg.seals;
    const panicBoost = hpRatio < 0.3 ? 1.18 : 1;
    state.door += dt / c.cfg.time * panicBoost;
    state.door = clamp(state.door, 0, 1);
    if (state.door >= 1) failBoss();
  }

  function startAdvance(opts = {}) {
    state.mode = 'transition';
    state.transition = 0;
    state.transitionFadeContent = opts.fadeContent !== false;
    state.pendingNextRoom = opts.toRoom || state.room + 1;
    state.draggingDoor = false;
    state.snapTarget = null;
    state.danger = 0;
    state.save.bestRoom = Math.max(state.save.bestRoom || 1, state.pendingNextRoom);
    saveGame();
  }

  function finishAdvance() {
    state.room = state.pendingNextRoom;
    state.transition = 0;
    state.transitionFadeContent = true;
    createContent();
  }

  function gameOver(reason) {
    state.resultReason = reason;
    state.save.bestRoom = Math.max(state.save.bestRoom || 1, state.room);
    saveGame();
    state.screen = 'result';
    state.mode = 'normal';
    state.draggingDoor = false;
    state.snapTarget = null;
  }

  function handleSealClick() {
    if (state.screen !== 'game' || state.mode !== 'normal') return;
    const c = state.content;
    if (!c) return;

    if (c.type === 'person') {
      gameOver('封错了，人家只是普通人');
      return;
    }
    if (c.type === 'empty') {
      gameOver('封错了，这间房是空的');
      return;
    }
    if (c.type === 'boss') {
      if (!c.bossSeen) {
        setToast('先开门确认');
      } else {
        setToast('关门后才能开始贴符');
      }
      return;
    }
    if (c.type !== 'ghost') return;

    if (state.door > 0.08) {
      setToast('先把门关上');
      return;
    }

    c.sealed += 1;
    c.talismans.push(randomTalisman());
    state.sealFlash = 0.01;

    if (c.sealed >= c.requiredSeals) {
      c.ghosts.forEach(g => {
        if (g.ghostEye) {
          state.ghostEye = 10;
          state.eyeFx = 1.05;
          setToast('鬼眼开启：10秒透视', 1.6);
        }
      });
      state.mode = 'sealSuccess';
      state.pendingNextRoom = state.room + 1;
      state.snapTarget = null;
    } else {
      setToast('符咒贴上去了');
    }
  }

  function handleBossSealClick() {
    const c = state.content;
    if (!c || c.type !== 'boss' || state.mode !== 'bossFight') return;
    c.hits += 1;
    c.talismans.push(randomTalisman());
    state.door = Math.max(0, state.door - 0.115);
    if (c.hits >= c.cfg.seals) {
      state.bossDefeated[c.stage] = true;
      const nextStageStart = c.stage * 25 + 1;
      state.pendingNextRoom = nextStageStart;
      state.mode = 'sealSuccess';
      state.sealFlash = 0.01;
      setToast('Boss已封印，进入下一大关', 1.4);
    }
  }

  function failBoss() {
    const c = state.content;
    if (!c || c.type !== 'boss') return;
    if (c.forced) {
      gameOver('强制Boss战失败，Boss冲出来了');
    } else {
      setToast('Boss逃走了', 1.1);
      startAdvance({ toRoom: state.room + 1 });
    }
  }

  function randomTalisman() {
    return {
      rx: 0.18 + Math.random() * 0.64,
      ry: 0.14 + Math.random() * 0.68,
      rot: (Math.random() - 0.5) * 0.7,
      scale: 0.72 + Math.random() * 0.38,
      born: state.t
    };
  }

  function getPointer(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function hit(p, r) {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  function onPointerDown(e) {
    e.preventDefault();
    const p = getPointer(e);
    state.pointer = { x: p.x, y: p.y, down: true };

    if (state.screen === 'menu') return handleMenuDown(p);
    if (state.screen === 'difficulty') return handleDifficultyDown(p);
    if (state.screen === 'rules') return handleRulesDown(p);
    if (state.screen === 'gallery') return handleGalleryDown(p);
    if (state.screen === 'result') return handleResultDown(p);
    if (state.screen !== 'game') return;

    const l = state.layout;
    if (hit(p, l.home)) {
      state.screen = 'menu';
      state.draggingDoor = false;
      return;
    }
    if (hit(p, l.galleryButton)) {
      state.lastScreen = 'game';
      state.screen = 'gallery';
      state.draggingDoor = false;
      return;
    }

    if (state.mode === 'bossFight') {
      if (hit(p, l.bossButton)) handleBossSealClick();
      return;
    }

    if (state.mode !== 'normal') return;

    if (hit(p, l.sealButton)) {
      handleSealClick();
      return;
    }

    const dragZone = {
      x: l.bigDoor.x - 18,
      y: l.bigDoor.y - 18,
      w: l.bigDoor.w + 70,
      h: l.bigDoor.h + 36
    };
    if (hit(p, dragZone)) {
      state.draggingDoor = true;
      state.dragStartX = p.x;
      state.dragStartDoor = state.door;
      state.snapTarget = null;
    }
  }

  function onPointerMove(e) {
    const p = getPointer(e);
    state.pointer.x = p.x;
    state.pointer.y = p.y;
    if (!state.draggingDoor || state.screen !== 'game' || state.mode !== 'normal') return;
    e.preventDefault();
    const l = state.layout;
    const dx = state.dragStartX - p.x;
    state.door = clamp(state.dragStartDoor + dx / (l.bigDoor.w * 0.58), 0, 1);
  }

  function onPointerUp(e) {
    const p = getPointer(e);
    state.pointer = { x: p.x, y: p.y, down: false };
    if (state.draggingDoor) {
      state.draggingDoor = false;
      state.snapTarget = state.door > 0.46 ? 1 : 0;
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
  canvas.addEventListener('pointermove', onPointerMove, { passive: false });
  canvas.addEventListener('pointerup', onPointerUp, { passive: false });
  canvas.addEventListener('pointercancel', onPointerUp, { passive: false });

  function menuButtons() {
    const l = state.layout;
    const bw = Math.min(260, l.w * 0.68);
    const bh = 58;
    const x = (l.w - bw) / 2;
    const y = l.h * 0.45;
    return {
      start: { x, y, w: bw, h: bh },
      rules: { x, y: y + 76, w: bw, h: bh },
      gallery: { x, y: y + 152, w: bw, h: bh }
    };
  }

  function handleMenuDown(p) {
    const b = menuButtons();
    if (hit(p, b.start)) state.screen = 'difficulty';
    else if (hit(p, b.rules)) state.screen = 'rules';
    else if (hit(p, b.gallery)) { state.lastScreen = 'menu'; state.screen = 'gallery'; }
  }

  function handleDifficultyDown(p) {
    const l = state.layout;
    const bw = Math.min(270, l.w * 0.72);
    const x = (l.w - bw) / 2;
    const easy = { x, y: l.h * 0.43, w: bw, h: 70 };
    const hard = { x, y: l.h * 0.43 + 94, w: bw, h: 70 };
    const back = { x: 16, y: 18, w: 70, h: 40 };
    if (hit(p, back)) state.screen = 'menu';
    else if (hit(p, easy)) startRun('easy');
    else if (hit(p, hard)) startRun('normal');
  }

  function handleRulesDown(p) {
    if (hit(p, { x: 16, y: 18, w: 70, h: 40 })) state.screen = 'menu';
  }

  function handleGalleryDown(p) {
    const l = state.layout;
    if (hit(p, { x: 16, y: 18, w: 70, h: 40 })) {
      state.screen = state.lastScreen === 'game' ? 'game' : 'menu';
      return;
    }
    const tabY = 78;
    const tabW = Math.min(146, (l.w - 44) / 2);
    const ghostTab = { x: 18, y: tabY, w: tabW, h: 42 };
    const peopleTab = { x: 28 + tabW, y: tabY, w: tabW, h: 42 };
    if (hit(p, ghostTab)) state.galleryTab = 'ghosts';
    else if (hit(p, peopleTab)) state.galleryTab = 'people';
  }

  function handleResultDown(p) {
    const l = state.layout;
    const bw = Math.min(260, l.w * 0.68);
    const x = (l.w - bw) / 2;
    const again = { x, y: l.h * 0.58, w: bw, h: 58 };
    const home = { x, y: l.h * 0.58 + 76, w: bw, h: 58 };
    if (hit(p, again)) state.screen = 'difficulty';
    else if (hit(p, home)) state.screen = 'menu';
  }

  function clear() {
    const l = state.layout;
    ctx.clearRect(0, 0, l.w, l.h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, l.w, l.h);
  }

  function draw() {
    clear();
    if (state.screen === 'menu') drawMenu();
    else if (state.screen === 'difficulty') drawDifficulty();
    else if (state.screen === 'rules') drawRules();
    else if (state.screen === 'gallery') drawGallery();
    else if (state.screen === 'game') drawGame();
    else if (state.screen === 'result') drawResult();
  }

  function drawMenu() {
    const l = state.layout;
    drawDoodleBackground();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fffdf6';
    roundRect(l.w / 2 - 130, l.h * 0.19, 260, 116, 24, true, true, 5);
    ctx.fillStyle = '#111';
    ctx.font = '900 54px system-ui, -apple-system, sans-serif';
    ctx.fillText('下一间', l.w / 2, l.h * 0.245);
    ctx.font = '700 15px system-ui, -apple-system, sans-serif';
    ctx.fillText('开门一秒，识别异常', l.w / 2, l.h * 0.305);
    ctx.font = '700 13px system-ui, -apple-system, sans-serif';
    ctx.fillText(VERSION, l.w / 2, l.h * 0.355);
    ctx.restore();

    const b = menuButtons();
    drawUIButton(b.start, '开始游戏');
    drawUIButton(b.rules, '游戏规则');
    drawUIButton(b.gallery, `图鉴 ${collectCountText()}`);
  }

  function drawDifficulty() {
    const l = state.layout;
    drawDoodleBackground();
    drawBackButton();
    drawTitleBlock('选择难度', '简单版会降低瘦子鬼速度');
    const bw = Math.min(270, l.w * 0.72);
    const x = (l.w - bw) / 2;
    drawUIButton({ x, y: l.h * 0.43, w: bw, h: 70 }, '简单版', '新手 / 瘦子鬼更慢');
    drawUIButton({ x, y: l.h * 0.43 + 94, w: bw, h: 70 }, '困难版', '原始速度 / 更紧张');
  }

  function drawRules() {
    const l = state.layout;
    drawDoodleBackground();
    drawBackButton();
    drawTitleBlock('游戏规则', '不要乱封，也不要看太久');
    const lines = [
      '1. 拖动门向左滑开，松手后门会自动吸附开/关。',
      '2. 门后是鬼：看清后关门，再点“封印”。',
      '3. 门后是人物或空房间：开到足够大即可通过。',
      '4. 对人物或空房间乱封，会直接失败。',
      '5. 多只鬼需要贴多张符，但按钮不会提示数量。',
      '6. 每25关附近会出现Boss，必须先开门确认，再关门狂贴符。',
      '7. 封印九尾狐后，会开启10秒鬼眼透视。'
    ];
    drawTextPanel(lines, l.w * 0.08, l.h * 0.31, l.w * 0.84, l.h * 0.50);
  }

  function drawGallery() {
    const l = state.layout;
    drawDoodleBackground();
    drawBackButton();
    ctx.save();
    ctx.fillStyle = '#111';
    ctx.font = '900 30px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('图鉴', l.w / 2, 45);
    ctx.restore();

    const tabY = 78;
    const tabW = Math.min(146, (l.w - 44) / 2);
    const ghostTab = { x: 18, y: tabY, w: tabW, h: 42 };
    const peopleTab = { x: 28 + tabW, y: tabY, w: tabW, h: 42 };
    drawTab(ghostTab, `鬼图鉴 ${seenGhostCount()}/${GHOSTS.length}`, state.galleryTab === 'ghosts');
    drawTab(peopleTab, `人物图鉴 ${seenPeopleCount()}/${PEOPLE.length}`, state.galleryTab === 'people');

    const list = state.galleryTab === 'ghosts' ? GHOSTS : PEOPLE;
    const seenMap = state.galleryTab === 'ghosts' ? state.save.ghosts : state.save.people;
    const cols = 3;
    const gap = 12;
    const cardW = (l.w - 32 - gap * (cols - 1)) / cols;
    const cardH = Math.min(176, cardW * 1.72);
    const startY = 138;

    list.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = 16 + col * (cardW + gap);
      const y = startY + row * (cardH + 14);
      drawGalleryCard({ x, y, w: cardW, h: cardH }, item, !!seenMap[item.name]);
    });
  }

  function drawResult() {
    const l = state.layout;
    drawDoodleBackground();
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fffdf6';
    roundRect(l.w * 0.08, l.h * 0.22, l.w * 0.84, l.h * 0.28, 24, true, true, 5);
    ctx.fillStyle = '#111';
    ctx.font = '900 38px system-ui, -apple-system, sans-serif';
    ctx.fillText('游戏结束', l.w / 2, l.h * 0.30);
    ctx.font = '700 17px system-ui, -apple-system, sans-serif';
    wrapText(state.resultReason, l.w / 2, l.h * 0.365, l.w * 0.72, 24, 'center');
    ctx.font = '800 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(`本次到达：第 ${state.room} 间`, l.w / 2, l.h * 0.445);
    ctx.fillText(`最高纪录：第 ${state.save.bestRoom || 1} 间`, l.w / 2, l.h * 0.478);
    ctx.restore();

    const bw = Math.min(260, l.w * 0.68);
    const x = (l.w - bw) / 2;
    drawUIButton({ x, y: l.h * 0.58, w: bw, h: 58 }, '再来一局');
    drawUIButton({ x, y: l.h * 0.58 + 76, w: bw, h: 58 }, '返回主页');
  }

  function drawGame() {
    if (state.mode === 'transition') drawTransitionScene();
    else drawInfinityScene();
    drawTopUI();
    drawGhostEyeFx();
    drawBottomControls();
    drawToast();
  }

  function drawInfinityScene() {
    const l = state.layout;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, l.topH, l.w, l.h - l.topH);
    ctx.clip();
    drawInfinityCore();
    ctx.restore();
  }

  function drawInfinityCore() {
    const l = state.layout;
    drawSceneGround(l.bigHole, l.smallWall);
    drawSmallWallAndDoor(l.smallWall, l.smallHole, l.smallDoor);
    drawInteriorPerspective();
    drawContentBehindDoor();
    drawBigWall();
    drawBossGlow();
    drawDoorPanel(l.bigDoor, state.door, { big: true });
    drawDoorTalismans();
    drawSealSuccessGlow();
    drawDangerVignette();
  }

  function drawTransitionScene() {
    const l = state.layout;
    const t = easeInOut(clamp(state.transition, 0, 1));
    const bigHole = rectLerp(l.smallHole, l.bigHole, t);
    const bigDoor = rectLerp(l.smallDoor, l.bigDoor, t);
    const smallScale = 0.36;
    const innerDoor = {
      w: bigDoor.w * smallScale,
      h: bigDoor.h * smallScale,
      x: bigDoor.x + (bigDoor.w - bigDoor.w * smallScale) * 0.5,
      y: bigDoor.y + bigDoor.h * 0.34
    };
    const innerHole = { ...innerDoor };
    const innerWall = {
      x: innerHole.x - innerHole.w * 0.64,
      y: innerHole.y - innerHole.h * 0.48,
      w: innerHole.w * 2.28,
      h: innerHole.h * 1.56
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, l.topH, l.w, l.h - l.topH);
    ctx.clip();
    drawSceneGround(bigHole, innerWall, clamp(1 - t * 0.4, 0.7, 1));
    drawSmallWallAndDoor(innerWall, innerHole, innerDoor, clamp(0.82 + (1 - t) * 0.15, 0.78, 1));
    drawInteriorPerspective(bigHole, innerWall);
    if (state.transitionFadeContent) {
      ctx.save();
      ctx.globalAlpha = clamp(1 - t * 1.45, 0, 1);
      drawContentBehindDoor(bigDoor, bigHole);
      ctx.restore();
    }
    drawBigWall(bigHole);
    drawDoorPanel(bigDoor, 0, { big: true });
    ctx.restore();
  }

  function rectLerp(a, b, t) {
    return {
      x: lerp(a.x, b.x, t),
      y: lerp(a.y, b.y, t),
      w: lerp(a.w, b.w, t),
      h: lerp(a.h, b.h, t)
    };
  }

  function drawInteriorPerspective(holeArg, wallArg) {
    const l = state.layout;
    const a = holeArg || l.bigHole;
    const b = wallArg || l.smallWall;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x - a.w * 0.08, a.y - a.h * 0.05);
    ctx.lineTo(b.x, b.y);
    ctx.moveTo(a.x + a.w * 1.08, a.y - a.h * 0.05);
    ctx.lineTo(b.x + b.w, b.y);
    ctx.moveTo(a.x - a.w * 0.10, a.y + a.h);
    ctx.lineTo(b.x, b.y + b.h);
    ctx.moveTo(a.x + a.w * 1.10, a.y + a.h);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.stroke();

    const floorTop = lerp(a.y + a.h, b.y + b.h, 0.10);
    const floorBottom = a.y + a.h + 8;
    const g = ctx.createLinearGradient(0, floorTop, 0, floorBottom);
    g.addColorStop(0, 'rgba(0,0,0,0.00)');
    g.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(a.x - a.w * 0.04, a.y + a.h);
    ctx.lineTo(a.x + a.w * 1.04, a.y + a.h);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.lineTo(b.x, b.y + b.h);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSceneGround(frontHole, innerWall, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const floorTop = frontHole.y + frontHole.h;
    const floorBottom = Math.min(state.layout.h - state.layout.bottomH * 0.35, floorTop + state.layout.gameH * 0.20);
    ctx.fillStyle = '#f5f5f5';
    ctx.beginPath();
    ctx.moveTo(frontHole.x - frontHole.w * 0.18, floorTop);
    ctx.lineTo(frontHole.x + frontHole.w * 1.18, floorTop);
    ctx.lineTo(innerWall.x + innerWall.w * 1.1, innerWall.y + innerWall.h * 1.06);
    ctx.lineTo(innerWall.x - innerWall.w * 0.1, innerWall.y + innerWall.h * 1.06);
    ctx.closePath();
    ctx.fill();

    const shadow = ctx.createLinearGradient(0, floorTop, 0, floorBottom);
    shadow.addColorStop(0, 'rgba(0,0,0,0.14)');
    shadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadow;
    ctx.fillRect(frontHole.x - frontHole.w * 0.12, floorTop - 1, frontHole.w * 1.24, floorBottom - floorTop);
    ctx.restore();
  }

  function drawSmallWallAndDoor(wall, hole, door, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    drawWallWithHole(wall, hole, { stroke: 3.5, fill: '#ffffff' });
    drawDoorPanel(door, 0, { big: false });
    ctx.restore();
  }

  function drawBigWall(holeArg) {
    const l = state.layout;
    const wall = { x: 0, y: l.topH, w: l.w, h: l.h - l.topH };
    drawWallWithHole(wall, holeArg || l.bigHole, { stroke: 6, fill: '#ffffff' });
  }

  function drawWallWithHole(wall, hole, opts = {}) {
    const fill = opts.fill || '#ffffff';
    const stroke = opts.stroke || 4;
    const radius = opts.radius || 13;
    ctx.save();
    ctx.fillStyle = fill;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = stroke;

    ctx.fillRect(wall.x, wall.y, Math.max(0, hole.x - wall.x), wall.h);
    ctx.fillRect(hole.x + hole.w, wall.y, Math.max(0, wall.x + wall.w - (hole.x + hole.w)), wall.h);
    ctx.fillRect(hole.x, wall.y, hole.w, Math.max(0, hole.y - wall.y));
    ctx.fillRect(hole.x, hole.y + hole.h, hole.w, Math.max(0, wall.y + wall.h - (hole.y + hole.h)));

    // 这里只保留墙洞的黑色切边，不再做额外门框。
    roundRect(hole.x, hole.y, hole.w, hole.h, radius, false, true, stroke);
    ctx.restore();
  }

  function drawDoorPanel(door, progress, opts = {}) {
    const alpha = opts.alpha ?? doorAlphaForGhostEye();
    const slide = door.w * 0.96 * progress;
    const x = door.x - slide;
    const y = door.y;
    const w = door.w;
    const h = door.h;
    const strokeW = opts.big ? 5 : 5;
    const inset = Math.max(10, w * 0.055);
    const handleW = Math.max(9, w * 0.046);
    const handleH = h * 0.20;

    ctx.save();
    ctx.globalAlpha = alpha;

    const body = ctx.createLinearGradient(x, y, x + w, y);
    body.addColorStop(0, '#723826');
    body.addColorStop(0.15, '#8a4830');
    body.addColorStop(0.50, '#9c5639');
    body.addColorStop(0.82, '#7f412d');
    body.addColorStop(1, '#693221');
    ctx.fillStyle = body;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = strokeW;
    roundRect(x, y, w, h, 12, true, true, strokeW);

    ctx.save();
    ctx.beginPath();
    roundRectPath(x + 2, y + 2, w - 4, h - 4, 10);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 10; i++) {
      const yy = y + h * (0.08 + i * 0.09);
      ctx.beginPath();
      ctx.moveTo(x + 6, yy + Math.sin(i * 1.7) * 2);
      ctx.lineTo(x + w - 6, yy + Math.cos(i * 1.2) * 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.lineWidth = 2.4;
    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    roundRect(x + inset, y + inset, w - inset * 2, h - inset * 2, 9, false, true, 2.4);

    ctx.globalAlpha = alpha * 0.16;
    ctx.fillStyle = '#ffffff';
    roundRect(x + inset * 0.85, y + inset * 0.85, w * 0.15, h - inset * 1.7, 10, true, false, 0);
    ctx.globalAlpha = alpha;

    const handleX = x + w - inset * 1.25 - handleW;
    const handleY = y + h * 0.5 - handleH / 2;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.4;
    roundRect(handleX, handleY, handleW, handleH, 5, false, true, 2.4);
    ctx.beginPath();
    ctx.moveTo(handleX + handleW * 0.48, handleY + handleH * 0.20);
    ctx.lineTo(handleX + handleW * 0.48, handleY + handleH * 0.80);
    ctx.stroke();

    ctx.restore();
  }

  function doorAlphaForGhostEye() {
    if (state.ghostEye > 0 && state.mode === 'normal') return 0.4;
    return 1;
  }

  function actualDoorRect() {
    const d = state.layout.bigDoor;
    const x = d.x - d.w * 0.96 * state.door;
    return { x, y: d.y, w: d.w, h: d.h };
  }

  function drawBossGlow() {
    const c = state.content;
    if (!c || c.type !== 'boss') return;
    const l = state.layout;
    const pulse = 0.5 + Math.sin(state.t * 12) * 0.5;
    const hpRatio = 1 - (c.hits || 0) / c.cfg.seals;
    const fast = hpRatio < 0.3 ? 1 : 0.35;
    ctx.save();
    ctx.globalAlpha = state.mode === 'bossFight' ? 0.48 + pulse * fast * 0.24 : 0.34;
    const g = ctx.createRadialGradient(l.bigHole.x + l.bigHole.w / 2, l.bigHole.y + l.bigHole.h / 2, 10, l.bigHole.x + l.bigHole.w / 2, l.bigHole.y + l.bigHole.h / 2, l.bigHole.w * 0.82);
    g.addColorStop(0, 'rgba(255,28,10,0.95)');
    g.addColorStop(0.48, 'rgba(255,28,10,0.28)');
    g.addColorStop(1, 'rgba(255,28,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(l.bigHole.x - 80, l.bigHole.y - 80, l.bigHole.w + 160, l.bigHole.h + 160);
    ctx.restore();
  }

  function drawContentBehindDoor(doorArg, holeArg) {
    const c = state.content;
    if (!c) return;
    const l = state.layout;
    const door = doorArg || l.bigDoor;
    const hole = holeArg || l.bigHole;
    const floorY = door.y + door.h * 0.96;
    const contentAlpha = state.mode === 'transition' && state.transitionFadeContent
      ? clamp(1 - state.transition * 1.35, 0, 1)
      : 1;

    ctx.save();
    ctx.globalAlpha *= contentAlpha;
    ctx.beginPath();
    ctx.rect(hole.x, hole.y, hole.w, hole.h);
    ctx.clip();

    if (c.type === 'empty') {
      drawEmptyRoomMark(hole);
    } else if (c.type === 'person') {
      drawCharacter(c.person, door.x + door.w / 2, floorY, door.h * 0.60, 'person', 1);
    } else if (c.type === 'ghost') {
      const count = c.ghosts.length;
      const approach = ghostApproachStep();
      const dangerScale = 1 + approach * 0.68;
      const baseH = door.h * (count === 1 ? 0.60 : count === 2 ? 0.49 : 0.40);
      const spread = door.w * (count === 1 ? 0 : count === 2 ? 0.25 : 0.28);
      c.ghosts.forEach((g, i) => {
        const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
        const gx = door.x + door.w / 2 + offset;
        const gh = baseH * dangerScale;
        drawGhostFires(g, gx, floorY - gh * 0.58, gh, g.fire || 1, i);
        drawCharacter(g, gx, floorY, baseH, 'ghost', dangerScale);
      });
    } else if (c.type === 'boss') {
      const approach = state.mode === 'bossFight' ? Math.floor(state.door * 8) / 8 : 0;
      const scale = state.mode === 'bossFight' ? 1 + approach * 0.45 : 1;
      drawGhostFires(c.bossGhost, door.x + door.w / 2, floorY - door.h * 0.52, door.h * 0.80, (c.bossGhost.fire || 3) + 2, 9);
      drawCharacter(c.bossGhost, door.x + door.w / 2, floorY + door.h * 0.04, door.h * 0.76, 'boss', scale);
    }
    ctx.restore();
  }

  function drawEmptyRoomMark(hole) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    const cx = hole.x + hole.w / 2;
    const cy = hole.y + hole.h * 0.56;
    ctx.beginPath();
    ctx.arc(cx, cy, hole.w * 0.11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawGhostFires(def, cx, cy, bodyH, count, seed = 0) {
    ctx.save();
    const base = GHOSTS.findIndex(g => g.name === def.name);
    const safeSeed = base >= 0 ? base : seed;
    const max = clamp(count, 1, 7);
    for (let i = 0; i < max; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const layer = Math.floor(i / 2);
      const drift = Math.sin(state.t * (1.1 + i * 0.17) + safeSeed * 0.9 + i) * bodyH * 0.035;
      const bob = Math.sin(state.t * (1.7 + i * 0.23) + i * 1.8) * bodyH * 0.045;
      const x = cx + side * bodyH * (0.22 + layer * 0.08) + drift;
      const y = cy - bodyH * (0.04 + layer * 0.035) + bob;
      const size = bodyH * (0.14 + (i % 3) * 0.022);
      const img = assets[GHOST_FIRE_FILES[(safeSeed + i) % GHOST_FIRE_FILES.length]];
      const pulse = 0.72 + Math.sin(state.t * 3.2 + i) * 0.15;
      ctx.globalAlpha = clamp(0.60 + pulse * 0.26, 0.48, 0.96);
      if (img && img.complete && img.naturalWidth) {
        ctx.drawImage(img, x - size / 2, y - size * 0.65, size, size * 1.28);
      } else {
        drawCodeGhostFire(x, y, size, pulse);
      }
    }
    ctx.restore();
  }

  function drawCodeGhostFire(x, y, size, pulse) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 1 + pulse * 0.15);
    const g = ctx.createRadialGradient(0, 0, size * 0.05, 0, 0, size * 0.72);
    g.addColorStop(0, 'rgba(255,255,220,0.95)');
    g.addColorStop(0.34, 'rgba(95,255,160,0.72)');
    g.addColorStop(1, 'rgba(35,220,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.78);
    ctx.bezierCurveTo(size * 0.45, -size * 0.28, size * 0.38, size * 0.32, 0, size * 0.48);
    ctx.bezierCurveTo(-size * 0.42, size * 0.18, -size * 0.40, -size * 0.28, 0, -size * 0.78);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCharacter(def, x, floorY, targetH, kind, scale = 1) {
    const img = assets[def.file];
    const h = targetH * scale * (def.scale || 1);
    const aspect = img && img.naturalWidth ? img.naturalWidth / img.naturalHeight : 0.62;
    const w = h * aspect;
    const y = floorY - h;

    ctx.save();
    if (kind === 'boss') {
      const pulse = 0.5 + Math.sin(state.t * 14) * 0.5;
      ctx.shadowColor = 'rgba(255,0,0,0.85)';
      ctx.shadowBlur = 24 + pulse * 16;
    }

    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, x - w / 2, y, w, h);
    } else {
      drawFallbackCharacter(def.name, x, y, w, h, kind);
    }
    ctx.restore();
  }

  function drawFallbackCharacter(name, x, y, w, h, kind) {
    ctx.save();
    ctx.fillStyle = kind === 'person' ? '#fffdf6' : '#111';
    ctx.strokeStyle = kind === 'person' ? '#111' : '#fffdf6';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(x, y + h * 0.43, w * 0.38, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y + h * 0.14, w * 0.23, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = kind === 'person' ? '#111' : '#fffdf6';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name.slice(0, 4), x, y + h * 0.54);
    ctx.restore();
  }

  function drawDoorTalismans() {
    const c = state.content;
    if (!c || !c.talismans || !c.talismans.length) return;
    const d = actualDoorRect();
    c.talismans.forEach(t => {
      const age = state.t - (t.born || state.t);
      let alpha = 1;
      if (state.mode === 'sealSuccess' && age > 0.15) {
        alpha = clamp(1 - state.sealFlash / 0.72, 0, 1);
      }
      drawSealPaper(d.x + d.w * t.rx, d.y + d.h * t.ry, d.w * 0.25 * t.scale, d.h * 0.118 * t.scale, t.rot, alpha);
    });
  }

  function drawSealPaper(x, y, w, h, rot, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    const ww = Math.max(w * 0.72, 34);
    const hh = Math.max(h * 1.12, 72);
    ctx.fillStyle = '#f7d85a';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    roundRect(-ww / 2, -hh / 2, ww, hh, 5, true, true, 3);
    ctx.strokeStyle = '#b11616';
    ctx.lineWidth = 2;
    roundRect(-ww / 2 + 5, -hh / 2 + 6, ww - 10, hh - 12, 3, false, true, 2);
    ctx.fillStyle = '#b11616';
    ctx.font = `900 ${Math.max(18, ww * 0.48)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('封', 0, -hh * 0.20);
    ctx.font = `900 ${Math.max(14, ww * 0.36)}px serif`;
    ctx.fillText('印', 0, hh * 0.18);
    ctx.restore();
  }

  function drawSealSuccessGlow() {
    if (state.mode !== 'sealSuccess') return;
    const l = state.layout;
    const alpha = clamp(1 - state.sealFlash / 0.72, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha * 0.72;
    ctx.strokeStyle = '#ffe243';
    ctx.lineWidth = 12;
    roundRect(l.bigHole.x - 8, l.bigHole.y - 8, l.bigHole.w + 16, l.bigHole.h + 16, 18, false, true, 12);
    ctx.globalAlpha = alpha * 0.32;
    ctx.fillStyle = '#ffe243';
    ctx.fillRect(l.bigHole.x - 24, l.bigHole.y - 24, l.bigHole.w + 48, l.bigHole.h + 48);
    ctx.restore();
  }

  function drawDangerVignette() {
    if (state.danger <= 0.02 || state.mode !== 'normal') return;
    const l = state.layout;
    ctx.save();
    ctx.globalAlpha = clamp(state.danger, 0, 1) * 0.38;
    const g = ctx.createRadialGradient(l.w / 2, l.h / 2, l.w * 0.15, l.w / 2, l.h / 2, l.w * 0.72);
    g.addColorStop(0, 'rgba(255,0,0,0)');
    g.addColorStop(1, 'rgba(255,0,0,0.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0, l.topH, l.w, l.h - l.topH);
    ctx.restore();
  }

  function drawTopUI() {
    const l = state.layout;
    const prog = currentStageProgress();
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, l.w, l.topH);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, l.topH - 2);
    ctx.lineTo(l.w, l.topH - 2);
    ctx.stroke();

    drawMiniButton(l.home, '主页');
    drawMiniButton(l.galleryButton, '图鉴');

    ctx.fillStyle = '#111';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '900 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(`第 ${state.room} 间`, 86, 20);
    ctx.font = '700 11px system-ui, -apple-system, sans-serif';
    const diff = state.difficulty === 'easy' ? '简单' : '困难';
    ctx.fillText(`难度 ${diff}  最高 ${state.save.bestRoom || 1}`, 86, 40);
    ctx.fillText(`进度 ${prog.index}/25  Boss：${prog.boss.name}`, 86, 58);

    const barX = 86;
    const barY = l.topH - 13;
    const barW = Math.max(80, l.w - 188);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    roundRect(barX, barY, barW, 6, 3, true, true, 2);
    ctx.fillStyle = '#111';
    roundRect(barX, barY, barW * prog.ratio, 6, 3, true, false, 0);

    ctx.textAlign = 'right';
    ctx.font = '700 10px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#111';
    ctx.fillText(collectCountText(), l.w - 10, 61);
    if (state.ghostEye > 0) {
      ctx.font = '800 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(`鬼眼 ${Math.ceil(state.ghostEye)}s`, l.w - 10, l.topH - 16);
    }

    if (state.mode === 'bossFight' && state.content && state.content.type === 'boss') {
      drawBossHPBar();
    }
    ctx.restore();
  }

  function drawBossHPBar() {
    const l = state.layout;
    const c = state.content;
    const ratio = clamp(1 - c.hits / c.cfg.seals, 0, 1);
    const x = 86;
    const y = l.topH - 24;
    const w = l.w - 172;
    const h = 9;
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    roundRect(x, y, w, h, 4, true, true, 2);
    ctx.fillStyle = ratio < 0.3 ? '#ff3b20' : '#111';
    roundRect(x, y, w * ratio, h, 4, true, false, 0);
    ctx.restore();
  }

  function drawBottomControls() {
    const l = state.layout;
    if (state.mode === 'transition' || state.mode === 'sealSuccess') return;

    if (state.mode === 'bossFight') {
      drawBossSealButton(l.bossButton);
      return;
    }

    drawSealButton(l.sealButton);
  }

  function drawSealButton(r) {
    const img = assets['封印按钮.png'];
    ctx.save();
    if (img && img.complete && img.naturalWidth) {
      const aspect = img.naturalWidth / img.naturalHeight;
      let drawH = r.h;
      let drawW = drawH * aspect;
      if (drawW > r.w) {
        drawW = r.w;
        drawH = drawW / aspect;
      }
      const x = r.x + (r.w - drawW) / 2;
      const y = r.y + (r.h - drawH) / 2;
      ctx.drawImage(img, x, y, drawW, drawH);
    } else {
      ctx.fillStyle = '#fff06d';
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 4;
      roundRect(r.x, r.y, r.w, r.h, 15, true, true, 4);
      ctx.fillStyle = '#111';
      ctx.font = '900 25px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('封 印', r.x + r.w / 2, r.y + r.h / 2);
    }
    ctx.restore();
  }

  function drawBossSealButton(r) {
    ctx.save();
    const beat = 1 + Math.sin(state.t * 18) * 0.025;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    ctx.translate(cx, cy);
    ctx.scale(beat, beat);
    const rr = { x: -r.w / 2, y: -r.h / 2, w: r.w, h: r.h };
    ctx.fillStyle = '#fff06d';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 5;
    roundRect(rr.x, rr.y, rr.w, rr.h, 18, true, true, 5);
    ctx.fillStyle = '#111';
    ctx.font = '900 24px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('疯狂贴封印！', 0, 0);
    ctx.restore();
  }

  function drawGhostEyeFx() {
    if (state.eyeFx <= 0) return;
    const l = state.layout;
    const p = clamp(state.eyeFx / 1.05, 0, 1);
    ctx.save();
    ctx.globalAlpha = p * 0.85;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(0, l.topH, l.w, l.h - l.topH);
    ctx.translate(l.w / 2, l.topH + (l.h - l.topH) * 0.42);
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-86, 0);
    ctx.quadraticCurveTo(0, -52, 86, 0);
    ctx.quadraticCurveTo(0, 52, -86, 0);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.fill();
    ctx.restore();
  }

  function drawToast() {
    if (!state.toast) return;
    const l = state.layout;
    ctx.save();
    ctx.globalAlpha = clamp(state.toast.time, 0, 1);
    ctx.fillStyle = '#111';
    ctx.strokeStyle = '#fffdf6';
    ctx.lineWidth = 3;
    const w = Math.min(l.w * 0.78, 300);
    const h = 42;
    const x = (l.w - w) / 2;
    const y = l.topH + 12;
    roundRect(x, y, w, h, 18, true, true, 3);
    ctx.fillStyle = '#fffdf6';
    ctx.font = '800 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.toast.text, l.w / 2, y + h / 2);
    ctx.restore();
  }

  function drawDoodleBackground() {
    const l = state.layout;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, l.w, l.h);
    ctx.strokeStyle = 'rgba(17,17,17,0.12)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 18; i++) {
      const x = (i * 73) % l.w;
      const y = (i * 127) % l.h;
      ctx.beginPath();
      ctx.arc(x, y, 8 + (i % 4) * 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTitleBlock(title, sub) {
    const l = state.layout;
    ctx.save();
    ctx.fillStyle = '#fffdf6';
    roundRect(l.w * 0.08, l.h * 0.18, l.w * 0.84, 104, 22, true, true, 5);
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.font = '900 34px system-ui, -apple-system, sans-serif';
    ctx.fillText(title, l.w / 2, l.h * 0.18 + 45);
    ctx.font = '700 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(sub, l.w / 2, l.h * 0.18 + 76);
    ctx.restore();
  }

  function drawBackButton() {
    const label = state.screen === 'gallery' && state.lastScreen === 'game' ? '返回游戏' : '返回';
    drawMiniButton({ x: 16, y: 18, w: 70, h: 40 }, label);
  }

  function drawMiniButton(r, text) {
    ctx.save();
    ctx.fillStyle = '#fffdf6';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    roundRect(r.x, r.y, r.w, r.h, 12, true, true, 3);
    ctx.fillStyle = '#111';
    ctx.font = '800 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2);
    ctx.restore();
  }

  function drawUIButton(r, title, sub = '') {
    ctx.save();
    ctx.fillStyle = '#fffdf6';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 5;
    roundRect(r.x, r.y, r.w, r.h, 18, true, true, 5);
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = sub ? '900 22px system-ui, -apple-system, sans-serif' : '900 24px system-ui, -apple-system, sans-serif';
    ctx.fillText(title, r.x + r.w / 2, r.y + r.h / 2 - (sub ? 10 : 0));
    if (sub) {
      ctx.font = '700 12px system-ui, -apple-system, sans-serif';
      ctx.fillText(sub, r.x + r.w / 2, r.y + r.h / 2 + 18);
    }
    ctx.restore();
  }

  function drawTab(r, text, active) {
    ctx.save();
    ctx.fillStyle = active ? '#111' : '#fffdf6';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    roundRect(r.x, r.y, r.w, r.h, 13, true, true, 3);
    ctx.fillStyle = active ? '#fffdf6' : '#111';
    ctx.font = '800 13px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, r.x + r.w / 2, r.y + r.h / 2);
    ctx.restore();
  }

  function drawGalleryCard(r, item, seen) {
    ctx.save();
    ctx.fillStyle = '#fffdf6';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    roundRect(r.x, r.y, r.w, r.h, 16, true, true, 3);
    ctx.beginPath();
    ctx.rect(r.x + 6, r.y + 6, r.w - 12, r.h - 64);
    ctx.clip();
    if (seen) {
      const img = assets[item.file];
      if (img && img.complete && img.naturalWidth) {
        const boxW = r.w - 20;
        const boxH = r.h - 82;
        const aspect = img.naturalWidth / img.naturalHeight;
        let drawH = boxH;
        let drawW = drawH * aspect;
        if (drawW > boxW) {
          drawW = boxW;
          drawH = drawW / aspect;
        }
        ctx.drawImage(img, r.x + r.w / 2 - drawW / 2, r.y + 10 + boxH - drawH, drawW, drawH);
      } else {
        drawFallbackCharacter(item.name, r.x + r.w / 2, r.y + 14, r.w * 0.62, r.h * 0.65, state.galleryTab === 'people' ? 'person' : 'ghost');
      }
    } else {
      ctx.fillStyle = '#111';
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.ellipse(r.x + r.w / 2, r.y + r.h * 0.34, r.w * 0.24, r.h * 0.20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#111';
      ctx.font = '900 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('？', r.x + r.w / 2, r.y + r.h * 0.37);
    }
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 12px system-ui, -apple-system, sans-serif';
    ctx.fillText(seen ? item.name : '？？？', r.x + r.w / 2, r.y + r.h - 44);
    ctx.font = '600 10px system-ui, -apple-system, sans-serif';
    const desc = seen ? (item.desc || '暂无记录') : '尚未记录';
    wrapText(desc, r.x + r.w / 2, r.y + r.h - 30, r.w - 14, 12, 'center');
    ctx.restore();
  }

  function drawTextPanel(lines, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = '#fffdf6';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 4;
    roundRect(x, y, w, h, 18, true, true, 4);
    ctx.fillStyle = '#111';
    ctx.font = '700 14px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    let yy = y + 22;
    lines.forEach(line => {
      yy = wrapText(line, x + 18, yy, w - 36, 22, 'left') + 6;
    });
    ctx.restore();
  }

  function collectCountText() {
    return `${seenGhostCount() + seenPeopleCount()}/${GHOSTS.length + PEOPLE.length}`;
  }
  function seenGhostCount() { return GHOSTS.filter(g => state.save.ghosts[g.name]).length; }
  function seenPeopleCount() { return PEOPLE.filter(p => state.save.people[p.name]).length; }

  function wrapText(text, x, y, maxWidth, lineHeight, align = 'left') {
    ctx.save();
    ctx.textAlign = align;
    const words = String(text).split('');
    let line = '';
    let yy = y;
    for (let i = 0; i < words.length; i++) {
      const test = line + words[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = words[i];
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
    ctx.restore();
    return yy + lineHeight;
  }

  function roundRectPath(x, y, w, h, r) {
    roundRectPath(x, y, w, h, r);
  }

  function roundRect(x, y, w, h, r, fill, stroke, lineWidth = 1) {
    roundRectPath(x, y, w, h, r);
    if (fill) ctx.fill();
    if (stroke) {
      const old = ctx.lineWidth;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      ctx.lineWidth = old;
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
})();
