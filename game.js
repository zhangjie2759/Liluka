// game.js
// 卡路里牌 Demo：对战布局版
// 上半区对手，下半区自己
// 已加入：牌型判断 / 组合奖励 / 全日总热量 / 本餐胜局加成
// 已修改：叫外卖按钮改为 荤 / 素 / 主食 / 甜点 四个小按钮

// 网页 / 小游戏双环境适配：
// - 在网页里使用 <canvas id="gameCanvas"></canvas>
// - 在抖音/微信小游戏里仍然优先使用 tt / wx
const IS_WEB = typeof window !== 'undefined' && typeof document !== 'undefined'

const GAME_API = IS_WEB
  ? {
      createCanvas() {
        const webCanvas = document.getElementById('gameCanvas')
        if (!webCanvas) {
          throw new Error('找不到 <canvas id="gameCanvas">，请确认 index.html 里有这个 canvas')
        }
        return webCanvas
      },

      getSystemInfoSync() {
        return {
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          pixelRatio: window.devicePixelRatio || 1,
          safeArea: {
            top: 0
          }
        }
      },

      createImage() {
        return new Image()
      },

      onTouchStart(handler) {
        const webCanvas = document.getElementById('gameCanvas')
        if (!webCanvas) return

        // 手机浏览器触摸
        webCanvas.addEventListener('touchstart', function (event) {
          event.preventDefault()
          handler(event)
        }, { passive: false })

        // 电脑鼠标点击，方便你在浏览器里测试
        webCanvas.addEventListener('mousedown', function (event) {
          event.preventDefault()
          handler({
            touches: [
              {
                clientX: event.clientX,
                clientY: event.clientY
              }
            ]
          })
        })
      }
    }
  : (typeof tt !== 'undefined' ? tt : wx)

const canvas = GAME_API.createCanvas()
const ctx = canvas.getContext('2d')

const systemInfo = GAME_API.getSystemInfoSync()
const W = systemInfo.windowWidth
const H = systemInfo.windowHeight
const DPR = systemInfo.pixelRatio || 1

// 用真实像素创建高清 canvas
canvas.width = W * DPR
canvas.height = H * DPR

// 后面的绘制坐标仍然按原来的 W / H 来写
ctx.scale(DPR, DPR)

// 手机网页版本：网页本身已经在浏览器/微信顶部栏下面，
// 不再使用小游戏的 66px 胶囊安全区，否则顶部会空太多。
const SAFE_TOP = IS_WEB
  ? 18
  : Math.max(
      66,
      ((systemInfo.safeArea && systemInfo.safeArea.top) || 0) + 18
    )

const SAFE_BOTTOM = IS_WEB ? 22 : 0

// 全日总外卖次数
const TOTAL_ORDERS_PER_DAY = 10

// =========================
// 中英双语系统
// 说明：逻辑仍然使用中文类型键（荤 / 素 / 主食 / 甜点），
// 显示文本根据 currentLang 自动切换。
// =========================
function getInitialLanguage() {
  try {
    if (IS_WEB && window.localStorage) {
      const saved = window.localStorage.getItem('lilu_cards_lang')
      if (saved === 'en' || saved === 'zh') return saved
    }
  } catch (err) {}

  return 'zh'
}

let currentLang = getInitialLanguage()

function L(zh, en) {
  return currentLang === 'en' ? en : zh
}

function saveLanguage() {
  try {
    if (IS_WEB && window.localStorage) {
      window.localStorage.setItem('lilu_cards_lang', currentLang)
    }
  } catch (err) {}
}

function toggleLanguage() {
  currentLang = currentLang === 'zh' ? 'en' : 'zh'
  saveLanguage()
  render()
}

function mealName(mealOrIndex) {
  const meal = typeof mealOrIndex === 'number' ? meals[mealOrIndex] : mealOrIndex
  if (!meal) return ''
  return L(meal.name, meal.english || meal.name)
}

function typeLabel(type) {
  const labels = {
    '荤': { zh: '荤', en: 'Meat' },
    '素': { zh: '素', en: 'Veg' },
    '主食': { zh: '主食', en: 'Staple' },
    '甜点': { zh: '甜点', en: 'Dessert' }
  }

  const item = labels[type]
  if (!item) return type
  return L(item.zh, item.en)
}

function typeFullLabel(type) {
  const labels = {
    '荤': { zh: '荤', en: 'Meat' },
    '素': { zh: '素', en: 'Vegetable' },
    '主食': { zh: '主食', en: 'Staple' },
    '甜点': { zh: '甜点', en: 'Dessert' }
  }

  const item = labels[type]
  if (!item) return type
  return L(item.zh, item.en)
}

function cardDisplayName(card) {
  if (!card) return ''
  return currentLang === 'en' ? (card.english || card.name) : card.name
}

function sideLabel(sideKey) {
  return sideKey === 'opponent' ? L('对手', 'Rival') : L('你', 'You')
}

function comboDisplayName(combo) {
  if (!combo) return ''

  const map = {
    line_master: L('卡线大师', 'Line Master'),
    full_feast: L('满汉大餐', 'Full Feast'),
    biased_combo: L('偏科套餐', 'One-Track Meal'),
    double_combo: L('双拼套餐', 'Double Combo')
  }

  return map[combo.id] || combo.name || ''
}

function buildComboResultText(combo) {
  if (!combo) return ''

  const name = comboDisplayName(combo)

  if (combo.level === 'high') {
    return `${name}${L('：本餐胜局 +1', ': meal point +1')}`
  }

  if (combo.level === 'middle') {
    if (combo.rewardCard) {
      return `${name}${L('：奖励', ': reward')} ${cardDisplayName(combo.rewardCard)} +${combo.rewardCard.kcal} kcal`
    }

    return `${name}${L('：没有可奖励的荤牌', ': no Meat card available')}`
  }

  return name
}

const meals = [
  { name: '早餐', english: 'Breakfast', threshold: 400 },
  { name: '午餐', english: 'Lunch', threshold: 800 },
  { name: '晚餐', english: 'Dinner', threshold: 600 },
  { name: '夜宵', english: 'Midnight Snack', threshold: 800 }
]

const FOOD_CARDS = [
  // 素菜 / Vegetable
  { name: '生菜沙拉', english: 'Salad', type: '素', kcal: 30 },
  { name: '西兰花', english: 'Broccoli', type: '素', kcal: 50 },
  { name: '牛油果', english: 'Avocado', type: '素', kcal: 80 },
  { name: '炒藕片', english: 'Lotus Root', type: '素', kcal: 80 },
  { name: '烤黄金香菇', english: 'Grilled Golden', type: '素', kcal: 60 },
  { name: '臭豆腐', english: 'Stinky Tofu', type: '素', kcal: 150 },

  // 荤 / Meat
  { name: '水煮蛋', english: 'Boiled Egg', type: '荤', kcal: 100 },
  { name: '烤生蚝', english: 'Grilled Oyster', type: '荤', kcal: 120 },
  { name: '烤鸡翅', english: 'Chicken Wing', type: '荤', kcal: 160 },
  { name: '烤鱿鱼', english: 'Grilled Squid', type: '荤', kcal: 160 },
  { name: '炸鸡', english: 'Fried Chicken', type: '荤', kcal: 220 },
  { name: '羊肉串', english: 'Lamb Skewer', type: '荤', kcal: 180 },

  // 主食 / Staples
  { name: '米饭', english: 'Rice Bowl', type: '主食', kcal: 150 },
  { name: '牛肉面', english: 'Beef Noodles', type: '主食', kcal: 200 },
  { name: '饺子', english: 'Dumpling', type: '主食', kcal: 180 },
  { name: '包子', english: 'Baozi', type: '主食', kcal: 180 },
  { name: '披萨片', english: 'Pizza Slice', type: '主食', kcal: 220 },
  { name: '咖喱饭', english: 'Curry Rice', type: '主食', kcal: 250 },

  // 甜点 / Dessert
  { name: '酸奶', english: 'Yogurt', type: '甜点', kcal: 80 },
  { name: '布丁', english: 'Pudding', type: '甜点', kcal: 250 },
  { name: '珍珠奶茶', english: 'Milk Tea', type: '甜点', kcal: 260 },
  { name: '冰淇淋', english: 'Ice Cream', type: '甜点', kcal: 300 },
  { name: '瑞士卷', english: 'Swiss Roll', type: '甜点', kcal: 260 },
  { name: '融化蛋糕', english: 'Cake Ooze', type: '甜点', kcal: 350 }
]
// 四类卡牌颜色
// 荤 = 粉色
// 素 = 薄荷绿
// 主食 = 黄色
// 甜点 = 天蓝色
const CARD_IMAGE_PATHS = {
  // 素菜
  '生菜沙拉': 'images/cards/salad.png',
  '西兰花': 'images/cards/broccoli.png',
  '牛油果': 'images/cards/avocado.png',
  '炒藕片': 'images/cards/lotus_root.png',
  '烤黄金香菇': 'images/cards/grilled_golden.png',
  '臭豆腐': 'images/cards/stinky_tofu.png',

  // 荤
  '水煮蛋': 'images/cards/boiled_egg.png',
  '烤生蚝': 'images/cards/grilled_oyster.png',
  '烤鸡翅': 'images/cards/chicken_wing.png',
  '烤鱿鱼': 'images/cards/grilled_squid.png',
  '炸鸡': 'images/cards/fried_chicken.png',
  '羊肉串': 'images/cards/lamb_skewer.png',

  // 主食
  '米饭': 'images/cards/rice_bowl.png',
  '牛肉面': 'images/cards/beef_noodles.png',
  '饺子': 'images/cards/dumpling.png',
  '包子': 'images/cards/baozi.png',
  '披萨片': 'images/cards/pizza_slice.png',
  '咖喱饭': 'images/cards/curry_rice.png',

  // 甜点
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
let deck = []
let currentMealIndex = 0
let gameEnded = false
let mealEnded = false
let message = ''
let comboMessage = ''
let buttons = []

// 是否已经进入游戏
let gameStarted = false

// 封面规则是否展开
let rulesExpanded = false

let sides = {}
let records = {}

function createSideState(name) {
  return {
    name,
    cards: [],
    ordersUsed: 0,
    stood: false,
    busted: false,

    // 夜宵专用：先记录选择的类别，最后一次性揭晓
    nightChoices: []
  }
}
// 【替换】记录每个玩家的全日数据
// 【替换】记录每个玩家的全日数据
function createRecord() {
  return {
    // 计入全日总热量的本餐热量
    // 如果爆牌，这里记 0
    mealKcal: meals.map(() => 0),

    // 原始本餐热量
    // 即使爆牌，也保留真实热量，用于结算页显示
    rawMealKcal: meals.map(() => 0),

    basePoint: meals.map(() => 0),
    comboBonusPoint: meals.map(() => 0),
    comboResults: meals.map(() => null),
    dayBonusKcal: 0,
    dayBonusCards: [],

    // 全日已使用外卖次数
    dayOrdersUsed: 0
  }
}
function resetRecords() {
  records = {
    self: createRecord(),
    opponent: createRecord()
  }
}

function cloneCard(card) {
  return {
    name: card.name,
    english: card.english,
    type: card.type,
    kcal: card.kcal,
    hidden: false,
    privateCard: false
  }
}

function shuffle(arr) {
  const a = arr.slice()

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = a[i]
    a[i] = a[j]
    a[j] = temp
  }

  return a
}

