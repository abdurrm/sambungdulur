import { describe, expect, it } from 'vitest';
import { commandFor, SHORTCUTS } from '../../src/ui/shortcuts';
import { kinNeighbour } from '../../src/model/kinNav';
import { createDefaultTree } from '../../src/model/defaultTree';
import { addSibling } from '../../src/model/relations';

const free = { typing: false, onControl: false };

describe('shortcut registry', () => {
  it('maps keys to commands', () => {
    expect(commandFor({ key: 'f', ctrlKey: true }, free)).toBe('search');
    expect(commandFor({ key: 'F', metaKey: true }, free)).toBe('search');
    expect(commandFor({ key: 's', ctrlKey: true }, free)).toBe('save');
    expect(commandFor({ key: 'z', ctrlKey: true }, free)).toBe('undo');
    expect(commandFor({ key: 'Z', ctrlKey: true, shiftKey: true }, free)).toBe('redo');
    expect(commandFor({ key: 'y', ctrlKey: true }, free)).toBe('redo');
    expect(commandFor({ key: 'ArrowUp' }, free)).toBe('navUp');
    expect(commandFor({ key: 'ArrowDown' }, free)).toBe('navDown');
    expect(commandFor({ key: 'ArrowLeft' }, free)).toBe('navLeft');
    expect(commandFor({ key: 'ArrowRight' }, free)).toBe('navRight');
    expect(commandFor({ key: 'Enter' }, free)).toBe('edit');
    expect(commandFor({ key: 'Delete' }, free)).toBe('delete');
    expect(commandFor({ key: '+' }, free)).toBe('zoomIn');
    expect(commandFor({ key: '=' }, free)).toBe('zoomIn');
    expect(commandFor({ key: '-' }, free)).toBe('zoomOut');
    expect(commandFor({ key: '0' }, free)).toBe('center');
    expect(commandFor({ key: '?', shiftKey: true }, free)).toBe('help');
    expect(commandFor({ key: 'Escape' }, free)).toBe('escape');
    expect(commandFor({ key: 'x' }, free)).toBeNull();
    expect(commandFor({ key: 'ArrowUp', ctrlKey: true }, free)).toBeNull();
  });

  it('stays out of the way while typing, except for save, search and Escape', () => {
    const typing = { typing: true, onControl: false };
    for (const key of ['ArrowUp', 'Enter', 'Delete', 'Backspace', '+', '-', '0', '?']) expect(commandFor({ key }, typing), key).toBeNull();
    // Text fields keep their own undo.
    expect(commandFor({ key: 'z', ctrlKey: true }, typing)).toBeNull();
    expect(commandFor({ key: 's', ctrlKey: true }, typing)).toBe('save');
    expect(commandFor({ key: 'f', ctrlKey: true }, typing)).toBe('search');
    expect(commandFor({ key: 'Escape' }, typing)).toBe('escape');
  });

  it('lets focused buttons and tabs keep arrows, Enter and Delete', () => {
    const onControl = { typing: false, onControl: true };
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Delete']) expect(commandFor({ key }, onControl), key).toBeNull();
    expect(commandFor({ key: '+' }, onControl)).toBe('zoomIn');
  });

  it('documents every command it handles', () => {
    for (const s of SHORTCUTS) expect(s.label).toMatch(/^sc/);
  });
});

describe('relative navigation', () => {
  const doc = createDefaultTree(); // I1 = me, I2 = father, I3 = mother
  const pos = new Map([
    ['I2', { x: -100, y: 0 }],
    ['I3', { x: 100, y: 0 }],
    ['I1', { x: 0, y: 200 }],
  ]);

  it('moves to parents and children', () => {
    expect(kinNeighbour(doc, pos, 'I1', 'up')).toBe('I2'); // equally close: the left one
    expect(kinNeighbour(doc, pos, 'I2', 'down')).toBe('I1');
    expect(kinNeighbour(doc, pos, 'I1', 'down')).toBeNull();
    expect(kinNeighbour(doc, pos, 'I2', 'up')).toBeNull();
  });

  it('moves sideways to partners and siblings', () => {
    expect(kinNeighbour(doc, pos, 'I2', 'right')).toBe('I3');
    expect(kinNeighbour(doc, pos, 'I3', 'left')).toBe('I2');
    expect(kinNeighbour(doc, pos, 'I2', 'left')).toBeNull();
    const { doc: d2, select: sib } = addSibling(doc, 'I1');
    const p2 = new Map(pos).set(sib!, { x: 220, y: 200 });
    expect(kinNeighbour(d2, p2, 'I1', 'right')).toBe(sib);
    expect(kinNeighbour(d2, p2, sib!, 'left')).toBe('I1');
  });

  it('skips relatives that are not shown and falls back to the same row', () => {
    const hidden = new Map(pos);
    hidden.delete('I3');
    hidden.set('X', { x: 300, y: 0 });
    expect(kinNeighbour(doc, hidden, 'I2', 'right')).toBe('X');
    expect(kinNeighbour(doc, hidden, 'nobody', 'up')).toBeNull();
  });
});
