// game.js
// 利禄卡 Online v4.3 中英文切换版
// 状态机：lobby / opening / meal_playing / meal_result / night_picking / day_result

const IS_WEB = typeof window !== 'undefined' && typeof document !== 'undefined'
const canvas = document.getElementById('gameCanvas')
const ctx = canvas.getContext('2d')

let W = 0
let H = 0
let DPR = 1
let SAFE_TOP = 18
let SAFE_BOTTOM = 18
let resizeRenderReady = false

function getViewportSize() {
  const vv = window.visualViewport

  const width = Math.floor((vv && vv.width) || window.innerWidth || document.documentElement.clientWidth || 390)
  const height = Math.floor((vv && vv.height) || window.innerHeight || document.documentElement.clientHeight || 780)

  return {
    width: Math.max(320, width),
    height: Math.max(560, height)
  }
}

function getTargetDpr(width, height) {
  const raw = window.devicePixelRatio || 1
  const area = width * height

  // iPhone 17 Pro / Pro Max 一类设备 CSS 视口更大、DPR 更高。
  // 如果继续用 DPR=2 或 3，Canvas 实际像素会很重，容易变形和卡。
  if (raw >= 3 && area > 380000) return 1.45
  if (raw >= 3 && area > 330000) return 1.65

  return Math.min(raw, 1.85)
}

function resizeCanvas(force) {
  const size = getViewportSize()
  const nextW = size.width
  const nextH = size.height
  const nextDpr = getTargetDpr(nextW, nextH)

  if (!force && W === nextW && H === nextH && Math.abs(DPR - nextDpr) < 0.01) return

  W = nextW
  H = nextH
  DPR = nextDpr

  const vv = window.visualViewport
  SAFE_TOP = Math.max(18, Math.round(((vv && vv.offsetTop) || 0) + 18))
  SAFE_BOTTOM = Math.max(18, H < 700 ? 14 : 18)

  canvas.style.width = `${W}px`
  canvas.style.height = `${H}px`
  canvas.width = Math.max(1, Math.floor(W * DPR))
  canvas.height = Math.max(1, Math.floor(H * DPR))

  // 关键：用 setTransform 重置矩阵，避免 resize 后重复 scale 造成画面变形。
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'medium'

  if (resizeRenderReady && typeof requestRender === 'function') {
    requestRender()
  }
}

resizeCanvas(true)

const TOTAL_ORDERS_PER_DAY = 10

const meals = [
  { name: '早餐', threshold: 400 },
  { name: '午餐', threshold: 800 },
  { name: '晚餐', threshold: 600 },
  { name: '夜宵', threshold: 800 }
]

const FOOD_CARDS = [
  { name: '生菜沙拉', english: 'Salad', type: '素', kcal: 30 },
  { name: '西兰花', english: 'Broccoli', type: '素', kcal: 50 },
  { name: '牛油果', english: 'Avocado', type: '素', kcal: 80 },
  { name: '炒藕片', english: 'Lotus Root', type: '素', kcal: 80 },
  { name: '烤黄金香菇', english: 'Grilled Golden', type: '素', kcal: 60 },
  { name: '臭豆腐', english: 'Stinky Tofu', type: '素', kcal: 150 },

  { name: '水煮蛋', english: 'Boiled Egg', type: '荤', kcal: 100 },
  { name: '烤生蚝', english: 'Grilled Oyster', type: '荤', kcal: 120 },
  { name: '烤鸡翅', english: 'Chicken Wing', type: '荤', kcal: 160 },
  { name: '烤鱿鱼', english: 'Grilled Squid', type: '荤', kcal: 160 },
  { name: '炸鸡', english: 'Fried Chicken', type: '荤', kcal: 220 },
  { name: '羊肉串', english: 'Lamb Skewer', type: '荤', kcal: 180 },

  { name: '米饭', english: 'Rice Bowl', type: '主食', kcal: 150 },
  { name: '牛肉面', english: 'Beef Noodles', type: '主食', kcal: 200 },
  { name: '饺子', english: 'Dumpling', type: '主食', kcal: 180 },
  { name: '包子', english: 'Baozi', type: '主食', kcal: 180 },
  { name: '披萨片', english: 'Pizza Slice', type: '主食', kcal: 220 },
  { name: '咖喱饭', english: 'Curry Rice', type: '主食', kcal: 250 },

  { name: '酸奶', english: 'Yogurt', type: '甜点', kcal: 80 },
  { name: '布丁', english: 'Pudding', type: '甜点', kcal: 250 },
  { name: '珍珠奶茶', english: 'Milk Tea', type: '甜点', kcal: 260 },
  { name: '冰淇淋', english: 'Ice Cream', type: '甜点', kcal: 300 },
  { name: '瑞士卷', english: 'Swiss Roll', type: '甜点', kcal: 260 },
  { name: '融化蛋糕', english: 'Cake Ooze', type: '甜点', kcal: 350 }
]

const CARD_IMAGE_PATHS = {
  '生菜沙拉': 'images/cards/salad.png',
  '西兰花': 'images/cards/broccoli.png',
  '牛油果': 'images/cards/avocado.png',
  '炒藕片': 'images/cards/lotus_root.png',
  '烤黄金香菇': 'images/cards/grilled_golden.png',
  '臭豆腐': 'images/cards/stinky_tofu.png',

  '水煮蛋': 'images/cards/boiled_egg.png',
  '烤生蚝': 'images/cards/grilled_oyster.png',
  '烤鸡翅': 'images/cards/chicken_wing.png',
  '烤鱿鱼': 'images/cards/grilled_squid.png',
  '炸鸡': 'images/cards/fried_chicken.png',
  '羊肉串': 'images/cards/lamb_skewer.png',

  '米饭': 'images/cards/rice_bowl.png',
  '牛肉面': 'images/cards/beef_noodles.png',
  '饺子': 'images/cards/dumpling.png',
  '包子': 'images/cards/baozi.png',
  '披萨片': 'images/cards/pizza_slice.png',
  '咖喱饭': 'images/cards/curry_rice.png',

  '酸奶': 'images/cards/yogurt.png',
  '布丁': 'images/cards/pudding.png',
  '珍珠奶茶': 'images/cards/milk_tea.png',
  '冰淇淋': 'images/cards/ice_cream.png',
  '瑞士卷': 'images/cards/swiss_roll.png',
  '融化蛋糕': 'images/cards/cake.png'
}

const CARD_BACK_PATHS = {
  '荤': 'images/cards/red_back.png',
  '素': 'images/cards/green_back.png',
  '主食': 'images/cards/yellow_back.png',
  '甜点': 'images/cards/blue_back.png'
}


const TYPE_COLORS = {
  '荤': '#FF9BB4',
  '素': '#A9F0D1',
  '主食': '#FFE169',
  '甜点': '#9EDBFF'
}

const TYPE_TEXT_COLORS = {
  '荤': '#7A1230',
  '素': '#0E5C44',
  '主食': '#5C4300',
  '甜点': '#063D66'
}

let appMode = 'home' // home / single / online
let myPlayerId = 'p1'
let roomId = ''
let roomData = null
let unsubscribeRoom = null
let buttons = []
let message = ''
let rulesExpanded = false
let lang = localStorage.getItem('lilucard_lang') || 'zh'

const I18N = {
  zh: {
    langBtn: 'EN', homeTitle: '利禄卡', homeSub: '卡路里外卖对战', slogan: '我的嘴，就是秤。',
    modes: '单机 / 开房间 / 加入房间', rulesBtn: '查看游戏规则', closeRules: '收起', rulesTitle: '游戏规则',
    single: '单机游戏', createRoom: '开房间', joinRoom: '加入房间', music: '音乐', musicOn: '音乐开',
    musicOff: '音乐关', musicFailed: '音乐失败', home: t('home'), opponent: '对手', you: '你',
    meat: '荤', veg: '素', staple: '主食', dessert: '甜点', eat: '开吃', wait: '等待对方',
    ready: '已准备', notReady: '未准备', readyBtn: '准备', warningLine: '警戒线', order: '外卖',
    totalKcal: '全日总热量', settledKcal: '已结算热量', kcal: 'kcal', startHand: '起手中',
    revealNight: '展示夜宵', mealResult: '结算', dayResult: '今日结算', nextReady: t('nextReady'),
    restartHome: t('restartHome'), confirmedWait: '已确认，等待对方', noRecord: t('noRecord'), noFood: t('noFood'),
    yourTurn: '你的回合', opponentTurn: '对方点餐中', chooseFood: '选外卖或开吃', waitOpponent: '等待对方操作',
    roomWait: '等待另一名玩家加入', readyStatus: '准备状态', p1: '玩家1', p2: '玩家2',
    winMeal: '本餐你赢了', loseMeal: '本餐你输了', drawMeal: '本餐平局',
    quoteWin: '你很会吃啊，小朋友。', quoteLose: '你会吃有个屁用。', quoteDraw: '你俩都挺能装。',
    yourFood: t('yourFood'), oppFood: t('oppFood'), confirmNext: '确认进入',
    finalWin: '恭喜你赢了！', finalLose: '你输了', finalDraw: '平局',
    finalWinSub: '你赢得了这一整局', finalLoseSub: '对方赢得了这一整局', finalDrawSub: '双方今天吃得不相上下',
    ruleLines: [
      '1. 双方准备后开局，早餐 / 午餐 / 晚餐 / 夜宵共 4 小局。',
      '2. 每局先进入起手阶段，双方各抽 2 张：第 1 张是底牌，第 2 张是明牌；起手不消耗外卖次数。',
      '3. 早餐起手完成后随机先手；午餐自动换另一方先手；晚餐换回早餐先手方。',
      '4. 点餐阶段轮流操作。轮到你时，可选择 荤 / 素 / 主食 / 甜点，或点击开吃。',
      '5. 对方只有底牌未知，其余明牌可见；对方热量显示为「? + 明牌热量」。',
      '6. 爆牌不会立刻摊牌，你还可以继续点外卖迷惑对方；只有主动开吃才结束。',
      '7. 双方都开吃后进入本餐结算，公开双方全部外卖、热量、爆牌情况和胜负。',
      '8. 夜宵不分先后，双方用剩余外卖次数选择搭配；双方选完后点击展示夜宵再结算。',
      '9. 四局结束后进入今日结算，比分更高者获胜；平局则双方都很会吃。',
      '10. 联机结束后不会退出房间，双方可继续准备下一整局。'
    ]
  },
  en: {
    langBtn: '中', homeTitle: 'LiluCard', homeSub: 'Calorie Takeout Duel', slogan: 'My mouth is the scale.',
    modes: 'Solo / Create Room / Join Room', rulesBtn: 'How to Play', closeRules: 'Close', rulesTitle: 'Rules',
    single: 'Solo', createRoom: 'Create Room', joinRoom: 'Join Room', music: 'Music', musicOn: 'Music On',
    musicOff: 'Music Off', musicFailed: 'Music Err', home: 'Home', opponent: 'Rival', you: 'You',
    meat: 'Meat', veg: 'Veg', staple: 'Staple', dessert: 'Dessert', eat: 'Eat', wait: 'Waiting',
    ready: 'Ready', notReady: 'Not Ready', readyBtn: 'Ready', warningLine: 'Limit', order: 'Orders',
    totalKcal: 'Day Total', settledKcal: 'Settled', kcal: 'kcal', startHand: 'Opening',
    revealNight: 'Reveal', mealResult: 'Result', dayResult: 'Final Result', nextReady: 'Next Round',
    restartHome: 'Home', confirmedWait: 'Confirmed, waiting', noRecord: 'No record', noFood: 'No orders',
    yourTurn: 'Your turn', opponentTurn: 'Rival ordering', chooseFood: 'Order or Eat', waitOpponent: 'Wait for rival',
    roomWait: 'Waiting for another player', readyStatus: 'Ready', p1: 'P1', p2: 'P2',
    winMeal: 'You won this meal', loseMeal: 'You lost this meal', drawMeal: 'Meal draw',
    quoteWin: 'You really know how to eat.', quoteLose: 'Eating well did nothing.', quoteDraw: 'Both of you can pretend.',
    yourFood: 'Your Orders', oppFood: 'Rival Orders', confirmNext: 'Go to ',
    finalWin: 'You Win!', finalLose: 'You Lose', finalDraw: 'Draw',
    finalWinSub: 'You won the full day', finalLoseSub: 'Rival won the full day', finalDrawSub: 'Both ate equally hard',
    ruleLines: [
      '1. Play 4 meals: Breakfast, Lunch, Dinner, and Night Snack.',
      '2. Each meal starts with 2 cards: first hidden, second visible. Opening cards do not cost orders.',
      '3. Breakfast first player is random. Lunch switches first player. Dinner switches back.',
      '4. On your turn, choose Meat / Veg / Staple / Dessert, or tap Eat.',
      '5. Only the rival hidden card is unknown. Their visible calories show as “? + visible calories”.',
      '6. Busting does not reveal immediately. You may keep ordering to bluff. Only Eat ends your meal.',
      '7. When both players Eat, all cards, calories, busts, and the winner are revealed.',
      '8. Night Snack is simultaneous. Spend remaining orders, then tap Reveal to settle.',
      '9. After 4 meals, the higher score wins the day.',
      '10. Online rooms stay open, so both players can ready up for another round.'
    ]
  }
}

