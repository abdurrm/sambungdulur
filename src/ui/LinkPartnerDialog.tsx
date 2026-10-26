import { useState } from 'react';
import type { TreeDoc } from '../model/types';
import { t } from '../i18n';
import { Modal } from './dialogs';
import { PersonPicker } from './PersonPicker';

export default function LinkPartnerDialog(props: { doc: TreeDoc; personId: string; onClose: () => void; onAdd: (existingId?: string) => void }) {
  const [existing, setExisting] = useState(false);
  const [personId, setPersonId] = useState('');
  return <Modal title={t('addPartner')} onClose={props.onClose} testId="add-partner-dialog">
    <div className="choice-list">
      <label className="choice"><input type="radio" name="partner-mode" checked={!existing} onChange={() => setExisting(false)} />{t('newPerson')}</label>
      <label className="choice"><input type="radio" name="partner-mode" checked={existing} onChange={() => setExisting(true)} data-testid="partner-existing" />{t('linkExisting')}</label>
    </div>
    {existing && <PersonPicker doc={props.doc} value={personId} exclude={props.personId} label={t('choosePerson')} onChange={setPersonId} testId="partner-person" />}
    <div className="actions"><button className="btn ghost" onClick={props.onClose}>{t('cancel')}</button><button className="btn primary" disabled={existing && !personId} onClick={() => props.onAdd(existing ? personId : undefined)} data-testid="add-partner-submit">{t('add')}</button></div>
  </Modal>;
}