function makeDeck() {
  return shuffle(FOOD_CARDS.map(cloneCard))
}

function drawFromDeck() {
  if (deck.length <= 0) {
    deck = makeDeck()
  }

  return deck.pop()
}

function normalizeCardType(card) {
  const t = card.type || card.category || card.suit || card.kind || ''

  if (t === '荤' || t === '肉' || t === '肉菜' || t === 'meat') return '荤'
  if (t === '素' || t === '素菜' || t === 'veg') return '素'
  if (t === '主' || t === '主食' || t === 'rice' || t === 'staple') return '主食'
  if (t === '甜' || t === '甜点' || t === 'dessert') return '甜点'

  return t
}

function drawFromDeckByType(type) {
  let indexes = []

  for (let i = 0; i < deck.length; i++) {
    if (normalizeCardType(deck[i]) === type) {
      indexes.push(i)
    }
  }

  // 当前牌堆没有该类型时，补一副新牌，保证 Demo 能继续测试
  if (indexes.length === 0) {
    deck = deck.concat(makeDeck())

    for (let i = 0; i < deck.length; i++) {
      if (normalizeCardType(deck[i]) === type) {
        indexes.push(i)
      }
    }
  }

  if (indexes.length === 0) return null

  const randomIndex = Math.floor(Math.random() * indexes.length)
  const deckIndex = indexes[randomIndex]
  return deck.splice(deckIndex, 1)[0]
}

function getCardKcal(card) {
  return Number(card.kcal || card.calorie || card.value || 0)
}

function calcCardsKcal(cards) {
  return cards.reduce((sum, card) => sum + getCardKcal(card), 0)
}

function calcVisibleKcal(cards) {
  return cards.reduce((sum, card) => {
    if (card.hidden) return sum
    return sum + getCardKcal(card)
  }, 0)
}

function getTypeCounts(cards) {
  const counts = {
    '荤': 0,
    '素': 0,
    '主食': 0,
    '甜点': 0
  }

  cards.forEach(card => {
    const type = normalizeCardType(card)
    if (counts[type] !== undefined) {
      counts[type] += 1
    }
  })

  return counts
}

// =========================
// 牌型判断
// =========================

function evaluateMealCombo(cards, threshold) {
  const total = calcCardsKcal(cards)

  // 爆牌不触发任何组合
  if (total > threshold) return null

  const counts = getTypeCounts(cards)
  const types = ['荤', '素', '主食', '甜点']
  const totalCards = cards.length

  const hasAllTypes = types.every(type => counts[type] >= 1)
  const pairTypes = types.filter(type => counts[type] >= 2)
  const maxType = types.reduce((a, b) => counts[a] >= counts[b] ? a : b)
  const maxCount = counts[maxType]

  // 高级组合优先
  // 卡线大师更稀有，优先于满汉大餐
  if (total === threshold) {
    return {
      id: 'line_master',
      level: 'high',
      name: '卡线大师',
      english: 'Line Master',
      desc: '本餐热量刚好等于警戒线',
      reward: '本餐胜局 +1'
    }
  }

  if (hasAllTypes) {
    return {
      id: 'full_feast',
      level: 'high',
      name: '满汉大餐',
      english: 'Full Feast',
      desc: '荤 / 素 / 主食 / 甜点四类齐全',
      reward: '本餐胜局 +1'
    }
  }

  // 中级组合
  const hasDoubleCombo = pairTypes.length >= 2
  const hasBiasCombo = maxCount >= 3

  // 同时满足双拼和偏科时，只显示更贴切的一个
  if (hasDoubleCombo && hasBiasCombo) {
    if (maxCount >= 4) {
      return {
        id: 'biased_combo',
        level: 'middle',
        name: '偏科套餐',
        english: 'One-Track Meal',
        desc: `${maxType}类 ≥3 张`,
        reward: '抽 1 张荤牌加入全日总分'
      }
    }

    return {
      id: 'double_combo',
      level: 'middle',
      name: '双拼套餐',
      english: 'Double Combo',
      desc: '任意两个类别各 ≥2 张',
      reward: '抽 1 张荤牌加入全日总分'
    }
  }

  if (hasDoubleCombo) {
    return {
      id: 'double_combo',
      level: 'middle',
      name: '双拼套餐',
      english: 'Double Combo',
      desc: '任意两个类别各 ≥2 张',
      reward: '抽 1 张荤牌加入全日总分'
    }
  }

  if (hasBiasCombo) {
    return {
      id: 'biased_combo',
      level: 'middle',
      name: '偏科套餐',
      english: 'One-Track Meal',
      desc: `${maxType}类 ≥3 张`,
      reward: '抽 1 张荤牌加入全日总分'
    }
  }

  return null
}

function drawRewardMeatCard(sideKey) {
  let meatIndexes = []

  for (let i = 0; i < deck.length; i++) {
    if (normalizeCardType(deck[i]) === '荤') {
      meatIndexes.push(i)
    }
  }

  // 如果牌堆里没有荤牌，补一副新牌方便 demo 测试
  if (meatIndexes.length === 0) {
    deck = deck.concat(makeDeck())

    for (let i = 0; i < deck.length; i++) {
      if (normalizeCardType(deck[i]) === '荤') {
        meatIndexes.push(i)
      }
    }
  }

  if (meatIndexes.length === 0) return null

  const randomIndex = Math.floor(Math.random() * meatIndexes.length)
  const deckIndex = meatIndexes[randomIndex]
  const rewardCard = deck.splice(deckIndex, 1)[0]

  rewardCard.hidden = false
  rewardCard.privateCard = false

  records[sideKey].dayBonusCards.push(rewardCard)
  records[sideKey].dayBonusKcal += getCardKcal(rewardCard)

  return rewardCard
}

// 【替换】结算牌型：爆牌时，本餐热量不计入全日总热量
// 【替换】结算牌型：爆牌时，本餐热量不计入全日总热量，但保留原始热量用于显示
function settleSideCombo(sideKey) {
  const side = sides[sideKey]
  const meal = meals[currentMealIndex]
  const total = calcCardsKcal(side.cards)
  const busted = total > meal.threshold

  // 永远记录原始热量，用于结算页显示
  records[sideKey].rawMealKcal[currentMealIndex] = total

  // 爆牌：本餐计入全日总热量为 0
  // 未爆：本餐正常计入全日总热量
  records[sideKey].mealKcal[currentMealIndex] = busted ? 0 : total

  // 爆牌不触发任何组合
  if (busted) {
    records[sideKey].comboResults[currentMealIndex] = null
    return null
  }

  const combo = evaluateMealCombo(side.cards, meal.threshold)

  if (!combo) {
    records[sideKey].comboResults[currentMealIndex] = null
    return null
  }

  if (combo.level === 'high') {
    records[sideKey].comboBonusPoint[currentMealIndex] += 1
  }

  if (combo.level === 'middle') {
    const rewardCard = drawRewardMeatCard(sideKey)
    combo.rewardCard = rewardCard
  }

  combo.resultText = buildComboResultText(combo)

  records[sideKey].comboResults[currentMealIndex] = combo
  return combo
}

