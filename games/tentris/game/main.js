const COLS = 10
const ROWS = 20
const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
const COLORS = {
  I: '#22b8cf',
  O: '#fcc419',
  T: '#be4bdb',
  S: '#51cf66',
  Z: '#ff6b6b',
  J: '#339af0',
  L: '#ff922b',
}
const SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
}
const LINE_SCORES = [0, 100, 300, 500, 800]
const KICKS = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [-2, 0],
  [2, 0],
]

const wellEl = document.getElementById('well')
const nextEl = document.getElementById('next')
const scoreEl = document.getElementById('score')
const linesEl = document.getElementById('lines')
const levelEl = document.getElementById('level')
const statusEl = document.getElementById('status')
const pauseBtn = document.getElementById('pause')
const wellCtx = wellEl.getContext('2d')
const nextCtx = nextEl.getContext('2d')

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

function rotate(matrix) {
  const n = matrix.length
  const out = Array.from({ length: n }, () => Array(n).fill(0))
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) out[x][n - 1 - y] = matrix[y][x]
  }
  return out
}

function clone(matrix) {
  return matrix.map((row) => row.slice())
}

function bagRandom() {
  let bag = []
  return () => {
    if (!bag.length) {
      bag = TYPES.slice()
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[bag[i], bag[j]] = [bag[j], bag[i]]
      }
    }
    return bag.pop()
  }
}

function cellsOf(piece) {
  const cells = []
  const m = piece.matrix
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (m[y][x]) cells.push({ x: piece.x + x, y: piece.y + y, type: piece.type })
    }
  }
  return cells
}

function collides(board, piece) {
  return cellsOf(piece).some(({ x, y }) => {
    if (x < 0 || x >= COLS || y >= ROWS) return true
    if (y < 0) return false
    return Boolean(board[y][x])
  })
}

function spawnPiece(type) {
  const matrix = clone(SHAPES[type])
  return { type, matrix, x: Math.floor((COLS - matrix.length) / 2), y: -1 }
}

function gravityMs(level) {
  return Math.max(80, Math.round(800 * Math.pow(0.82, level - 1)))
}

const params = new URLSearchParams(location.search)
const kitUrl = params.get('kit') || './vendor/kit.js'

let kit = null
let startLevel = 1
let accent = '#ffd43b'
let showGhost = true
let board = emptyBoard()
let current = null
let nextType = 'T'
let pick = bagRandom()
let score = 0
let lines = 0
let level = 1
let paused = false
let over = false
let acc = 0
let last = 0
let soft = false
let started = false

function hud() {
  scoreEl.textContent = String(score)
  linesEl.textContent = String(lines)
  levelEl.textContent = String(level)
}

function setStatus(text) {
  statusEl.textContent = text
}

function lockPiece() {
  for (const { x, y, type } of cellsOf(current)) {
    if (y < 0) {
      gameOver()
      return
    }
    board[y][x] = type
  }
  const full = []
  for (let y = 0; y < ROWS; y++) {
    if (board[y].every(Boolean)) full.push(y)
  }
  if (full.length) {
    board = board.filter((_, y) => !full.includes(y))
    while (board.length < ROWS) board.unshift(Array(COLS).fill(null))
    const gained = LINE_SCORES[full.length] * level
    score += gained
    lines += full.length
    level = startLevel + Math.floor(lines / 10)
    void reportScore()
  }
  spawn()
  hud()
}

function spawn() {
  current = spawnPiece(nextType)
  nextType = pick()
  if (collides(board, current)) gameOver()
}

function move(dx, dy) {
  if (!current || paused || over) return false
  const next = { ...current, x: current.x + dx, y: current.y + dy }
  if (collides(board, next)) return false
  current = next
  return true
}

function rotateCurrent() {
  if (!current || paused || over) return
  const rotated = { ...current, matrix: rotate(current.matrix) }
  for (const [kx, ky] of KICKS) {
    const next = { ...rotated, x: current.x + kx, y: current.y + ky }
    if (!collides(board, next)) {
      current = next
      return
    }
  }
}

