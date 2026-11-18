// Wall time survives missing frames and background throttling. Only explicit
// gameplay pauses (for example an item sheet) should pause this clock.
export default class BattleClock {
  constructor({ now = () => performance.now() } = {}) {
    this.now = now;
    this.previous = now();
    this.pauses = new Set();
  }

  pause(reason) {
    this.pauses.add(reason);
    this.previous = this.now();
  }

  resume(reason) {
    if (this.pauses.delete(reason)) this.previous = this.now();
  }

  tick(speed) {
    const current = this.now();
    const delta = Math.max(0, current - this.previous);
    this.previous = current;
    return this.pauses.size ? 0 : delta * speed;
  }
}
