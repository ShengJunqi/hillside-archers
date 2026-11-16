// Pointer coordinates stay in CSS pixels, independent of camera zoom and resolution.
export function pullGeometry(rect, pointerType = 'mouse') {
  if (pointerType === 'touch' || pointerType === 'pen') {
    const fullPull = Math.max(85, Math.min(140, Math.min(rect.width, rect.height) * .28));
    return {fullPull, cancelRadius: Math.max(32, Math.min(44, fullPull * .38))};
  }
  return {fullPull: 145 * rect.width / 960, cancelRadius: 48 * rect.width / 960};
}

// One owner for a held flight skill, shared by the canvas, keyboard and HUD.
// Cancelling restores normal flight without spending the once-per-volley skill.
export class FlightSkillInput {
  constructor(game, {isPaused = () => false, onChange = () => {}} = {}) {
    this.game = game; this.isPaused = isPaused; this.onChange = onChange; this.hold = null;
  }
  get canHold() {return !this.isPaused() && this.game.skill === 'dive' && this.game.canSkill && typeof this.game.beginSkillAim === 'function';}
  clearHold() {
    const old = this.hold; this.hold = null;
    if (old?.kind === 'pointer') try {if (old.element.hasPointerCapture?.(old.id)) old.element.releasePointerCapture(old.id);} catch {}
    return old;
  }
  cancel() {
    if (this.hold?.kind === 'key') this.cancelledKey = this.hold.key;
    const held = this.clearHold(), aiming = Boolean(this.game.skillAim);
    if (aiming) this.game.cancelSkillAim?.();
    if (held || aiming) this.onChange();
    return Boolean(held || aiming);
  }
  release() {
    this.clearHold();
    if (this.isPaused()) {this.game.cancelSkillAim?.(); this.onChange(); return false;}
    const fired = this.game.skillAim ? Boolean(this.game.releaseSkillAim?.()) : false;
    this.onChange(); return fired;
  }
  startPointer(element, event) {
    if (!this.canHold || this.hold || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return false;
    event.preventDefault();
    if (!this.game.skillAim && !this.game.beginSkillAim()) return false;
    const rect = element.getBoundingClientRect();
    this.hold = {kind: 'pointer', element, id: event.pointerId, x: event.clientX, tilt: this.game.skillAim?.tilt || 0, span: Math.max(120, Math.min(rect.width, rect.height) * .6)};
    try {element.setPointerCapture(event.pointerId);} catch {this.cancel(); return false;}
    this.onChange(); return true;
  }
  ownsPointer(element, event) {return this.hold?.kind === 'pointer' && this.hold.element === element && this.hold.id === event.pointerId;}
  movePointer(element, event) {
    if (!this.ownsPointer(element, event)) return false;
    if (this.isPaused() || !this.game.skillAim || event.buttons !== undefined && (event.buttons & 2)) {this.cancel(); return true;}
    if (Number.isFinite(event.clientX)) {event.preventDefault(); this.game.aimSkill?.(this.hold.tilt + (event.clientX - this.hold.x) * 70 / this.hold.span); this.onChange();}
    return true;
  }
  endPointer(element, event, cancelled = false) {
    if (!this.ownsPointer(element, event)) return false;
    event.preventDefault();
    if (cancelled || this.isPaused()) this.cancel();
    else {this.movePointer(element, event); if (this.ownsPointer(element, event)) this.release();}
    return true;
  }
  keyDown(event, fromButton = false) {
    if (!this.canHold || ![' ', ...(fromButton ? ['Enter'] : [])].includes(event.key)) return false;
    if (event.repeat) {event.preventDefault(); return true;}
    event.preventDefault();
    if (this.hold || !this.game.skillAim && !this.game.beginSkillAim()) return true;
    if (this.cancelledKey === event.key) this.cancelledKey = null;
    this.hold = {kind: 'key', key: event.key, element: event.target}; this.onChange(); return true;
  }
  keyUp(event) {
    if (this.cancelledKey === event.key) {this.cancelledKey = null; event.preventDefault(); return true;}
    if (this.hold?.kind !== 'key' || this.hold.key !== event.key) return false;
    event.preventDefault();
    const tag = event.target?.tagName;
    if (['INPUT', 'SELECT', 'TEXTAREA', 'A', 'SUMMARY'].includes(tag) || tag === 'BUTTON' && event.target !== this.hold.element) this.cancel();
    else this.release();
    return true;
  }
  bindButton(button) {
    button.style.touchAction = 'none';
    button.addEventListener('pointerdown', event => {if (event.button === 2) {event.preventDefault(); this.cancel(); return;} if (this.game.skill === 'dive') this.startPointer(button, event);});
    button.addEventListener('pointermove', event => this.movePointer(button, event));
    button.addEventListener('pointerup', event => this.endPointer(button, event));
    button.addEventListener('pointercancel', event => this.endPointer(button, event, true));
    button.addEventListener('lostpointercapture', event => {if (this.ownsPointer(button, event)) this.cancel();});
    button.addEventListener('contextmenu', event => {event.preventDefault(); this.cancel();});
    button.addEventListener('keydown', event => this.keyDown(event, true));
    button.addEventListener('keyup', event => this.keyUp(event));
    button.onclick = event => {
      if (this.isPaused()) return;
      if (this.game.skill !== 'dive' || typeof this.game.beginSkillAim !== 'function') {this.game.activateSkill(); return;}
      // A real pointer is handled on down/up, including a cancelled gesture.
      // Accessibility's click-only activation can enter, then confirm preview.
      event?.preventDefault?.();
      if (event?.pointerType || event?.detail > 0 || this.hold) return;
      if (this.game.skillAim) this.release(); else if (this.canHold) {this.game.beginSkillAim(); this.onChange();}
    };
  }
}

export class AimInput {
  constructor(canvas, game, {isPaused = () => false, onChange = () => {}, onTouch = () => {}, onTap = () => {}} = {}) {
    this.canvas = canvas;
    this.game = game;
    this.isPaused = isPaused;
    this.onChange = onChange;
    this.onTouch = onTouch;
    this.onTap = onTap;
    this.drag = null;
    this.skill = new FlightSkillInput(game, {isPaused, onChange});
    canvas.addEventListener('pointerdown', event => this.start(event));
    canvas.addEventListener('pointermove', event => this.move(event));
    canvas.addEventListener('pointerup', event => this.end(event));
    canvas.addEventListener('pointercancel', event => this.end(event, true));
    canvas.addEventListener('lostpointercapture', event => {
      if (this.drag?.id === event.pointerId || this.skill.ownsPointer(canvas, event)) this.cancel();
    });
    canvas.addEventListener('contextmenu', event => {event.preventDefault(); this.cancel();});
  }