function hardDrop() {
  if (!current || paused || over) return
  let dropped = 0
  while (move(0, 1)) dropped += 1
  score += dropped * 2
  hud()
  lockPiece()
}

function ghost() {
  if (!current || !showGhost) return null
  let ghostPiece = { ...current }
  while (!collides(board, { ...ghostPiece, y: ghostPiece.y + 1 })) {
    ghostPiece = { ...ghostPiece, y: ghostPiece.y + 1 }
  }
  return ghostPiece
}

function tick() {
  if (!move(0, 1)) lockPiece()
}

async function reportScore() {
  if (!kit) return
  try {
    await kit.setState({ score, lines, level })
    await kit.emit('score', { score, result: { lines, level } })
  } catch {
    /* mock or host may reject mid-play */
  }
}

async function gameOver() {
  if (over) return
  over = true
  setStatus(`Game over · ${score}`)
  pauseBtn.textContent = '↻'
  if (!kit) return
  try {
    await kit.setState({ score, lines, level, over: true })
    await kit.emit('finish', { score, result: { score, lines, level } })
  } catch {
    /* already finished */
  }
}

function togglePause() {
  if (over) {
    restart()
    return
  }
  if (!started) return
  paused = !paused
  pauseBtn.textContent = paused ? '▶' : 'II'
  setStatus(paused ? 'Paused' : 'PLAYING')
  if (kit) void kit.emit(paused ? 'pause' : 'start')
}

function restart() {
  board = emptyBoard()
  pick = bagRandom()
  nextType = pick()
  score = 0
  lines = 0
  level = startLevel
  over = false
  paused = false
  acc = 0
  soft = false
  pauseBtn.textContent = 'II'
  spawn()
  hud()
  setStatus('PLAYING')
  if (kit && kit.snapshot.status === 'FINISHED') {
    void kit.emit('start').catch(() => {})
  }
}

function cellSize(canvas, cols, rows) {
  const dpr = window.devicePixelRatio || 1
  const cssW = canvas.clientWidth || cols * 20
  const cssH = canvas.clientHeight || rows * 20
  const size = Math.floor(Math.min(cssW / cols, cssH / rows))
  const w = Math.max(1, size * cols)
  const h = Math.max(1, size * rows)
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr
    canvas.height = h * dpr
  }
  return { size, dpr, ox: (cssW - w) / 2, oy: (cssH - h) / 2 }
}

function drawCell(ctx, x, y, size, color, dpr, ox, oy, alpha = 1) {
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  const p = 1 * dpr
  ctx.fillRect(ox * dpr + x * size * dpr + p, oy * dpr + y * size * dpr + p, size * dpr - p * 2, size * dpr - p * 2)
  ctx.globalAlpha = 1
}

function draw() {
  const { size, dpr, ox, oy } = cellSize(wellEl, COLS, ROWS)
  wellCtx.setTransform(1, 0, 0, 1, 0, 0)
  wellCtx.clearRect(0, 0, wellEl.width, wellEl.height)
  wellCtx.fillStyle = '#120f0c'
  wellCtx.fillRect(0, 0, wellEl.width, wellEl.height)
  wellCtx.strokeStyle = 'rgba(255,255,255,0.04)'
  wellCtx.lineWidth = dpr
  for (let x = 0; x <= COLS; x++) {
    wellCtx.beginPath()
    wellCtx.moveTo((ox + x * size) * dpr, oy * dpr)
    wellCtx.lineTo((ox + x * size) * dpr, (oy + ROWS * size) * dpr)
    wellCtx.stroke()
  }
  for (let y = 0; y <= ROWS; y++) {
    wellCtx.beginPath()
    wellCtx.moveTo(ox * dpr, (oy + y * size) * dpr)
    wellCtx.lineTo((ox + COLS * size) * dpr, (oy + y * size) * dpr)
    wellCtx.stroke()
  }
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const type = board[y][x]
      if (type) drawCell(wellCtx, x, y, size, COLORS[type], dpr, ox, oy)
    }
  }
  const g = ghost()
  if (g) {
    for (const { x, y, type } of cellsOf(g)) {
      if (y >= 0) drawCell(wellCtx, x, y, size, COLORS[type], dpr, ox, oy, 0.22)
    }
  }
  if (current) {
    for (const { x, y, type } of cellsOf(current)) {
      if (y >= 0) drawCell(wellCtx, x, y, size, COLORS[type], dpr, ox, oy)
    }
  }

  const preview = SHAPES[nextType]
  const { size: ns, dpr: nd, ox: nox, oy: noy } = cellSize(nextEl, 4, 4)
  nextCtx.setTransform(1, 0, 0, 1, 0, 0)
  nextCtx.clearRect(0, 0, nextEl.width, nextEl.height)
  const offX = Math.floor((4 - preview[0].length) / 2)
  const offY = Math.floor((4 - preview.length) / 2)
  for (let y = 0; y < preview.length; y++) {
    for (let x = 0; x < preview[y].length; x++) {
      if (preview[y][x]) drawCell(nextCtx, x + offX, y + offY, ns, COLORS[nextType], nd, nox, noy)
    }
  }
}

