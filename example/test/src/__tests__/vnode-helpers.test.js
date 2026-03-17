import { describe, expect, it } from 'vitest';
import { AEUI } from 'aeui';
import {
  getVNodeKey,
  isFragmentVNode,
  getFragmentChildren,
} from '../../../../packages/core/src/vnode-helpers.js';

describe('vnode-helpers', () => {
  it('extracts keys from vnode props', () => {
    expect(getVNodeKey(AEUI.createVNode('li', { key: 'row-1' }))).toBe('row-1');
    expect(getVNodeKey('plain text')).toBeNull();
  });

  it('recognizes arrays and AEUI fragments as fragments', () => {
    const fragmentVNode = AEUI.createVNode(AEUI.Fragment, null, 'A', 'B');

    expect(isFragmentVNode(AEUI.Fragment, ['A', 'B'])).toBe(true);
    expect(isFragmentVNode(AEUI.Fragment, fragmentVNode)).toBe(true);
    expect(isFragmentVNode(AEUI.Fragment, AEUI.createVNode('div', null))).toBe(false);
  });

  it('returns fragment children for arrays and fragment vnodes', () => {
    const fragmentVNode = AEUI.createVNode(AEUI.Fragment, null, 'A', 'B');

    expect(getFragmentChildren(AEUI.Fragment, ['A', 'B'])).toEqual(['A', 'B']);
    expect(getFragmentChildren(AEUI.Fragment, fragmentVNode)).toEqual(['A', 'B']);
  });
});