// =========================
// 游戏流程
// =========================
// =========================
// 夜宵特殊规则
// =========================

function isNightMeal() {
  return currentMealIndex === meals.length - 1
}

function getRemainingOrders(sideKey) {
  return Math.max(0, TOTAL_ORDERS_PER_DAY - records[sideKey].dayOrdersUsed)
}

function getNightChoiceText(side) {
  const counts = {
    '荤': 0,
    '素': 0,
    '主食': 0,
    '甜点': 0
  }

  side.nightChoices.forEach(type => {
    if (counts[type] !== undefined) {
      counts[type] += 1
    }
  })

  const parts = []

  Object.keys(counts).forEach(type => {
    if (counts[type] > 0) {
      parts.push(`${typeLabel(type)}×${counts[type]}`)
    }
  })

  return parts.length > 0 ? parts.join(' ') : L('还未选择', 'Not selected')
}

function drawNightCardsForSide(sideKey) {
  const side = sides[sideKey]

  side.nightChoices.forEach(type => {
    const card = drawFromDeckByType(type)

    if (card) {
      card.hidden = false
      card.privateCard = false
      side.cards.push(card)
    }
  })

  side.nightChoices = []
}

function makeOpponentNightChoices() {
  const opponent = sides.opponent
  const types = ['荤', '素', '主食', '甜点']
  const remaining = getRemainingOrders('opponent')

  for (let i = 0; i < remaining; i++) {
    const randomType = types[Math.floor(Math.random() * types.length)]
    opponent.nightChoices.push(randomType)
    records.opponent.dayOrdersUsed += 1
  }
}

function finishNightMeal() {
  // 你选择好的夜宵一次性揭晓
  drawNightCardsForSide('self')

  // 对手也一次性用完剩余外卖次数
  makeOpponentNightChoices()
  drawNightCardsForSide('opponent')

  sides.self.stood = true
  sides.opponent.stood = true

  message = L('夜宵揭晓！双方一次性公开全部夜宵', 'Midnight snack revealed! Both sides show all orders at once')
  finishMeal()
}

// =========================
// 抖音侧边栏复访
// =========================

function goToSidebar() {
  if (typeof tt !== 'undefined' && tt.navigateToScene) {
    tt.navigateToScene({
      scene: 'sidebar',
      success() {
        console.log('已跳转到抖音侧边栏')
      },
      fail(err) {
        console.log('跳转侧边栏失败', err)
      }
    })
  } else {
    console.log('当前环境不支持 tt.navigateToScene')
    if (typeof message !== 'undefined') {
      message = L('网页测试版不支持抖音侧边栏复访', 'Sidebar return is not supported in this web demo')
      if (typeof render === 'function') render()
    }
  }
}
function startGame() {
  gameStarted = true

  deck = makeDeck()
  currentMealIndex = 0
  gameEnded = false
  mealEnded = false
  message = ''
  comboMessage = ''

  resetRecords()
  startMeal(0)
  render()
}

// 【替换 3】开始一餐：起手爆牌也不自动结算
// 【替换】开始一餐：对手自动发牌，你的起手牌改为自己抽
// 【替换】开始一餐：夜宵改为一次性选搭配后揭晓
function startMeal(index) {
  if (index >= meals.length) {
    gameEnded = true
    message = L('今日结算完成', 'Day complete')
    render()
    return
  }

  currentMealIndex = index
  mealEnded = false
  comboMessage = ''

  sides = {
    opponent: createSideState(L('对手', 'Rival')),
    self: createSideState(L('你', 'You'))
  }

  // 夜宵特殊规则：不自动发起手牌，改成一次性选完剩余外卖搭配
  if (isNightMeal()) {
    const remaining = getRemainingOrders('self')
    message = L(`夜宵开始：请一次性选完剩余 ${remaining} 次外卖搭配，然后揭晓`, `Midnight snack: choose all ${remaining} remaining orders, then reveal`) 
    render()
    return
  }

  // 非夜宵：对手仍然自动获得 1 张暗牌 + 1 张明牌
  const opponentHidden = drawFromDeck()
  opponentHidden.hidden = true
  sides.opponent.cards.push(opponentHidden)

  const opponentOpen = drawFromDeck()
  opponentOpen.hidden = false
  sides.opponent.cards.push(opponentOpen)

  // 你不再自动发牌，改为自己点击四个类别按钮抽起手牌
  message = L(`${mealName(index)}开始：请先抽你的第 1 张起手牌`, `${mealName(index)} starts: draw your 1st opening card`) 

  updateBustState('opponent')

  render()
}
function isSelfOpeningPhase() {
  // 夜宵没有起手抽牌阶段
  if (isNightMeal()) return false

  return sides.self && sides.self.cards.length < 2 && !mealEnded && !gameEnded
}
function updateBustState(sideKey) {
  const side = sides[sideKey]
  const meal = meals[currentMealIndex]
  const total = calcCardsKcal(side.cards)

  if (total > meal.threshold) {
    side.busted = true
    // 注意：这里不设置 side.stood = true
    // 爆牌后只是不能继续叫外卖，但不会自动结算
  }
}
// 【替换 2】玩家点外卖：自己爆牌也不自动结算，必须点“收手”
// 【替换】玩家点外卖：使用全日总外卖次数
// 【替换】玩家抽牌：前 2 张为起手牌，不消耗今日外卖次数
// 【替换】玩家抽牌：夜宵先选搭配，最后一次性揭晓
function playerDraw(type) {
  if (gameEnded || mealEnded) return

  const self = sides.self

  if (self.stood || self.busted) return

  // 夜宵特殊规则：点击按钮只记录搭配，不立即抽牌
  if (isNightMeal()) {
    if (records.self.dayOrdersUsed >= TOTAL_ORDERS_PER_DAY) {
      message = L('夜宵搭配已经选完，请点击揭晓夜宵', 'Midnight orders are ready. Tap Reveal')
      render()
      return
    }

    self.nightChoices.push(type)
    records.self.dayOrdersUsed += 1

    const remaining = getRemainingOrders('self')
    const choiceText = getNightChoiceText(self)

    if (remaining > 0) {
      message = L(`夜宵搭配：${choiceText}；还剩 ${remaining} 次需要选择`, `Midnight order: ${choiceText}; ${remaining} choices left`) 
    } else {
      message = L(`夜宵搭配完成：${choiceText}；点击揭晓夜宵`, `Midnight order ready: ${choiceText}; tap Reveal`) 
    }

    render()
    return
  }

  const isOpening = isSelfOpeningPhase()

  // 起手牌不消耗今日外卖次数
  if (!isOpening && records.self.dayOrdersUsed >= TOTAL_ORDERS_PER_DAY) {
    message = L('你的全日外卖次数已经用完，只能收手', 'You have used all daily orders. Stand only')
    render()
    return
  }

  const card = drawFromDeckByType(type)

  if (!card) {
    message = L(`${typeLabel(type)}牌暂时抽不到`, `${typeLabel(type)} card is unavailable`) 
    render()
    return
  }

  card.hidden = false

  if (isOpening) {
    // 第一张起手牌标记为底牌
    if (self.cards.length === 0) {
      card.privateCard = true
      self.cards.push(card)
      message = L(`你抽到第 1 张起手牌：${cardDisplayName(card)}，这是你的底牌`, `Opening card 1: ${cardDisplayName(card)}. This is your hidden card`) 
    } else {
      card.privateCard = false
      self.cards.push(card)
      message = L(`你抽到第 2 张起手牌：${cardDisplayName(card)}，起手完成，可以继续叫外卖或收手`, `Opening card 2: ${cardDisplayName(card)}. You can order more or stand`) 
    }

    updateBustState('self')

    if (self.busted) {
      message += L('，你起手爆牌了，请点击收手结算', '. Your opening hand busted. Tap Stand to settle')
    }

    render()
    return
  }

  // 起手完成后，才是正式外卖
  card.privateCard = false
  self.cards.push(card)

  self.ordersUsed += 1
  records.self.dayOrdersUsed += 1

  message = L(`你点了${typeLabel(type)}外卖：${cardDisplayName(card)} +${card.kcal} kcal`, `You ordered ${typeLabel(type)}: ${cardDisplayName(card)} +${card.kcal} kcal`) 
  message += L(`；今日外卖 ${records.self.dayOrdersUsed}/${TOTAL_ORDERS_PER_DAY}`, `; daily orders ${records.self.dayOrdersUsed}/${TOTAL_ORDERS_PER_DAY}`)

  updateBustState('self')

  if (self.busted) {
    message += L('，你爆牌了，请点击收手结算', '. You busted. Tap Stand to settle')
    render()
    return
  }

  opponentAutoStep()

  if (sides.self.stood && sides.opponent.stood) {
    finishMeal()
    return
  }

  render()
}
// 【替换】收手：必须先抽满 2 张起手牌
// 【替换】收手：夜宵时改为揭晓夜宵
function playerStand() {
  if (gameEnded || mealEnded) return

  const self = sides.self

  // 夜宵特殊规则：必须先选完剩余外卖次数，再一次性揭晓
  if (isNightMeal()) {
    const remaining = getRemainingOrders('self')

    if (remaining > 0) {
      message = L(`请先选完夜宵搭配，还剩 ${remaining} 次`, `Choose all midnight orders first. ${remaining} left`) 
      render()
      return
    }

    finishNightMeal()
    return
  }

  if (self.cards.length < 2) {
    message = L(`请先抽满 2 张起手牌，目前 ${self.cards.length}/2`, `Draw 2 opening cards first: ${self.cards.length}/2`) 
    render()
    return
  }

  if (self.busted) {
    self.stood = true
    message = L('你已经爆牌，点击收手进入结算', 'You busted. Tap Stand to settle')
    finishMeal()
    return
  }

  self.stood = true
  message = L('你选择收手，等待对手结算', 'You stand. Rival is settling')

  opponentAutoPlayToEnd()
  finishMeal()
}
function opponentShouldDraw() {
  const opponent = sides.opponent
  const self = sides.self
  const meal = meals[currentMealIndex]

  const opponentTotal = calcCardsKcal(opponent.cards)
  const selfTotal = calcCardsKcal(self.cards)
  const threshold = meal.threshold

  if (records.opponent.dayOrdersUsed >= TOTAL_ORDERS_PER_DAY) return false
  if (opponentTotal > threshold) return false
  if (self.busted) return false

  // 玩家收手后，对手会尝试追分，但不会太激进
  if (self.stood) {
    if (opponentTotal <= selfTotal - 30 && opponentTotal <= threshold - 70) {
      return true
    }

    if (opponentTotal < threshold * 0.62) {
      return true
    }

    return false
  }

  // 玩家还没收手时，对手保守叫外卖
  if (opponentTotal < threshold * 0.45) {
    return true
  }

  if (opponentTotal < threshold * 0.65) {
    return Math.random() < 0.75
  }

  if (opponentTotal < threshold * 0.8 && opponentTotal < selfTotal - 80) {
    return Math.random() < 0.45
  }

  return false
}

