import { useCallback, useMemo, useRef } from 'react';
import { usePlayAnimation, type PlayRefs } from '../hooks/usePlayAnimation';
import type { Plan, Point, PosKey, Role } from '../types';
import { POS_KEYS } from '../types';
import { sx, sy, xy } from './Field';
import Fielders from './Fielders';
import RunnerMarkers from './RunnerMarkers';

interface PlayProps {
  plan: Plan;
  start: Record<PosKey, Point>;
  replayKey: number;
  focus: PosKey | null;
  onFocus: (k: PosKey | null) => void;
  /** 퀴즈 문제 수비수: 그리지 않는다 (QuizLayer 가 대신 그림) */
  exclude?: PosKey | null;
}

/** 타구 선 · 송구 경로 · 대체 경로 · 수비수 · 공. 위치는 usePlayAnimation 이 직접 갱신 */
export default function Play({ plan, start, replayKey, focus, onFocus, exclude = null }: PlayProps) {
  const refs = useRef<PlayRefs>({ fielders: {}, ball: null, hit: null, throwGroup: null, altGroup: null, runners: {}, results: {} });
  usePlayAnimation(refs, plan, start, replayKey);

  const roles = useMemo(
    () => Object.fromEntries(POS_KEYS.map((k) => [k, plan.assignments[k].role])) as Record<PosKey, Role>,
    [plan],
  );
  const registerFielder = useCallback((k: PosKey, el: SVGGElement | null) => {
    refs.current.fielders[k] = el;
  }, []);

  const registerRunner = useCallback((k: string, el: SVGGElement | null) => {
    refs.current.runners[k] = el;
  }, []);
  const registerResult = useCallback((k: string, el: SVGGElement | null) => {
    refs.current.results[k] = el;
  }, []);

  const throwPoints = plan.throwPath.map(xy).join(' ');
  return (
    <g className="play">
      {/* 타구 */}
      <line ref={(el) => void (refs.current.hit = el)} className="hit-line" x1={0} y1={0} x2={0} y2={0} />

      {/* 대체 송구 경로 (2아웃 단타 홈 승부) */}
      <g ref={(el) => void (refs.current.altGroup = el)} opacity={0}>
        {plan.altThrowPath && (
          <polyline className="alt-path" points={plan.altThrowPath.map(xy).join(' ')} markerEnd="url(#arrowhead)" />
        )}
      </g>

      {/* 송구 경로 + 중계·컷오프 지점 */}
      <g ref={(el) => void (refs.current.throwGroup = el)} opacity={0}>
        {plan.throwPath.length > 1 && (
          <polyline className="throw-path" points={throwPoints} markerEnd="url(#arrowhead)" />
        )}
        {plan.cutIndices.map((i) => (
          <circle key={i} className="cut-ring" cx={sx(plan.throwPath[i])} cy={sy(plan.throwPath[i])} r={13} />
        ))}
      </g>

      <Fielders positions={start} roles={roles} registerRef={registerFielder} focus={focus} onFocus={onFocus} exclude={exclude} />

      <RunnerMarkers moves={plan.runnerMoves} registerRunner={registerRunner} registerResult={registerResult} />

      <circle ref={(el) => void (refs.current.ball = el)} className="ball" cx={0} cy={0} r={3.4} />
    </g>
  );
}
