import type { ReactNode } from 'react';
import { DIRECTIONS, KIND_NAME } from '../rules';
import type { Kind, Shift, Situation } from '../types';

const KINDS: { value: Kind; label: string }[] = [
  { value: 'ground', label: `내야 ${KIND_NAME.ground}` },
  { value: 'single', label: `외야 ${KIND_NAME.single}` },
  { value: 'fly', label: `외야 ${KIND_NAME.fly}` },
  { value: 'extra', label: KIND_NAME.extra },
  { value: 'popup', label: KIND_NAME.popup },
  { value: 'bunt', label: KIND_NAME.bunt },
];

const SHIFTS: { value: Shift; label: string }[] = [
  { value: 'normal', label: '정상' },
  { value: 'dp', label: '병살' },
  { value: 'in', label: '전진' },
];

function Segment<T extends string | number>({
  label,
  options,
  isOn,
  onPick,
}: {
  label: string;
  options: { value: T; label: ReactNode }[];
  isOn: (v: T) => boolean;
  onPick: (v: T) => void;
}) {
  return (
    <div className="control-row" role="group" aria-label={label}>
      <span className="control-label">{label}</span>
      <div className="segment">
        {options.map((o) => (
          <button key={String(o.value)} type="button" aria-pressed={isOn(o.value)} onClick={() => onPick(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ControlsProps {
  situation: Situation;
  onChange: (next: Situation) => void;
}

export default function Controls({ situation: s, onChange }: ControlsProps) {
  const set = (patch: Partial<Situation>) => onChange({ ...s, ...patch });
  return (
    <div className="controls">
      <Segment label="타구" options={KINDS} isOn={(v) => s.kind === v} onPick={(kind) => set({ kind })} />
      <Segment
        label="방향"
        options={DIRECTIONS.map((d) => ({ value: d.angle, label: d.label }))}
        isOn={(v) => s.angle === v}
        onPick={(angle) => set({ angle })}
      />
      <Segment
        label="주자"
        options={[1, 2, 3].map((b) => ({ value: b as 1 | 2 | 3, label: `${b}루` }))}
        isOn={(b) => s.runners[b]}
        onPick={(b) => set({ runners: { ...s.runners, [b]: !s.runners[b] } })}
      />
      <Segment
        label="아웃"
        options={[0, 1, 2].map((o) => ({ value: o as 0 | 1 | 2, label: `${o}` }))}
        isOn={(o) => s.outs === o}
        onPick={(outs) => set({ outs })}
      />
      <Segment label="시프트" options={SHIFTS} isOn={(v) => s.shift === v} onPick={(shift) => set({ shift })} />
    </div>
  );
}
