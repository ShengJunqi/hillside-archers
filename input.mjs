// Pointer coordinates stay in CSS pixels, independent of camera zoom and resolution.
export function pullGeometry(rect, pointerType = 'mouse') {
  if (pointerType === 'touch' || pointerType === 'pen') {
    const fullPull = Math.max(85, Math.min(140, Math.min(rect.width, rect.height) * .28));
    return {fullPull, cancelRadius: Math.max(32, Math.min(44, fullPull * .38))};
  }
  return {fullPull: 145 * rect.width / 960, cancelRadius: 48 * rect.width / 960};
}

export class AimInput {
  constructor(canvas, game, {isPaused = () => false, onChange = () => {}, onTouch = () => {}} = {}) {
    this.canvas = canvas;
    this.game = game;
    this.isPaused = isPaused;
    this.onChange = onChange;
    this.onTouch = onTouch;
    this.drag = null;
    canvas.addEventListener('pointerdown', event => this.start(event));
    canvas.addEventListener('pointermove', event => this.move(event));
    canvas.addEventListener('pointerup', event => this.end(event));
    canvas.addEventListener('pointercancel', event => this.end(event, true));
    canvas.addEventListener('lostpointercapture', event => {
      if (this.drag?.id === event.pointerId) this.cancel();
    });
    canvas.addEventListener('contextmenu', event => {event.preventDefault(); this.cancel();});
  }

  start(event) {
    if (event.button === 2) {event.preventDefault(); this.cancel(); return;}
    if (event.isPrimary === false || this.drag || this.isPaused() || (event.button !== undefined && event.button !== 0)) return;
    if (event.pointerType === 'touch' || event.pointerType === 'pen') this.onTouch();
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || event.clientX < rect.left || event.clientX > rect.left + rect.width || event.clientY < rect.top || event.clientY > rect.top + rect.height) return;
    if (this.game.canSkill) {event.preventDefault(); this.game.activateSkill(); return;}
    if (!this.game.canAim) return;
    event.preventDefault();
    this.canvas.focus({preventScroll: true});
    this.drag = {
      id: event.pointerId, x: event.clientX, y: event.clientY,
      angle: this.game.angles[this.game.active], power: this.game.powers[this.game.active],
      screenX: (event.clientX - rect.left) / rect.width * this.canvas.width,
      screenY: (event.clientY - rect.top) / rect.height * this.canvas.height,
      screenScale: this.canvas.width / rect.width,
      ...pullGeometry(rect, event.pointerType), inside: true, moved: false,
    };
    try {this.canvas.setPointerCapture(event.pointerId);} catch {this.cancel(); return;}
    this.onChange();
  }

  move(event) {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.id) return;
    if (event.buttons !== undefined && (event.buttons & 2)) {this.cancel(); return;}
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    event.preventDefault();
    const dx = (drag.x - event.clientX) * this.game.players[this.game.active].dir;
    const dy = event.clientY - drag.y;
    const distance = Math.hypot(dx, dy);
    drag.inside = distance <= drag.cancelRadius;
    drag.moved = !drag.inside;
    if (drag.inside) this.game.aim(drag.angle, drag.power);
    else this.game.aim(Math.atan2(dy, dx) * 180 / Math.PI, distance / drag.fullPull * 100);
    this.onChange();
  }

  release(drag) {
    this.drag = null;
    try {if (this.canvas.hasPointerCapture?.(drag.id)) this.canvas.releasePointerCapture(drag.id);} catch {}
    this.onChange();
  }

  cancel() {
    if (!this.drag) return false;
    const old = this.drag;
    this.release(old);
    if (this.game.canAim) this.game.aim(old.angle, old.power);
    return true;
  }

  end(event, cancelled = false) {
    if (!this.drag || this.drag.id !== event.pointerId) return;
    if (cancelled || this.isPaused() || !this.game.canAim) {this.cancel(); return;}
    this.move(event);
    if (!this.drag) return;
    const old = this.drag;
    this.release(old);
    if (old.moved) this.game.shoot();
  }
}
