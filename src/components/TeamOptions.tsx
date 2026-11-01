import type { Options } from '../types';
import { DEFAULT_OPTIONS } from '../types';

type Choice<K extends keyof Options> = { value: Options[K]; label: string };

const ROWS: { [K in keyof Options]: { title: string; choices: Choice<K>[] } } = {
  homeCutoff: {
    title: '홈 컷오프',
    choices: [
      { value: 'split', label: '좌측 3루수 · 그 외 1루수' },
      { value: 'firstBase', label: '항상 1루수' },
    ],
  },
  centerKeystone: {
    title: '중견 정면 타구에 나가는 키스톤',
    choices: [
      { value: 'SS', label: '유격수' },
      { value: '2B', label: '2루수' },
    ],
  },
  pitcherDpCover: {
    title: '투수 앞 병살 2루 커버',
    choices: [
      { value: 'SS', label: '유격수' },
      { value: '2B', label: '2루수' },
    ],
  },
  extraHome2B: {
    title: '장타 홈 승부 때 2루',
    choices: [
      { value: 'empty', label: '비움' },
      { value: 'firstBase', label: '1루수 커버 · 3루수 컷오프' },
    ],
  },
  buntPlay: {
    title: '주자 1·2루 번트 수비',
    choices: [
      { value: 'standard', label: '기본' },
      { value: 'rotation', label: '로테이션' },
    ],
  },
};

interface TeamOptionsProps {
  options: Options;
  onChange: (o: Options) => void;
}

export default function TeamOptions({ options, onChange }: TeamOptionsProps) {
  const changed = (Object.keys(DEFAULT_OPTIONS) as (keyof Options)[]).filter((k) => options[k] !== DEFAULT_OPTIONS[k]).length;
  return (
    <details className="team-options">
      <summary>
        팀 방식 {changed > 0 && <span className="badge">{changed}개 변경</span>}
      </summary>
      <p className="hint-inline">팀마다 다른 약속을 바꿔 볼 수 있습니다. 이 기기에만 저장됩니다.</p>
      {(Object.keys(ROWS) as (keyof Options)[]).map((k) => (
        <div key={k} className="control-row wide" role="group" aria-label={ROWS[k].title}>
          <span className="control-label">{ROWS[k].title}</span>
          <div className="segment">
            {ROWS[k].choices.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-pressed={options[k] === c.value}
                onClick={() => onChange({ ...options, [k]: c.value })}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {changed > 0 && (
        <button type="button" className="reset" onClick={() => onChange(DEFAULT_OPTIONS)}>
          기본값으로
        </button>
      )}
    </details>
  );
}
