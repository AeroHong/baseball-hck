import { useSyncExternalStore } from 'react';
import { T1 } from '../hooks/usePlayAnimation';
import { SPEEDS, type Timeline } from '../timeline';

const SPEED_LABEL: Record<number, string> = { 0.25: '¼×', 0.5: '½×', 1: '1×' };

/** 재생 / 일시정지 · 구간 이동 · 속도. 단계 표시: ① 타구·수비 이동 → ② 송구 */
export default function PlaybackBar({ timeline }: { timeline: Timeline }) {
  useSyncExternalStore(timeline.subscribe, timeline.getSnapshot);
  const { t, duration, paused, speed, done } = timeline;
  const playing = !paused && !done;
  const phase = t < T1 ? '① 타구 · 수비 이동' : done ? '③ 끝 — 최종 위치' : '② 송구 · 주자';
  const split = (T1 / duration) * 100;
  return (
    <div className="playback" role="group" aria-label="재생 조절">
      <button type="button" className="play-btn" onClick={() => timeline.toggle()} aria-label={playing ? '일시정지' : '재생'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <button type="button" onClick={() => timeline.seek(t < T1 + 1 ? 0 : T1)} aria-label="이전 단계">
        ⏮
      </button>
      <button type="button" onClick={() => timeline.seek(t < T1 - 1 ? T1 : duration)} aria-label="다음 단계">
        ⏭
      </button>
      <div className="scrub" style={{ '--split': `${split}%` } as React.CSSProperties}>
        <input
          type="range"
          min={0}
          max={duration}
          step={10}
          value={Math.round(t)}
          onChange={(e) => timeline.seek(Number(e.target.value))}
          aria-label="재생 위치"
        />
        <span className="phase">{phase}</span>
      </div>
      <div className="segment speed" role="group" aria-label="재생 속도">
        {SPEEDS.map((s) => (
          <button key={s} type="button" aria-pressed={speed === s} onClick={() => timeline.setSpeed(s)}>
            {SPEED_LABEL[s]}
          </button>
        ))}
      </div>
    </div>
  );
}