function t(key) {
  const pack = I18N[lang] || I18N.zh
  return pack[key] !== undefined ? pack[key] : (I18N.zh[key] || key)
}

function mealName(i) {
  const names = lang === 'en' ? ['Breakfast', 'Lunch', 'Dinner', 'Night Snack'] : ['早餐', '午餐', '晚餐', '夜宵']
  return names[i] || ''
}

function typeLabel(type) {
  if (lang === 'en') {
    if (type === '荤') return 'Meat'
    if (type === '素') return 'Veg'
    if (type === '主食') return 'Staple'
    if (type === '甜点') return 'Dessert'
  }
  return type
}


// =========================
// 背景音乐 BGM
// =========================
// 请在 GitHub 根目录上传：audio/bgm.mp3
// 手机浏览器必须在玩家第一次点击后才能播放音乐。
const BGM_SRC = './audio/bgm.mp3'

let bgm = null
let bgmEnabled = true
let bgmStarted = false
let bgmLoadFailed = false
let bgmStatusText = ''
let bgmUserInteracted = false
let localReadyLocked = false
let startRequested = false
let startOverlayText = ''
let startOverlayUntil = 0
let localGameActionSeq = 0
let pendingWriteUntil = 0
let pendingActionId = ''
let rulesScroll = 0
let rulesMaxScroll = 0
let rulesTouchDragging = false
let rulesTouchLastY = 0
const buttonPulse = {}
const BUTTON_PULSE_MS = 160
let onlineActionLocked = false
let onlineActionLockUntil = 0

let game = createGame('single')




function initBgm() {
  if (bgm) return

  try {
    bgm = new Audio()
    bgm.loop = true
    bgm.volume = 0.32
    bgm.preload = 'auto'
    bgm.autoplay = false
    bgm.muted = false
    bgm.playsInline = true
    bgm.setAttribute('playsinline', 'true')
    bgm.setAttribute('webkit-playsinline', 'true')

    bgm.addEventListener('canplaythrough', () => {
      bgmLoadFailed = false
      if (bgmUserInteracted && !bgmStatusText) bgmStatusText = '音乐已加载'
      requestRender()
    })

    bgm.addEventListener('error', () => {
      bgmLoadFailed = true
      if (bgmUserInteracted) bgmStatusText = '音乐文件未找到'
      requestRender()
    })

    bgm.src = BGM_SRC
    bgm.load()
  } catch (err) {
    bgmLoadFailed = true
    if (bgmUserInteracted) bgmStatusText = '音乐初始化失败'
  }
}




function startBgm() {
  bgmUserInteracted = true
  if (!bgmEnabled) return

  initBgm()

  if (!bgm || bgmLoadFailed) {
    bgmStatusText = '音乐文件未找到'
    requestRender()
    return
  }

  try {
    bgm.muted = false
    bgm.volume = 0.32
    if (bgm.readyState === 0) bgm.load()
  } catch (err) {}

  const playPromise = bgm.play()

  if (playPromise && playPromise.then) {
    playPromise
      .then(() => {
        bgmStarted = true
        bgmStatusText = ''
        requestRender()
      })
      .catch(() => {
        bgmStarted = false
        bgmStatusText = '点音乐启动'
        requestRender()
      })
  } else {
    bgmStarted = true
    bgmStatusText = ''
    requestRender()
  }
}


function toggleBgm() {
  bgmUserInteracted = true
  initBgm()

  if (bgmLoadFailed) {
    bgmStatusText = '音乐文件未找到'
    requestRender()
    return
  }

  if (!bgmEnabled) {
    bgmEnabled = true
    startBgm()
    return
  }

  if (!bgmStarted || (bgm && bgm.paused)) {
    bgmEnabled = true
    startBgm()
    return
  }

  bgmEnabled = false
  if (bgm) bgm.pause()
  bgmStatusText = ''
  requestRender()
}




function drawMusicButton() {
  let label = t('music')
  if (bgmLoadFailed) label = t('musicFailed')
  else if (!bgmEnabled) label = t('musicOff')
  else if (bgmStarted && bgm && !bgm.paused) label = t('musicOn')

  const y = Math.max(3, SAFE_TOP - 11)
  const musicW = lang === 'en' ? 64 : 50
  addButton('music_toggle', label, 8, y, musicW, 22, '#FFFFFF', '#111', 9)
  addButton('lang_toggle', t('langBtn'), 12 + musicW, y, 32, 22, '#FFFFFF', '#111', 10)

  if (bgmStatusText && (!bgmStarted || bgmLoadFailed)) {
    drawText(bgmStatusText, 48 + musicW, y + 6, 8, bgmLoadFailed ? '#E94335' : '#777', 'left', 'bold')
  }
}



// =========================
// 基础工具
// =========================

function safeArray(value) {
  if (Array.isArray(value)) return value.filter(v => v !== null && v !== undefined)
  if (!value) return []
  if (typeof value === 'object') {
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b))
      .map(k => value[k])
      .filter(v => v !== null && v !== undefined)
  }
  return []
}

function safeNumberArray(value, length) {
  const arr = safeArray(value)
  const out = []
  for (let i = 0; i < length; i++) out[i] = Number(arr[i] || 0)
  return out
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function randomId() {
  return `${Date.now()}_${Math.floor(Math.random() * 999999)}`
}

function shuffle(arr) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const t = a[i]
    a[i] = a[j]
    a[j] = t
  }
  return a
}

function cloneCard(card) {
  return {
    id: randomId(),
    name: card.name,
    english: card.english,
    type: card.type,
    kcal: card.kcal,
    hidden: false,
    privateCard: false
  }
}

function makeDeck() {
  return shuffle(FOOD_CARDS.map(cloneCard))
}

function normalizeType(cardOrType) {
  const t = typeof cardOrType === 'string'
    ? cardOrType
    : (cardOrType.type || cardOrType.category || cardOrType.suit || cardOrType.kind || '')

  if (t === '荤' || t === '肉' || t === '肉菜' || t === 'meat') return '荤'
  if (t === '素' || t === '素菜' || t === 'veg') return '素'
  if (t === '主' || t === '主食' || t === 'rice' || t === 'staple') return '主食'
  if (t === '甜' || t === '甜点' || t === 'dessert') return '甜点'
  return t
}

function drawFromDeck(g, type) {
  if (!g.deck || g.deck.length === 0) g.deck = makeDeck()

  let indexes = []
  if (type) {
    for (let i = 0; i < g.deck.length; i++) {
      if (normalizeType(g.deck[i]) === type) indexes.push(i)
    }

    if (indexes.length === 0) {
      g.deck = g.deck.concat(makeDeck())
      for (let i = 0; i < g.deck.length; i++) {
        if (normalizeType(g.deck[i]) === type) indexes.push(i)
      }
    }
  } else {
    indexes = g.deck.map((_, i) => i)
  }

  if (indexes.length === 0) return null
  const deckIndex = indexes[Math.floor(Math.random() * indexes.length)]
  return g.deck.splice(deckIndex, 1)[0]
}

function calcCardsKcal(cards) {
  return safeArray(cards).reduce((sum, card) => sum + Number(card.kcal || 0), 0)
}

function getVisibleKcal(cards) {
  return safeArray(cards).reduce((sum, card) => {
    if (card.hidden) return sum
    return sum + Number(card.kcal || 0)
  }, 0)
}

function getPlayerName(pid) {
  return pid === 'p1' ? '玩家1' : '玩家2'
}

function otherPlayer(pid) {
  return pid === 'p1' ? 'p2' : 'p1'
}

function getSelfId() {
  return appMode === 'online' ? myPlayerId : 'p1'
}

function getOpponentId() {
  return otherPlayer(getSelfId())
}

function getMeal() {
  return meals[game.mealIndex]
}

function getRoomPlayers() {
  return roomData && roomData.players ? roomData.players : {}
}

function isReadyLockedForMe() {
  const players = getRoomPlayers()
  return Boolean(localReadyLocked || (players[myPlayerId] && players[myPlayerId].ready))
}

function areBothPlayersReady() {
  const players = getRoomPlayers()
  return Boolean(players.p1 && players.p2 && players.p1.ready && players.p2.ready)
}

function showStartOverlay(text, ms) {
  startOverlayText = text || '开局中...'
  startOverlayUntil = Date.now() + (ms || 1200)
}

function isBusted(g, pid) {
  const meal = meals[g.mealIndex]
  return calcCardsKcal(g.players[pid].cards) > meal.threshold
}


function isEnded(g, pid) {
  const p = g.players[pid]
  // v2.4：爆牌不再自动结束。
  // 玩家可以继续叫外卖来迷惑对方，只有主动开吃才算结束。
  return Boolean(p.stood)
}

function getRemainingOrders(g, pid) {
  return Math.max(0, TOTAL_ORDERS_PER_DAY - Number(g.records[pid].dayOrdersUsed || 0))
}

function getMealStarter(g, index) {
  if (!g.firstTurnPlayer) g.firstTurnPlayer = Math.random() < 0.5 ? 'p1' : 'p2'

  if (index === 0) return g.firstTurnPlayer
  if (index === 1) return otherPlayer(g.firstTurnPlayer)
  if (index === 2) return g.firstTurnPlayer
  return null
}

// =========================
// 游戏数据结构
// =========================

function createPlayerState() {
  return {
    cards: [],
    nightChoices: [],
    stood: false,
    busted: false,
    ordersUsed: 0
  }
}

function createRecord() {
  return {
    mealKcal: meals.map(() => 0),
    rawMealKcal: meals.map(() => 0),
    basePoint: meals.map(() => 0),
    comboBonusPoint: meals.map(() => 0),
    comboResults: meals.map(() => null),
    dayBonusKcal: 0,
    dayBonusCards: [],
    dayOrdersUsed: 0
  }
}

function normalizePlayerState(p) {
  const base = createPlayerState()
  const src = p && typeof p === 'object' ? p : {}
  return {
    ...base,
    ...src,
    cards: safeArray(src.cards),
    nightChoices: safeArray(src.nightChoices),
    stood: Boolean(src.stood),
    busted: Boolean(src.busted),
    ordersUsed: Number(src.ordersUsed || 0)
  }
}

function normalizeRecord(r) {
  const base = createRecord()
  const src = r && typeof r === 'object' ? r : {}

  return {
    ...base,
    ...src,
    mealKcal: safeNumberArray(src.mealKcal, meals.length),
    rawMealKcal: safeNumberArray(src.rawMealKcal, meals.length),
    basePoint: safeNumberArray(src.basePoint, meals.length),
    comboBonusPoint: safeNumberArray(src.comboBonusPoint, meals.length),
    comboResults: safeArray(src.comboResults),
    dayBonusKcal: Number(src.dayBonusKcal || 0),
    dayBonusCards: safeArray(src.dayBonusCards),
    dayOrdersUsed: Number(src.dayOrdersUsed || 0)
  }
}

function normalizeGame(g) {
  const base = createGame('online')
  const src = g && typeof g === 'object' ? g : {}

  return {
    ...base,
    ...src,
    deck: safeArray(src.deck),
    players: {
      p1: normalizePlayerState(src.players && src.players.p1),
      p2: normalizePlayerState(src.players && src.players.p2)
    },
    records: {
      p1: normalizeRecord(src.records && src.records.p1),
      p2: normalizeRecord(src.records && src.records.p2)
    },
    mealIndex: Number(src.mealIndex || 0),
    actionSeq: Number(src.actionSeq || 0),
    lastMealResult: src.lastMealResult || null,
    mealResults: safeArray(src.mealResults).length ? safeArray(src.mealResults) : meals.map(() => null),
    firstTurnPlayer: src.firstTurnPlayer || null,
    turn: src.turn || null,
    phase: src.phase || 'lobby',
    message: src.message || '',
    comboMessage: src.comboMessage || '',
    nextReady: {
      p1: Boolean(src.nextReady && src.nextReady.p1),
      p2: Boolean(src.nextReady && src.nextReady.p2)
    },
    replayReady: {
      p1: Boolean(src.replayReady && src.replayReady.p1),
      p2: Boolean(src.replayReady && src.replayReady.p2)
    }
  }
}

function createGame(mode) {
  return {
    mode,
    phase: mode === 'single' ? 'opening' : 'lobby',
    mealIndex: 0,
    turn: null,
    firstTurnPlayer: null,
    deck: makeDeck(),
    players: {
      p1: createPlayerState(),
      p2: createPlayerState()
    },
    records: {
      p1: createRecord(),
      p2: createRecord()
    },
    lastMealResult: null,
    mealResults: meals.map(() => null),
    message: mode === 'single'
      ? '早餐开始：起手阶段，先抽2张起手牌'
      : '等待玩家加入并准备',
    comboMessage: '',
    actionSeq: 0,
    nextReady: { p1: false, p2: false },
    replayReady: { p1: false, p2: false }
  }
}

