import { SKINS } from '../entities/SnakeSkins.js';

/**
 * HUD overlay: live stats panel, power-up badges, skin picker, name entry,
 * leaderboard, and start / game-over card. Persists name + best to localStorage.
 */
export class Hud {
  constructor() {
    this.scoreEl    = document.getElementById('hud-score');
    this.lengthEl   = document.getElementById('hud-length');
    this.speedEl    = document.getElementById('hud-speed');
    this.bestEl     = document.getElementById('hud-best');
    this.killsEl    = document.getElementById('hud-kills');
    this.powerupsEl = document.getElementById('hud-powerups');

    this.overlay  = document.getElementById('overlay');
    this.eyebrow  = document.getElementById('overlay-eyebrow');
    this.title    = document.getElementById('overlay-title');
    this.bigScore = document.getElementById('overlay-score');
    this.summary  = document.getElementById('overlay-summary');
    this.bestOut  = document.getElementById('overlay-best');
    this.lenOut   = document.getElementById('overlay-len');
    this.hint     = document.getElementById('overlay-hint');
    this.btn      = document.getElementById('overlay-btn');

    this.nameInput  = document.getElementById('player-name');
    this.boardList  = document.getElementById('board-list');
    this.boardMode  = document.getElementById('board-mode');
    this.skinName   = document.getElementById('skin-name');
    this.menuView   = document.getElementById('menu-view');
    this.planetSize = document.getElementById('planet-size');

    this.muteBtn    = document.getElementById('btn-mute');
    this.zoomInBtn  = document.getElementById('btn-zoom-in');
    this.zoomOutBtn = document.getElementById('btn-zoom-out');

    this.best = Number(localStorage.getItem('snake3d.best') || 0);
    this.bestEl.textContent = this.best;
    this.nameInput.value = localStorage.getItem('snake3d.name') || '';

    // Selected skin
    this._skinKey = localStorage.getItem('snake3d.skin') || 'cosmic';
    this._initSkinPicker();
    this._initMenuOptions();

    // Callbacks set by Game
    this.onStart      = null;
    this.onMuteToggle = null;
    this.onZoom       = null;
    this.onSkinChange = null;
    this.onMenuViewChange = null;
    this.onPlanetSizeChange = null;

    this.btn.addEventListener('click', () => {
      this._persistName();
      if (this.onStart) this.onStart();
    });
    this.nameInput.addEventListener('change', () => this._persistName());
    this.muteBtn.addEventListener('click', () => this.onMuteToggle && this.onMuteToggle());
    this.zoomInBtn.addEventListener('click', () => this.onZoom && this.onZoom(-0.3));
    this.zoomOutBtn.addEventListener('click', () => this.onZoom && this.onZoom(0.3));
  }

  _initMenuOptions() {
    if (this.menuView) {
      this.menuView.value = localStorage.getItem('snake3d.view') || 'normal';
      this.menuView.addEventListener('change', () => {
        localStorage.setItem('snake3d.view', this.menuView.value);
        if (this.onMenuViewChange) this.onMenuViewChange(this.menuView.value);
      });
    }
    if (this.planetSize) {
      this.planetSize.value = localStorage.getItem('snake3d.planetSize') || 'medium';
      this.planetSize.addEventListener('change', () => {
        localStorage.setItem('snake3d.planetSize', this.planetSize.value);
        if (this.onPlanetSizeChange) this.onPlanetSizeChange(this.planetSize.value);
      });
    }
  }

  _initSkinPicker() {
    const btns = document.querySelectorAll('.skin-btn');
    btns.forEach((btn) => {
      if (btn.dataset.skin === this._skinKey) btn.classList.add('active');
      else btn.classList.remove('active');

      btn.addEventListener('click', () => {
        this._skinKey = btn.dataset.skin;
        localStorage.setItem('snake3d.skin', this._skinKey);
        btns.forEach((b) => b.classList.toggle('active', b.dataset.skin === this._skinKey));
        const skin = SKINS[this._skinKey];
        if (this.skinName && skin) this.skinName.textContent = skin.name;
        if (this.onSkinChange) this.onSkinChange(this._skinKey);
      });
    });
    // Set initial name label
    const skin = SKINS[this._skinKey];
    if (this.skinName && skin) this.skinName.textContent = skin.name;
    // Mark active
    btns.forEach((b) => b.classList.toggle('active', b.dataset.skin === this._skinKey));
  }

  getSkin() {
    return this._skinKey;
  }

  getMenuView() {
    return this.menuView?.value || 'normal';
  }

  getPlanetRadius() {
    const radii = { small: 16, medium: 20, large: 26 };
    return radii[this.planetSize?.value || 'medium'] || radii.medium;
  }

  _persistName() {
    const v = this.nameInput.value.trim().slice(0, 14);
    if (v) localStorage.setItem('snake3d.name', v);
  }

  getName() {
    return (this.nameInput.value.trim() || 'Você').slice(0, 14);
  }

  setScore(score) {
    this.scoreEl.textContent = score;
  }

  setStats({ length, speed, kills }) {
    if (length != null) this.lengthEl.textContent = length;
    if (speed  != null) this.speedEl.textContent  = `${speed.toFixed(1)}×`;
    if (kills  != null && this.killsEl) this.killsEl.textContent = kills;
  }

  setMuted(muted) {
    this.muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  setPowerups(active) {
    const parts = [];
    if (active.shield > 0) parts.push(`<div class="pu-badge shield">🛡 ${active.shield.toFixed(0)}s</div>`);
    if (active.turbo  > 0) parts.push(`<div class="pu-badge turbo">⚡ ${active.turbo.toFixed(0)}s</div>`);
    this.powerupsEl.innerHTML = parts.join('');
  }

  renderBoard(list, mode = 'local', highlightScore = null) {
    this.boardMode.textContent = mode;
    if (!list || list.length === 0) {
      this.boardList.innerHTML = '<li class="board-empty">Sem pontuações ainda</li>';
      return;
    }
    let highlighted = false;
    this.boardList.innerHTML = list
      .slice(0, 10)
      .map((row, i) => {
        const me = !highlighted && highlightScore != null && row.score === highlightScore;
        if (me) highlighted = true;
        const name = String(row.name || 'Anon').replace(/[<>&]/g, '');
        return `<li class="${me ? 'me' : ''}"><span class="rank">${i + 1}</span><span class="nm">${name}</span><span class="sc">${row.score}</span></li>`;
      })
      .join('');
  }

  showStart(board = []) {
    this.eyebrow.textContent = 'SNAKE 3D';
    this.title.textContent   = 'Planeta';
    this.bigScore.hidden     = true;
    this.summary.hidden      = true;
    this.hint.hidden         = false;
    this.btn.textContent     = 'Jogar';
    this.renderBoard(board);
    this.overlay.classList.remove('hidden');
  }

  showGameOver(score, length, board = []) {
    this.best = Math.max(this.best, score);
    localStorage.setItem('snake3d.best', String(this.best));
    this.bestEl.textContent = this.best;

    this.eyebrow.textContent = 'GAME OVER';
    this.title.textContent   = 'Você morreu';
    this.bigScore.textContent = score;
    this.bigScore.hidden     = false;
    this.bestOut.textContent = this.best;
    this.lenOut.textContent  = length;
    this.summary.hidden      = false;
    this.hint.hidden         = true;
    this.btn.textContent     = 'Jogar de novo';
    this.renderBoard(board, undefined, score);
    this.overlay.classList.remove('hidden');
  }

  hide() {
    this.overlay.classList.add('hidden');
    this.powerupsEl.innerHTML = '';
  }
}
