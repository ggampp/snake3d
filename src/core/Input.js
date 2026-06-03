/**
 * Steering input. Produces a turn signal in [-1, 1]:
 *   +1 = turning one way, -1 = the other. The snake auto-advances.
 * Supports keyboard (arrows / A,D) and touch (tap left/right half of screen).
 */
export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.left = false;
    this.right = false;
    this._touchLeft = false;
    this._touchRight = false;

    this._onKeyDown = (e) => this._key(e, true);
    this._onKeyUp = (e) => this._key(e, false);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    this._onTouchStart = (e) => this._touch(e);
    this._onTouchEnd = () => {
      this._touchLeft = false;
      this._touchRight = false;
    };
    this.dom.addEventListener('touchstart', this._onTouchStart, { passive: true });
    this.dom.addEventListener('touchmove', this._onTouchStart, { passive: true });
    this.dom.addEventListener('touchend', this._onTouchEnd);
    this.dom.addEventListener('touchcancel', this._onTouchEnd);

    // Mouse fallback (click-and-hold left/right half).
    this._onMouseDown = (e) => this._mouse(e, true);
    this._onMouseUp = () => {
      this._touchLeft = false;
      this._touchRight = false;
    };
    this.dom.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);

    /** Optional callback fired on any "confirm" key (Space/Enter). */
    this.onConfirm = null;
  }

  _key(e, down) {
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.left = down;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.right = down;
        break;
      case 'Space':
      case 'Enter':
        if (down && this.onConfirm) this.onConfirm();
        break;
    }
  }

  _touch(e) {
    const w = window.innerWidth;
    this._touchLeft = false;
    this._touchRight = false;
    for (const t of e.touches) {
      if (t.clientX < w / 2) this._touchLeft = true;
      else this._touchRight = true;
    }
  }

  _mouse(e, down) {
    if (!down) return;
    if (e.clientX < window.innerWidth / 2) this._touchLeft = true;
    else this._touchRight = true;
  }

  /** -1 .. +1 steering value. Left turns positive (CCW around normal). */
  get steer() {
    const l = this.left || this._touchLeft ? 1 : 0;
    const r = this.right || this._touchRight ? 1 : 0;
    return l - r;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.dom.removeEventListener('touchstart', this._onTouchStart);
    this.dom.removeEventListener('touchmove', this._onTouchStart);
    this.dom.removeEventListener('touchend', this._onTouchEnd);
    this.dom.removeEventListener('touchcancel', this._onTouchEnd);
    this.dom.removeEventListener('mousedown', this._onMouseDown);
  }
}
