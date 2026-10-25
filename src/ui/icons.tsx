import { lazy, Suspense } from 'react';
import type { Icon as PhosphorIcon, IconWeight } from '@phosphor-icons/react';
import { ArrowCounterClockwise } from '@phosphor-icons/react/dist/csr/ArrowCounterClockwise';
import { Baby } from '@phosphor-icons/react/dist/csr/Baby';
import { CaretDown } from '@phosphor-icons/react/dist/csr/CaretDown';
import { CaretLeft } from '@phosphor-icons/react/dist/csr/CaretLeft';
import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import { CaretUp } from '@phosphor-icons/react/dist/csr/CaretUp';
import { CornersOut } from '@phosphor-icons/react/dist/csr/CornersOut';
import { Crosshair } from '@phosphor-icons/react/dist/csr/Crosshair';
import { DotsThree } from '@phosphor-icons/react/dist/csr/DotsThree';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { FloppyDisk } from '@phosphor-icons/react/dist/csr/FloppyDisk';
import { FolderOpen } from '@phosphor-icons/react/dist/csr/FolderOpen';
import { Heart } from '@phosphor-icons/react/dist/csr/Heart';
import { Layout } from '@phosphor-icons/react/dist/csr/Layout';
import { MagnifyingGlass } from '@phosphor-icons/react/dist/csr/MagnifyingGlass';
import { MagnifyingGlassMinus } from '@phosphor-icons/react/dist/csr/MagnifyingGlassMinus';
import { MagnifyingGlassPlus } from '@phosphor-icons/react/dist/csr/MagnifyingGlassPlus';
import { Moon } from '@phosphor-icons/react/dist/csr/Moon';
import { PencilSimple } from '@phosphor-icons/react/dist/csr/PencilSimple';
import { PushPin } from '@phosphor-icons/react/dist/csr/PushPin';
import { Question } from '@phosphor-icons/react/dist/csr/Question';
import { SlidersHorizontal } from '@phosphor-icons/react/dist/csr/SlidersHorizontal';
import { Trash } from '@phosphor-icons/react/dist/csr/Trash';
import { UserPlus } from '@phosphor-icons/react/dist/csr/UserPlus';
import { Users } from '@phosphor-icons/react/dist/csr/Users';
import { X } from '@phosphor-icons/react/dist/csr/X';
import type { PersonActionId } from '../model/personActions';
import type { Command } from './shortcuts';
import { hasWeight } from './iconWeights';

type DeferredName = keyof typeof import('./iconsDeferred');
const loadDeferred = () => import('./iconsDeferred');
/** Warm the deferred icons once the first view is up (called with the other lazy UI). */
export function preloadIcons() {
  void loadDeferred();
}
/** A lazily loaded icon; renders an empty box of the same size until its chunk arrives. */
function deferred(name: DeferredName): PhosphorIcon {
  const c = lazy(() => loadDeferred().then((m) => ({ default: m[name] })));
  return Object.assign(c, { displayName: `${name}Icon` }) as unknown as PhosphorIcon;
}

/**
 * One icon per action. The toolbar, the editor panel, the card menu, the overflow menu and the
 * shortcut list all draw icons from this map, so the same action always looks the same.
 * Only some weights are bundled (see iconWeights.ts); a weight that is not bundled falls back to
 * `regular`. Icons that never show on the first screen come from iconsDeferred.ts, loaded on demand.
 */
const ICONS = {
  // Person actions (model/personActions.ts)
  edit: PencilSimple,
  addParents: Users,
  addSibling: UserPlus,
  addPartner: Heart,
  addChild: Baby,
  focus: Crosshair,
  delete: Trash,
  uploadImage: deferred('Image'),
  deleteImage: Trash,
  // Toolbar and menus
  open: FolderOpen,
  save: FloppyDisk,
  export: DownloadSimple,
  search: MagnifyingGlass,
  settings: SlidersHorizontal,
  manual: Layout,
  reset: ArrowCounterClockwise,
  themeDark: Moon,
  themeLight: deferred('Sun'),
  help: Question,
  install: deferred('MonitorArrowUp'),
  more: DotsThree,
  shortcuts: deferred('Keyboard'),
  undo: deferred('ArrowUUpLeft'),
  redo: deferred('ArrowUUpRight'),
  // Canvas controls
  zoomIn: MagnifyingGlassPlus,
  zoomOut: MagnifyingGlassMinus,
  center: CornersOut,
  // Open dialog
  openFile: deferred('FileArrowUp'),
  linkFolder: deferred('FolderSimplePlus'),
  newTree: deferred('FilePlus'),
  // Chrome
  close: X,
  pin: PushPin,
  caretUp: CaretUp,
  caretDown: CaretDown,
  caretLeft: CaretLeft,
  caretRight: CaretRight,
  tree: deferred('TreeStructure'),
} satisfies Record<string, PhosphorIcon>;

export type IconId = keyof typeof ICONS;

/** Icon of each keyboard command, for the shortcut list. */
const COMMAND_ICONS: Partial<Record<Command, IconId>> = {
  search: 'search',
  save: 'save',
  open: 'open',
  export: 'export',
  settings: 'settings',
  theme: 'themeDark',
  manual: 'manual',
  ancMore: 'caretUp',
  ancLess: 'caretDown',
  descMore: 'caretUp',
  descLess: 'caretDown',
  help: 'shortcuts',
  zoomIn: 'zoomIn',
  zoomOut: 'zoomOut',
  center: 'center',
  edit: 'edit',
  delete: 'delete',
  undo: 'undo',
  redo: 'redo',
};

export function commandIcon(cmd: Command): IconId | undefined {
  return COMMAND_ICONS[cmd];
}

/**
 * An action icon. `active` (a pressed toggle, an open popup) and primary buttons use the filled
 * weight; everything else the regular one. Decorative: the button carries the accessible name.
 */
export function Icon(props: { id: IconId; size?: number; active?: boolean; weight?: IconWeight; className?: string }) {
  const C = ICONS[props.id];
  const wanted = props.weight ?? (props.active ? 'fill' : 'regular');
  const weight = hasWeight((C.displayName ?? '').replace(/Icon$/, ''), wanted) ? wanted : 'regular';
  const size = props.size ?? 18;
  return (
    <Suspense fallback={<span style={{ display: 'inline-block', width: size, height: size, flex: 'none' }} />}>
      <C size={size} weight={weight} aria-hidden="true" focusable="false" className={props.className} data-icon={props.id} data-weight={weight} />
    </Suspense>
  );
}