function resetMealState(g) {
  g.players.p1 = createPlayerState()
  g.players.p2 = createPlayerState()
  g.lastMealResult = null
  g.comboMessage = ''
  g.nextReady = { p1: false, p2: false }
}

function enterOpening(g) {
  g.phase = 'opening'
  g.turn = null
  resetMealState(g)
  g.message = `${meals[g.mealIndex].name}开始：起手阶段不分先后，双方各抽2张`
}

function enterMealPlayingIfReady(g) {
  const p1Count = safeArray(g.players.p1.cards).length
  const p2Count = safeArray(g.players.p2.cards).length

  if (p1Count < 2 || p2Count < 2) return false

  g.players.p1.busted = isBusted(g, 'p1')
  g.players.p2.busted = isBusted(g, 'p2')

  if (isEnded(g, 'p1') && isEnded(g, 'p2')) {
    settleMeal(g)
    return true
  }

  const starter = getMealStarter(g, g.mealIndex)
  g.turn = isEnded(g, starter) ? otherPlayer(starter) : starter
  g.phase = 'meal_playing'
  g.message = `${meals[g.mealIndex].name}点餐开始：${getPlayerName(g.turn)}点餐回合`
  return true
}


function settleNightNoOrders(g) {
  const meal = meals[g.mealIndex]
  const p1Remain = getRemainingOrders(g, 'p1')
  const p2Remain = getRemainingOrders(g, 'p2')

  g.players.p1.cards = []
  g.players.p2.cards = []
  g.players.p1.nightChoices = []
  g.players.p2.nightChoices = []
  g.players.p1.stood = true
  g.players.p2.stood = true
  g.players.p1.busted = false
  g.players.p2.busted = false

  g.records.p1.rawMealKcal[g.mealIndex] = 0
  g.records.p2.rawMealKcal[g.mealIndex] = 0
  g.records.p1.mealKcal[g.mealIndex] = 0
  g.records.p2.mealKcal[g.mealIndex] = 0
  g.records.p1.comboResults[g.mealIndex] = null
  g.records.p2.comboResults[g.mealIndex] = null

  let winner = null
  let resultText = '双方都没有外卖机会，夜宵无人得分'

  if (p1Remain <= 0 && p2Remain > 0) {
    winner = 'p2'
    g.records.p2.basePoint[g.mealIndex] += 1
    resultText = '玩家1没有留下外卖机会，玩家2赢得夜宵'
  } else if (p2Remain <= 0 && p1Remain > 0) {
    winner = 'p1'
    g.records.p1.basePoint[g.mealIndex] += 1
    resultText = '玩家2没有留下外卖机会，玩家1赢得夜宵'
  }

  const p1Point = getMealPoint(g, 'p1', g.mealIndex)
  const p2Point = getMealPoint(g, 'p2', g.mealIndex)

  g.lastMealResult = {
    mealIndex: g.mealIndex,
    mealName: meal.name,
    threshold: meal.threshold,
    p1Cards: [],
    p2Cards: [],
    p1Total: 0,
    p2Total: 0,
    p1Busted: false,
    p2Busted: false,
    p1Combo: null,
    p2Combo: null,
    p1Point,
    p2Point,
    winner,
    resultText,
    scoreText: `玩家1 ${getMealTotalPoint(g, 'p1')} : ${getMealTotalPoint(g, 'p2')} 玩家2`
  }

  if (!g.mealResults) g.mealResults = meals.map(() => null)
  g.mealResults[g.mealIndex] = clone(g.lastMealResult)

  g.phase = 'meal_result'
  g.turn = null
  g.nextReady = { p1: false, p2: false }
  g.message = `夜宵结算：${resultText}`
  g.comboMessage = ''
  g.actionSeq += 1
}


function enterNightPicking(g) {
  g.phase = 'night_picking'
  g.turn = null
  resetMealState(g)

  const p1Remain = getRemainingOrders(g, 'p1')
  const p2Remain = getRemainingOrders(g, 'p2')

  if (p1Remain <= 0 || p2Remain <= 0) {
    settleNightNoOrders(g)
    return
  }

  g.message = '夜宵开始：不分先后，双方按剩余外卖次数选择搭配'
}

function enterNextMeal(g) {
  const next = g.mealIndex + 1

  if (next >= meals.length) {
    g.phase = 'day_result'
    g.turn = null
    g.message = '今日结算完成'
    return
  }

  g.mealIndex = next
  g.nextReady = { p1: false, p2: false }

  if (g.mealIndex === 3) {
    enterNightPicking(g)
  } else {
    enterOpening(g)
  }
}

// =========================
// 组合与结算
// =========================

function getTypeCounts(cards) {
  const counts = { '荤': 0, '素': 0, '主食': 0, '甜点': 0 }

  safeArray(cards).forEach(card => {
    const type = normalizeType(card)
    if (counts[type] !== undefined) counts[type] += 1
  })

  return counts
}

function evaluateMealCombo(cards, threshold) {
  const total = calcCardsKcal(cards)
  if (total > threshold) return null

  const counts = getTypeCounts(cards)
  const types = ['荤', '素', '主食', '甜点']
  const hasAllTypes = types.every(type => counts[type] >= 1)
  const pairTypes = types.filter(type => counts[type] >= 2)
  const maxType = types.reduce((a, b) => counts[a] >= counts[b] ? a : b)
  const maxCount = counts[maxType]

  if (total === threshold) {
    return {
      level: 'high',
      name: '卡线大师',
      desc: '本餐热量刚好等于警戒线',
      reward: '本餐胜局 +1'
    }
  }

  if (hasAllTypes) {
    return {
      level: 'high',
      name: '满汉大餐',
      desc: '荤 / 素 / 主食 / 甜点四类齐全',
      reward: '本餐胜局 +1'
    }
  }

  const hasDoubleCombo = pairTypes.length >= 2
  const hasBiasCombo = maxCount >= 3

  if (hasDoubleCombo && hasBiasCombo) {
    if (maxCount >= 4) {
      return {
        level: 'middle',
        name: '偏科套餐',
        desc: `${maxType}类 ≥3 张`,
        reward: '抽1张荤牌加入全日总分'
      }
    }

    return {
      level: 'middle',
      name: '双拼套餐',
      desc: '任意两个类别各 ≥2 张',
      reward: '抽1张荤牌加入全日总分'
    }
  }

  if (hasDoubleCombo) {
    return {
      level: 'middle',
      name: '双拼套餐',
      desc: '任意两个类别各 ≥2 张',
      reward: '抽1张荤牌加入全日总分'
    }
  }

  if (hasBiasCombo) {
    return {
      level: 'middle',
      name: '偏科套餐',
      desc: `${maxType}类 ≥3 张`,
      reward: '抽1张荤牌加入全日总分'
    }
  }

  return null
}

function drawRewardMeatCard(g, pid) {
  let indexes = []
  for (let i = 0; i < g.deck.length; i++) {
    if (normalizeType(g.deck[i]) === '荤') indexes.push(i)
  }

  if (indexes.length === 0) {
    g.deck = g.deck.concat(makeDeck())
    for (let i = 0; i < g.deck.length; i++) {
      if (normalizeType(g.deck[i]) === '荤') indexes.push(i)
    }
  }

  if (indexes.length === 0) return null

  const deckIndex = indexes[Math.floor(Math.random() * indexes.length)]
  const reward = g.deck.splice(deckIndex, 1)[0]
  reward.hidden = false
  reward.privateCard = false

  g.records[pid].dayBonusCards.push(reward)
  g.records[pid].dayBonusKcal += Number(reward.kcal || 0)

  return reward
}

function settlePlayerCombo(g, pid) {
  const meal = meals[g.mealIndex]
  const player = g.players[pid]
  const total = calcCardsKcal(player.cards)
  const busted = total > meal.threshold

  g.records[pid].rawMealKcal[g.mealIndex] = total
  g.records[pid].mealKcal[g.mealIndex] = busted ? 0 : total

  player.busted = busted
  player.stood = true

  if (busted) {
    g.records[pid].comboResults[g.mealIndex] = null
    return null
  }

  const combo = evaluateMealCombo(player.cards, meal.threshold)

  if (!combo) {
    g.records[pid].comboResults[g.mealIndex] = null
    return null
  }

  if (combo.level === 'high') {
    g.records[pid].comboBonusPoint[g.mealIndex] += 1
    combo.resultText = `${combo.name}：本餐胜局 +1`
  }

  if (combo.level === 'middle') {
    const rewardCard = drawRewardMeatCard(g, pid)
    combo.rewardCard = rewardCard || null

    if (rewardCard) {
      combo.resultText = `${combo.name}：奖励 ${rewardCard.name} +${rewardCard.kcal} kcal`
    } else {
      combo.resultText = `${combo.name}：没有可奖励的荤牌`
    }
  }

  g.records[pid].comboResults[g.mealIndex] = combo
  return combo
}

function getMealPoint(g, pid, mealIndex) {
  return Number(g.records[pid].basePoint[mealIndex] || 0) + Number(g.records[pid].comboBonusPoint[mealIndex] || 0)
}

function getMealTotalPoint(g, pid) {
  let point = 0
  for (let i = 0; i < meals.length; i++) point += getMealPoint(g, pid, i)
  return point
}

function getDayBaseKcal(g, pid) {
  return safeNumberArray(g.records[pid].mealKcal, meals.length).reduce((sum, kcal) => sum + kcal, 0)
}

function getDayTotalKcal(g, pid) {
  return getDayBaseKcal(g, pid) + Number(g.records[pid].dayBonusKcal || 0)
}

function getDayTotalPoint(g, pid) {
  const p1 = getDayTotalKcal(g, 'p1')
  const p2 = getDayTotalKcal(g, 'p2')

  if (p1 === p2) return 0
  if (pid === 'p1') return p1 > p2 ? 1 : 0
  return p2 > p1 ? 1 : 0
}

function getFinalPoint(g, pid) {
  return getMealTotalPoint(g, pid) + getDayTotalPoint(g, pid)
}

function settleMeal(g) {
  const meal = meals[g.mealIndex]

  safeArray(g.players.p1.cards).forEach(card => { card.hidden = false })
  safeArray(g.players.p2.cards).forEach(card => { card.hidden = false })

  const p1Total = calcCardsKcal(g.players.p1.cards)
  const p2Total = calcCardsKcal(g.players.p2.cards)
  const p1Busted = p1Total > meal.threshold
  const p2Busted = p2Total > meal.threshold

  g.players.p1.busted = p1Busted
  g.players.p2.busted = p2Busted
  g.players.p1.stood = true
  g.players.p2.stood = true

  const p1Combo = settlePlayerCombo(g, 'p1')
  const p2Combo = settlePlayerCombo(g, 'p2')

  let resultText = ''
  let winner = null

  if (p1Busted && p2Busted) {
    resultText = '双方都爆牌，本餐无人得分'
  } else if (p1Busted) {
    g.records.p2.basePoint[g.mealIndex] += 1
    winner = 'p2'
    resultText = '玩家1爆牌，玩家2赢得本餐'
  } else if (p2Busted) {
    g.records.p1.basePoint[g.mealIndex] += 1
    winner = 'p1'
    resultText = '玩家2爆牌，玩家1赢得本餐'
  } else if (p1Total > p2Total) {
    g.records.p1.basePoint[g.mealIndex] += 1
    winner = 'p1'
    resultText = '玩家1热量更高，赢得本餐'
  } else if (p2Total > p1Total) {
    g.records.p2.basePoint[g.mealIndex] += 1
    winner = 'p2'
    resultText = '玩家2热量更高，赢得本餐'
  } else {
    resultText = '双方热量相同，本餐平局'
  }

  const p1Point = getMealPoint(g, 'p1', g.mealIndex)
  const p2Point = getMealPoint(g, 'p2', g.mealIndex)

  g.lastMealResult = {
    mealIndex: g.mealIndex,
    mealName: meal.name,
    threshold: meal.threshold,
    p1Cards: clone(g.players.p1.cards),
    p2Cards: clone(g.players.p2.cards),
    p1Total,
    p2Total,
    p1Busted,
    p2Busted,
    p1Combo,
    p2Combo,
    p1Point,
    p2Point,
    winner,
    resultText,
    scoreText: `玩家1 ${getMealTotalPoint(g, 'p1')} : ${getMealTotalPoint(g, 'p2')} 玩家2`
  }

  if (!g.mealResults) g.mealResults = meals.map(() => null)
  g.mealResults[g.mealIndex] = clone(g.lastMealResult)

  g.phase = g.mealIndex >= meals.length - 1 ? 'meal_result' : 'meal_result'
  g.turn = null
  g.nextReady = { p1: false, p2: false }
  g.message = `${meal.name}结算：${resultText}`
  g.comboMessage = ''
  g.actionSeq += 1
}

// =========================
// 玩家操作
// =========================



