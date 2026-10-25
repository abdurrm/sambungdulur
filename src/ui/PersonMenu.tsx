import { Menu } from '@base-ui/react/menu';
import { Icon } from './icons';
import type { TreeDoc } from '../model/types';
import { displayName } from '../model/relations';
import { personActionLabel, personActions, type PersonActionId } from '../model/personActions';

/** Anything the menu can be positioned against: the card's ⋯ button, or the pointer for right-click / long-press. */
export type MenuAnchor = Element | { getBoundingClientRect: () => DOMRect };

const GROUPS: PersonActionId[][] = [['edit', 'photo'], ['addParents', 'addSibling', 'addPartner', 'addChild'], ['focus'], ['delete']];

/**
 * Card action menu: the same person actions as the editor panel, offered right on the tree.
 * Controlled by the App; unavailable actions stay listed with their reason.
 */
export default function PersonMenu(props: {
  doc: TreeDoc;
  personId: string;
  anchor: MenuAnchor;
  manualMode: boolean;
  /** Touch screen: "Take a photo" instead of "Upload a photo". */
  coarse?: boolean;
  onAction: (action: PersonActionId, personId: string) => void;
  onClose: () => void;
}) {
  const acts = personActions(props.doc, props.personId, { manualMode: props.manualMode });
  const name = displayName(props.doc.persons[props.personId], props.doc.settings);
  return (
    <Menu.Root open onOpenChange={(open) => !open && props.onClose()}>
      <Menu.Portal>
        <Menu.Positioner className="popup-positioner card-menu-positioner" anchor={props.anchor} side="bottom" align="start" sideOffset={4} collisionPadding={8}>
          <Menu.Popup className="popover menu" aria-label={name} data-testid="person-menu">
            <div className="menu-label menu-title">{name}</div>
            {GROUPS.map((group, gi) => (
              <div key={gi} role="presentation">
                {gi > 0 && <Menu.Separator className={`menu-sep${group[0] === 'delete' ? ' danger-sep' : ''}`} />}
                {group.map((id) => {
                  const a = acts[id];
                  return (
                    <Menu.Item
                      key={id}
                      className={`menu-item${id === 'delete' ? ' danger' : ''}`}
                      disabled={!a.enabled}
                      onClick={() => props.onAction(id, props.personId)}
                      data-testid={`pm-${id}`}
                    >
                      <Icon id={id === 'photo' && !props.coarse ? 'uploadImage' : id} size={16} />
                      <span className="menu-text">
                        {personActionLabel(id, { coarse: props.coarse })}
                        {a.reason && <small className="menu-reason" data-testid={`pm-${id}-reason`}>{a.reason}</small>}
                      </span>
                    </Menu.Item>
                  );
                })}
              </div>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
