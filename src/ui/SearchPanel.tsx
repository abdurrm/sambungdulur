import { useMemo, useState, type ReactElement } from 'react';
import type { Person, TreeDoc } from '../model/types';
import { yearOf } from '../model/dates';
import { displayName } from '../model/relations';
import { t } from '../i18n';

const MAX_RESULTS = 100;

const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export interface SearchHit {
  person: Person;
  name: string;
  score: number;
}

/** All query tokens must match somewhere (name, surnames, years, place, profession or id). */
export function searchPeople(doc: TreeDoc, query: string): SearchHit[] {
  const tokens = norm(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const hits: SearchHit[] = [];
  for (const id of doc.order) {
    const p = doc.persons[id];
    const name = displayName(p, doc.settings);
    const nameN = norm(`${p.givenName} ${p.surnameNow} ${p.surnameAtBirth}`);
    const by = yearOf(p.birthDate);
    const dy = p.deceased ? yearOf(p.deathDate) : undefined;
    const hay = `${nameN} ${by ?? ''} ${dy ?? ''} ${norm(p.birthPlace)} ${norm(p.profession)} ${p.id.toLowerCase()}`;
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      if (!hay.includes(t)) {
        ok = false;
        break;
      }
      if (nameN.startsWith(t) || nameN.includes(` ${t}`)) score += 3;
      else if (nameN.includes(t)) score += 2;
      else score += 1;
    }
    if (ok) hits.push({ person: p, name, score });
  }
  hits.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return hits;
}

function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
  if (!tokens.length) return <>{text}</>;
  const n = norm(text);
  const marks = new Array(text.length).fill(false);
  for (const t of tokens) {
    let i = n.indexOf(t);
    while (i >= 0) {
      for (let k = i; k < i + t.length && k < marks.length; k++) marks[k] = true;
      i = n.indexOf(t, i + 1);
    }
  }
  const out: ReactElement[] = [];
  let i = 0;
  while (i < text.length) {
    let j = i;
    while (j < text.length && marks[j] === marks[i]) j++;
    out.push(marks[i] ? <mark key={i}>{text.slice(i, j)}</mark> : <span key={i}>{text.slice(i, j)}</span>);
    i = j;
  }
  return <>{out}</>;
}

export function SearchPanel(props: {
  doc: TreeDoc;
  onPick: (id: string) => void;
  onClose: () => void;
  onQuery: (ids: Set<string>) => void;
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const hits = useMemo(() => searchPeople(props.doc, q), [props.doc, q]);
  const tokens = norm(q).split(/\s+/).filter(Boolean);
  const shown = hits.slice(0, MAX_RESULTS);
  const pick = (id: string) => {
    props.onPick(id);
    props.onClose();
  };
  return (
    <div className="popover search-panel" role="dialog" aria-label={t('searchPeople')} data-testid="search-panel">
      <input
        className="input"
        type="search"
        autoFocus
        placeholder={t('searchPlaceholder')}
        value={q}
        data-testid="search-input"
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          const next = searchPeople(props.doc, e.target.value);
          props.onQuery(new Set(next.map((h) => h.person.id)));
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), setActive((a) => Math.min(shown.length - 1, a + 1)));
          else if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(0, a - 1)));
          else if (e.key === 'Enter' && shown[active]) pick(shown[active].person.id);
          else if (e.key === 'Escape') props.onClose();
        }}
      />
      <div className="note" data-testid="search-count">
        {q
          ? [hits.length === 1 ? t('match1') : t('matches', { n: hits.length }), hits.length > MAX_RESULTS ? t('showingFirst', { n: MAX_RESULTS }) : '', t('ofPeople', { total: props.doc.order.length })].filter(Boolean).join(' ')
          : t('peopleInTree', { n: props.doc.order.length })}
      </div>
      {shown.length > 0 && (
        <ul className="search-results" role="listbox">
          {shown.map((h, i) => {
            const p = h.person;
            const by = yearOf(p.birthDate);
            const dy = p.deceased ? yearOf(p.deathDate) : undefined;
            return (
              <li
                key={p.id}
                role="option"
                aria-selected={i === active}
                className={i === active ? 'active' : ''}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(p.id)}
                data-testid={`search-hit-${p.id}`}
              >
                <span className={`dot ${p.gender}`} />
                <div style={{ minWidth: 0 }}>
                  <div className="nm"><Highlight text={h.name} tokens={tokens} /></div>
                  <div className="mt">
                    {p.id}
                    {by || dy ? ` · ${by ?? '?'}${p.deceased ? `–${dy ?? '?'}` : ''}` : ''}
                    {p.birthPlace ? ` · ${p.birthPlace}` : ''}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