// 【替换】对手自动行动：叫外卖时扣全日次数
function opponentAutoStep() {
  const opponent = sides.opponent

  if (opponent.stood || opponent.busted || mealEnded) return

  if (records.opponent.dayOrdersUsed >= TOTAL_ORDERS_PER_DAY) {
    opponent.stood = true
    message += L(`；对手全日外卖用完，收手`, `; rival used all daily orders and stands`)
    return
  }

  if (opponentShouldDraw()) {
    const card = drawFromDeck()
    card.hidden = false
    opponent.cards.push(card)

    // 本餐次数
    opponent.ordersUsed += 1

    // 全日次数
    records.opponent.dayOrdersUsed += 1

    message += L(`；对手叫了一单`, `; rival ordered once`)

    updateBustState('opponent')

    if (opponent.busted) {
      message += L(`，对手爆牌`, `; rival busted`)
    }
  } else {
    opponent.stood = true
    message += L(`；对手收手`, `; rival stands`)
  }
}
function opponentAutoPlayToEnd() {
  const opponent = sides.opponent

  while (!opponent.stood && !opponent.busted && !mealEnded) {
    const beforeCount = opponent.cards.length
    opponentAutoStep()

    // 防止极端情况下死循环
    if (opponent.cards.length === beforeCount && !opponentShouldDraw()) {
      opponent.stood = true
      break
    }
  }
}

function revealAllCards() {
  sides.opponent.cards.forEach(card => {
    card.hidden = false
  })

  sides.self.cards.forEach(card => {
    card.hidden = false
  })
}

function finishMeal() {
  if (mealEnded || gameEnded) return

  revealAllCards()

  updateBustState('self')
  updateBustState('opponent')

  const meal = meals[currentMealIndex]

  const selfTotal = calcCardsKcal(sides.self.cards)
  const opponentTotal = calcCardsKcal(sides.opponent.cards)

  const selfBusted = selfTotal > meal.threshold
  const opponentBusted = opponentTotal > meal.threshold

  sides.self.busted = selfBusted
  sides.opponent.busted = opponentBusted
  sides.self.stood = true
  sides.opponent.stood = true

  const selfCombo = settleSideCombo('self')
  const opponentCombo = settleSideCombo('opponent')

  // 本餐基础胜负
  let resultText = ''

  if (selfBusted && opponentBusted) {
    resultText = L('双方卡路里都爆炸啦！', 'Both sides busted!')
  } else if (selfBusted) {
    records.opponent.basePoint[currentMealIndex] += 1
    resultText = L('会吃有个屁用啊', 'Eating more means nothing if you bust')
  } else if (opponentBusted) {
    records.self.basePoint[currentMealIndex] += 1
    resultText = L('你很会吃啊，小朋友', 'You know how to eat, kid')
  } else {
    if (selfTotal > opponentTotal) {
      records.self.basePoint[currentMealIndex] += 1
      resultText = L('你很会吃啊，小朋友', 'You know how to eat, kid')
    } else if (opponentTotal > selfTotal) {
      records.opponent.basePoint[currentMealIndex] += 1
      resultText = L('对手更接近警戒线，赢得本餐', 'Rival gets closer to the line and wins this meal')
    } else {
      resultText = L('双方热量相同，本餐平局', 'Same calories. This meal is tied')
    }
  }

  mealEnded = true

  message = L(`${mealName(meal)}结算：你 ${selfTotal} / 对手 ${opponentTotal}`, `${mealName(meal)} result: You ${selfTotal} / Rival ${opponentTotal}`) 
  comboMessage = resultText

  const selfComboText = selfCombo ? `${L('你触发', 'You triggered')}: ${buildComboResultText(selfCombo)}` : ''
  const opponentComboText = opponentCombo ? `${L('对手触发', 'Rival triggered')}: ${buildComboResultText(opponentCombo)}` : ''

  if (selfComboText && opponentComboText) {
    comboMessage += `${L('｜', ' | ')}${selfComboText}${L('｜', ' | ')}${opponentComboText}`
  } else if (selfComboText) {
    comboMessage += `${L('｜', ' | ')}${selfComboText}`
  } else if (opponentComboText) {
    comboMessage += `${L('｜', ' | ')}${opponentComboText}`
  }

  render()
}

function goNextMeal() {
  if (!mealEnded) return

  const nextIndex = currentMealIndex + 1

  if (nextIndex >= meals.length) {
    gameEnded = true
    message = L('今日结算完成', 'Day complete')
    render()
  } else {
    startMeal(nextIndex)
    render()
  }
}

function getDayBaseKcal(sideKey) {
  return records[sideKey].mealKcal.reduce((sum, kcal) => sum + kcal, 0)
}

function getDayTotalKcal(sideKey) {
  return getDayBaseKcal(sideKey) + records[sideKey].dayBonusKcal
}

function getMealPoint(sideKey, mealIndex) {
  return records[sideKey].basePoint[mealIndex] + records[sideKey].comboBonusPoint[mealIndex]
}

function getMealTotalPoint(sideKey) {
  let point = 0

  for (let i = 0; i < meals.length; i++) {
    point += getMealPoint(sideKey, i)
  }

  return point
}

function getDayTotalPoint(sideKey) {
  const selfTotal = getDayTotalKcal('self')
  const opponentTotal = getDayTotalKcal('opponent')

  if (selfTotal === opponentTotal) return 0

  if (sideKey === 'self') {
    return selfTotal > opponentTotal ? 1 : 0
  }

  return opponentTotal > selfTotal ? 1 : 0
}

function getFinalPoint(sideKey) {
  return getMealTotalPoint(sideKey) + getDayTotalPoint(sideKey)
}

// =========================
// 绘制工具
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
  ctx.fillText(text, x, y)
}

function wrapText(text, x, y, maxWidth, lineHeight, size, color, weight, maxLines) {
  ctx.font = `${weight || 'normal'} ${size}px sans-serif`
  ctx.fillStyle = color || '#111'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  let line = ''
  let yy = y
  let lines = 0
  const rawText = String(text || '')

  // 中文按字符换行；英文按单词换行，避免字母被逐个切开。
  const units = /[A-Za-z]/.test(rawText) && rawText.indexOf(' ') >= 0
    ? rawText.split(/(\s+)/)
    : rawText.split('')

  for (let i = 0; i < units.length; i++) {
    const unit = units[i]
    const testLine = line + unit
    const metrics = ctx.measureText(testLine)

    if (metrics.width > maxWidth && i > 0 && line.trim() !== '') {
      ctx.fillText(line.trimEnd(), x, yy)
      lines += 1

      if (maxLines && lines >= maxLines) {
        return yy + lineHeight
      }

      line = unit.trimStart()
      yy += lineHeight
    } else {
      line = testLine
    }
  }

  ctx.fillText(line.trimEnd(), x, yy)
  return yy + lineHeight
}

function addButton(id, text, x, y, w, h, fill, color, fontSize) {
  buttons.push({ id, text, x, y, w, h })

  drawRoundRect(x, y, w, h, 14, fill || '#111', '#111', 2)
  drawText(text, x + w / 2, y + h / 2 - (fontSize || 20) / 2, fontSize || 20, color || '#fff', 'center', 'bold')
}

const imageCache = {}