function canPlayerAct(g, pid) {
  if (g.phase === 'opening') {
    return safeArray(g.players[pid].cards).length < 2
  }

  if (g.phase === 'meal_playing') {
    if (g.players[pid].stood) return false
    return g.turn === pid
  }

  if (g.phase === 'night_picking') {
    return getRemainingOrders(g, pid) > 0
  }

  return false
}




function getActionHint(g, selfId) {
  const oppId = otherPlayer(selfId)
  const self = g.players[selfId]
  const opp = g.players[oppId]

  if (appMode === 'online' && (!roomData || roomData.status === 'lobby' || g.phase === 'lobby')) {
    const players = roomData && roomData.players ? roomData.players : {}
    const p1Ready = Boolean(players.p1 && players.p1.ready)
    const p2Ready = Boolean(players.p2 && players.p2.ready)

    if (!players.p1 || !players.p2) return `房间码 ${roomId}：等待另一名玩家加入`
    return `准备状态：玩家1 ${p1Ready ? '已准备' : '未准备'}｜玩家2 ${p2Ready ? '已准备' : '未准备'}`
  }

  if (g.phase === 'opening') {
    const count = safeArray(self.cards).length
    const oppCount = safeArray(opp.cards).length

    if (count < 2) return `起手阶段：你可以直接抽牌，目前 ${count}/2`
    if (oppCount < 2) return '你已抽满起手牌，等待对方出牌'
    return '双方起手完成，准备进入点餐回合'
  }

  if (g.phase === 'meal_playing') {
    if (self.stood) return '你已开吃，等待对方继续点外卖或开吃'
    if (opp.stood && g.turn === selfId) return '对方已开吃，你可以继续点外卖，或选择开吃结算'

    if (g.turn === selfId) {
      if (self.busted || isBusted(g, selfId)) {
        return '已爆牌：可继续迷惑，或开吃摊牌'
      }

      return '你的回合：选外卖或开吃'
    }

    return '对方点餐中：等待对方操作'
  }

  if (g.phase === 'night_picking') {
    const remain = getRemainingOrders(g, selfId)
    const oppRemain = getRemainingOrders(g, oppId)

    if (remain > 0) return `夜宵阶段：还要选择 ${remain} 单`
    if (oppRemain > 0) return '你已选完夜宵，等待对方选完'
    return '双方夜宵已选完，点击展示夜宵'
  }

  if (g.phase === 'night_ready') {
    return '双方夜宵已选完，点击展示夜宵'
  }

  if (g.phase === 'meal_result') {
    const next = g.mealIndex >= 3 ? '今日结算' : `进入${meals[g.mealIndex + 1].name}`
    return `本餐结算完成，点击${next}`
  }

  if (g.phase === 'day_result') return '今日结算完成'

  return g.message || ''
}



function applyDraw(g, pid, type) {
  if (!canPlayerAct(g, pid)) return

  if (g.phase === 'opening') {
    const card = drawFromDeck(g, type)
    if (!card) return

    card.hidden = false
    card.privateCard = safeArray(g.players[pid].cards).length === 0
    g.players[pid].cards.push(card)

    if (isBusted(g, pid)) {
      // 只有自己界面会通过自己的总热量知道爆牌；
      // 不在共享 message 里暴露给对方。
      g.players[pid].busted = true
    }

    g.message = `${getPlayerName(pid)}抽了一张起手牌`

    enterMealPlayingIfReady(g)
    g.actionSeq += 1
    return
  }

  if (g.phase === 'meal_playing') {
    const card = drawFromDeck(g, type)
    if (!card) return

    card.hidden = false
    card.privateCard = false
    g.players[pid].cards.push(card)
    g.players[pid].ordersUsed += 1
    g.records[pid].dayOrdersUsed += 1

    if (isBusted(g, pid)) {
      // v2.4：爆牌只记录在状态里，不自动结束，也不广播给对方。
      g.players[pid].busted = true
    }

    g.message = `${getPlayerName(pid)}点了一单${type}外卖`

    // 只有双方都主动开吃，才进入本餐结算。
    if (g.players.p1.stood && g.players.p2.stood) {
      settleMeal(g)
    } else {
      const other = otherPlayer(pid)
      g.turn = g.players[other].stood ? pid : other
      g.message += `，${getPlayerName(g.turn)}点餐回合`
    }

    g.actionSeq += 1
    return
  }

  if (g.phase === 'night_picking') {
    if (getRemainingOrders(g, pid) <= 0) return

    g.players[pid].nightChoices.push(type)
    g.records[pid].dayOrdersUsed += 1

    const remain = getRemainingOrders(g, pid)
    g.message = `${getPlayerName(pid)}选择了一单夜宵；剩余 ${remain} 单`

    if (getRemainingOrders(g, 'p1') <= 0 && getRemainingOrders(g, 'p2') <= 0) {
      g.phase = 'night_ready'
      g.turn = null
      g.message = '双方夜宵已选完，点击展示夜宵'
    }

    g.actionSeq += 1
  }
}


function applyStand(g, pid) {
  if (g.phase === 'opening') {
    g.message = '起手阶段请先抽满2张起手牌'
    return
  }

  if (g.phase === 'meal_playing') {
    if (g.players[pid].stood) return

    if (safeArray(g.players[pid].cards).length < 2) {
      g.message = `${getPlayerName(pid)}还没抽满起手牌`
      return
    }

    if (isBusted(g, pid)) {
      g.players[pid].busted = true
    }

    g.players[pid].stood = true
    g.message = `${getPlayerName(pid)}选择收手`

    if (g.players.p1.stood && g.players.p2.stood) {
      settleMeal(g)
    } else {
      const other = otherPlayer(pid)
      if (!g.players[other].stood) g.turn = other
    }

    g.actionSeq += 1
    return
  }

  if (g.phase === 'night_picking') {
    g.message = getRemainingOrders(g, pid) > 0
      ? `请先选完夜宵搭配，还剩 ${getRemainingOrders(g, pid)} 单`
      : '你已选完夜宵，等待对方'
    g.actionSeq += 1
  }
}

function revealNightAndSettle(g) {
  ;['p1', 'p2'].forEach(pid => {
    const player = g.players[pid]
    safeArray(player.nightChoices).forEach(type => {
      const card = drawFromDeck(g, type)
      if (card) {
        card.hidden = false
        card.privateCard = false
        player.cards.push(card)
      }
    })
    player.nightChoices = []
    player.stood = true
  })

  settleMeal(g)
}


function applyNext(g, pid) {
  if (g.phase === 'meal_result') {
    if (appMode === 'online') {
      if (!g.nextReady) g.nextReady = { p1: false, p2: false }

      g.nextReady[pid] = true

      if (g.nextReady.p1 && g.nextReady.p2) {
        enterNextMeal(g)
      } else {
        const nextName = g.mealIndex >= meals.length - 1 ? '今日结算' : meals[g.mealIndex + 1].name
        g.message = `${getPlayerName(pid)}已确认，等待对方进入${nextName}`
      }

      g.actionSeq += 1
      return
    }

    enterNextMeal(g)
    g.actionSeq += 1
    return
  }

  if (g.phase === 'day_result') {
    // 今日结算页不自动重开，由 replayReady 控制
  }
}

function createReplayGameFrom(g) {
  const fresh = createGame(appMode === 'online' ? 'online' : 'single')
  fresh.phase = 'opening'
  fresh.message = '新一局开始：早餐起手阶段，双方可以同时抽2张'
  fresh.actionSeq = Number(g.actionSeq || 0) + 1
  fresh.nextReady = { p1: false, p2: false }
  fresh.replayReady = { p1: false, p2: false }
  return fresh
}

function applyReplayReady(pid) {
  if (appMode !== 'online') {
    leaveToHome()
    return
  }

  if (!game.replayReady) game.replayReady = { p1: false, p2: false }

  game.replayReady[pid] = true

  if (game.replayReady.p1 && game.replayReady.p2) {
    game = createReplayGameFrom(game)
    // v2.4：下一整局直接进入起手阶段，不再弹出“双方已准备”覆盖层。
  } else {
    game.message = `${getPlayerName(pid)}已准备下一局，等待对方准备`
    game.actionSeq += 1
  }
}


// =========================
// 单机 AI
// =========================

function aiOpeningIfNeeded(g) {
  while (g.phase === 'opening' && safeArray(g.players.p2.cards).length < 2) {
    const types = ['荤', '素', '主食', '甜点']
    applyDraw(g, 'p2', types[Math.floor(Math.random() * types.length)])
  }
}

function aiTakeTurn(g) {
  if (appMode !== 'single') return
  if (g.phase !== 'meal_playing') return
  if (g.turn !== 'p2') return
  if (isEnded(g, 'p2')) return

  const meal = meals[g.mealIndex]
  const p2Total = calcCardsKcal(g.players.p2.cards)
  const p1Total = calcCardsKcal(g.players.p1.cards)

  if (p2Total < meal.threshold * 0.48) {
    applyDraw(g, 'p2', ['荤', '素', '主食', '甜点'][Math.floor(Math.random() * 4)])
  } else if (!g.players.p1.busted && !g.players.p1.stood && p2Total < p1Total - 50 && p2Total < meal.threshold - 80) {
    applyDraw(g, 'p2', ['荤', '素', '主食', '甜点'][Math.floor(Math.random() * 4)])
  } else if (Math.random() < 0.35 && p2Total < meal.threshold * 0.72) {
    applyDraw(g, 'p2', ['荤', '素', '主食', '甜点'][Math.floor(Math.random() * 4)])
  } else {
    applyStand(g, 'p2')
  }
}

function singleAfterPlayerAction() {
  if (appMode !== 'single') return

  if (game.phase === 'opening') {
    aiOpeningIfNeeded(game)
  }

  let guard = 0
  while (game.phase === 'meal_playing' && game.turn === 'p2' && guard < 12) {
    aiTakeTurn(game)
    guard += 1
  }

  if (game.phase === 'night_picking') {
    while (getRemainingOrders(game, 'p2') > 0) {
      const types = ['荤', '素', '主食', '甜点']
      applyDraw(game, 'p2', types[Math.floor(Math.random() * 4)])
    }
  }
}

// =========================
// 联机同步
// =========================



function getOnlineStatusByGame(g) {
  if (g.phase === 'day_result') return 'finished'
  if (g.phase === 'lobby') return 'lobby'
  return 'playing'
}

function isGlobalActionAfterLocal(actionId, localGame) {
  // 这些动作会改变整局公共状态，可以整包写入。
  if (actionId === 'reveal_night') return true
  if ((actionId === 'draw_meat' || actionId === 'draw_veg' || actionId === 'draw_staple' || actionId === 'draw_dessert' || actionId === 'stand') && localGame.phase === 'meal_result') return true
  if (actionId === 'next' && localGame.phase !== 'meal_result') return true
  if (actionId === 'replay_ready' && localGame.phase === 'opening') return true
  return false
}

function buildOwnPatch(localGame, pid, actionSeq) {
  const patch = {}

  patch[`game/players/${pid}`] = normalizePlayerState(localGame.players[pid])
  patch[`game/records/${pid}`] = normalizeRecord(localGame.records[pid])

  // deck 可以更新，但就算两边同时写 deck，也不会覆盖玩家手牌。
  patch['game/deck'] = safeArray(localGame.deck)

  patch['game/phase'] = localGame.phase
  patch['game/mealIndex'] = localGame.mealIndex
  patch['game/turn'] = localGame.turn || null
  patch['game/firstTurnPlayer'] = localGame.firstTurnPlayer || null
  patch['game/message'] = localGame.message || ''
  patch['game/comboMessage'] = localGame.comboMessage || ''
  patch['game/actionSeq'] = actionSeq

  if (localGame.nextReady) {
    patch[`game/nextReady/${pid}`] = Boolean(localGame.nextReady[pid])
  }

  if (localGame.replayReady) {
    patch[`game/replayReady/${pid}`] = Boolean(localGame.replayReady[pid])
  }

  return patch
}

function runPostSyncTransitions(g) {
  const before = JSON.stringify({
    phase: g.phase,
    mealIndex: g.mealIndex,
    turn: g.turn,
    p1Cards: safeArray(g.players.p1.cards).length,
    p2Cards: safeArray(g.players.p2.cards).length,
    p1Stood: g.players.p1.stood,
    p2Stood: g.players.p2.stood,
    p1Night: safeArray(g.players.p1.nightChoices).length,
    p2Night: safeArray(g.players.p2.nightChoices).length,
    nextReady: g.nextReady,
    replayReady: g.replayReady
  })

  if (g.phase === 'opening') {
    enterMealPlayingIfReady(g)
  } else if (g.phase === 'meal_playing') {
    // v2.7：只有双方都主动开吃后，才进入结算。
    if (g.players.p1.stood && g.players.p2.stood) {
      settleMeal(g)
    }
  } else if (g.phase === 'night_picking') {
    if (getRemainingOrders(g, 'p1') <= 0 && getRemainingOrders(g, 'p2') <= 0) {
      g.phase = 'night_ready'
      g.turn = null
      g.message = '双方夜宵已选完，点击展示夜宵'
    }
  } else if (g.phase === 'meal_result') {
    if (g.nextReady && g.nextReady.p1 && g.nextReady.p2) {
      enterNextMeal(g)
    }
  } else if (g.phase === 'day_result') {
    if (g.replayReady && g.replayReady.p1 && g.replayReady.p2) {
      const fresh = createReplayGameFrom(g)
      Object.keys(fresh).forEach(key => {
        g[key] = fresh[key]
      })
    }
  }

  const after = JSON.stringify({
    phase: g.phase,
    mealIndex: g.mealIndex,
    turn: g.turn,
    p1Cards: safeArray(g.players.p1.cards).length,
    p2Cards: safeArray(g.players.p2.cards).length,
    p1Stood: g.players.p1.stood,
    p2Stood: g.players.p2.stood,
    p1Night: safeArray(g.players.p1.nightChoices).length,
    p2Night: safeArray(g.players.p2.nightChoices).length,
    nextReady: g.nextReady,
    replayReady: g.replayReady
  })

  return before !== after
}

