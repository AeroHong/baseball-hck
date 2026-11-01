import type { ReactNode } from 'react';
import { B1, B2, B3, H, MOUND, along, fenceDist, playablePolygon, pt } from '../geometry';
import type { Point } from '../types';

/** 좌표 → SVG (y 반전) */
export const sx = (p: Point) => p.x;
export const sy = (p: Point) => -p.y;
export const xy = (p: Point) => `${sx(p).toFixed(1)},${sy(p).toFixed(1)}`;

export const VIEWBOX = '-272 -436 544 506';

/** 펜스(또는 펜스에서 inset 만큼 안쪽) 호를 따라가는 페어 지역 경로 */
function fairPath(inset = 0): string {
  const pts: string[] = [xy(H)];
  for (let a = -45; a <= 45; a += 1) pts.push(xy(pt(fenceDist(a) - inset, a)));
  return `M${pts.join('L')}Z`;
}

const polyPath = (pts: Point[]) => `M${pts.map(xy).join('L')}Z`;

/** 내야 잔디: 베이스 라인 안쪽 정사각형 */
function infieldGrassPath(): string {
  const c = { x: 0, y: B2.y / 2 };
  return polyPath([H, B1, B2, B3].map((p) => along(p, c, 4.5 * Math.SQRT2)));
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
  const playable = polyPath(playablePolygon());
  return (
    <svg className="field" viewBox={VIEWBOX} role="img" aria-label="야구장 그라운드" onPointerDown={onPointerDown}>
      <defs>
        {/* 내야 흙은 파울 라인 바깥으로 조금 넘어가도록 ±52° 쐐기로 자른다 */}
        <clipPath id="infield-clip">
          <path d={`M0,0L${xy(pt(300, -52))}L${xy(pt(300, 0))}L${xy(pt(300, 52))}Z`} />
        </clipPath>
        <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path className="arrowhead" d="M0,0 L10,5 L0,10 Z" />
        </marker>
      </defs>

      {/* 관중석 (경기장 밖) */}
      <rect className="stands" x={-272} y={-436} width={544} height={506} />
      {/* 경기장 전체 = 파울 지역 포함. 외곽선 = 관중석 벽·백스톱·외야 펜스 */}
      <path className="foul-grass" d={playable} />
      {/* 페어 지역: 워닝 트랙 → 외야 잔디 */}
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
      {/* 벽: 관중석 벽 + 백스톱 + 외야 펜스 */}
      <path className="wall" d={playable} />

      {/* 베이스 */}
      <rect className="rubber" x={-1} y={sy(MOUND) - 0.4} width={2} height={0.8} />
      <BaseSquare p={B1} />
      <BaseSquare p={B2} />
      <BaseSquare p={B3} />
      <path className="base" d="M-1.4,-0.6 L1.4,-0.6 L1.4,0.8 L0,2 L-1.4,0.8 Z" transform="scale(2.4)" />

      {/* 파울 라인을 따라 바깥쪽 28ft 지점에 표기 */}
      <text className="area-label" transform="translate(-145 -109) rotate(45)">파울 지역</text>
      <text className="area-label" transform="translate(145 -109) rotate(-45)">파울 지역</text>

      {children}
    </svg>
  );
}