// =========================
// 图片预加载
// 目的：进入游戏前先把所有卡牌图片加载好，避免抽牌时先闪一下旧版文字卡。
// 如果某张图片路径错误或缺失，也不会卡死，会用“图片缺失”占位卡继续运行。
// =========================
let imagePreloadStarted = false

function getAllGameImagePaths() {
  const paths = []
  const seen = {}

  Object.keys(CARD_IMAGE_PATHS).forEach(name => {
    const src = CARD_IMAGE_PATHS[name]
    if (src && !seen[src]) {
      seen[src] = true
      paths.push(src)
    }
  })

  Object.keys(CARD_BACK_PATHS).forEach(type => {
    const src = CARD_BACK_PATHS[type]
    if (src && !seen[src]) {
      seen[src] = true
      paths.push(src)
    }
  })

  return paths
}

function getImagePreloadProgress() {
  const paths = getAllGameImagePaths()
  let loaded = 0
  let failed = 0

  paths.forEach(src => {
    const img = imageCache[src]
    if (img && img.loaded) loaded += 1
    if (img && img.failed) failed += 1
  })

  return {
    total: paths.length,
    loaded,
    failed,
    done: paths.length === 0 || loaded + failed >= paths.length
  }
}

function areGameImagesReady() {
  return getImagePreloadProgress().done
}

function preloadGameImages() {
  if (imagePreloadStarted) return

  imagePreloadStarted = true
  const paths = getAllGameImagePaths()

  paths.forEach(src => {
    getGameImage(src)
  })
}

function getGameImage(src) {
  if (!src) return null

  if (imageCache[src]) {
    return imageCache[src]
  }

  const img = GAME_API.createImage
    ? GAME_API.createImage()
    : canvas.createImage()

  img.loaded = false
  img.failed = false

  img.onload = function () {
    img.loaded = true
    img.failed = false
    render()
  }

  img.onerror = function () {
    img.loaded = false
    img.failed = true
    console.log('图片加载失败：', src)
    render()
  }

  img.src = src

  // 某些浏览器命中缓存时可能已经完成加载，这里做一次保险判断。
  if (IS_WEB && img.complete && img.naturalWidth > 0) {
    img.loaded = true
    img.failed = false
    setTimeout(render, 0)
  }

  imageCache[src] = img

  return img
}

function drawCard(card, x, y, w, h) {
  const type = normalizeCardType(card)
  const imgPath = card.hidden
    ? (CARD_BACK_PATHS[type] || CARD_BACK_PATHS['荤'])
    : CARD_IMAGE_PATHS[card.name]
  const img = getGameImage(imgPath)

  if (img && img.loaded) {
    const radius = 10
    const strokeWidth = 2

    // 正面有血线：适当放大裁切，吃掉一点边缘
    // 背面只做轻微裁切，避免白边，同时尽量保留背面原本黑边
    // 背面裁切参数：1.07；如果还有白边可调到 1.08，裁太多可调到 1.05
    const bleedCropScale = card.hidden ? 1.07 : 1.08

    // 图片比例：671 × 1121
    const imageRatio = 671 / 1121
    const boxRatio = w / h

    let drawW = w
    let drawH = h

    // cover 模式：铺满卡牌区域，允许正面少量裁切
    if (boxRatio > imageRatio) {
      drawW = w
      drawH = w / imageRatio
    } else {
      drawH = h
      drawW = h * imageRatio
    }

    drawW = drawW * bleedCropScale
    drawH = drawH * bleedCropScale

    const drawX = x + (w - drawW) / 2
    const drawY = y + (h - drawH) / 2

    // 圆角裁切图片本身
    ctx.save()

    const r = Math.min(radius, w / 2, h / 2)
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
    ctx.clip()

    ctx.drawImage(img, drawX, drawY, drawW, drawH)

    ctx.restore()

    // 正面才加一圈细描边；背面图片自带黑边，不再额外加边
    if (!card.hidden) {
      drawRoundRect(x, y, w, h, radius, null, '#111', strokeWidth)
    }

    // 如果是你的底牌，额外显示一个小标签
    if (card.privateCard && !card.hidden) {
      drawRoundRect(x + 6, y + 6, 30, 17, 7, '#111', null, 0)
      drawText(L('底牌', 'HID'), x + 21, y + 8, 10, '#fff', 'center', 'bold')
    }

    return
  }

  // 图片没加载出来时，不再显示旧版文字卡，只显示临时占位。
  // 这样抽牌时不会出现“旧版图案 → 正式卡面”的闪烁。
  const placeholderText = img && img.failed ? L('图片缺失', 'Missing') : L('加载中', 'Loading')
  drawRoundRect(x, y, w, h, 12, '#F3EBDD', '#111', 2)
  drawText(placeholderText, x + w / 2, y + h / 2 - 8, 12, '#777', 'center', 'bold')
  return
}

function drawCardsInZone(cards, x, y, zoneW, cardW, cardH) {
  // 卡牌间距：数值越小，卡牌越靠近
  const gap = 3
  const perRow = Math.max(4, Math.floor((zoneW + gap) / (cardW + gap)))

  for (let i = 0; i < cards.length; i++) {
    const row = Math.floor(i / perRow)
    const col = i % perRow
    const cx = x + col * (cardW + gap)
    const cy = y + row * (cardH + gap)

    drawCard(cards[i], cx, cy, cardW, cardH)
  }
}
// 【新增】胜局眼球：白色眼球 + 黑色瞳孔
function drawEyeToken(cx, cy, r) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.strokeStyle = '#111'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx + 2, cy, Math.max(2, r * 0.35), 0, Math.PI * 2)
  ctx.fillStyle = '#111'
  ctx.fill()
}

// 【新增】在玩家框右侧显示累计胜局眼球
function drawScoreEyes(sideKey, x, y, maxH) {
  const point = getMealTotalPoint(sideKey)

  if (point <= 0) return

  const r = 7
  const gap = 18
  const maxEyes = Math.min(point, Math.floor(maxH / gap))

  for (let i = 0; i < maxEyes; i++) {
    drawEyeToken(x, y + i * gap, r)
  }

  // 极端情况：如果点数太多放不下，用 xN 表示剩余
  if (point > maxEyes) {
    drawText(`×${point}`, x, y + maxEyes * gap - 2, 11, '#111', 'center', 'bold')
  }
}

// 【替换】对战区域：增加卡路里状态文字 + 状态条
// 【替换】对战区域：增加全日总热量统计
function drawBattleZone(sideKey, x, y, w, h) {
  const isOpponent = sideKey === 'opponent'
  const side = sides[sideKey]
  const meal = meals[currentMealIndex]

  const total = calcCardsKcal(side.cards)
  const visibleTotal = calcVisibleKcal(side.cards)

  // 对手未结算前，只显示明牌热量
  const displayTotal = isOpponent && !mealEnded ? visibleTotal : total

  const bg = isOpponent ? '#EFE9DF' : '#FFFFFF'
  const title = sideLabel(sideKey)
  const status = side.busted ? L('爆牌', 'Busted') : side.stood ? L('已收手', 'Stood') : isOpponent ? L('观察中', 'Watching') : L('行动中', 'Your turn')
  const statusColor = side.busted ? '#E94335' : '#111'

  drawRoundRect(x, y, w, h, 22, bg, '#111', 3)

  drawText(title, x + 16, y + 12, 22, '#111', 'left', 'bold')
  drawText(status, x + 72, y + 17, 14, statusColor, 'left', 'bold')

  if (isOpponent && !mealEnded) {
    drawText(L(`明牌 ${displayTotal} kcal`, `Open ${displayTotal} kcal`), x + w - 16, y + 14, 16, '#111', 'right', 'bold')
  } else {
    drawText(`${displayTotal}/${meal.threshold} kcal`, x + w - 16, y + 14, 16, total > meal.threshold ? '#E94335' : '#111', 'right', 'bold')
  }

  // 今日外卖次数
  const orderText = L(`外卖 ${records[sideKey].dayOrdersUsed}/${TOTAL_ORDERS_PER_DAY}`, `Orders ${records[sideKey].dayOrdersUsed}/${TOTAL_ORDERS_PER_DAY}`)
  drawText(orderText, x + 16, y + 42, 13, '#666', 'left', 'bold')

  // 新增：全日总热量统计
  // 未结算时：已完成餐次 + 当前可见/当前自己热量 + 奖励热量
  // 结算后：直接使用记录里的全日总热量
  let dayDisplayTotal = getDayBaseKcal(sideKey) + records[sideKey].dayBonusKcal

  if (!mealEnded) {
    dayDisplayTotal += displayTotal
  }

  const dayText = isOpponent && !mealEnded
    ? L(`已知总热量 ${dayDisplayTotal}`, `Known total ${dayDisplayTotal}`)
    : L(`全日总热量 ${dayDisplayTotal}`, `Day total ${dayDisplayTotal}`)

  drawText(dayText, x + 110, y + 42, 13, '#111', 'left', 'bold')

  const mealPoint = getMealPoint(sideKey, currentMealIndex)
  if (mealEnded) {
    drawText(L(`本餐点数 +${mealPoint}`, `Meal pts +${mealPoint}`), x + w - 16, y + 42, 13, '#E94335', 'right', 'bold')
  }

  // 右侧胜局眼球
  drawScoreEyes(sideKey, x + w - 24, y + 82, h - 100)

  // 夜宵选择阶段：不直接出正面牌，而是把已选择的类别显示成对应颜色的背面。
  // 例如 3 素 + 3 荤，会先出现 3 张绿色背面 + 3 张粉色背面；点击“揭晓夜宵”后再显示正面图。
  let cardsToDraw = side.cards

  if (isNightMeal() && !mealEnded && side.nightChoices && side.nightChoices.length > 0) {
    cardsToDraw = side.nightChoices.map((type, index) => ({
      name: L(`夜宵订单${index + 1}`, `Midnight Order ${index + 1}`),
      type,
      kcal: 0,
      hidden: true,
      privateCard: false,
      nightPreview: true
    }))
  }

  // 手机优先卡牌尺寸：根据当前张数和区域高度自动缩小，避免卡牌超出框外。
  const cardCount = cardsToDraw.length

  if (cardCount <= 0) return

  const cardGap = 3
  const cardAreaX = x + 14
  const cardAreaY = y + 62
  const cardAreaW = w - 48
  const cardAreaH = Math.max(64, h - 76)

  let targetCardW = 60
  if (cardCount <= 2) targetCardW = 64
  else if (cardCount <= 4) targetCardW = 58
  else if (cardCount <= 6) targetCardW = 50
  else if (cardCount <= 8) targetCardW = 44
  else targetCardW = 38

  // 先保证一行至少能放下 4 张，再根据高度反推最大卡宽。
  const maxCardWByWidth = Math.floor((cardAreaW - cardGap * 3) / 4)
  let cardW = Math.min(targetCardW, maxCardWByWidth)

  // 迭代几次，让 drawCardsInZone 实际会使用的每行数量与高度限制匹配。
  for (let i = 0; i < 8; i++) {
    const perRow = Math.max(4, Math.floor((cardAreaW + cardGap) / (cardW + cardGap)))
    const rows = Math.max(1, Math.ceil(cardCount / perRow))
    const maxCardHByHeight = Math.floor((cardAreaH - cardGap * (rows - 1)) / rows)
    const maxCardWByHeight = Math.floor(maxCardHByHeight * 671 / 1121)
    const nextCardW = Math.max(30, Math.min(targetCardW, maxCardWByWidth, maxCardWByHeight))

    if (Math.abs(nextCardW - cardW) <= 1) {
      cardW = nextCardW
      break
    }

    cardW = nextCardW
  }

  const cardH = Math.round(cardW * 1121 / 671)
  drawCardsInZone(cardsToDraw, cardAreaX, cardAreaY, cardAreaW, cardW, cardH)
}

