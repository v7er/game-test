const W = 960
const H = 540
const UNIT = 40
const GROUND = 460
const CEIL = 80
const JUMP = 760
const PAD_JUMP = 1100
const GRAVITY = 2400

const COURSE = [
  { x: 14, t: 'spike' },
  { x: 18, t: 'spike' },
  { x: 24, t: 'block', w: 2, h: 1 },
  { x: 29, t: 'spike' },
  { x: 34, t: 'pad' },
  { x: 42, t: 'block', w: 4, h: 2 },
  { x: 47, t: 'spike' },
  { x: 54, t: 'spike' },
  { x: 55, t: 'spike' },
  { x: 62, t: 'block', w: 1, h: 1 },
  { x: 64, t: 'block', w: 1, h: 2 },
  { x: 66, t: 'block', w: 1, h: 3 },
  { x: 72, t: 'spike' },
  { x: 78, t: 'pad' },
  { x: 88, t: 'grav' },
  { x: 96, t: 'spike', ceil: true },
  { x: 102, t: 'spike', ceil: true },
  { x: 110, t: 'grav' },
  { x: 118, t: 'spike' },
  { x: 122, t: 'spike' },
  { x: 128, t: 'block', w: 3, h: 1 },
  { x: 134, t: 'spike' },
  { x: 140, t: 'pad' },
  { x: 150, t: 'spike' },
  { x: 151, t: 'spike' },
  { x: 160, t: 'end' },
]

const params = new URLSearchParams(location.search)
const kitUrl = params.get('kit') || './vendor/kit.js'
const statusEl = document.getElementById('status')
const progressEl = document.getElementById('progress')
const attemptsEl = document.getElementById('attempts')

let kit = null
let settings = { speed: 1, accent: '#ffd43b', mute: false }

function hex(color) {
  const raw = String(color || '#ffd43b').replace('#', '')
  return Number.parseInt(raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw, 16)
}

function courseEnd() {
  return Math.max(...COURSE.map((item) => item.x)) + 12
}

class Pulse {
  constructor(mute) {
    this.mute = mute
    this.ctx = null
  }
  kick() {
    if (this.mute) return
    this.ctx = this.ctx || new AudioContext()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(90, t)
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.1)
    gain.gain.setValueAtTime(0.16, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    osc.connect(gain).connect(this.ctx.destination)
    osc.start(t)
    osc.stop(t + 0.13)
  }
}

class Play extends Phaser.Scene {
  create() {
    this.speed = 11 * UNIT * Number(settings.speed || 1)
    this.accent = hex(settings.accent)
    this.dead = false
    this.won = false
    this.paused = false
    this.attempts = 1
    this.best = 0
    this.flip = 1
    this.jumpBuf = 0
    this.worldW = courseEnd() * UNIT
    this.pulse = new Pulse(Boolean(settings.mute))
    this.beatAcc = 0
    this.used = new Set()

    this.cameras.main.setBackgroundColor('#120f0c')
    this.drawGrid()

    this.physics.world.gravity.y = GRAVITY
    this.physics.world.setBounds(0, 0, this.worldW, H)

    this.platforms = this.physics.add.staticGroup()
    this.hazards = this.physics.add.staticGroup()
    this.pads = this.physics.add.staticGroup()
    this.portals = this.physics.add.staticGroup()
    this.goal = this.physics.add.staticGroup()

    this.add.rectangle(this.worldW / 2, GROUND + 40, this.worldW, 80, 0x241f1a).setDepth(1)
    this.add.rectangle(this.worldW / 2, CEIL - 40, this.worldW, 80, 0x241f1a).setDepth(1)
    const floor = this.add.rectangle(this.worldW / 2, GROUND + 40, this.worldW, 80, 0, 0)
    const roof = this.add.rectangle(this.worldW / 2, CEIL - 40, this.worldW, 80, 0, 0)
    this.physics.add.existing(floor, true)
    this.physics.add.existing(roof, true)
    this.platforms.add(floor)
    this.platforms.add(roof)

    for (const item of COURSE) this.place(item)

    this.player = this.add.rectangle(3 * UNIT, GROUND - 16, 32, 32, this.accent).setDepth(5)
    this.physics.add.existing(this.player)
    this.player.body.setCollideWorldBounds(true)
    this.player.body.setSize(28, 28)
    this.player.body.setOffset(2, 2)
    this.player.body.setMaxVelocity(this.speed, 1600)

    this.physics.add.collider(this.player, this.platforms)
    this.physics.add.overlap(this.player, this.hazards, () => this.die())
    this.physics.add.overlap(this.player, this.pads, (_p, pad) => this.bounce(pad))
    this.physics.add.overlap(this.player, this.portals, (_p, portal) => this.flipGravity(portal))
    this.physics.add.overlap(this.player, this.goal, () => this.finish())

    this.cameras.main.setBounds(0, 0, this.worldW, H)
    this.cameras.main.startFollow(this.player, false, 1, 0)
    this.cameras.main.setFollowOffset(-W * 0.28, 0)

    this.input.keyboard?.on('keydown-SPACE', () => this.bufferJump())
    this.input.keyboard?.on('keydown-UP', () => this.bufferJump())
    this.input.keyboard?.on('keydown-P', () => this.togglePause())
    this.input.on('pointerdown', () => this.bufferJump())

    this.banner = this.add
      .text(W / 2, H / 2, '', {
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontSize: '28px',
        color: '#f4eee4',
        fontStyle: '700',
      })
      .setScrollFactor(0)
      .setOrigin(0.5)
      .setDepth(20)

    attemptsEl.textContent = String(this.attempts)
    this.spawn()
  }

