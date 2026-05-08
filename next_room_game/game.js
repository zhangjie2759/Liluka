// game.js - 《下一间》v7
// 更新：
// 1. 安全房间开门后，不再直接切下一间
// 2. 会播放“进入空间 → 看到下一道门”的推进动画
// 3. 鬼房间仍然需要关门 + 点击封印 + 贴封条
// 4. 三种鬼：巨大鬼慢、细长鬼快、普通鬼正常

const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')

const sys = wx.getSystemInfoSync()
const W = sys.windowWidth
const H = sys.windowHeight

canvas.width = W
canvas.height = H

let gameState = 'playing'

let room = 1
let best = wx.getStorageSync('bestRoomV7') || 1

let dragging = false
let startX = 0
let startDoorOpen = 0

let doorOpen = 0
let roomContent = 'empty' // ghost / fake / empty
let ghostType = 'normal' // big / thin / normal

let contentVisible = false
let hasSeenContent = false

let danger = 0
let dangerSpeed = 0.02
let ghostThreshold = 0.35

let isChangingRoom = false
let sealAnim = 0
let sealSuccess = false

let enterAnim = 0 // 安全进入房间动画 0~1
let enteringRoom = false

const sealButton = {
  x: W * 0.3,
  y: H * 0.85,
  w: W * 0.4,
  h: 58
}

function randomContent() {
  const r = Math.random()
  if (r < 0.4) return 'ghost'
  if (r < 0.65) return 'fake'
  return 'empty'
}

function randomGhostType() {
  const r = Math.random()
  if (r < 0.33) return 'big'
  if (r < 0.66) return 'thin'
  return 'normal'
}

function newRoom() {
  dragging = false
  startX = 0
  startDoorOpen = 0

  doorOpen = 0
  roomContent = randomContent()
  ghostType = roomContent === 'ghost' ? randomGhostType() : 'normal'

  contentVisible = false
  hasSeenContent = false
  danger = 0

  isChangingRoom = false
  sealAnim = 0
  sealSuccess = false
  enterAnim = 0
  enteringRoom = false

  ghostThreshold = [0.24, 0.34, 0.48][Math.floor(Math.random() * 3)]

  const base = 0.012 + room * 0.001

  if (ghostType === 'big') dangerSpeed = base * 0.7
  else if (ghostType === 'thin') dangerSpeed = base * 1.8
  else dangerSpeed = base * 1.1
}

function finishNextRoom() {
  room++

  if (room > best) {
    best = room
    wx.setStorageSync('bestRoomV7', best)
  }

  newRoom()
}

function nextRoomAfterSeal() {
  if (isChangingRoom) return
  isChangingRoom = true

  room++

  if (room > best) {
    best = room
    wx.setStorageSync('bestRoomV7', best)
  }

  setTimeout(() => {
    newRoom()
  }, 520)
}

function startEnterRoom() {
  if (isChangingRoom) return
  isChangingRoom = true
  enteringRoom = true
  enterAnim = 0
}

function gameOver() {
  gameState = 'gameover'
}

function inSealButton(x, y) {
  return (
    x >= sealButton.x &&
    x <= sealButton.x + sealButton.w &&
    y >= sealButton.y &&
    y <= sealButton.y + sealButton.h
  )
}

wx.onTouchStart((e) => {
  const x = e.touches[0].clientX
  const y = e.touches[0].clientY

  if (gameState === 'gameover') {
    room = 1
    gameState = 'playing'
    newRoom()
    return
  }

  if (gameState !== 'playing') return
  if (isChangingRoom) return

  // 只有关门后，且看见过内容，才能点封印
  if (doorOpen <= 0.05 && hasSeenContent && inSealButton(x, y)) {
    if (roomContent === 'ghost') {
      sealSuccess = true
      sealAnim = 0
      nextRoomAfterSeal()
    } else {
      gameOver()
    }
    return
  }

  dragging = true
  startX = x
  startDoorOpen = doorOpen
})

wx.onTouchMove((e) => {
  if (!dragging || gameState !== 'playing') return
  if (isChangingRoom) return

  const x = e.touches[0].clientX
  const dx = startX - x

  doorOpen = startDoorOpen + dx / (W * 0.55)
  doorOpen = Math.max(0, Math.min(1, doorOpen))
})

