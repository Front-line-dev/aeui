import { describe, it, expect } from 'vitest';
import { AEUI } from 'aeui';

describe('AEUI._deepEqual', () => {
  it('원시값 비교', () => {
    expect(AEUI._deepEqual(1, 1)).toBe(true);
    expect(AEUI._deepEqual(1, 2)).toBe(false);
    expect(AEUI._deepEqual('a', 'a')).toBe(true);
    expect(AEUI._deepEqual('a', 'b')).toBe(false);
    expect(AEUI._deepEqual(true, true)).toBe(true);
    expect(AEUI._deepEqual(true, false)).toBe(false);
    expect(AEUI._deepEqual(null, null)).toBe(true);
    expect(AEUI._deepEqual(undefined, undefined)).toBe(true);
    expect(AEUI._deepEqual(null, undefined)).toBe(false);
  });

  it('배열 비교', () => {
    expect(AEUI._deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(AEUI._deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(AEUI._deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(AEUI._deepEqual([1, [2, 3]], [1, [2, 4]])).toBe(false);
  });

  it('객체 비교', () => {
    expect(AEUI._deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(AEUI._deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(AEUI._deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(AEUI._deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
  });

  it('Date 비교', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2024-01-01');
    const d3 = new Date('2024-12-31');
    expect(AEUI._deepEqual(d1, d2)).toBe(true);
    expect(AEUI._deepEqual(d1, d3)).toBe(false);
  });

  it('Map 비교', () => {
    const m1 = new Map([['a', 1], ['b', 2]]);
    const m2 = new Map([['a', 1], ['b', 2]]);
    const m3 = new Map([['a', 1], ['b', 3]]);
    expect(AEUI._deepEqual(m1, m2)).toBe(true);
    expect(AEUI._deepEqual(m1, m3)).toBe(false);
  });

  it('Set 비교', () => {
    const s1 = new Set([1, 2, 3]);
    const s2 = new Set([1, 2, 3]);
    const s3 = new Set([1, 2, 4]);
    expect(AEUI._deepEqual(s1, s2)).toBe(true);
    expect(AEUI._deepEqual(s1, s3)).toBe(false);
  });
});

describe('AEUI._deepClone', () => {
  it('원시값 복제', () => {
    expect(AEUI._deepClone(42)).toBe(42);
    expect(AEUI._deepClone('hello')).toBe('hello');
    expect(AEUI._deepClone(null)).toBe(null);
  });

  it('배열 복제 (독립적)', () => {
    const original = [1, [2, 3]];
    const cloned = AEUI._deepClone(original);
    expect(cloned).toEqual(original);
    cloned[1].push(4);
    expect(original[1]).toEqual([2, 3]); // 원본 변경 안 됨
  });

  it('객체 복제 (독립적)', () => {
    const original = { a: 1, b: { c: 2 } };
    const cloned = AEUI._deepClone(original);
    expect(cloned).toEqual(original);
    cloned.b.c = 99;
    expect(original.b.c).toBe(2); // 원본 변경 안 됨
  });

  it('Date 복제', () => {
    const original = new Date('2024-01-01');
    const cloned = AEUI._deepClone(original);
    expect(cloned.getTime()).toBe(original.getTime());
    expect(cloned).not.toBe(original);
  });
});

describe('AEUI.createVNode', () => {
  it('기본 VNode 생성', () => {
    const vnode = AEUI.createVNode('div', { id: 'test' }, 'hello');
    expect(vnode.tag).toBe('div');
    expect(vnode.props.id).toBe('test');
    expect(vnode.children).toEqual(['hello']);
  });

  it('children이 props에 포함됨', () => {
    const vnode = AEUI.createVNode('div', null, 'a', 'b');
    expect(vnode.props.children).toEqual(['a', 'b']);
    expect(vnode.children).toEqual(['a', 'b']);
  });

  it('null children 필터링', () => {
    const vnode = AEUI.createVNode('div', null, 'a', null, 'b', undefined);
    expect(vnode.children).toEqual(['a', 'b']);
  });

  it('createElement는 createVNode의 alias', () => {
    expect(AEUI.createElement).toBe(AEUI.createVNode);
  });
});

describe('AEUI.Fragment', () => {
  it('Fragment가 정의되어 있음', () => {
    expect(typeof AEUI.Fragment).toBe('function');
  });

  it('children을 그대로 반환', () => {
    const items = ['a', 'b', 'c'];
    const fn = AEUI.Fragment;
    const render = fn({ children: items });
    const result = render({ children: items });
    expect(result).toEqual(items);
  });
});