function drawCenterPanel(x, y, w, h) {
  const meal = meals[currentMealIndex]

  // 方案一：浅底状态卡，替代原来的整块黑色信息条
  drawRoundRect(x, y, w, h, 18, '#FFF6E8', '#111', 3)

  // 左侧餐次标题
  drawText(`${currentMealIndex + 1}/${meals.length}  ${mealName(meal)}`, x + 16, y + 10, currentLang === 'en' ? 17 : 19, '#111', 'left', 'bold')

  // 右侧红色警戒线标签
  const badgeW = currentLang === 'en' ? 132 : 128
  const badgeH = 26
  const badgeX = x + w - badgeW - 12
  const badgeY = y + 8
  drawRoundRect(badgeX, badgeY, badgeW, badgeH, 13, '#FF4A3D', '#111', 2)
  drawText(L(`警戒线 ${meal.threshold} kcal`, `Limit ${meal.threshold} kcal`), badgeX + badgeW / 2, badgeY + 6, 12, '#fff', 'center', 'bold')

  // 底部提示语，改成深色文字，和浅底卡统一
  wrapText(message, x + 16, y + 40, w - 32, 17, 13, '#333', 'bold', 1)

  // 组合 / 结算提示保留，但改成绿色文字，不再用黑底承载
  if (comboMessage) {
    wrapText(comboMessage, x + 16, y + 56, w - 32, 15, 11, '#0E5C44', 'bold', 1)
  }
}