  start(event) {
    if (event.button === 2) {event.preventDefault(); this.cancel(); return;}
    if (event.isPrimary === false || this.drag || this.isPaused() || (event.button !== undefined && event.button !== 0)) return;
    if (event.pointerType === 'touch' || event.pointerType === 'pen') this.onTouch();
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || event.clientX < rect.left || event.clientX > rect.left + rect.width || event.clientY < rect.top || event.clientY > rect.top + rect.height) return;
    if (this.game.canSkill) {
      event.preventDefault();
      if (this.game.skill === 'dive' && typeof this.game.beginSkillAim === 'function') this.skill.startPointer(this.canvas, event);
      else this.game.activateSkill();
      return;
    }
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
      maxDistance: 0, tapSlop: event.pointerType === 'mouse' ? 5 : 9,
      startedAt: Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now(),
    };
    try {this.canvas.setPointerCapture(event.pointerId);} catch {this.cancel(); return;}
    this.onChange();
  }

  move(event) {
    if (this.skill.movePointer(this.canvas, event)) return;
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.id) return;
    if (event.buttons !== undefined && (event.buttons & 2)) {this.cancel(); return;}
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
    event.preventDefault();
    const dx = (drag.x - event.clientX) * this.game.players[this.game.active].dir;
    const dy = event.clientY - drag.y;
    const distance = Math.hypot(dx, dy);
    drag.maxDistance = Math.max(drag.maxDistance, distance);
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
    const skillCancelled = this.skill.cancel();
    if (!this.drag) return skillCancelled;
    const old = this.drag;
    this.release(old);
    if (this.game.canAim) this.game.aim(old.angle, old.power);
    return true;
  }

  end(event, cancelled = false) {
    if (this.skill.endPointer(this.canvas, event, cancelled)) return;
    if (!this.drag || this.drag.id !== event.pointerId) return;
    if (cancelled || this.isPaused() || !this.game.canAim) {this.cancel(); return;}
    this.move(event);
    if (!this.drag) return;
    const old = this.drag;
    this.release(old);
    if (old.moved) this.game.shoot();
    else {
      const now = Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now();
      if (old.maxDistance <= old.tapSlop && now - old.startedAt <= 350) this.onTap();
    }
  }
}
