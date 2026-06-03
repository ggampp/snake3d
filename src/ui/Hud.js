/**
 * Thin wrapper over the HTML overlay: live score/stats panel + the
 * start / game-over card. Persists the best score in localStorage.
 */
export class Hud {
  constructor() {
    this.scoreEl = document.getElementById('hud-score');
    this.lengthEl = document.getElementById('hud-length');
    this.speedEl = document.getElementById('hud-speed');
    this.bestEl = document.getElementById('hud-best');

    this.overlay = document.getElementById('overlay');
    this.eyebrow = document.getElementById('overlay-eyebrow');
    this.title = document.getElementById('overlay-title');
    this.bigScore = document.getElementById('overlay-score');
    this.summary = document.getElementById('overlay-summary');
    this.bestOut = document.getElementById('overlay-best');
    this.lenOut = document.getElementById('overlay-len');
    this.hint = document.getElementById('overlay-hint');
    this.btn = document.getElementById('overlay-btn');

    this.best = Number(localStorage.getItem('snake3d.best') || 0);
    this.bestEl.textContent = this.best;

    this.onStart = null;
    this.btn.addEventListener('click', () => this.onStart && this.onStart());
  }

  setScore(score) {
    this.scoreEl.textContent = score;
  }

  setStats({ length, speed }) {
    if (length != null) this.lengthEl.textContent = length;
    if (speed != null) this.speedEl.textContent = `${speed.toFixed(1)}×`;
  }

  showStart() {
    this.eyebrow.textContent = 'SNAKE 3D';
    this.title.textContent = 'Planeta';
    this.bigScore.hidden = true;
    this.summary.hidden = true;
    this.hint.hidden = false;
    this.btn.textContent = 'Jogar';
    this.overlay.classList.remove('hidden');
  }

  showGameOver(score, length) {
    this.best = Math.max(this.best, score);
    localStorage.setItem('snake3d.best', String(this.best));
    this.bestEl.textContent = this.best;

    this.eyebrow.textContent = 'GAME OVER';
    this.title.textContent = 'Você morreu';
    this.bigScore.textContent = score;
    this.bigScore.hidden = false;
    this.bestOut.textContent = this.best;
    this.lenOut.textContent = length;
    this.summary.hidden = false;
    this.hint.hidden = true;
    this.btn.textContent = 'Jogar de novo';
    this.overlay.classList.remove('hidden');
  }

  hide() {
    this.overlay.classList.add('hidden');
  }
}