async function writeFullOnlineGame(nextGame) {
  nextGame = normalizeGame(nextGame)
  nextGame.actionSeq = Date.now()

  game = nextGame
  localGameActionSeq = nextGame.actionSeq
  pendingWriteUntil = Date.now() + 900
  requestRender()

  await window.LiluOnline.updateRoom(roomId, {
    game: nextGame,
    status: getOnlineStatusByGame(nextGame)
  })
}


async function saveOnlineGame() {
  if (appMode !== 'online' || !roomId) return

  const actionId = pendingActionId || ''
  pendingActionId = ''

  let local = normalizeGame(game)
  const seq = Date.now()
  local.actionSeq = seq

  game = local
  localGameActionSeq = seq
  pendingWriteUntil = Date.now() + 900
  requestRender()

  // 结算、展示夜宵、进入下一餐这类“公共状态”动作，整包写入。
  if (isGlobalActionAfterLocal(actionId, local)) {
    await writeFullOnlineGame(local)
    return
  }

  // 普通动作只写“自己的玩家状态”和必要共享字段，避免双方同时抽牌时互相覆盖。
  await window.LiluOnline.updateRoom(roomId, buildOwnPatch(local, myPlayerId, seq))

  // 写完后立刻读取一次最新房间，把双方状态合并，再判断是否可以自动推进阶段。
  try {
    const latestRoom = await window.LiluOnline.getRoom(roomId)

    if (!latestRoom || !latestRoom.game) return

    roomData = latestRoom
    let merged = normalizeGame(latestRoom.game)

    const changed = runPostSyncTransitions(merged)

    if (changed) {
      await writeFullOnlineGame(merged)
    } else {
      game = merged
      localGameActionSeq = Math.max(localGameActionSeq, Number(merged.actionSeq || 0))
      requestRender()
    }
  } catch (err) {
    message = `同步失败：${err.message || err}`
    requestRender()
  }
}

async function createOnlineRoom() {
  try {
    if (!window.LiluOnline) {
      message = '联机模块没有加载成功，请刷新页面'
      render()
      return
    }

    const initialGame = createGame('online')
    initialGame.phase = 'lobby'
    initialGame.message = '等待玩家2加入并准备'

    const result = await window.LiluOnline.createRoom(initialGame)

    appMode = 'online'
    roomId = result.roomId
    myPlayerId = result.playerId
    localReadyLocked = false
    startRequested = false
    startOverlayText = ''
    startOverlayUntil = 0
    localGameActionSeq = 0
    pendingWriteUntil = 0
    pendingActionId = ''
    game = normalizeGame(initialGame)
    message = `房间创建成功：${roomId}`

    if (unsubscribeRoom) unsubscribeRoom()

    unsubscribeRoom = window.LiluOnline.listenRoom(roomId, data => {
      roomData = data

      if (data && data.game) {
        const incomingGame = normalizeGame(data.game)
        const incomingSeq = Number(incomingGame.actionSeq || 0)

        // 本机刚点击后的极短时间内，如果轮询拿到旧快照，不要盖回去。
        // 超过 pendingWriteUntil 后，无论如何接受数据库状态，避免因为时间戳差异卡死。
        if (Date.now() > pendingWriteUntil || incomingSeq >= localGameActionSeq) {
          game = incomingGame
          localGameActionSeq = Math.max(localGameActionSeq, incomingSeq)
        }
      }

      if (data && data.status === 'playing') {
        startRequested = false
      }

      if (data && data.players && data.players[myPlayerId] && data.players[myPlayerId].ready) {
        localReadyLocked = true
      }

      if (areBothPlayersReady() && (game.phase === 'lobby' || (data && data.status === 'lobby'))) {
        showStartOverlay('双方已准备，正在开局...', 1400)
        maybeStartOnlineGame()
      }

      render()
    })

    render()
  } catch (err) {
    message = `创建房间失败：${err.message || err}`
    render()
  }
}

async function joinOnlineRoom() {
  try {
    if (!window.LiluOnline) {
      message = '联机模块没有加载成功，请刷新页面'
      render()
      return
    }

    const code = window.prompt('请输入房间码')
    if (!code) return

    const result = await window.LiluOnline.joinRoom(code)

    appMode = 'online'
    roomId = result.roomId
    myPlayerId = result.playerId
    localReadyLocked = false
    startRequested = false
    startOverlayText = ''
    startOverlayUntil = 0
    localGameActionSeq = 0
    pendingWriteUntil = 0
    pendingActionId = ''

    if (unsubscribeRoom) unsubscribeRoom()

    unsubscribeRoom = window.LiluOnline.listenRoom(roomId, data => {
      roomData = data

      if (data && data.game) {
        const incomingGame = normalizeGame(data.game)
        const incomingSeq = Number(incomingGame.actionSeq || 0)

        // 本机刚点击后的极短时间内，如果轮询拿到旧快照，不要盖回去。
        // 超过 pendingWriteUntil 后，无论如何接受数据库状态，避免因为时间戳差异卡死。
        if (Date.now() > pendingWriteUntil || incomingSeq >= localGameActionSeq) {
          game = incomingGame
          localGameActionSeq = Math.max(localGameActionSeq, incomingSeq)
        }
      }

      if (data && data.status === 'playing') {
        startRequested = false
      }

      if (data && data.players && data.players[myPlayerId] && data.players[myPlayerId].ready) {
        localReadyLocked = true
      }

      if (areBothPlayersReady() && (game.phase === 'lobby' || (data && data.status === 'lobby'))) {
        showStartOverlay('双方已准备，正在开局...', 1400)
        maybeStartOnlineGame()
      }

      render()
    })

    message = `已加入房间：${roomId}`
    render()
  } catch (err) {
    message = `加入房间失败：${err.message || err}`
    render()
  }
}

async function playerReady() {
  if (appMode !== 'online' || !roomId || !myPlayerId) return
  if (isReadyLockedForMe()) return

  localReadyLocked = true
  showStartOverlay('你已准备，等待对方准备...', 900)
  render()

  await window.LiluOnline.updateRoom(roomId, {
    [`players/${myPlayerId}/ready`]: true,
    'game/message': `${getPlayerName(myPlayerId)}已准备`
  })

  const latest = await window.LiluOnline.getRoom(roomId)
  roomData = latest

  if (latest && latest.game) {
    game = normalizeGame(latest.game)
  }

  render()
  await maybeStartOnlineGame()
}

async function maybeStartOnlineGame() {
  if (appMode !== 'online' || !roomId || !roomData) return
  if (!areBothPlayersReady()) return

  const status = roomData.status || ''
  const phase = game.phase || ''

  // 已经开始就不重复开局
  if (status === 'playing' || phase !== 'lobby') return

  // 两边可能几乎同时检测到“双方已准备”，用本地锁避免重复点火。
  if (startRequested) return

  startRequested = true
  showStartOverlay('双方已准备，正在开局...', 1400)
  render()

  try {
    const latest = await window.LiluOnline.getRoom(roomId)
    if (!latest) throw new Error('房间不存在')

    roomData = latest

    const players = latest.players || {}
    const bothReady = Boolean(players.p1 && players.p2 && players.p1.ready && players.p2.ready)

    if (!bothReady) {
      startRequested = false
      render()
      return
    }

    const latestGame = normalizeGame(latest.game)

    // 如果另一边已经开局了，直接跟随，不重复覆盖
    if (latest.status === 'playing' || latestGame.phase !== 'lobby') {
      game = latestGame
      render()
      return
    }

    latestGame.phase = 'opening'
    latestGame.message = '双方已准备：早餐起手阶段，双方各抽2张'
    latestGame.mealIndex = 0
    latestGame.turn = null
    latestGame.actionSeq = Number(latestGame.actionSeq || 0) + 1
    resetMealState(latestGame)
    localGameActionSeq = latestGame.actionSeq

    await window.LiluOnline.updateRoom(roomId, {
      status: 'playing',
      game: latestGame
    })
  } catch (err) {
    startRequested = false
    message = `开局失败：${err.message || err}`
    render()
  }
}

function leaveToHome() {
  if (unsubscribeRoom) {
    unsubscribeRoom()
    unsubscribeRoom = null
  }

  appMode = 'home'
  roomId = ''
  myPlayerId = 'p1'
  roomData = null
  localReadyLocked = false
  startRequested = false
  startOverlayText = ''
  startOverlayUntil = 0
  localGameActionSeq = 0
  pendingWriteUntil = 0
  pendingActionId = ''
  game = createGame('single')
  message = ''
  render()
}

// =========================
// 渲染节流与图片预加载
// =========================

let renderScheduled = false
resizeRenderReady = true

function requestRender() {
  if (renderScheduled) return
  renderScheduled = true

  const runner = () => {
    renderScheduled = false
    render()
  }

  if (typeof window !== 'undefined' && window.requestAnimationFrame) {
    window.requestAnimationFrame(runner)
  } else {
    setTimeout(runner, 16)
  }
}







function retryFailedImages() {
  Object.keys(imageFailedUntil).forEach(key => {
    delete imageFailedUntil[key]
  })
  scheduleImageRender()
}







function preloadGameImages() {
  const backs = Object.keys(CARD_BACK_PATHS).map(key => CARD_BACK_PATHS[key])
  const fronts = Object.keys(CARD_IMAGE_PATHS).map(key => CARD_IMAGE_PATHS[key])

  // 卡背优先，保证底牌/隐藏牌先有图。
  backs.forEach(src => getImage(src, true))

  // 正面卡图后台预热，不阻塞游戏流程。
  // 保守分批，避免刚进入时和 UI 绘制抢主线程。
  let index = 0

  function step() {
    const batchSize = 2

    for (let i = 0; i < batchSize && index < fronts.length; i++) {
      getImage(fronts[index], false)
      index += 1
    }

    if (index < fronts.length) {
      setTimeout(step, 160)
    }
  }

  setTimeout(step, 240)
}


let imageRenderTimer = null

function scheduleImageRender() {
  if (imageRenderTimer) return

  imageRenderTimer = setTimeout(() => {
    imageRenderTimer = null
    requestRender()
  }, 90)
}

// =========================
// 餐段背景与小卡绘制
// =========================

function getMealTheme(index) {
  const i = Number(index || 0)
  if (i === 0) {
    return {
      bg: '#FFF5C7',
      panel: '#FFFDF0',
      opponentPanel: '#F4EED7',
      center: '#FFF2C5',
      accent: '#FFE169',
      text: '#111'
    }
  }

  if (i === 1) {
    return {
      bg: '#FFD85E',
      panel: '#FFF7D7',
      opponentPanel: '#F1D890',
      center: '#FFE98A',
      accent: '#FFB53D',
      text: '#111'
    }
  }

  if (i === 2) {
    return {
      bg: '#17294C',
      panel: '#F6F8FF',
      opponentPanel: '#DCE5FF',
      center: '#EAF0FF',
      accent: '#4E77C8',
      text: '#111'
    }
  }

  return {
    bg: '#101010',
    panel: '#F7F1E8',
    opponentPanel: '#D8D0C4',
    center: '#EFE6DA',
    accent: '#111',
    text: '#111'
  }
}

function getPageBg() {
  if (appMode === 'home' || !game) return '#F7F1E8'
  return getMealTheme(game.mealIndex).bg
}

function getMealCardsFromResult(result, pid) {
  if (!result) return []
  return pid === 'p1' ? safeArray(result.p1Cards) : safeArray(result.p2Cards)
}

function drawTinyCards(cards, x, y, areaW, areaH, maxSize) {
  const list = safeArray(cards)
  if (list.length === 0) {
    drawText(t('noFood'), x, y + 8, 12, '#777', 'left', 'bold')
    return
  }

  const gap = 3
  let cardW = maxSize || 38
  const perRow = Math.max(3, Math.floor((areaW + gap) / (cardW + gap)))

  const rows = Math.ceil(list.length / perRow)
  const maxH = Math.floor((areaH - gap * Math.max(0, rows - 1)) / rows)

  let cardH = Math.min(Math.round(cardW * 1121 / 671), Math.max(34, maxH))
  cardW = Math.round(cardH * 671 / 1121)

  for (let i = 0; i < list.length; i++) {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    const yy = y + row * (cardH + gap)
    if (yy + cardH > y + areaH) break
    const card = { ...list[i], hidden: false }
    drawCard(card, x + col * (cardW + gap), yy, cardW, cardH)
  }
}

