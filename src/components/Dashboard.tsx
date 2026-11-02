import { useState } from 'react';
import type { CloudStatus } from '../cloud';
import { DIFFICULTY_NAME } from '../quiz';
import type { PlayerStats, RecordStore, Tally } from '../records';
import { RANK_MIN_QUESTIONS, correctRate, leaderboard, playerStats, scoreRate, tally, weakest } from '../records';
import { KIND_NAME, situationTitle } from '../rules';
import type { PosKey, Situation } from '../types';
import { KINDS, POS_KEYS, POS_NAME, POS_NUMBER } from '../types';

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const CLOUD_TEXT: Record<CloudStatus, string> = {
  connecting: '클라우드 연결 중…',
  online: '클라우드 동기화 중 — 모든 기기가 같은 순위표를 봅니다',
  offline: '오프라인 — 이 기기에 저장해 두었다가 연결되면 올립니다',
  error: '클라우드에 연결할 수 없어 이 브라우저에만 저장합니다',
};

function CloudBadge({ status }: { status: CloudStatus }) {
  return (
    <span className={`cloud-badge ${status}`} role="status">
      <span className="cloud-dot" aria-hidden="true" />
      {CLOUD_TEXT[status]}
    </span>
  );
}

interface DashboardProps {
  store: RecordStore;
  cloudStatus: CloudStatus;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  /** 삭제 버튼 표시 여부 (클라우드: 선수를 만든 기기만) */
  canRemove: (id: string) => boolean;
  onStartQuiz: () => void;
  onReview: (s: Situation) => void;
}

/** 단일 계열 막대: 점수율 0~100. 값 라벨은 텍스트 색, 막대만 색 */
function RateBar({ label, t, sub }: { label: React.ReactNode; t: Tally | undefined; sub?: string }) {
  const rate = t ? scoreRate(t) : 0;
  const tip = t ? `점수율 ${rate}% · 정답 ${t.correct} · 근접 ${t.close} · 오답 ${t.wrong}` : '기록 없음';
  return (
    <li className={`rate-row${t ? '' : ' empty'}`} title={tip}>
      <span className="rate-label">{label}</span>
      <span className="rate-track">{t && rate > 0 && <span className="rate-fill" style={{ width: `${Math.max(rate, 1.5)}%` }} />}</span>
      <span className="rate-value">{t ? `${rate}%` : '—'}</span>
      <span className="rate-n">{t ? `${t.n}문제` : (sub ?? '')}</span>
    </li>
  );
}

function Trend({ values }: { values: number[] }) {
  if (values.length < 2) return <p className="muted small">두 판 이상 풀면 추이가 보입니다.</p>;
  const w = 240;
  const h = 64;
  const bw = w / values.length;
  return (
    <svg className="trend" viewBox={`0 0 ${w} ${h + 14}`} role="img" aria-label={`최근 ${values.length}판 점수율: ${values.join(', ')}%`}>
      <line className="trend-base" x1={0} x2={w} y1={h} y2={h} />
      {values.map((v, i) => {
        const bh = Math.max(2, (v / 100) * h);
        return (
          <g key={i}>
            <title>{`${i + 1}번째 판 · ${v}%`}</title>
            <rect className="trend-hit" x={i * bw} y={0} width={bw} height={h} />
            <path
              className="trend-bar"
              d={`M${i * bw + bw * 0.18} ${h} V${h - bh + 3} q0 -3 3 -3 H${i * bw + bw * 0.82 - 3} q3 0 3 3 V${h} Z`}
            />
          </g>
        );
      })}
      <text className="trend-label" x={w} y={h + 12} textAnchor="end">
        최근 {values[values.length - 1]}%
      </text>
    </svg>
  );
}

