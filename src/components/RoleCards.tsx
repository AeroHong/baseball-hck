import type { Plan, PosKey } from '../types';
import { BASE_NAME, POS_KEYS, POS_NAME, POS_NUMBER, ROLE_NAME } from '../types';

interface RoleCardsProps {
  plan: Plan;
  focus: PosKey | null;
  onFocus: (k: PosKey | null) => void;
}

/** 역할 카드 9개. 카드에 올리거나 누르면 그라운드의 해당 수비수를 강조 */
export default function RoleCards({ plan, focus, onFocus }: RoleCardsProps) {
  return (
    <section aria-labelledby="roles-h">
      <h2 id="roles-h">포지션별 역할</h2>
      <ol className="roles">
        {POS_KEYS.map((k) => {
          const a = plan.assignments[k];
          return (
            <li key={k} className={`role-${a.role}${focus === k ? ' focused' : ''}`}>
              <button
                type="button"
                className="role-card"
                aria-pressed={focus === k}
                onMouseEnter={() => onFocus(k)}
                onMouseLeave={() => onFocus(null)}
                onFocus={() => onFocus(k)}
                onBlur={() => onFocus(null)}
                onClick={() => onFocus(focus === k ? null : k)}
              >
                <span className="num">{POS_NUMBER[k]}</span>
                <span>
                  <b>{POS_NAME[k]}</b> · {ROLE_NAME[a.role]}
                  {a.base ? ` (${BASE_NAME[a.base]})` : ''}
                  <br />
                  <small>{a.text}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