function drawCompactMealCards(title, cards, total, busted, x, y, w, h) {
  drawRoundRect(x, y, w, h, 16, '#FFFFFF', '#111', 2.2)
  drawText(title, x + 12, y + 10, 15, '#111', 'left', 'bold')
  drawText(`${total} kcal${busted ? ' 爆' : ''}`, x + w - 12, y + 11, 13, busted ? '#E94335' : '#111', 'right', 'bold')
  drawTinyCards(cards, x + 12, y + 34, w - 24, h - 42, 34)
}


// =========================
// 绘图工具
// =========================

function drawRoundRect(x, y, w, h, r, fillStyle, strokeStyle, lineWidth) {
  const radius = Math.min(r, w / 2, h / 2)

  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()

  if (fillStyle) {
    ctx.fillStyle = fillStyle
    ctx.fill()
  }

  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle
    ctx.lineWidth = lineWidth || 2
    ctx.stroke()
  }
}

function drawText(text, x, y, size, color, align, weight) {
  ctx.fillStyle = color || '#111'
  ctx.font = `${weight || 'normal'} ${size}px sans-serif`
  ctx.textAlign = align || 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(String(text), x, y)
}

function wrapText(text, x, y, maxWidth, lineHeight, size, color, weight, maxLines) {
  ctx.font = `${weight || 'normal'} ${size}px sans-serif`
  ctx.fillStyle = color || '#111'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  let line = ''
  let yy = y
  let lines = 0
  const chars = String(text || '').split('')

  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i]
    if (ctx.measureText(testLine).width > maxWidth && i > 0) {
      ctx.fillText(line, x, yy)
      lines += 1
      if (maxLines && lines >= maxLines) return yy + lineHeight
      line = chars[i]
      yy += lineHeight
    } else {
      line = testLine
    }
  }

  ctx.fillText(line, x, yy)
  return yy + lineHeight
}


function addButton(id, text, x, y, w, h, fill, color, fontSize) {
  buttons.push({ id, x, y, w, h })

  const now = Date.now()
  const pulseStart = buttonPulse[id] || 0
  const elapsed = now - pulseStart
  let scale = 1

  if (elapsed >= 0 && elapsed < BUTTON_PULSE_MS) {
    const t = elapsed / BUTTON_PULSE_MS
    scale = 1 + 0.055 * Math.sin(Math.PI * t)
  }

  const cx = x + w / 2
  const cy = y + h / 2
  const sx = cx - (w * scale) / 2
  const sy = cy - (h * scale) / 2
  const sw = w * scale
  const sh = h * scale

  drawRoundRect(sx + 4, sy + 5, sw, sh, 14, '#111', null, 0)
  drawRoundRect(sx, sy, sw, sh, 14, fill || '#111', '#111', 2.5)
  drawText(text, cx, cy - (fontSize || 18) / 2, fontSize || 18, color || '#fff', 'center', 'bold')
}

function hitButton(x, y) {
  for (let i = buttons.length - 1; i >= 0; i--) {
    const b = buttons[i]
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id
  }
  return null
}

// 图片懒加载
const imageCache = {}
const imageFailedUntil = {}
const IMAGE_RETRY_DELAY = 900









function getImage(src, priority) {
  if (!src) return null

  const cached = imageCache[src]

  // 只缓存“已加载成功”或“正在加载中”的图片。
  // 失败图片不永久缓存，避免某些 iPhone 一次失败后永远显示不出来。
  if (cached && (cached.loaded || cached.loading)) return cached

  const now = Date.now()
  if (imageFailedUntil[src] && now < imageFailedUntil[src]) {
    return null
  }

  const img = new Image()
  img.loaded = false
  img.loading = true
  img.failed = false
  img.decoding = 'async'
  img.loading = 'eager'

  img.onload = () => {
    img.loaded = true
    img.loading = false
    img.failed = false
    delete imageFailedUntil[src]
    scheduleImageRender()
  }

  img.onerror = () => {
    img.loaded = false
    img.loading = false
    img.failed = true

    // 失败后立即从缓存删除，只短暂冷却，之后当前画面需要它时会重新请求。
    delete imageCache[src]
    imageFailedUntil[src] = Date.now() + IMAGE_RETRY_DELAY

    setTimeout(() => {
      if (imageFailedUntil[src] && Date.now() >= imageFailedUntil[src]) {
        delete imageFailedUntil[src]
        scheduleImageRender()
      }
    }, IMAGE_RETRY_DELAY + 80)

    scheduleImageRender()
  }

  // 保持最稳定的原始路径，不加 ?v，不 decode，不等待 loading。
  img.src = src

  imageCache[src] = img
  return img
}




