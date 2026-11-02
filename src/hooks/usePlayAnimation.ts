import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { H, dist, lerp, pointAlong, runnerSpot } from '../geometry';
import type { Timeline } from '../timeline';
import type { Plan, Point, PosKey } from '../types';
import { POS_KEYS } from '../types';

export const T1 = 1300; // 수비수 이동
export const T2 = 1100; // 송구
const HIT_RATIO = 0.55; // 타구가 T1 의 55% 동안 날아감

export interface PlayRefs {
  fielders: Partial<Record<PosKey, SVGGElement | null>>;
  ball: SVGCircleElement | null;
  hit: SVGLineElement | null;
  throwGroup: SVGGElement | null;
  altGroup: SVGGElement | null;
  runners: Record<string, SVGGElement | null>;
  results: Record<string, SVGGElement | null>;
}

/** 주자 속도: 3베이스를 전체 재생 시간에 달리는 속도 (ft/ms) */
const RUNNER_SPEED = (3 * 95) / (T1 + T2);
const BATTER_DELAY = 200;

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * SVG 요소 속성을 직접 갱신한다. React state 는 건드리지 않는다.
 * 시간은 Timeline 이 흘린다(일시정지·속도·구간 이동). plan·start·replayKey 가 바뀌면 처음부터 다시 재생.
 */
export function usePlayAnimation(
  refs: MutableRefObject<PlayRefs>,
  plan: Plan,
  start: Record<PosKey, Point>,
  replayKey: number,
  timeline: Timeline,
) {
  useEffect(() => {
    const r = refs.current;
    const setFielder = (k: PosKey, p: Point) =>
      r.fielders[k]?.setAttribute('transform', `translate(${p.x.toFixed(1)} ${(-p.y).toFixed(1)})`);
    const setBall = (p: Point) => {
      r.ball?.setAttribute('cx', p.x.toFixed(1));
      r.ball?.setAttribute('cy', (-p.y).toFixed(1));
    };
    const from = plan.ballFrom ?? H;
    r.hit?.setAttribute('x1', from.x.toFixed(1));
    r.hit?.setAttribute('y1', (-from.y).toFixed(1));
    const setHit = (p: Point) => {
      r.hit?.setAttribute('x2', p.x.toFixed(1));
      r.hit?.setAttribute('y2', (-p.y).toFixed(1));
    };
    const setOpacity = (el: SVGGElement | null, o: number) => el?.setAttribute('opacity', o.toFixed(3));
    const hasThrow = plan.throwPath.length > 1;
    const runnerPaths = plan.runnerMoves.map((m) => {
      const pts = m.path.map(runnerSpot);
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += dist(pts[i - 1], pts[i]);
      return { key: String(m.id), pts, len, delay: m.id === 'batter' ? BATTER_DELAY : 0 };
    });

    const render = (t: number) => {
      const kMove = easeInOutQuad(clamp01(t / T1));
      for (const k of POS_KEYS) setFielder(k, lerp(start[k], plan.assignments[k].pos, kMove));

      const kHit = easeOutCubic(clamp01(t / (T1 * HIT_RATIO)));
      const hitPoint = lerp(from, plan.ballPoint, kHit);
      setHit(hitPoint);

      const kThrow = clamp01((t - T1) / T2);
      setOpacity(r.throwGroup, hasThrow ? clamp01(kThrow * 3) : 0);
      setOpacity(r.altGroup, clamp01(kThrow * 3));
      setBall(t < T1 || !hasThrow ? hitPoint : pointAlong(plan.throwPath, easeInOutQuad(kThrow)));

      for (const rp of runnerPaths) {
        const run = Math.max(0, t - rp.delay) * RUNNER_SPEED;
        const k = rp.len > 0 ? Math.min(1, run / rp.len) : 1;
        const p = pointAlong(rp.pts, k);
        r.runners[rp.key]?.setAttribute('transform', `translate(${p.x.toFixed(1)} ${(-p.y).toFixed(1)})`);
        r.results[rp.key]?.setAttribute('opacity', k >= 1 && rp.len > 0 ? '1' : rp.len === 0 && t > T1 ? '1' : '0');
      }
    };

    const reduce = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    return timeline.attach(render, T1 + T2, reduce);
  }, [refs, plan, start, replayKey, timeline]);
}
