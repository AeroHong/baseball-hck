import type { ReactNode } from 'react';
import { B1, B2, B3, H, MOUND, along, fenceDist, pt } from '../geometry';
import type { Point } from '../types';

/** 좌표 → SVG (y 반전) */
export const sx = (p: Point) => p.x;
export const sy = (p: Point) => -p.y;
const xy = (p: Point) => `${sx(p).toFixed(1)},${sy(p).toFixed(1)}`;

export const VIEWBOX = '-262 -432 524 492';

/** 펜스(또는 펜스에서 inset 만큼 안쪽) 호를 따라가는 페어 지역 경로 */
function fairPath(inset = 0): string {
  const pts: string[] = [xy(H)];
  for (let a = -45; a <= 45; a += 1) pts.push(xy(pt(fenceDist(a) - inset, a)));
  return `M${pts.join('L')}Z`;
}

/** 내야 잔디: 베이스 라인 안쪽 정사각형 (주로 3ft 만큼 안쪽) */
function infieldGrassPath(): string {
  const inset = 4.5;
  const c = { x: 0, y: B2.y / 2 };
  const pts = [H, B1, B2, B3].map((p) => along(p, c, inset * Math.SQRT2));
  return `M${pts.map(xy).join('L')}Z`;
}

function BaseSquare({ p, size = 6 }: { p: Point; size?: number }) {
  return (
    <rect
      className="base"
      x={sx(p) - size / 2}
      y={sy(p) - size / 2}
      width={size}
      height={size}
      transform={`rotate(45 ${sx(p)} ${sy(p)})`}
    />
  );
}

interface FieldProps {
  children?: ReactNode;
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
}

export default function Field({ children, onPointerDown }: FieldProps) {
  const foulL = pt(fenceDist(-45), -45);
  const foulR = pt(fenceDist(45), 45);
  return (
    <svg
      className="field"
      viewBox={VIEWBOX}
      role="img"
      aria-label="야구장 그라운드"
      onPointerDown={onPointerDown}
    >
      <defs>
        {/* 내야 흙은 파울 라인 바깥으로 조금 넘어가도록 ±52° 쐐기로 자른다 */}
        <clipPath id="infield-clip">
          <path d={`M0,0L${xy(pt(300, -52))}L${xy(pt(300, 0))}L${xy(pt(300, 52))}Z`} />
        </clipPath>
      </defs>

      {/* 파울 지역 바탕 */}
      <rect className="foul-ground" x={-262} y={-432} width={524} height={492} />
      {/* 워닝 트랙 → 외야 잔디 */}
      <path className="track" d={fairPath()} />
      <path className="grass" d={fairPath(14)} />

      {/* 내야 흙: 마운드 기준 반지름 95ft 호 + 홈 주변 */}
      <g clipPath="url(#infield-clip)">
        <circle className="dirt" cx={sx(MOUND)} cy={sy(MOUND)} r={95} />
      </g>
      <path className="grass infield-grass" d={infieldGrassPath()} />
      <circle className="dirt" cx={0} cy={0} r={13} />
      <circle className="dirt" cx={sx(MOUND)} cy={sy(MOUND)} r={9} />

      {/* 파울 라인 */}
      <line className="chalk" x1={0} y1={0} x2={sx(foulL)} y2={sy(foulL)} />
      <line className="chalk" x1={0} y1={0} x2={sx(foulR)} y2={sy(foulR)} />
      {/* 펜스 */}
      <path className="fence" d={fairPath().replace(/^M[^L]+L/, 'M').replace(/Z$/, '')} />

      {/* 베이스 */}
      <rect className="rubber" x={-1} y={sy(MOUND) - 0.4} width={2} height={0.8} />
      <BaseSquare p={B1} />
      <BaseSquare p={B2} />
      <BaseSquare p={B3} />
      <path className="base" d="M-1.4,-0.6 L1.4,-0.6 L1.4,0.8 L0,2 L-1.4,0.8 Z" transform="scale(2.4)" />

      {children}
    </svg>
  );
}