function drawCategoryIcon(type, cx, cy, s, color) {
  const c = color || '#111'

  ctx.strokeStyle = c
  ctx.fillStyle = c
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (type === '荤') {
    // 鸡腿 / 肉类图标
    ctx.beginPath()
    ctx.arc(cx - s * 0.08, cy - s * 0.05, s * 0.32, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = c
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx + s * 0.08, cy + s * 0.12)
    ctx.lineTo(cx + s * 0.36, cy + s * 0.36)
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(cx + s * 0.42, cy + s * 0.42, s * 0.11, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx + s * 0.28, cy + s * 0.48, s * 0.09, 0, Math.PI * 2)
    ctx.stroke()
  } else if (type === '素') {
    // 叶子图标
    ctx.beginPath()
    ctx.moveTo(cx - s * 0.42, cy + s * 0.12)
    ctx.quadraticCurveTo(cx - s * 0.18, cy - s * 0.46, cx + s * 0.42, cy - s * 0.30)
    ctx.quadraticCurveTo(cx + s * 0.22, cy + s * 0.30, cx - s * 0.42, cy + s * 0.12)
    ctx.fill()

    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(cx - s * 0.24, cy + s * 0.06)
    ctx.lineTo(cx + s * 0.22, cy - s * 0.18)
    ctx.stroke()
  } else if (type === '主食') {
    // 米饭碗图标
    ctx.strokeStyle = c
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx - s * 0.42, cy)
    ctx.quadraticCurveTo(cx, cy + s * 0.48, cx + s * 0.42, cy)
    ctx.closePath()
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(cx, cy - s * 0.04, s * 0.38, Math.PI, Math.PI * 2)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(cx - s * 0.22, cy - s * 0.18)
    ctx.lineTo(cx - s * 0.12, cy - s * 0.35)
    ctx.moveTo(cx, cy - s * 0.20)
    ctx.lineTo(cx + s * 0.02, cy - s * 0.40)
    ctx.moveTo(cx + s * 0.22, cy - s * 0.18)
    ctx.lineTo(cx + s * 0.14, cy - s * 0.35)
    ctx.stroke()
  } else {
    // 蛋糕 / 甜点图标
    ctx.strokeStyle = c
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx - s * 0.38, cy + s * 0.24)
    ctx.lineTo(cx + s * 0.38, cy + s * 0.24)
    ctx.lineTo(cx + s * 0.28, cy - s * 0.14)
    ctx.lineTo(cx - s * 0.28, cy - s * 0.14)
    ctx.closePath()
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(cx - s * 0.25, cy - s * 0.14)
    ctx.quadraticCurveTo(cx, cy - s * 0.42, cx + s * 0.25, cy - s * 0.14)
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(cx + s * 0.08, cy - s * 0.34, s * 0.06, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawTinyDeliveryBag(x, y, s, color) {
  const c = color || '#111'

  ctx.strokeStyle = c
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  drawRoundRect(x, y + s * 0.24, s, s * 0.72, s * 0.12, null, c, 1.6)

  ctx.beginPath()
  ctx.moveTo(x + s * 0.28, y + s * 0.30)
  ctx.quadraticCurveTo(x + s * 0.50, y, x + s * 0.72, y + s * 0.30)
  ctx.stroke()
}

function drawTinyScooter(x, y, s, color) {
  const c = color || '#111'

  ctx.strokeStyle = c
  ctx.fillStyle = c
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  ctx.arc(x + s * 0.18, y + s * 0.78, s * 0.12, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + s * 0.78, y + s * 0.78, s * 0.12, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x + s * 0.22, y + s * 0.64)
  ctx.lineTo(x + s * 0.52, y + s * 0.64)
  ctx.quadraticCurveTo(x + s * 0.70, y + s * 0.64, x + s * 0.78, y + s * 0.48)
  ctx.lineTo(x + s * 0.88, y + s * 0.48)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(x + s * 0.70, y + s * 0.46)
  ctx.lineTo(x + s * 0.66, y + s * 0.22)
  ctx.lineTo(x + s * 0.80, y + s * 0.22)
  ctx.stroke()

  drawRoundRect(x + s * 0.26, y + s * 0.34, s * 0.22, s * 0.20, s * 0.04, null, c, 1.6)
}

function drawStickerButton(id, type, x, y, w, h, disabled) {
  buttons.push({ id, text: type, x, y, w, h })

  // 简洁贴纸按钮：外卖感放在整体标题里，不再把图标/英文/外卖字塞进按钮
  const bgColor = disabled ? '#DADADA' : TYPE_COLORS[type]
  const textColor = disabled ? '#555' : '#111'
  const shadowColor = disabled ? '#777' : '#111'

  // 黑色错位阴影，做成实体贴纸感
  drawRoundRect(x + 3, y + 4, w, h, 12, shadowColor, null, 0)

  // 主按钮
  drawRoundRect(x, y, w, h, 12, bgColor, '#111', 2.4)

  // 顶部轻微高光，避免像系统按钮
  ctx.save()
  ctx.globalAlpha = disabled ? 0.12 : 0.22
  drawRoundRect(x + 5, y + 4, w - 10, Math.max(8, h * 0.32), 8, '#FFFFFF', null, 0)
  ctx.restore()

  // 中心文字，尽量干净
  const label = typeLabel(type)
  const fontSize = currentLang === 'en'
    ? (label.length > 6 ? 10 : label.length > 4 ? 12 : 14)
    : (label.length > 1 ? 17 : 20)
  drawText(label, x + w / 2, y + h / 2 - fontSize / 2 - 1, fontSize, textColor, 'center', 'bold')
}

function drawCleanStandButton(id, text, x, y, w, h, subText) {
  buttons.push({ id, text, x, y, w, h })

  // 右侧主按钮也去掉外卖小车，和左侧贴纸保持统一
  drawRoundRect(x + 4, y + 5, w, h, 17, '#111', null, 0)
  drawRoundRect(x, y, w, h, 17, '#FFE169', '#111', 2.8)

  ctx.save()
  ctx.globalAlpha = 0.18
  drawRoundRect(x + 7, y + 6, w - 14, Math.max(14, h * 0.30), 12, '#FFFFFF', null, 0)
  ctx.restore()

  const mainSize = currentLang === 'en'
    ? (text.length >= 12 ? 14 : text.length >= 8 ? 16 : 21)
    : (text.length >= 4 ? 19 : 24)
  drawText(text, x + w / 2, y + h / 2 - mainSize / 2 - 8, mainSize, '#111', 'center', 'bold')

  if (subText) {
    drawText(subText, x + w / 2, y + h - 22, 10, '#5C4300', 'center', 'bold')
  }
}

function drawGameButtons() {
  // 清爽版：外卖元素只作为区域标题，不塞进每个按钮
  // 卡牌是主角，底部按钮只做干净的“分类贴纸 + 主按钮”
  const y = H - SAFE_BOTTOM - 86
  const gap = 10
  const totalW = W - 32
  const leftW = Math.floor(totalW * 0.52)
  const standW = totalW - leftW - gap
  const buttonH = 72

  if (!mealEnded) {
    const self = sides.self
    const isNight = isNightMeal()

    const drawDisabled = isNight
      ? records.self.dayOrdersUsed >= TOTAL_ORDERS_PER_DAY || self.stood || self.busted
      : (!isSelfOpeningPhase() && records.self.dayOrdersUsed >= TOTAL_ORDERS_PER_DAY) || self.stood || self.busted

    const leftX = 16
    const leftY = y
    const innerGap = 8
    const smallW = (leftW - innerGap) / 2
    const smallH = (buttonH - innerGap) / 2

    // 区域标题：保留“点外卖”的主题，但不干扰按钮本身
    drawText(L('叫外卖', 'Order'), leftX + 2, leftY - 17, 12, '#111', 'left', 'bold')
    drawText(`${records.self.dayOrdersUsed}/${TOTAL_ORDERS_PER_DAY}`, leftX + leftW - 2, leftY - 17, 12, '#777', 'right', 'bold')

    drawStickerButton('draw_meat', '荤', leftX, leftY, smallW, smallH, drawDisabled)
    drawStickerButton('draw_veg', '素', leftX + smallW + innerGap, leftY, smallW, smallH, drawDisabled)
    drawStickerButton('draw_staple', '主食', leftX, leftY + smallH + innerGap, smallW, smallH, drawDisabled)
    drawStickerButton('draw_dessert', '甜点', leftX + smallW + innerGap, leftY + smallH + innerGap, smallW, smallH, drawDisabled)

    let standText = L('收手', 'Stand')
    let standSubText = L('确认热量', 'Lock calories')

    if (isNight) {
      standText = L('揭晓夜宵', 'Reveal')
      standSubText = L('打开订单', 'Open orders')
    } else if (self.busted) {
      standText = L('结算', 'Settle')
      standSubText = L('热量爆表', 'Busted')
    }

    drawCleanStandButton(
      'stand',
      standText,
      16 + leftW + gap,
      y,
      standW,
      buttonH,
      standSubText
    )
  } else {
    if (currentMealIndex >= meals.length - 1) {
      drawCleanStandButton('next', L('今日结算', 'Final Result'), 16, y, W - 32, buttonH, L('查看最终订单', 'View all orders'))
    } else {
      drawCleanStandButton('next', L('进入下一餐', 'Next Meal'), 16, y, W - 32, buttonH, L('继续点下一单', 'Keep ordering'))
    }
  }
}
// 【替换】战斗界面布局：避开灵动岛，并整体压缩一点
function drawBattleScreen() {
  // 手机专用竖屏布局：不再把内容硬拉满全屏，
  // 先保证顶部不空、底部按钮不贴边。
  const actionH = 92
  const actionY = H - SAFE_BOTTOM - actionH

  const topY = SAFE_TOP
  const centerH = 68
  const gap = 8

  const availableH = actionY - topY - 10

  let zoneH = Math.floor((availableH - centerH - gap * 2) / 2)

  // 控制玩家区域高度，避免长屏手机上框太高、卡太小。
  zoneH = Math.max(188, Math.min(246, zoneH))

  const opponentY = topY
  const centerY = opponentY + zoneH + gap
  const selfY = centerY + centerH + gap

  drawBattleZone('opponent', 16, opponentY, W - 32, zoneH)
  drawCenterPanel(16, centerY, W - 32, centerH)
  drawBattleZone('self', 16, selfY, W - 32, zoneH)

  drawGameButtons()
}

// =========================
// 结果页
// =========================

function drawResultScreen() {
  drawText(L('今日结算', 'Final Result'), 16, SAFE_TOP + 4, currentLang === 'en' ? 25 : 28, '#111', 'left', 'bold')

  const selfFinalPoint = getFinalPoint('self')
  const opponentFinalPoint = getFinalPoint('opponent')

  let y = SAFE_TOP + 54

  drawRoundRect(16, y, W - 32, 108, 22, '#FFFFFF', '#111', 3)

  drawText(L(`你 ${selfFinalPoint} : ${opponentFinalPoint} 对手`, `You ${selfFinalPoint} : ${opponentFinalPoint} Rival`), W / 2, y + 18, currentLang === 'en' ? 24 : 28, '#111', 'center', 'bold')

  const selfDay = getDayTotalKcal('self')
  const opponentDay = getDayTotalKcal('opponent')

  drawText(L(`你全日热量：${selfDay} kcal`, `Your day: ${selfDay} kcal`), 32, y + 60, currentLang === 'en' ? 13 : 15, '#111', 'left', 'bold')
  drawText(L(`对手：${opponentDay} kcal`, `Rival: ${opponentDay} kcal`), W - 32, y + 60, currentLang === 'en' ? 13 : 15, '#111', 'right', 'bold')

  const dayPointText = getDayTotalPoint('self') === 1
    ? L('全日总热量点：你 +1', 'Day total point: You +1')
    : getDayTotalPoint('opponent') === 1
      ? L('全日总热量点：对手 +1', 'Day total point: Rival +1')
      : L('全日总热量点：平局', 'Day total point: Tie')

  drawText(dayPointText, W / 2, y + 84, 14, '#E94335', 'center', 'bold')

  y += 126

  for (let i = 0; i < meals.length; i++) {
    const meal = meals[i]

    const selfRawKcal = records.self.rawMealKcal[i] || records.self.mealKcal[i]
    const opponentRawKcal = records.opponent.rawMealKcal[i] || records.opponent.mealKcal[i]

    const selfCountedKcal = records.self.mealKcal[i]
    const opponentCountedKcal = records.opponent.mealKcal[i]

    const selfBusted = selfRawKcal > meal.threshold
    const opponentBusted = opponentRawKcal > meal.threshold

    const selfPoint = getMealPoint('self', i)
    const opponentPoint = getMealPoint('opponent', i)

    const selfCombo = records.self.comboResults[i]
    const opponentCombo = records.opponent.comboResults[i]

    drawRoundRect(16, y, W - 32, 96, 16, '#FFFFFF', '#111', 2)

    drawText(mealName(meal), 32, y + 12, currentLang === 'en' ? 13 : 18, '#111', 'left', 'bold')

    const resultSelfX = currentLang === 'en' ? 112 : 94
    const resultOpponentX = currentLang === 'en' ? 204 : 174
    const resultFontSize = currentLang === 'en' ? 11 : 15

    const selfKcalText = selfBusted
      ? L(`你 ${selfRawKcal}爆`, `You ${selfRawKcal} bust`)
      : L(`你 ${selfCountedKcal}`, `You ${selfCountedKcal}`)

    const opponentKcalText = opponentBusted
      ? L(`对手 ${opponentRawKcal}爆`, `Rival ${opponentRawKcal} bust`)
      : L(`对手 ${opponentCountedKcal}`, `Rival ${opponentCountedKcal}`)

    drawText(selfKcalText, resultSelfX, y + 14, resultFontSize, selfBusted ? '#E94335' : '#111', 'left', 'bold')
    drawText(opponentKcalText, resultOpponentX, y + 14, resultFontSize, opponentBusted ? '#E94335' : '#111', 'left', 'bold')
    drawText(`${selfPoint}:${opponentPoint}`, W - 32, y + 14, 16, '#E94335', 'right', 'bold')

    let line = ''

    if (selfBusted) {
      line += L(`你：爆牌不计入`, `You: bust, not counted`)
    } else if (selfCombo) {
      line += `${L('你', 'You')}: ${comboDisplayName(selfCombo)}`
    } else {
      line += L('你：无组合', 'You: no combo')
    }

    line += L(' ｜ ', ' | ')

    if (opponentBusted) {
      line += L(`对手：爆牌不计入`, `Rival: bust, not counted`)
    } else if (opponentCombo) {
      line += `${L('对手', 'Rival')}: ${comboDisplayName(opponentCombo)}`
    } else {
      line += L('对手：无组合', 'Rival: no combo')
    }

    wrapText(line, 32, y + 44, W - 64, 18, 13, '#555', 'bold', 2)

    y += 106
  }

  if (records.self.dayBonusKcal > 0 || records.opponent.dayBonusKcal > 0) {
    const selfBonus = records.self.dayBonusKcal
    const opponentBonus = records.opponent.dayBonusKcal

    drawText(
      L(`奖励热量：你 +${selfBonus} / 对手 +${opponentBonus}`, `Bonus kcal: You +${selfBonus} / Rival +${opponentBonus}`),
      24,
      y + 2,
      14,
      '#E94335',
      'left',
      'bold'
    )
  }

  addButton('restart', L('重新开始', 'Restart'), 16, H - SAFE_BOTTOM - 64, W - 32, 54, '#111', '#fff', 20)
}
// =========================
// 开始画面
// =========================

function drawStartScreen() {
  buttons = []

  preloadGameImages()
  const preloadProgress = getImagePreloadProgress()
  const preloadDone = preloadProgress.done

  ctx.clearRect(0, 0, W, H)

  ctx.fillStyle = '#F7F1E8'
  ctx.fillRect(0, 0, W, H)

  // 背景装饰
  drawRoundRect(-42, H - 220, 150, 150, 36, '#A9F0D1', null, 0)
  drawRoundRect(W - 96, SAFE_TOP + 70, 130, 130, 32, '#FF9BB4', null, 0)
  drawRoundRect(38, SAFE_TOP + 150, 96, 96, 26, '#FFE169', null, 0)

  // 主标题卡片
  const panelX = 24
  const panelY = SAFE_TOP + 42
  const panelW = W - 48
  const panelH = H - panelY - 260

  drawRoundRect(panelX, panelY, panelW, panelH, 28, '#FFFFFF', '#111', 4)

  // 主页语言切换按钮
  addButton(
    'lang_toggle',
    currentLang === 'zh' ? 'EN' : '中文',
    panelX + panelW - 78,
    panelY + 14,
    58,
    30,
    '#FFFFFF',
    '#111',
    14
  )

  drawText('利禄卡', W / 2, panelY + 24, 46, '#111', 'center', 'bold')
  drawText('LILU CARDS', W / 2, panelY + 82, 16, '#555', 'center', 'bold')

  drawRoundRect(W / 2 - 98, panelY + 116, 196, 40, 18, '#111', null, 0)
  drawText(L('卡路里外卖对战', 'Calorie Delivery Duel'), W / 2, panelY + 126, currentLang === 'en' ? 14 : 17, '#FFE169', 'center', 'bold')

  if (!rulesExpanded) {
    // 收起状态：只显示游戏口号
    drawText(L('我的嘴，就是秤。', 'My mouth is the scale.'), W / 2, panelY + 208, currentLang === 'en' ? 24 : 28, '#111', 'center', 'bold')
    drawText(L('偷偷点外卖，认真算输赢。', 'Order in secret. Count like your life depends on it.'), W / 2, panelY + 252, currentLang === 'en' ? 12 : 15, '#555', 'center', 'bold')
  } else {
    // 展开状态：中英双语完整说明书
    const textX = panelX + 22
    let textY = panelY + 158
    const textW = panelW - 44
    const fs = currentLang === 'en' ? 11.5 : 13
    const lh = currentLang === 'en' ? 16 : 18

    drawText(L('游戏规则', 'Rules'), textX, textY, 21, '#111', 'left', 'bold')
    textY += 28

    const ruleLines = currentLang === 'en'
      ? [
          '1. Four meals: Breakfast 400, Lunch 800, Dinner 600, Midnight Snack 800.',
          '2. Each meal starts with 2 opening cards: card 1 is hidden, card 2 is open. They do not cost orders.',
          `3. Choose Meat, Veg, Staple, or Dessert. You have ${TOTAL_ORDERS_PER_DAY} delivery orders per day.`,
          '4. Go over the calorie limit and you bust: lose this meal, calories do not count, no combo.',
          '5. If nobody busts, the higher calorie total wins the meal. If both bust, nobody scores.',
          '6. Middle combos: Double Combo / One-Track Meal. Reward: 1 Meat card added to day total.',
          '7. High combos: Full Feast / Line Master. Reward: meal point +1.',
          '8. Midnight Snack: choose all remaining orders first, then reveal. Final score = meal points + day-total point.'
        ]
      : [
          '1. 四餐：早餐400，午餐800，晚餐600，夜宵800。',
          '2. 每餐先抽2张：第1张底牌，第2张明牌；不消耗外卖。',
          `3. 可选荤、素、主食、甜点；全天共${TOTAL_ORDERS_PER_DAY}次外卖。`,
          '4. 超过警戒线即爆牌：输本餐，热量不计入，也无组合。',
          '5. 未爆牌时，热量更高者赢本餐；双方爆牌则无人得分。',
          '6. 中级组合：双拼/偏科，奖励1张荤牌进全日热量。',
          '7. 高级组合：满汉大餐/卡线大师，本餐胜局+1。',
          '8. 夜宵一次性选完再揭晓；最终分=四餐胜局+全日热量分。'
        ]

    ruleLines.forEach(line => {
      textY = wrapText(line, textX, textY, textW, lh, fs, '#333', 'bold', 2)
      textY += currentLang === 'en' ? 1 : 3
    })
  }

  // 规则展开 / 收起按钮
  addButton(
    'rules_toggle',
    rulesExpanded ? L('收起规则', 'Hide Rules') : L('游戏规则', 'Rules'),
    32,
    H - SAFE_BOTTOM - 238,
    W - 64,
    42,
    '#FFFFFF',
    '#111',
    17
  )

  // 抖音侧边栏复访按钮
  addButton(
    'sidebar',
    L('侧边栏复访', 'Sidebar Return'),
    32,
    H - SAFE_BOTTOM - 188,
    W - 64,
    42,
    '#FFFFFF',
    '#111',
    17
  )

  // 底部开始按钮：图片未预加载完成时不进入游戏，避免卡牌闪旧版占位。
  const startButtonText = preloadDone
    ? L('开始游戏', 'Start Game')
    : L(
        `图片加载中 ${preloadProgress.loaded + preloadProgress.failed}/${preloadProgress.total}`,
        `Loading images ${preloadProgress.loaded + preloadProgress.failed}/${preloadProgress.total}`
      )

  addButton(
    preloadDone ? 'start' : 'loading',
    startButtonText,
    32,
    H - SAFE_BOTTOM - 112,
    W - 64,
    62,
    preloadDone ? '#111' : '#777',
    '#fff',
    preloadDone ? 24 : 18
  )

  if (preloadDone && preloadProgress.failed > 0) {
    drawText(
      L(
        `有 ${preloadProgress.failed} 张图片未加载，将显示占位卡`,
        `${preloadProgress.failed} images failed. Placeholder cards will be shown`
      ),
      W / 2,
      H - SAFE_BOTTOM - 42,
      11,
      '#E94335',
      'center',
      'bold'
    )
  }
}
// =========================
// 主渲染
// =========================

function render() {
  buttons = []

  ctx.clearRect(0, 0, W, H)

  ctx.fillStyle = '#F7F1E8'
  ctx.fillRect(0, 0, W, H)

  // 还没开始时，显示开始画面
  if (!gameStarted) {
    drawStartScreen()
    return
  }

  if (gameEnded) {
    drawResultScreen()
    return
  }

  drawBattleScreen()
}
function hitButton(x, y) {
  for (let i = buttons.length - 1; i >= 0; i--) {
    const b = buttons[i]

    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      return b.id
    }
  }

  return null
}

function handleTouch(e) {
  const touch = e.touches && e.touches[0]
  if (!touch) return

  const x = touch.clientX
  const y = touch.clientY

  const id = hitButton(x, y)

  if (!id) return

if (id === 'lang_toggle') {
  toggleLanguage()
  return
}
if (id === 'rules_toggle') {
  rulesExpanded = !rulesExpanded
  render()
  return
}
if (id === 'sidebar') {
  goToSidebar()
  return
}
if (id === 'start') {
  if (!areGameImagesReady()) {
    render()
    return
  }

  startGame()
  return
}
  if (id === 'draw_meat') {
    playerDraw('荤')
    return
  }

  if (id === 'draw_veg') {
    playerDraw('素')
    return
  }

  if (id === 'draw_staple') {
    playerDraw('主食')
    return
  }

  if (id === 'draw_dessert') {
    playerDraw('甜点')
    return
  }

  if (id === 'stand') {
    playerStand()
    return
  }

  if (id === 'next') {
    goNextMeal()
    return
  }

  if (id === 'restart') {
    startGame()
    return
  }
}

GAME_API.onTouchStart(handleTouch)

render()
