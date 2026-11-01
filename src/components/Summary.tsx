import { BASES, dist } from '../geometry';
import type { Base, Plan, Point } from '../types';
import { BASE_NAME, POS_KEYS, POS_NAME } from '../types';

/** throwPath 를 "좌익수 → 3루수(중계) → 홈" 형태로. 각 점은 베이스면 베이스 이름, 아니면 그 자리 수비수 */
export function throwPathLabel(plan: Plan): string {
  if (plan.throwPath.length === 1) return '송구 없음';
  const handler = POS_KEYS.find((k) => plan.assignments[k].role === 'ball')!;
  const label = (p: Point): string => {
    const base = (Object.keys(BASES) as Base[]).find((b) => dist(BASES[b], p) < 0.5);
    if (base) return BASE_NAME[base];
    const k = POS_KEYS.find((x) => x !== handler && dist(plan.assignments[x].pos, p) < 0.5);
    return k ? `${POS_NAME[k]}(중계)` : '중계';
  };
  return [POS_NAME[handler], ...plan.throwPath.slice(1).map(label)].join(' → ');
}

/** 대체 경로: 출발점이 타구 지점이면 처리자, 아니면 컷오프 */
export function altPathLabel(plan: Plan): string | null {
  const alt = plan.altThrowPath;
  if (!alt || alt.length < 2) return null;
  const end = (Object.keys(BASES) as Base[]).find((b) => dist(BASES[b], alt[alt.length - 1]) < 0.5);
  const from = dist(alt[0], plan.ballPoint) < 0.5 ? '빠르면' : '컷오프가 끊어';
  return `${from} ${end ? BASE_NAME[end] : '?'}`;
}

export default function Summary({ plan }: { plan: Plan }) {
  return (
    <section aria-labelledby="summary-h">
      <h2 id="summary-h">상황 요약</h2>
      {plan.warnings?.some((w) => w.startsWith('인필드 플라이')) && (
        <p className="infield-fly" role="status">
          인필드 플라이!
        </p>
      )}
      <p className="throw-label">
        <span>송구</span> {throwPathLabel(plan)}
        {altPathLabel(plan) && <em> · 대체: {altPathLabel(plan)}</em>}
      </p>
      <ul className="notes">
        {plan.notes.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
      {plan.warnings && (
        <ul className="warnings">
          {plan.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
