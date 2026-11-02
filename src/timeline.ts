/**
 * 재생 시계: 일시정지 · 속도 · 구간 이동(§7 학습 보조).
 * rAF 루프를 직접 돌리고, 그리기 함수(render)는 usePlayAnimation 이 붙인다.
 * React 는 subscribe/getSnapshot 으로 재생 막대만 다시 그린다.
 */
export const SPEEDS = [0.25, 0.5, 1] as const;
export type Speed = (typeof SPEEDS)[number];

export class Timeline {
  t = 0;
  duration = 1;
  speed: Speed = 1;
  paused = false;
  private render: ((t: number) => void) | null = null;
  private raf = 0;
  private last = 0;
  private version = 0;
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  getSnapshot = () => this.version;

  private emit() {
    this.version++;
    for (const fn of this.listeners) fn();
  }

  get done() {
    return this.t >= this.duration;
  }

  /** 새 장면을 붙이고 처음부터 재생. 반환값으로 떼어 낸다 */
  attach(render: (t: number) => void, duration: number, reduceMotion = false): () => void {
    this.stop();
    this.render = render;
    this.duration = duration;
    this.t = reduceMotion ? duration : 0;
    this.paused = reduceMotion;
    render(this.t);
    if (!reduceMotion) this.loop();
    this.emit();
    return () => {
      this.stop();
      if (this.render === render) this.render = null;
    };
  }

  private stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private loop() {
    this.stop();
    this.last = performance.now();
    const frame = (now: number) => {
      const dt = now - this.last;
      this.last = now;
      this.t = Math.min(this.duration, this.t + dt * this.speed);
      this.render?.(this.t);
      this.emit();
      if (this.t < this.duration && !this.paused) this.raf = requestAnimationFrame(frame);
      else this.raf = 0;
    };
    this.raf = requestAnimationFrame(frame);
  }

  play() {
    if (this.done) this.t = 0;
    this.paused = false;
    this.render?.(this.t);
    this.loop();
    this.emit();
  }

  pause() {
    this.paused = true;
    this.stop();
    this.emit();
  }

  toggle() {
    if (this.paused || this.done) this.play();
    else this.pause();
  }

  /** 구간 이동: 멈춘 상태로 그 시점을 그린다 */
  seek(t: number) {
    this.stop();
    this.paused = true;
    this.t = Math.max(0, Math.min(this.duration, t));
    this.render?.(this.t);
    this.emit();
  }

  setSpeed(s: Speed) {
    this.speed = s;
    this.emit();
  }
}