function drawCard(card, x, y, w, h) {
  const type = normalizeType(card)
  const src = card.hidden ? (CARD_BACK_PATHS[type] || CARD_BACK_PATHS['荤']) : CARD_IMAGE_PATHS[card.name]
  const img = getImage(src, true)

  if (img && img.loaded) {
    const radius = 9
    ctx.save()

    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + w - radius, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
    ctx.lineTo(x + w, y + h - radius)
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
    ctx.lineTo(x + radius, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
    ctx.clip()

    const imageRatio = 671 / 1121
    const boxRatio = w / h
    let drawW = w
    let drawH = h

    if (boxRatio > imageRatio) {
      drawW = w
      drawH = w / imageRatio
    } else {
      drawH = h
      drawW = h * imageRatio
    }

    drawW *= card.hidden ? 1.06 : 1.08
    drawH *= card.hidden ? 1.06 : 1.08

    ctx.drawImage(img, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH)
    ctx.restore()

    if (!card.hidden) drawRoundRect(x, y, w, h, radius, null, '#111', 2)
    return
  }

  // 图片未就绪时，只做轻量占位，不影响玩法。
  drawRoundRect(x, y, w, h, 10, TYPE_COLORS[type] || '#fff', '#111', 2)
  drawText(card.hidden ? '背面' : String(card.name || '').slice(0, 4), x + w / 2, y + h / 2 - 12, Math.max(9, Math.min(12, w / 4)), '#111', 'center', 'bold')
  if (!card.hidden) drawText(`${card.kcal}kcal`, x + w / 2, y + h / 2 + 6, Math.max(8, Math.min(11, w / 5)), '#111', 'center', 'bold')
}


function drawCards(cards, x, y, areaW, areaH) {
  const list = safeArray(cards)
  if (list.length === 0) return

  const gap = 4
  let cardW = 64
  if (list.length > 4) cardW = 54
  if (list.length > 6) cardW = 47
  if (list.length > 8) cardW = 42
  if (list.length > 10) cardW = 38

  const perRow = Math.max(3, Math.floor((areaW + gap) / (cardW + gap)))
  const rows = Math.ceil(list.length / perRow)
  const maxH = Math.floor((areaH - gap * (rows - 1)) / rows)
  const cardH = Math.min(Math.round(cardW * 1121 / 671), maxH)
  cardW = Math.round(cardH * 671 / 1121)

  for (let i = 0; i < list.length; i++) {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    drawCard(list[i], x + col * (cardW + gap), y + row * (cardH + gap), cardW, cardH)
  }
}

// =========================
// 画面
// =========================



function drawHome() {
  const panelX = 24
  const panelY = SAFE_TOP + 26
  const panelW = W - 48
  const bottomButtonsH = 172
  const panelH = Math.max(360, H - panelY - bottomButtonsH - SAFE_BOTTOM - 18)

  drawRoundRect(-40, H - 220, 160, 160, 36, '#A9F0D1', null, 0)
  drawRoundRect(W - 92, SAFE_TOP + 90, 130, 130, 32, '#FF9BB4', null, 0)
  drawRoundRect(panelX, panelY, panelW, panelH, 28, '#FFFFFF', '#111', 4)

  if (!rulesExpanded) {
    drawText(t('homeTitle'), W / 2, panelY + 28, lang === 'en' ? 43 : 48, '#111', 'center', 'bold')
    drawText('LILU CARDS', W / 2, panelY + 90, 16, '#555', 'center', 'bold')
    drawRoundRect(W / 2 - 104, panelY + 126, 208, 40, 18, '#111', null, 0)
    drawText(t('homeSub'), W / 2, panelY + 136, lang === 'en' ? 14 : 17, '#FFE169', 'center', 'bold')
    drawText(t('slogan'), W / 2, panelY + 212, lang === 'en' ? 23 : 28, '#111', 'center', 'bold')
    drawText(t('modes'), W / 2, panelY + 254, 15, '#555', 'center', 'bold')
    const ruleBtnW = Math.min(panelW - 64, 220)
    addButton('rules_toggle', t('rulesBtn'), W / 2 - ruleBtnW / 2, panelY + panelH - 64, ruleBtnW, 42, '#FFFFFF', '#111', 16)
  } else {
    drawText(t('rulesTitle'), panelX + 24, panelY + 20, 28, '#111', 'left', 'bold')
    addButton('rules_toggle', t('closeRules'), panelX + panelW - 92, panelY + 18, 68, 34, '#111', '#fff', 14)
    const viewX = panelX + 24
    const viewY = panelY + 66
    const viewW = panelW - 48
    const viewH = panelH - 88
    const lines = t('ruleLines')

    ctx.save()
    ctx.beginPath()
    ctx.rect(viewX, viewY, viewW, viewH)
    ctx.clip()
    let yy = viewY - rulesScroll
    const startY = yy
    lines.forEach(line => {
      yy = wrapText(line, viewX, yy, viewW, 18, 12, '#333', 'bold', 4)
      yy += 8
    })
    const contentH = yy - startY
    rulesMaxScroll = Math.max(0, contentH - viewH + 18)
    rulesScroll = Math.max(0, Math.min(rulesScroll, rulesMaxScroll))
    ctx.restore()

    if (rulesMaxScroll > 0) {
      const barH = Math.max(28, viewH * viewH / (contentH || viewH))
      const barY = viewY + (viewH - barH) * (rulesScroll / rulesMaxScroll)
      drawRoundRect(viewX + viewW + 6, barY, 4, barH, 3, '#111', null, 0)
      drawText(lang === 'en' ? 'Swipe' : '上下滑动', W / 2, panelY + panelH - 18, 10, '#777', 'center', 'bold')
    }
  }

  const bottomY = H - SAFE_BOTTOM - 154
  addButton('single_start', t('single'), 32, bottomY, W - 64, 54, '#111', '#fff', 22)
  const gap = 12
  const halfW = (W - 64 - gap) / 2
  addButton('online_create', t('createRoom'), 32, bottomY + 68, halfW, 54, '#FFE169', '#111', lang === 'en' ? 16 : 20)
  addButton('online_join', t('joinRoom'), 32 + halfW + gap, bottomY + 68, halfW, 54, '#9EDBFF', '#111', lang === 'en' ? 16 : 20)
  if (message) wrapText(message, 32, H - SAFE_BOTTOM - 24, W - 64, 14, 11, '#E94335', 'bold', 1)
}





function drawHomeMiniButton() {
  if (appMode === 'home') return
  const y = Math.max(3, SAFE_TOP - 11)
  addButton('home', t('home'), W - (lang === 'en' ? 54 : 46), y, lang === 'en' ? 46 : 38, 22, '#FFFFFF', '#111', 9)
}

function drawTopBadge() {
  if (appMode !== 'online') return
  const text = roomId ? `房间 ${roomId}｜你是${getPlayerName(myPlayerId)}` : '联机模式'
  const w = Math.min(W - 32, 240)
  drawRoundRect(W / 2 - w / 2, SAFE_TOP, w, 26, 13, '#111', null, 0)
  drawText(text, W / 2, SAFE_TOP + 6, 11, '#fff', 'center', 'bold')
}

function getDisplayPlayerIds() {
  const self = getSelfId()
  return {
    self,
    opponent: otherPlayer(self)
  }
}




function drawPlayerPanel(pid, label, x, y, w, h, isOpponent) {
  const player = game.players[pid]
  const meal = getMeal()

  const inResultPhase = game.phase === 'meal_result' || game.phase === 'day_result'
  const hiddenForOpponent = isOpponent && !inResultPhase

  const displayCards = safeArray(player.cards).map((card, index) => {
    const next = { ...card }

    // v2.5：对方只有第一张底牌隐藏，后续外卖牌都明牌。
    // 自己的底牌自己可见；结算页全部公开。
    if (hiddenForOpponent && next.privateCard) {
      next.hidden = true
    } else if (!inResultPhase) {
      next.hidden = false
    }

    return next
  })

  const total = calcCardsKcal(player.cards)
  const visibleTotal = hiddenForOpponent ? getVisibleKcal(displayCards) : total

  const theme = getMealTheme(game.mealIndex)
  const bg = isOpponent ? theme.opponentPanel : theme.panel

  let status = '观察中'

  if (hiddenForOpponent) {
    // 结算前仍然不暴露对方是否爆牌。
    status = player.stood
      ? '已收手'
      : game.phase === 'meal_playing' && game.turn === pid
        ? '点餐中'
        : game.phase === 'opening'
          ? '起手中'
          : '观察中'
  } else {
    status = player.busted || isBusted(game, pid)
      ? '爆牌'
      : player.stood
        ? '已收手'
        : game.phase === 'meal_playing' && game.turn === pid
          ? '点餐中'
          : game.phase === 'opening'
            ? '起手中'
            : '观察中'
  }

  drawRoundRect(x, y, w, h, 22, bg, '#111', 3)

  drawText(label, x + 16, y + 12, H < 720 ? 21 : 24, '#111', 'left', 'bold')
  drawText(status, x + 72, y + 18, H < 720 ? 12 : 14, status === '爆牌' ? '#E94335' : '#111', 'left', 'bold')

  const kcalText = hiddenForOpponent
    ? `? + ${visibleTotal} kcal`
    : `${total}/${meal.threshold} kcal`

  drawText(kcalText, x + w - 16, y + 15, H < 720 ? 13 : 16, status === '爆牌' ? '#E94335' : '#111', 'right', 'bold')
  drawText(`外卖 ${game.records[pid].dayOrdersUsed}/${TOTAL_ORDERS_PER_DAY}`, x + 16, y + 44, H < 720 ? 11 : 13, '#666', 'left', 'bold')

  const dayText = hiddenForOpponent
    ? `已结算热量 ${getDayTotalKcal(game, pid)}`
    : `全日总热量 ${getDayTotalKcal(game, pid) + (inResultPhase ? 0 : total)}`

  drawText(dayText, x + 108, y + 44, H < 720 ? 11 : 13, '#111', 'left', 'bold')

  let cardsToDraw = displayCards

  if ((game.phase === 'night_picking' || game.phase === 'night_ready') && safeArray(player.nightChoices).length > 0) {
    cardsToDraw = safeArray(player.nightChoices).map((type, index) => ({
      id: `night_${index}`,
      name: `夜宵${index + 1}`,
      type,
      kcal: 0,
      hidden: true,
      privateCard: false
    }))
  }

  drawCards(cardsToDraw, x + 14, y + 72, w - 28, h - 86)
}







function drawCenterPanel(x, y, w, h) {
  const meal = getMeal()
  const selfId = getSelfId()
  const selfTotal = calcCardsKcal(game.players[selfId].cards)
  const ratio = Math.max(0, Math.min(1, selfTotal / meal.threshold))
  const theme = getMealTheme(game.mealIndex)
  drawRoundRect(x, y, w, h, 18, theme.center, '#111', 3)
  drawText(`${game.mealIndex + 1}/4  ${mealName(game.mealIndex)}`, x + 16, y + 10, H < 720 ? 17 : 19, '#111', 'left', 'bold')
  const barX = x + 16
  const barY = y + Math.max(34, Math.floor(h * 0.48))
  const barW = w - 32
  const barH = H < 720 ? 18 : 20
  const r = barH / 2
  ctx.save()
  drawRoundRect(barX, barY, barW, barH, r, '#FFFFFF', null, 0)
  ctx.beginPath()
  ctx.rect(barX, barY, barW, barH)
  ctx.clip()
  const fillColor = selfTotal >= meal.threshold ? '#E94335' : ratio > 0.78 ? '#FF7A3D' : '#FFE169'
  ctx.fillStyle = fillColor
  ctx.fillRect(barX, barY, barW * ratio, barH)
  ctx.restore()
  drawRoundRect(barX, barY, barW, barH, r, null, '#111', 2.5)
  drawText(`${t('warningLine')} ${meal.threshold}`, barX + barW / 2, barY + (H < 720 ? 3 : 4), H < 720 ? 10 : 11, '#111', 'center', 'bold')
}





function drawActionButtons() {
  const y = H - SAFE_BOTTOM - 84
  const gap = 10
  const leftW = Math.floor((W - 32) * 0.52)
  const rightW = W - 32 - leftW - gap
  const leftX = 16
  const smallGap = 8
  const smallW = (leftW - smallGap) / 2
  const smallH = (72 - smallGap) / 2
  const selfId = getSelfId()

  const drawTypeButtons = (canAct) => {
    const disabledFill = '#ddd'
    const disabledColor = '#666'
    addButton(canAct ? 'draw_meat' : 'noop', t('meat'), leftX, y, smallW, smallH, canAct ? TYPE_COLORS['荤'] : disabledFill, canAct ? '#111' : disabledColor, 16)
    addButton(canAct ? 'draw_veg' : 'noop', t('veg'), leftX + smallW + smallGap, y, smallW, smallH, canAct ? TYPE_COLORS['素'] : disabledFill, canAct ? '#111' : disabledColor, 16)
    addButton(canAct ? 'draw_staple' : 'noop', t('staple'), leftX, y + smallH + smallGap, smallW, smallH, canAct ? TYPE_COLORS['主食'] : disabledFill, canAct ? '#111' : disabledColor, 16)
    addButton(canAct ? 'draw_dessert' : 'noop', t('dessert'), leftX + smallW + smallGap, y + smallH + smallGap, smallW, smallH, canAct ? TYPE_COLORS['甜点'] : disabledFill, canAct ? '#111' : disabledColor, 16)
  }

  if (appMode === 'online' && (!roomData || roomData.status === 'lobby' || game.phase === 'lobby')) {
    drawTypeButtons(false)
    const ready = isReadyLockedForMe()
    addButton(ready ? 'noop' : 'ready', ready ? t('ready') : t('readyBtn'), leftX + leftW + gap, y, rightW, 72, '#FFE169', '#111', 22)
    return
  }

  if (game.phase === 'night_ready') {
    drawTypeButtons(false)
    addButton('reveal_night', t('revealNight'), leftX + leftW + gap, y, rightW, 72, '#FFE169', '#111', lang === 'en' ? 18 : 22)
    return
  }

  const canAct = canPlayerAct(game, selfId)
  drawTypeButtons(canAct)

  let standText = t('eat')
  let standSub = ''
  if (game.phase === 'opening') {
    standText = t('startHand')
    standSub = lang === 'en' ? 'Draw 2 cards' : '双方可同时抽'
  } else if (game.phase === 'night_picking') {
    standText = lang === 'en' ? 'Night' : '夜宵'
    standSub = lang === 'en' ? 'Pick all' : '选完后展示'
  } else if (game.phase === 'meal_playing') {
    if (game.turn === selfId) {
      standText = t('eat')
      standSub = (game.players[selfId].busted || isBusted(game, selfId)) ? (lang === 'en' ? 'Busted' : '爆牌也可开吃') : t('yourTurn')
    } else {
      standText = t('wait')
      standSub = t('opponentTurn')
    }
  }
  addButton(game.phase === 'meal_playing' && game.turn === selfId ? 'stand' : 'noop', standText, leftX + leftW + gap, y, rightW, 72, '#FFE169', '#111', lang === 'en' ? 18 : 24)
  if (standSub) drawText(standSub, leftX + leftW + gap + rightW / 2, y + 50, 10, '#5C4300', 'center', 'bold')
}



function drawGameScreen() {
  drawTopBadge()

  const isOnline = appMode === 'online'
  const topY = SAFE_TOP + (isOnline ? 34 : 4)
  const actionY = H - SAFE_BOTTOM - 94
  const gap = H < 700 ? 5 : 8
  const centerH = H < 680 ? 66 : H < 760 ? 74 : 86

  const available = Math.max(300, actionY - topY - centerH - gap * 2 - 8)
  let zoneH = Math.floor(available / 2)

  // 全机型自适应：小屏时宁可压缩卡牌区，也不要压扁底部按钮。
  const minZone = H < 680 ? 116 : H < 760 ? 132 : 150
  const maxZone = H > 850 ? 248 : 220
  zoneH = Math.max(minZone, Math.min(maxZone, zoneH))

  const ids = getDisplayPlayerIds()
  const opponentY = topY
  const centerY = opponentY + zoneH + gap
  const selfY = centerY + centerH + gap

  drawPlayerPanel(ids.opponent, t('opponent'), 16, opponentY, W - 32, zoneH, true)
  drawCenterPanel(16, centerY, W - 32, centerH)
  drawPlayerPanel(ids.self, t('you'), 16, selfY, W - 32, zoneH, false)

  drawActionButtons()
  drawWaitingOpponentFloat()
}




function applyRevealNight(g) {
  if (g.phase !== 'night_ready') return

  revealNightAndSettle(g)
  g.actionSeq += 1
}




function drawWaitingOpponentFloat() {
  if (appMode !== 'online') return
  if (game.phase !== 'meal_playing') return
  const selfId = getSelfId()
  const oppId = otherPlayer(selfId)
  if (game.turn !== oppId) return
  if (game.players[selfId] && game.players[selfId].stood) return
  const boxW = Math.min(W - 96, 250)
  const boxH = H < 720 ? 58 : 66
  const x = (W - boxW) / 2
  const y = Math.max(SAFE_TOP + 90, Math.min(H * 0.26, SAFE_TOP + 150))
  ctx.save()
  ctx.globalAlpha = 0.97
  drawRoundRect(x + 5, y + 6, boxW, boxH, 22, '#111', null, 0)
  drawRoundRect(x, y, boxW, boxH, 22, '#FFF6E8', '#111', 3)
  ctx.restore()
  drawText(t('opponentTurn'), W / 2, y + 10, H < 720 ? 18 : 21, '#111', 'center', 'bold')
  drawText(t('waitOpponent'), W / 2, y + (H < 720 ? 38 : 44), 11, '#555', 'center', 'bold')
}



function drawMealResult() {
  const result = game.lastMealResult

  if (!result) {
    drawText('本餐结算', 24, SAFE_TOP + 10, 28, '#111', 'left', 'bold')
        addButton('next', '继续', 24, H - SAFE_BOTTOM - 72, W - 48, 58, '#111', '#fff', 22)
    return
  }

  const selfId = getSelfId()
  const oppId = otherPlayer(selfId)

  let verdict = '本餐平局'
  let quote = '你俩都挺能装。'

  if (result.winner === selfId) {
    verdict = '本餐你赢了'
    quote = '你很会吃啊，小朋友。'
  } else if (result.winner === oppId) {
    verdict = '本餐你输了'
    quote = '你会吃有个屁用。'
  }

  const selfScore = getMealTotalPoint(game, selfId)
  const oppScore = getMealTotalPoint(game, oppId)

  const selfCards = getMealCardsFromResult(result, selfId)
  const oppCards = getMealCardsFromResult(result, oppId)
  const selfTotal = selfId === 'p1' ? result.p1Total : result.p2Total
  const oppTotal = oppId === 'p1' ? result.p1Total : result.p2Total
  const selfBusted = selfId === 'p1' ? result.p1Busted : result.p2Busted
  const oppBusted = oppId === 'p1' ? result.p1Busted : result.p2Busted


  const panelW = W - 48
  const panelH = Math.min(520, H - SAFE_TOP - SAFE_BOTTOM - 112)
  const x = 24
  const y = SAFE_TOP + 48

  drawRoundRect(x, y, panelW, panelH, 28, '#FFFFFF', '#111', 4)

  drawText(`${result.mealName}结算`, W / 2, y + 24, 24, '#111', 'center', 'bold')
  drawText(verdict, W / 2, y + 62, 34, result.winner === selfId ? '#E94335' : '#111', 'center', 'bold')
  drawText(quote, W / 2, y + 108, 16, '#555', 'center', 'bold')

  drawRoundRect(W / 2 - 86, y + 138, 172, 44, 22, '#FFF6E8', '#111', 3)
  drawText(`你 ${selfScore} : ${oppScore} 对手`, W / 2, y + 150, 22, '#111', 'center', 'bold')

  const cardAreaY = y + 202
  const cardPanelH = Math.max(108, Math.min(150, (panelH - 260) / 2))
  drawCompactMealCards(t('oppFood'), oppCards, oppTotal, oppBusted, x + 16, cardAreaY, panelW - 32, cardPanelH)
  drawCompactMealCards(t('yourFood'), selfCards, selfTotal, selfBusted, x + 16, cardAreaY + cardPanelH + 10, panelW - 32, cardPanelH)

  if (appMode === 'online') {
    const nextReady = game.nextReady || { p1: false, p2: false }
    const statusText = `确认状态：你 ${nextReady[selfId] ? '已确认' : '未确认'}｜对方 ${nextReady[oppId] ? '已确认' : '未确认'}`
    drawText(statusText, W / 2, y + panelH - 30, 12, '#E94335', 'center', 'bold')
  }

  const nextReady = game.nextReady || { p1: false, p2: false }
  const nextName = game.mealIndex >= 3 ? '今日结算' : meals[game.mealIndex + 1].name

  if (appMode === 'online') {
    const alreadyReady = Boolean(nextReady[selfId])
    addButton(alreadyReady ? 'noop' : 'next', alreadyReady ? `已确认，等待对方` : `确认进入${nextName}`, 24, H - SAFE_BOTTOM - 72, W - 48, 58, '#111', '#fff', 19)
  } else {
    addButton('next', `进入${nextName}`, 24, H - SAFE_BOTTOM - 72, W - 48, 58, '#111', '#fff', 22)
  }
}

function drawResultPlayer(title, pid, y, h) {
  const result = game.lastMealResult
  const cards = pid === 'p1' ? result.p1Cards : result.p2Cards
  const total = pid === 'p1' ? result.p1Total : result.p2Total
  const busted = pid === 'p1' ? result.p1Busted : result.p2Busted
  const combo = pid === 'p1' ? result.p1Combo : result.p2Combo
  const point = pid === 'p1' ? result.p1Point : result.p2Point

  drawRoundRect(20, y, W - 40, h, 20, '#FFFFFF', '#111', 3)
  drawText(title, 38, y + 12, 20, '#111', 'left', 'bold')
  drawText(`${total}/${result.threshold} kcal`, W - 38, y + 14, 16, busted ? '#E94335' : '#111', 'right', 'bold')
  drawText(busted ? '状态：爆牌' : '状态：未爆牌', 38, y + 42, 13, busted ? '#E94335' : '#333', 'left', 'bold')
  drawText(`本餐点数 +${point}`, W - 38, y + 42, 13, '#E94335', 'right', 'bold')

  const comboText = busted ? '爆牌不触发组合' : combo ? combo.resultText : '无组合'
  wrapText(`组合：${comboText}`, 38, y + 62, W - 76, 16, 12, '#555', 'bold', 2)

  drawCards(cards, 38, y + 96, W - 76, h - 110)
}




function drawDayResult() {
  const selfId = getSelfId()
  const oppId = otherPlayer(selfId)
  const selfPoint = getFinalPoint(game, selfId)
  const oppPoint = getFinalPoint(game, oppId)
  const selfKcal = getDayTotalKcal(game, selfId)
  const oppKcal = getDayTotalKcal(game, oppId)

  let finalText = '平局'
  let finalSubText = '双方今天吃得不相上下'

  if (selfPoint > oppPoint) {
    finalText = '恭喜你赢了！'
    finalSubText = '你赢得了这一整局'
  } else if (selfPoint < oppPoint) {
    finalText = '你输了'
    finalSubText = '对方赢得了这一整局'
  }

  const selfWin = selfPoint > oppPoint
  const oppWin = oppPoint > selfPoint
  const selfColor = selfWin ? '#E94335' : selfPoint === oppPoint ? '#E94335' : '#888'
  const oppColor = oppWin ? '#E94335' : selfPoint === oppPoint ? '#E94335' : '#888'

  drawRoundRect(20, SAFE_TOP + 42, W - 40, 126, 22, '#FFFFFF', '#111', 3)
  drawText(finalText, W / 2, SAFE_TOP + 56, 27, selfWin ? '#E94335' : '#111', 'center', 'bold')
  drawText(finalSubText, W / 2, SAFE_TOP + 90, 13, '#555', 'center', 'bold')

  // v3.6：最终几比几两边显示双方最终卡路里。
  drawText(`${selfKcal} kcal`, W * 0.24, SAFE_TOP + 120, 18, selfColor, 'center', 'bold')
  drawText(`你 ${selfPoint} : ${oppPoint} 对手`, W / 2, SAFE_TOP + 116, 22, '#111', 'center', 'bold')
  drawText(`${oppKcal} kcal`, W * 0.76, SAFE_TOP + 120, 18, oppColor, 'center', 'bold')

  const results = safeArray(game.mealResults)
  let y = SAFE_TOP + 184
  const bottomLimit = H - SAFE_BOTTOM - 104
  const blockH = Math.max(82, Math.min(112, (bottomLimit - y - 18) / meals.length))

  for (let i = 0; i < meals.length; i++) {
    const meal = meals[i]
    const res = results[i]

    drawRoundRect(20, y, W - 40, blockH, 16, '#FFFFFF', '#111', 2)

    drawText(mealName(game.mealIndex), 34, y + 10, 17, '#111', 'left', 'bold')

    if (!res) {
      drawText(t('noRecord'), W / 2, y + 12, 13, '#777', 'center', 'bold')
      y += blockH + 8
      continue
    }

    const selfCards = getMealCardsFromResult(res, selfId)
    const oppCards = getMealCardsFromResult(res, oppId)
    const selfRaw = selfId === 'p1' ? res.p1Total : res.p2Total
    const oppRaw = oppId === 'p1' ? res.p1Total : res.p2Total
    const selfBusted = selfId === 'p1' ? res.p1Busted : res.p2Busted
    const oppBusted = oppId === 'p1' ? res.p1Busted : res.p2Busted
    const selfP = getMealPoint(game, selfId, i)
    const oppP = getMealPoint(game, oppId, i)

    drawText(`${selfP}:${oppP}`, W - 34, y + 10, 16, '#E94335', 'right', 'bold')
    drawText(`你 ${selfRaw}${selfBusted ? '爆' : ''}｜对手 ${oppRaw}${oppBusted ? '爆' : ''}`, 92, y + 12, 12, '#333', 'left', 'bold')

    const cardY = y + 34
    const colW = (W - 76) / 2
    drawText('对方', 34, cardY, 10, '#777', 'left', 'bold')
    drawTinyCards(oppCards, 34, cardY + 14, colW, blockH - 50, 26)
    drawText('你', 42 + colW, cardY, 10, '#777', 'left', 'bold')
    drawTinyCards(selfCards, 42 + colW, cardY + 14, colW, blockH - 50, 26)

    y += blockH + 8
  }

  if (appMode === 'online') {
    const ready = game.replayReady || { p1: false, p2: false }
    const statusText = `下一整局准备：你 ${ready[selfId] ? '已准备' : '未准备'}｜对方 ${ready[oppId] ? '已准备' : '未准备'}`
    drawText(statusText, W / 2, H - SAFE_BOTTOM - 92, 13, '#E94335', 'center', 'bold')
    addButton(ready[selfId] ? 'noop' : 'replay_ready', ready[selfId] ? t('confirmedWait') : t('nextReady'), 24, H - SAFE_BOTTOM - 72, W - 48, 58, '#111', '#fff', 22)
  } else {
    addButton('restart_home', t('restartHome'), 24, H - SAFE_BOTTOM - 72, W - 48, 58, '#111', '#fff', 22)
  }
}

// =========================
// 渲染入口
// =========================


function drawOverlayIfNeeded() {
  if (Date.now() > startOverlayUntil || !startOverlayText) return

  // v2.6：正式开局后不再显示“开始”遮罩，避免误以为不能操作。
  if (game && game.phase && game.phase !== 'lobby') return

  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.fillRect(0, 0, W, H)

  const boxW = Math.min(W - 60, 280)
  const boxH = 96
  const x = (W - boxW) / 2
  const y = (H - boxH) / 2

  drawRoundRect(x, y, boxW, boxH, 22, '#111', '#111', 2)
  drawText('开始', x + boxW / 2, y + 18, 30, '#FFE169', 'center', 'bold')
  drawText(startOverlayText, x + boxW / 2, y + 56, 14, '#fff', 'center', 'bold')
  ctx.restore()
}



function drawTopControls() {
  // 最后绘制，确保永远在最上层，也保证点击区域最后加入 buttons。
  drawMusicButton()
  drawHomeMiniButton()
}





function render() {
  buttons = []
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = getPageBg()
  ctx.fillRect(0, 0, W, H)

  if (appMode === 'home') {
    drawHome()
    drawOverlayIfNeeded()
    drawTopControls()
    return
  }

  if (game.phase === 'meal_result') {
    drawMealResult()
    drawOverlayIfNeeded()
    drawTopControls()
    return
  }

  if (game.phase === 'day_result') {
    drawDayResult()
    drawOverlayIfNeeded()
    drawTopControls()
    return
  }

  drawGameScreen()
  drawOverlayIfNeeded()
  drawTopControls()
}

// =========================
// 点击事件
// =========================


async function handleAction(id) {
  const selfId = getSelfId()

  const lockedActions = ['draw_meat', 'draw_veg', 'draw_staple', 'draw_dessert', 'stand', 'reveal_night', 'next', 'replay_ready', 'ready']
  const shouldLock = appMode === 'online' && lockedActions.includes(id)

  if (shouldLock && onlineActionLocked && Date.now() < onlineActionLockUntil) {
    return
  }

  if (shouldLock) {
    onlineActionLocked = true
    onlineActionLockUntil = Date.now() + 900
  }

  pendingActionId = id

  try {
    if (id === 'rules_toggle') {
      rulesExpanded = !rulesExpanded
      if (!rulesExpanded) rulesScroll = 0
      render()
      return
    }

    if (id === 'music_toggle') {
      toggleBgm()
      return
    }

    if (id === 'lang_toggle') {
      lang = lang === 'zh' ? 'en' : 'zh'
      localStorage.setItem('lilucard_lang', lang)
      rulesScroll = 0
      requestRender()
      return
    }

    if (id === 'home') {
      leaveToHome()
      return
    }

    if (id === 'single_start') {
      appMode = 'single'
      myPlayerId = 'p1'
      game = createGame('single')
      aiOpeningIfNeeded(game)
      render()
      return
    }

    if (id === 'online_create') {
      await createOnlineRoom()
      return
    }

    if (id === 'online_join') {
      await joinOnlineRoom()
      return
    }

    if (id === 'ready') {
      await playerReady()
      return
    }

    if (id === 'draw_meat') applyDraw(game, selfId, '荤')
    if (id === 'draw_veg') applyDraw(game, selfId, '素')
    if (id === 'draw_staple') applyDraw(game, selfId, '主食')
    if (id === 'draw_dessert') applyDraw(game, selfId, '甜点')
    if (id === 'stand') applyStand(game, selfId)
    if (id === 'reveal_night') applyRevealNight(game)

    if (['draw_meat', 'draw_veg', 'draw_staple', 'draw_dessert', 'stand', 'reveal_night'].includes(id)) {
      singleAfterPlayerAction()

      if (appMode === 'online') await saveOnlineGame()
      else render()

      return
    }

    if (id === 'next') {
      applyNext(game, selfId)

      if (appMode === 'online') await saveOnlineGame()
      else {
        if (game.phase === 'opening') aiOpeningIfNeeded(game)
        render()
      }

      return
    }

    if (id === 'replay_ready') {
      applyReplayReady(selfId)

      if (appMode === 'online') await saveOnlineGame()
      else render()

      return
    }

    if (id === 'restart_home') {
      leaveToHome()
      return
    }
  } finally {
    if (shouldLock) {
      setTimeout(() => {
        onlineActionLocked = false
      }, 360)
    }
  }
}




function onPointer(clientX, clientY) {
  const id = hitButton(clientX, clientY)
  if (!id || id === 'noop') return

  if (id === 'music_toggle') {
    startBgm()
  }

  retryFailedImages()

  buttonPulse[id] = Date.now()
  requestRender()
  setTimeout(requestRender, BUTTON_PULSE_MS + 24)

  handleAction(id)
}

canvas.addEventListener('touchstart', event => {
  event.preventDefault()

  const touch = event.touches && event.touches[0]
  if (!touch) return

  const id = hitButton(touch.clientX, touch.clientY)

  if (id) {
    onPointer(touch.clientX, touch.clientY)
    return
  }

  if (appMode === 'home' && rulesExpanded) {
    rulesTouchDragging = true
    rulesTouchLastY = touch.clientY
  }
}, { passive: false })

canvas.addEventListener('touchmove', event => {
  if (!(appMode === 'home' && rulesExpanded && rulesTouchDragging)) return

  event.preventDefault()
  const touch = event.touches && event.touches[0]
  if (!touch) return

  const dy = rulesTouchLastY - touch.clientY
  rulesTouchLastY = touch.clientY
  rulesScroll = Math.max(0, Math.min(rulesMaxScroll, rulesScroll + dy))
  requestRender()
}, { passive: false })

canvas.addEventListener('touchend', event => {
  rulesTouchDragging = false
}, { passive: false })

canvas.addEventListener('wheel', event => {
  if (!(appMode === 'home' && rulesExpanded)) return

  event.preventDefault()
  rulesScroll = Math.max(0, Math.min(rulesMaxScroll, rulesScroll + event.deltaY))
  requestRender()
}, { passive: false })

canvas.addEventListener('mousedown', event => {
  event.preventDefault()
  onPointer(event.clientX, event.clientY)
})

let resizeTimer = null

function scheduleResize(force) {
  if (resizeTimer) clearTimeout(resizeTimer)

  resizeTimer = setTimeout(() => {
    resizeTimer = null
    resizeCanvas(Boolean(force))
  }, force ? 80 : 140)
}

window.addEventListener('resize', () => scheduleResize(false))

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => scheduleResize(false))
  window.visualViewport.addEventListener('scroll', () => scheduleResize(false))
}

window.addEventListener('orientationchange', () => {
  scheduleResize(true)
  setTimeout(() => resizeCanvas(true), 360)
})

initBgm()
preloadGameImages()
render()
