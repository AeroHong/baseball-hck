import type { Plan } from '../types';

export type Theme = 'auto' | 'light' | 'dark';
const THEME_LABEL: Record<Theme, string> = { auto: '◐ 자동', light: '☀ 라이트', dark: '☾ 다크' };
const NEXT: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };

interface ScoreboardProps {
  plan: Plan;
  onReplay: () => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
}

export default function Scoreboard({ plan, onReplay, theme, onTheme }: ScoreboardProps) {
  return (
    <div className="toolbar">
      <p className="scoreboard" aria-live="polite">
        {plan.title}
      </p>
      <button type="button" onClick={onReplay}>
        ↻ 다시 재생
      </button>
      <button type="button" className="theme-btn" onClick={() => onTheme(NEXT[theme])} aria-label={`테마: ${THEME_LABEL[theme]}`}>
        {THEME_LABEL[theme]}
      </button>
    </div>
  );
}