  drawGrid() {
    const g = this.add.graphics().setAlpha(0.12).setDepth(0)
    g.lineStyle(1, 0xf4eee4, 1)
    for (let x = 0; x < this.worldW; x += UNIT) {
      g.lineBetween(x, CEIL, x, GROUND)
    }
    for (let y = CEIL; y <= GROUND; y += UNIT) {
      g.lineBetween(0, y, this.worldW, y)
    }
  }

  place(item) {
    const x = item.x * UNIT
    if (item.t === 'spike') this.spike(x, Boolean(item.ceil))
    if (item.t === 'block') this.block(x, item.w || 1, item.h || 1)
    if (item.t === 'pad') this.pad(x)
    if (item.t === 'grav') this.portal(x)
    if (item.t === 'end') this.endGate(x)
  }

  spike(x, ceil) {
    const g = this.add.graphics().setDepth(2)
    g.fillStyle(0xff5c5c)
    if (ceil) g.fillTriangle(x, CEIL, x + UNIT / 2, CEIL + UNIT, x + UNIT, CEIL)
    else g.fillTriangle(x, GROUND, x + UNIT / 2, GROUND - UNIT, x + UNIT, GROUND)
    const hit = this.add.rectangle(
      x + UNIT / 2,
      ceil ? CEIL + UNIT * 0.48 : GROUND - UNIT * 0.48,
      UNIT * 0.42,
      UNIT * 0.55,
      0,
      0,
    )
    this.physics.add.existing(hit, true)
    this.hazards.add(hit)
  }

  block(x, w, h) {
    const width = w * UNIT
    const height = h * UNIT
    const y = GROUND - height / 2
    const rect = this.add.rectangle(x + width / 2, y, width, height, 0x3a332c).setDepth(2)
    this.add.rectangle(x + width / 2, y, width - 6, height - 6, 0x2a241f).setDepth(2)
    this.physics.add.existing(rect, true)
    this.platforms.add(rect)
  }

  pad(x) {
    const y = GROUND - 14
    this.add.circle(x + UNIT / 2, y, 12, 0xffe066).setDepth(3)
    this.add.circle(x + UNIT / 2, y, 6, this.accent).setDepth(3)
    const hit = this.add.rectangle(x + UNIT / 2, y, 22, 22, 0, 0)
    this.physics.add.existing(hit, true)
    this.pads.add(hit)
  }

  portal(x) {
    const y = (GROUND + CEIL) / 2
    this.add.rectangle(x + UNIT / 2, y, 18, 88, 0xbe4bdb).setDepth(3).setAlpha(0.9)
    this.add.rectangle(x + UNIT / 2, y, 8, 72, 0xf3d9fa).setDepth(3)
    const hit = this.add.rectangle(x + UNIT / 2, y, 20, 90, 0, 0)
    this.physics.add.existing(hit, true)
    this.portals.add(hit)
  }

  endGate(x) {
    const y = (GROUND + CEIL) / 2
    this.add.rectangle(x + 10, y, 16, GROUND - CEIL, 0x51cf66).setDepth(3)
    const hit = this.add.rectangle(x + 10, y, 20, GROUND - CEIL, 0, 0)
    this.physics.add.existing(hit, true)
    this.goal.add(hit)
  }

  spawn() {
    this.dead = false
    this.won = false
    this.flip = 1
    this.used.clear()
    this.physics.world.gravity.y = GRAVITY
    this.player.setPosition(3 * UNIT, GROUND - 16)
    this.player.setAngle(0)
    this.player.setFillStyle(this.accent)
    this.player.body.setVelocity(0, 0)
    this.player.body.allowGravity = true
    this.banner.setText('')
    this.physics.resume()
  }