wx.onTouchEnd(() => {
  dragging = false
})

function update() {
  if (gameState !== 'playing') return

  if (sealSuccess) {
    sealAnim += 0.08
    if (sealAnim > 1) sealAnim = 1
  }

  if (enteringRoom) {
    enterAnim += 0.035
    if (enterAnim >= 1) {
      enterAnim = 1
      finishNextRoom()
    }
    return
  }

  if (isChangingRoom) return

  if (roomContent === 'ghost' && doorOpen > ghostThreshold) {
    contentVisible = true
    hasSeenContent = true
  }

  if (roomContent === 'fake' && doorOpen > 0.4) {
    contentVisible = true
    hasSeenContent = true
  }

  if (roomContent === 'empty' && doorOpen > 0.5) {
    hasSeenContent = true
  }

  // 鬼被看见后，只要门还开着，危险值上涨
  if (roomContent === 'ghost' && contentVisible && doorOpen > 0.05) {
    danger += dangerSpeed
    if (danger >= 1) {
      danger = 1
      gameOver()
    }
  }

  // 没鬼，开到足够大，播放进入房间动画
  if (roomContent !== 'ghost' && doorOpen > 0.92) {
    startEnterRoom()
  }
}

function roundRect(x, y, w, h, r) {
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
}

function drawGhost(cx, cy, frameW, frameH) {
  const alpha = Math.min(1, 0.35 + danger * 0.65)
  let scale = 1 + danger * 0.7

  if (ghostType === 'big') {
    scale *= 1.45

    ctx.fillStyle = `rgba(0,0,0,${alpha})`
    roundRect(cx - 70 * scale, cy - 95 * scale, 140 * scale, 190 * scale, 50)
    ctx.fill()

    ctx.fillStyle = `rgba(220,220,210,${alpha})`
    ctx.beginPath()
    ctx.ellipse(cx, cy - 42 * scale, 42 * scale, 52 * scale, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (ghostType === 'thin') {
    scale *= 0.82

    ctx.fillStyle = `rgba(0,0,0,${alpha})`
    roundRect(cx - 24 * scale, cy - 135 * scale, 48 * scale, 260 * scale, 22)
    ctx.fill()

    ctx.fillStyle = `rgba(220,220,210,${alpha})`
    ctx.beginPath()
    ctx.ellipse(cx, cy - 78 * scale, 22 * scale, 42 * scale, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = `rgba(0,0,0,${alpha})`
    roundRect(cx - 50 * scale, cy - 90 * scale, 100 * scale, 180 * scale, 38)
    ctx.fill()

    ctx.fillStyle = `rgba(220,220,210,${alpha})`
    ctx.beginPath()
    ctx.ellipse(cx, cy - 45 * scale, 32 * scale, 44 * scale, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // 眼睛
  ctx.fillStyle = '#000'
  ctx.beginPath()
  ctx.arc(cx - 13 * scale, cy - 55 * scale, 5 + danger * 5, 0, Math.PI * 2)
  ctx.arc(cx + 13 * scale, cy - 55 * scale, 5 + danger * 5, 0, Math.PI * 2)
  ctx.fill()

  // 压迫感闪白
  if (danger > 0.6) {
    ctx.fillStyle = `rgba(255,255,255,${(danger - 0.6) * 0.4})`
    ctx.beginPath()
    ctx.arc(cx, cy - 50 * scale, 70 + danger * 35, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawFake(cx, cy) {
  ctx.strokeStyle = '#8b806c'
  ctx.lineWidth = 5

  ctx.beginPath()
  ctx.arc(cx, cy - 80, 22, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx, cy - 56)
  ctx.lineTo(cx, cy + 48)
  ctx.moveTo(cx - 42, cy - 20)
  ctx.lineTo(cx + 42, cy - 20)
  ctx.moveTo(cx, cy + 48)
  ctx.lineTo(cx - 28, cy + 96)
  ctx.moveTo(cx, cy + 48)
  ctx.lineTo(cx + 28, cy + 96)
  ctx.stroke()
}

function drawInnerRoom(frameX, frameY, frameW, frameH, depthScale = 1) {
  ctx.fillStyle = '#10100f'
  ctx.fillRect(frameX, frameY, frameW, frameH)

  // 深处空间
  const backW = frameW * 0.64 * depthScale
  const backH = frameH * 0.66 * depthScale
  const backX = frameX + (frameW - backW) / 2
  const backY = frameY + frameH * 0.12

  ctx.fillStyle = '#050505'
  ctx.fillRect(backX, backY, backW, backH)

  // 下一道门的轮廓，让安全进入时更有“下一间”的感觉
  if (roomContent !== 'ghost' || enteringRoom) {
    ctx.strokeStyle = 'rgba(90,72,48,0.8)'
    ctx.lineWidth = 3
    const nextDoorW = frameW * 0.24 * depthScale
    const nextDoorH = frameH * 0.42 * depthScale
    const nextDoorX = frameX + frameW * 0.5 - nextDoorW / 2
    const nextDoorY = frameY + frameH * 0.26
    ctx.strokeRect(nextDoorX, nextDoorY, nextDoorW, nextDoorH)

    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.fillRect(nextDoorX + 4, nextDoorY + 4, nextDoorW - 8, nextDoorH - 8)
  }

  // 地面
  ctx.fillStyle = '#151310'
  ctx.fillRect(frameX, frameY + frameH * 0.72, frameW, frameH * 0.28)

  if (!contentVisible) return

  const cx = frameX + frameW * 0.5
  const cy = frameY + frameH * 0.52

  if (roomContent === 'ghost') {
    drawGhost(cx, cy, frameW, frameH)
  }

  if (roomContent === 'fake') {
    drawFake(cx, cy)
  }
}

function drawDoorPanel(frameX, frameY, frameW, frameH) {
  const panelW = frameW * 1.08
  const panelH = frameH
  const maxSlide = frameW * 0.82
  const slide = doorOpen * maxSlide

  const panelX = frameX + frameW - panelW - slide
  const panelY = frameY

  ctx.fillStyle = '#38271d'
  ctx.fillRect(panelX, panelY, panelW, panelH)

  // 木纹
  ctx.fillStyle = 'rgba(255,255,255,0.055)'
  for (let i = 0; i < 12; i++) {
    const x = panelX + 24 + i * (panelW - 48) / 11
    ctx.fillRect(x, panelY + 18, 2, panelH - 36)
  }

  // 门边
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.fillRect(panelX, panelY, 8, panelH)
  ctx.fillRect(panelX + panelW - 8, panelY, 8, panelH)

  // 长条抓手
  const handleW = 26
  const handleH = 118
  const handleX = panelX + panelW * 0.78
  const handleY = panelY + panelH * 0.47 - handleH / 2

  ctx.fillStyle = '#090909'
  roundRect(handleX, handleY, handleW, handleH, 13)
  ctx.fill()

  ctx.strokeStyle = '#9a8a69'
  ctx.lineWidth = 3
  roundRect(handleX, handleY, handleW, handleH, 13)
  ctx.stroke()

  ctx.fillStyle = '#252525'
  roundRect(handleX + 7, handleY + 14, handleW - 14, handleH - 28, 8)
  ctx.fill()

  return { panelX, panelY, panelW, panelH }
}

function drawSealButton() {
  const canSeal = doorOpen <= 0.05 && hasSeenContent && !isChangingRoom

  if (!canSeal) return

  ctx.fillStyle = '#8b1e1e'
  roundRect(sealButton.x, sealButton.y, sealButton.w, sealButton.h, 12)
  ctx.fill()

  ctx.strokeStyle = '#d8bd75'
  ctx.lineWidth = 2
  roundRect(sealButton.x, sealButton.y, sealButton.w, sealButton.h, 12)
  ctx.stroke()

  ctx.fillStyle = '#f5df9b'
  ctx.font = '24px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('封 印', W / 2, sealButton.y + 37)
}

function drawSealOnDoor(frameX, frameY, frameW, frameH) {
  if (!sealSuccess) return

  const t = sealAnim

  const startX = W / 2
  const startY = sealButton.y + sealButton.h / 2

  const endX = frameX + frameW * 0.5
  const endY = frameY + frameH * 0.47

  const ease = 1 - Math.pow(1 - t, 3)

  const x = startX + (endX - startX) * ease
  const y = startY + (endY - startY) * ease

  const scale = 0.75 + 0.45 * Math.sin(Math.min(1, t) * Math.PI)
  const w = 54 * scale
  const h = 126 * scale

  ctx.save()
  ctx.translate(x, y)

  if (t > 0.82) {
    ctx.scale(1.08, 0.94)
  }

  ctx.fillStyle = '#e5c76c'
  ctx.fillRect(-w / 2, -h / 2, w, h)

  ctx.strokeStyle = '#9f2020'
  ctx.lineWidth = 3
  ctx.strokeRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8)

  ctx.fillStyle = '#9f2020'
  ctx.font = `${Math.floor(28 * scale)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('封', 0, 0)

  ctx.restore()
}

function drawEnterTransition(baseFrameX, baseFrameY, baseFrameW, baseFrameH) {
  if (!enteringRoom) return

  const t = enterAnim
  const ease = t * t * (3 - 2 * t)

  // 镜头推进：中间房间放大，四周变暗
  ctx.save()

  const zoom = 1 + ease * 1.8
  const cx = baseFrameX + baseFrameW / 2
  const cy = baseFrameY + baseFrameH / 2

  ctx.translate(cx, cy)
  ctx.scale(zoom, zoom)
  ctx.translate(-cx, -cy)

  // 重新画一个更靠近的内房间
  drawInnerRoom(baseFrameX, baseFrameY, baseFrameW, baseFrameH, 1 + ease * 0.8)

  ctx.restore()

  // 中央下一道门越来越清晰
  const ndW = baseFrameW * (0.24 + ease * 0.22)
  const ndH = baseFrameH * (0.42 + ease * 0.3)
  const ndX = W / 2 - ndW / 2
  const ndY = baseFrameY + baseFrameH * (0.26 - ease * 0.08)

  ctx.strokeStyle = `rgba(150,120,72,${0.5 + ease * 0.5})`
  ctx.lineWidth = 4
  ctx.strokeRect(ndX, ndY, ndW, ndH)

  ctx.fillStyle = `rgba(0,0,0,${0.7 + ease * 0.25})`
  ctx.fillRect(ndX + 5, ndY + 5, ndW - 10, ndH - 10)

  // 暗角
  ctx.fillStyle = `rgba(0,0,0,${ease * 0.5})`
  ctx.fillRect(0, 0, W, H)

  // 最后短暂黑场
  if (t > 0.82) {
    ctx.fillStyle = `rgba(0,0,0,${(t - 0.82) / 0.18})`
    ctx.fillRect(0, 0, W, H)
  }
}

function draw() {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, W, H)

  // 顶部信息
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.font = '22px sans-serif'
  ctx.fillText(`第 ${room} 间`, W / 2, 48)

  ctx.font = '14px sans-serif'
  ctx.fillText(`最高纪录：${best}`, W / 2, 73)

  // 门居中，门可以出画
  const frameW = W * 0.78
  const frameH = H * 0.62
  const frameX = (W - frameW) / 2
  const frameY = H * 0.14

  // 门框
  ctx.fillStyle = '#0b0b0b'
  ctx.fillRect(frameX - 10, frameY - 10, frameW + 20, frameH + 20)

  ctx.strokeStyle = '#2d221a'
  ctx.lineWidth = 4
  ctx.strokeRect(frameX - 10, frameY - 10, frameW + 20, frameH + 20)

  drawInnerRoom(frameX, frameY, frameW, frameH)
  drawDoorPanel(frameX, frameY, frameW, frameH)

  drawSealOnDoor(frameX, frameY, frameW, frameH)
  drawSealButton()

  drawEnterTransition(frameX, frameY, frameW, frameH)

  if (gameState === 'gameover') {
    ctx.fillStyle = 'rgba(0,0,0,0.82)'
    ctx.fillRect(0, 0, W, H)

    ctx.fillStyle = '#fff'
    ctx.font = '32px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('游戏结束', W / 2, H / 2 - 30)

    ctx.font = '18px sans-serif'
    ctx.fillText(`你到达了第 ${room} 间`, W / 2, H / 2 + 10)
    ctx.fillText('点击屏幕重新开始', W / 2, H / 2 + 48)
  }
}

function loop() {
  update()
  draw()
  requestAnimationFrame(loop)
}

newRoom()
loop()
