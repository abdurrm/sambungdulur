import { useState } from 'react';
import type { TreeDoc } from '../model/types';
import { displayName } from '../model/relations';
import { normalizeName } from '../kk/parse';
import { t } from '../i18n';

export function PersonPicker(props: { doc: TreeDoc; value: string; onChange: (id: string) => void; label: string; exclude?: string; testId?: string }) {
  const [query, setQuery] = useState('');
  const needle = normalizeName(query);
  const matches = props.doc.order.filter((id) => id !== props.exclude && (!needle || normalizeName(`${displayName(props.doc.persons[id])} ${id}`).includes(needle))).slice(0, 100);
  const ids = [...new Set([props.value, ...matches].filter((id) => id && props.doc.persons[id] && id !== props.exclude))];
  return <div className="field">
    <label>{props.label}<input type="search" className="input" value={query} placeholder={t('personSearch')} onChange={(e) => setQuery(e.target.value)} /></label>
    <select className="input" aria-label={props.label} value={props.value} onChange={(e) => props.onChange(e.target.value)} data-testid={props.testId}>
      <option value="">{t('choosePerson')}</option>
      {ids.map((id) => <option key={id} value={id}>{displayName(props.doc.persons[id])} · {props.doc.persons[id].birthDate} [{id}]</option>)}
    </select>
  </div>;
}