  bufferJump() {
    this.pulse.kick()
    if (this.paused) return
    if (this.dead || this.won) {
      if (this.dead) this.retry()
      return
    }
    this.jumpBuf = 140
  }

  grounded() {
    const body = this.player.body
    return this.flip > 0 ? body.blocked.down || body.touching.down : body.blocked.up || body.touching.up
  }

  jump() {
    if (!this.grounded()) return false
    this.player.body.setVelocityY(-JUMP * this.flip)
    return true
  }

  bounce(pad) {
    const id = pad.name || (pad.name = `pad-${pad.x}`)
    if (this.used.has(id)) return
    this.used.add(id)
    this.player.body.setVelocityY(-PAD_JUMP * this.flip)
  }

  flipGravity(portal) {
    const id = portal.name || (portal.name = `grav-${portal.x}`)
    if (this.used.has(id)) return
    this.used.add(id)
    this.flip *= -1
    this.physics.world.gravity.y = GRAVITY * this.flip
    this.player.body.setVelocityY(220 * this.flip)
  }

  die() {
    if (this.dead || this.won) return
    this.dead = true
    this.player.body.setVelocity(0, 0)
    this.player.setFillStyle(0xff5c5c)
    this.banner.setText('Tap to retry')
    const pct = this.progress()
    this.best = Math.max(this.best, pct)
    void report({ score: this.best, attempts: this.attempts, progress: pct })
    statusEl.textContent = `Hit · ${pct}%`
  }

  retry() {
    this.attempts += 1
    attemptsEl.textContent = String(this.attempts)
    this.spawn()
    statusEl.textContent = kit?.preview ? 'Preview' : 'PLAYING'
  }

  finish() {
    if (this.won || this.dead) return
    this.won = true
    this.player.body.setVelocity(0, 0)
    this.banner.setText('Cleared')
    progressEl.textContent = '100%'
    void finishRun({ score: 100, attempts: this.attempts, best: this.best })
    statusEl.textContent = 'FINISHED'
  }

  togglePause() {
    if (this.dead || this.won) return
    this.paused = !this.paused
    if (this.paused) this.physics.pause()
    else this.physics.resume()
    this.banner.setText(this.paused ? 'Paused' : '')
    statusEl.textContent = this.paused ? 'Paused' : 'PLAYING'
    if (kit) void kit.emit(this.paused ? 'pause' : 'start')
  }

  progress() {
    const start = 3 * UNIT
    const end = courseEnd() * UNIT
    const raw = ((this.player.x - start) / (end - start)) * 100
    return Math.max(0, Math.min(99, Math.floor(raw)))
  }

  update(_time, delta) {
    if (this.paused) return
    this.beatAcc += delta
    if (this.beatAcc >= 400) {
      this.beatAcc -= 400
      if (!this.dead && !this.won) this.pulse.kick()
    }
    if (this.dead || this.won) return
    this.player.body.setVelocityX(this.speed)
    if (this.grounded()) {
      this.player.setAngle(Math.round(this.player.angle / 90) * 90)
    } else {
      this.player.angle += (420 * this.flip * delta) / 1000
    }
    this.jumpBuf = Math.max(0, this.jumpBuf - delta)
    if (this.jumpBuf > 0) {
      if (this.jump()) this.jumpBuf = 0
    }
    const pct = this.progress()
    progressEl.textContent = `${pct}%`
  }
}

async function report(payload) {
  if (!kit) return
  try {
    await kit.setState(payload)
    await kit.emit('score', { score: payload.score, result: payload })
  } catch {
    /* preview or host may ignore */
  }
}

async function finishRun(payload) {
  if (!kit) return
  try {
    await kit.setState(payload)
    await kit.emit('finish', { score: payload.score, result: payload })
  } catch {
    /* already finished */
  }
}

function startGame() {
  document.documentElement.style.setProperty('--accent', String(settings.accent || '#ffd43b'))
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'mount',
    width: W,
    height: H,
    backgroundColor: '#120f0c',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: 'arcade',
      arcade: { gravity: { y: GRAVITY }, debug: false },
    },
    scene: [Play],
  })
}

async function boot() {
  try {
    const mod = await import(kitUrl)
    kit = mod.createKit()
    await kit.load()
    await kit.connect()
    await kit.emit('ready')
    await kit.emit('start')
    settings = { ...settings, ...kit.config() }
    statusEl.textContent = kit.preview ? 'Preview' : kit.snapshot.status || 'PLAYING'
  } catch (error) {
    statusEl.textContent = error instanceof Error ? error.message : 'Ready'
  }
  startGame()
}

boot()
