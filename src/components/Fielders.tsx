import type { Point, PosKey, Role } from '../types';
import { POS_KEYS, POS_NAME, POS_NUMBER, ROLE_NAME } from '../types';
import { sx, sy } from './Field';

interface FieldersProps {
  positions: Record<PosKey, Point>;
  roles: Record<PosKey, Role>;
  /** 4단계 애니메이션 훅이 위치를 직접 갱신할 수 있도록 각 <g> 를 넘겨준다 */
  registerRef?: (k: PosKey, el: SVGGElement | null) => void;
  focus?: PosKey | null;
  onFocus?: (k: PosKey | null) => void;
  exclude?: PosKey | null;
}

export default function Fielders({ positions, roles, registerRef, focus, onFocus, exclude }: FieldersProps) {
  return (
    <g className="fielders">
      {POS_KEYS.filter((k) => k !== exclude).map((k) => {
        const p = positions[k];
        return (
          <g
            key={k}
            ref={(el) => registerRef?.(k, el)}
            className={`fielder role-${roles[k]}${focus === k ? ' focused' : ''}${focus && focus !== k ? ' dimmed' : ''}`}
            onPointerEnter={(e) => e.pointerType === 'mouse' && onFocus?.(k)}
            onPointerLeave={(e) => e.pointerType === 'mouse' && onFocus?.(null)}
            transform={`translate(${sx(p).toFixed(1)} ${sy(p).toFixed(1)})`}
          >
            <title>{`${POS_NUMBER[k]} ${POS_NAME[k]} · ${ROLE_NAME[roles[k]]}`}</title>
            <circle r={9} />
            <text dy="0.35em">{POS_NUMBER[k]}</text>
          </g>
        );
      })}
    </g>
  );
}