function PlayerDetail({ s, onRemove, onReview }: { s: PlayerStats; onRemove?: () => void; onReview: (x: Situation) => void }) {
  const [confirm, setConfirm] = useState(false);
  const weakPos = weakest(s.byPosition);
  const weakKind = weakest(s.byKind);
  const misses = s.sessions
    .flatMap((x) => x.answers)
    .filter((a) => a.grade === 'wrong')
    .slice(-6)
    .reverse();
  return (
    <section className="dash-card player-detail" aria-labelledby="pd-h">
      <div className="pd-head">
        <h2 id="pd-h">
          {s.player.name}
          {s.player.position && (
            <small>
              {' '}
              · 주 포지션 {POS_NUMBER[s.player.position]} {POS_NAME[s.player.position]}
            </small>
          )}
        </h2>
        {!onRemove ? null : confirm ? (
          <span className="confirm">
            이 선수와 모든 기기의 기록을 지울까요?{' '}
            <button type="button" className="danger" onClick={onRemove}>
              삭제
            </button>{' '}
            <button type="button" onClick={() => setConfirm(false)}>
              취소
            </button>
          </span>
        ) : (
          <button type="button" className="ghost small" onClick={() => setConfirm(true)}>
            선수 삭제
          </button>
        )}
      </div>

      <div className="tiles">
        <div className="tile">
          <span>점수율</span>
          <strong>{scoreRate(s.total)}%</strong>
        </div>
        <div className="tile">
          <span>정답률</span>
          <strong>{correctRate(s.total)}%</strong>
        </div>
        <div className="tile">
          <span>최고 기록</span>
          <strong>{s.best}%</strong>
        </div>
        <div className="tile">
          <span>푼 문제</span>
          <strong>{s.total.n}</strong>
          <small>{s.sessions.length}판</small>
        </div>
      </div>

      {(weakPos || weakKind) && (
        <p className="weak">
          보완할 곳:{' '}
          {weakPos && (
            <b>
              {POS_NAME[weakPos.key]} {scoreRate(weakPos.tally)}%
            </b>
          )}
          {weakPos && weakKind && ' · '}
          {weakKind && (
            <b>
              {KIND_NAME[weakKind.key]} 상황 {scoreRate(weakKind.tally)}%
            </b>
          )}
        </p>
      )}

      <div className="dash-cols">
        <div>
          <h3>포지션별 점수율</h3>
          <ul className="rate-list">
            {POS_KEYS.map((k: PosKey) => (
              <RateBar
                key={k}
                label={
                  <>
                    <b>{POS_NUMBER[k]}</b> {POS_NAME[k]}
                  </>
                }
                t={s.byPosition[k]}
              />
            ))}
          </ul>
        </div>
        <div>
          <h3>타구 종류별 점수율</h3>
          <ul className="rate-list">
            {KINDS.map((k) => (
              <RateBar key={k} label={KIND_NAME[k]} t={s.byKind[k]} />
            ))}
          </ul>
          <h3>최근 판 추이</h3>
          <Trend values={s.trend} />
        </div>
      </div>

      <div className="dash-cols">
        <div>
          <h3>최근 판</h3>
          {s.sessions.length === 0 ? (
            <p className="muted small">아직 푼 판이 없습니다.</p>
          ) : (
            <table className="dash-table compact">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>포지션</th>
                  <th>난이도</th>
                  <th className="num">점수</th>
                </tr>
              </thead>
              <tbody>
                {s.sessions
                  .slice(-8)
                  .reverse()
                  .map((x) => {
                    const t = tally(x.answers);
                    return (
                      <tr key={x.id}>
                        <td>{fmtDate(x.date)}</td>
                        <td>{x.position ? POS_NAME[x.position] : '전체'}</td>
                        <td>
                          {DIFFICULTY_NAME[x.difficulty]}
                          {x.retry && <small> · 다시</small>}
                        </td>
                        <td className="num">
                          {t.points}/{t.n * 10}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
        <div>
          <h3>오답 노트</h3>
          {misses.length === 0 ? (
            <p className="muted small">최근 오답이 없습니다.</p>
          ) : (
            <ul className="miss-list">
              {misses.map((a, i) => (
                <li key={i}>
                  <span>
                    <b>{POS_NAME[a.fielder]}</b> <small>{situationTitle(a.situation)}</small>
                  </span>
                  <button type="button" className="link" onClick={() => onReview(a.situation)}>
                    학습에서 보기
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export default function Dashboard({ store, cloudStatus, onSelect, onRemove, canRemove, onStartQuiz, onReview }: DashboardProps) {
  const rows = leaderboard(store);
  const selectedId = store.currentId ?? rows[0]?.player.id ?? null;
  const stats = selectedId ? playerStats(store, selectedId) : null;

  if (rows.length === 0) {
    return (
      <div className="dashboard">
        <section className="dash-card empty-state">
          <h2>아직 기록이 없습니다</h2>
          <p className="muted">퀴즈에서 이름을 등록하고 문제를 풀면 순위표와 포지션별 통계가 여기에 쌓입니다.</p>
          <CloudBadge status={cloudStatus} />
          <div className="quiz-actions">
            <button type="button" className="primary" onClick={onStartQuiz}>
              퀴즈 시작 →
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <section className="dash-card" aria-labelledby="lb-h">
        <div className="pd-head">
          <h2 id="lb-h">순위표</h2>
          <CloudBadge status={cloudStatus} />
          <button type="button" className="primary small" onClick={onStartQuiz}>
            퀴즈 풀기 →
          </button>
        </div>
        <div className="table-scroll">
          <table className="dash-table leaderboard">
            <thead>
              <tr>
                <th className="num">순위</th>
                <th>선수</th>
                <th>점수율</th>
                <th className="num">정답률</th>
                <th className="num">최고</th>
                <th className="num">문제</th>
                <th className="num">판</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.player.id}
                  className={r.player.id === selectedId ? 'selected' : undefined}
                  onClick={() => onSelect(r.player.id)}
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(r.player.id)}
                  aria-selected={r.player.id === selectedId}
                >
                  <td className="num rank">{r.rank ? (r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank) : '—'}</td>
                  <td>
                    <b>{r.player.name}</b>
                    {r.player.position && <small> {POS_NAME[r.player.position]}</small>}
                  </td>
                  <td className="bar-cell">
                    <span className="rate-track">
                      {r.rate > 0 && <span className="rate-fill" style={{ width: `${Math.max(r.rate, 1.5)}%` }} />}
                    </span>
                    <span className="rate-value">{r.total.n ? `${r.rate}%` : '—'}</span>
                  </td>
                  <td className="num">{r.total.n ? `${correctRate(r.total)}%` : '—'}</td>
                  <td className="num">{r.plays ? `${r.best}%` : '—'}</td>
                  <td className="num">{r.total.n}</td>
                  <td className="num">{r.plays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint-inline">
          점수율 = 얻은 점수 ÷ 만점(정답 10 · 근접 5). {RANK_MIN_QUESTIONS}문제 이상 푼 선수만 순위에 오르고, 오답 다시 풀기는 빠집니다. 행을
          누르면 아래에 선수별 통계가 나옵니다. 같은 이름은 어느 기기에서든 같은 선수로 합쳐집니다.
        </p>
      </section>

      {stats && (
        <PlayerDetail
          key={stats.player.id}
          s={stats}
          onRemove={canRemove(stats.player.id) ? () => onRemove(stats.player.id) : undefined}
          onReview={onReview}
        />
      )}
    </div>
  );
}
