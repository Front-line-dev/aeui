import { describe, it, expect } from 'vitest';
import { AEUI } from 'aeui';
import { _deepClone, _deepEqual } from '../../../../packages/core/src/deep-compare.js';

describe('deepEqual', () => {
  it('원시값 비교', () => {
    expect(_deepEqual(1, 1)).toBe(true);
    expect(_deepEqual(1, 2)).toBe(false);
    expect(_deepEqual('a', 'a')).toBe(true);
    expect(_deepEqual('a', 'b')).toBe(false);
    expect(_deepEqual(true, true)).toBe(true);
    expect(_deepEqual(true, false)).toBe(false);
    expect(_deepEqual(null, null)).toBe(true);
    expect(_deepEqual(undefined, undefined)).toBe(true);
    expect(_deepEqual(null, undefined)).toBe(false);
  });

  it('배열 비교', () => {
    expect(_deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(_deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(_deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);
    expect(_deepEqual([1, [2, 3]], [1, [2, 4]])).toBe(false);
  });

  it('객체 비교', () => {
    expect(_deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(_deepEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(_deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(_deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
  });

  it('Date 비교', () => {
    const d1 = new Date('2024-01-01');
    const d2 = new Date('2024-01-01');
    const d3 = new Date('2024-12-31');
    expect(_deepEqual(d1, d2)).toBe(true);
    expect(_deepEqual(d1, d3)).toBe(false);
  });

  it('Map 비교', () => {
    const m1 = new Map([['a', 1], ['b', 2]]);
    const m2 = new Map([['a', 1], ['b', 2]]);
    const m3 = new Map([['a', 1], ['b', 3]]);
    expect(_deepEqual(m1, m2)).toBe(true);
    expect(_deepEqual(m1, m3)).toBe(false);
  });

  it('Set 비교', () => {
    const s1 = new Set([1, 2, 3]);
    const s2 = new Set([1, 2, 3]);
    const s3 = new Set([1, 2, 4]);
    expect(_deepEqual(s1, s2)).toBe(true);
    expect(_deepEqual(s1, s3)).toBe(false);
  });

  it('Set 내부 객체를 순서와 무관하게 비교', () => {
    const s1 = new Set([{ a: 1 }, { b: 2 }]);
    const s2 = new Set([{ b: 2 }, { a: 1 }]);
    expect(_deepEqual(s1, s2)).toBe(true);
  });

  it('Set 내부 deep-equal 중복 객체를 1:1로 매칭', () => {
    const s1 = new Set([{ a: 1 }, { a: 1 }]);
    const s2 = new Set([{ a: 1 }, { b: 2 }]);
    expect(_deepEqual(s1, s2)).toBe(false);
  });

  it('순환 참조 객체 비교 시 크래시 없이 동작', () => {
    const a = { value: 1 };
    a.self = a;
    const b = { value: 1 };
    b.self = b;

    // 자기 자신을 참조하는 동일 구조 → true
    expect(_deepEqual(a, b)).toBe(true);

    const c = { value: 2 };
    c.self = c;
    expect(_deepEqual(a, c)).toBe(false);
  });

  it('순환 참조 배열 비교 시 크래시 없이 동작', () => {
    const a = [1, 2];
    a.push(a);
    const b = [1, 2];
    b.push(b);

    expect(_deepEqual(a, b)).toBe(true);
  });
});

describe('deepClone', () => {
  it('원시값 복제', () => {
    expect(_deepClone(42)).toBe(42);
    expect(_deepClone('hello')).toBe('hello');
    expect(_deepClone(null)).toBe(null);
  });

  it('배열 복제 (독립적)', () => {
    const original = [1, [2, 3]];
    const cloned = _deepClone(original);
    expect(cloned).toEqual(original);
    cloned[1].push(4);
    expect(original[1]).toEqual([2, 3]); // 원본 변경 안 됨
  });

  it('객체 복제 (독립적)', () => {
    const original = { a: 1, b: { c: 2 } };
    const cloned = _deepClone(original);
    expect(cloned).toEqual(original);
    cloned.b.c = 99;
    expect(original.b.c).toBe(2); // 원본 변경 안 됨
  });

  it('Date 복제', () => {
    const original = new Date('2024-01-01');
    const cloned = _deepClone(original);
    expect(cloned.getTime()).toBe(original.getTime());
    expect(cloned).not.toBe(original);
  });

  it('순환 참조 객체 복제 시 크래시 없이 동작', () => {
    const original = { value: 1 };
    original.self = original;

    const cloned = _deepClone(original);

    expect(cloned.value).toBe(1);
    expect(cloned).not.toBe(original);
    // 복제된 객체의 self도 자기 자신을 참조해야 함
    expect(cloned.self).toBe(cloned);
  });

  it('순환 참조 배열 복제 시 크래시 없이 동작', () => {
    const original = [1, 2];
    original.push(original);

    const cloned = _deepClone(original);

    expect(cloned[0]).toBe(1);
    expect(cloned[1]).toBe(2);
    expect(cloned).not.toBe(original);
    expect(cloned[2]).toBe(cloned);
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

  it('렌더 시점 props.children을 반환', () => {
    const initialItems = ['a'];
    const nextItems = ['a', 'b', 'c'];

    const render = AEUI.Fragment({ children: initialItems });
    const result = render({ children: nextItems });

    expect(result).toEqual(nextItems);
  });
});

describe('AEUI public surface', () => {
  it('does not expose legacy underscore runtime helpers at top level', () => {
    expect(AEUI._tick).toBeUndefined();
    expect(AEUI._didMutate).toBeUndefined();
    expect(AEUI.__runtime).toBeDefined();
  });
});