function frame(t) {
  requestAnimationFrame(frame)
  const dt = Math.min(50, t - last || 0)
  last = t
  if (started && !paused && !over) {
    acc += dt
    const step = soft ? Math.min(50, gravityMs(level) / 12) : gravityMs(level)
    while (acc >= step) {
      acc -= step
      if (soft) {
        if (move(0, 1)) score += 1
        else lockPiece()
      } else {
        tick()
      }
    }
    hud()
  }
  draw()
}

function onKey(event, down) {
  const key = event.key
  const map = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowDown: 'down',
    ArrowUp: 'rotate',
    z: 'rotate',
    Z: 'rotate',
    x: 'rotate',
    X: 'rotate',
    ' ': 'drop',
    p: 'pause',
    P: 'pause',
  }
  const action = map[key]
  if (!action) return
  event.preventDefault()
  if (!down) {
    if (action === 'down') soft = false
    return
  }
  if (event.repeat && (action === 'rotate' || action === 'drop' || action === 'pause')) return
  run(action)
}

function run(action) {
  if (action === 'left') move(-1, 0)
  else if (action === 'right') move(1, 0)
  else if (action === 'down') soft = true
  else if (action === 'rotate') rotateCurrent()
  else if (action === 'drop') hardDrop()
  else if (action === 'pause') togglePause()
}

function bindPad() {
  const holds = new Map()
  for (const btn of document.querySelectorAll('.pad button')) {
    const hold = btn.dataset.hold
    const tap = btn.dataset.tap
    const start = (event) => {
      event.preventDefault()
      if (tap) run(tap)
      if (hold) {
        run(hold)
        const id = setInterval(() => run(hold), hold === 'down' ? 40 : 90)
        holds.set(btn, id)
      }
    }
    const stop = () => {
      const id = holds.get(btn)
      if (id) clearInterval(id)
      holds.delete(btn)
      if (hold === 'down') soft = false
    }
    btn.addEventListener('pointerdown', start)
    btn.addEventListener('pointerup', stop)
    btn.addEventListener('pointerleave', stop)
    btn.addEventListener('pointercancel', stop)
  }
}

pauseBtn.addEventListener('click', togglePause)
window.addEventListener('keydown', (e) => onKey(e, true))
window.addEventListener('keyup', (e) => onKey(e, false))
bindPad()
requestAnimationFrame(frame)

async function boot() {
  try {
    const mod = await import(kitUrl)
    kit = mod.createKit()
    await kit.load()
    await kit.connect()
    await kit.emit('ready')
    await kit.emit('start')
    const config = kit.config()
    startLevel = Math.max(1, Math.min(15, Number(config.startLevel ?? 1)))
    accent = String(config.accent ?? accent)
    showGhost = config.showGhost !== false
    document.documentElement.style.setProperty('--accent', accent)
    level = startLevel
    started = true
    spawn()
    hud()
    setStatus(kit.snapshot.status || 'PLAYING')
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Failed to start')
  }
}

boot()
