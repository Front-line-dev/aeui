import { it, expect } from 'vitest';
import { AEUI } from 'aeui';
import { _deepEqual as equal, _deepClone as clone } from '../../../../packages/core/src/deep-compare.js';

it.each([
  ['NaN', NaN, NaN, true], ['signed zero', 0, -0, false],
  ['number/string', 1, '1', false], ['nullish', null, undefined, false],
  ['array order', [1, 2], [2, 1], false], ['object key order', { a: 1, b: 2 }, { b: 2, a: 1 }, true],
  ['date', new Date(10), new Date(11), false], ['regexp flags', /a/i, /a/g, false],
  ['different kinds', {}, new Map(), false],
])('[INTERNAL-DEEP.10] %s 비교는 값의 차이를 놓치거나 동일값을 변경으로 오인하지 않는다', (_name, a, b, expected) => {
  expect(equal(a, b)).toBe(expected);
  expect(equal(b, a)).toBe(expected);
});

it('[INTERNAL-DEEP.11] 공유·순환 그래프를 복제하되 원본 변이를 snapshot에 전파하지 않는다', () => {
  const item = { count: 1 }, source = { left: item, right: item, list: [item] };
  source.self = source;
  const snapshot = clone(source);
  expect(snapshot).not.toBe(source);
  expect(snapshot.left).toBe(snapshot.right);
  expect(snapshot.list[0]).toBe(snapshot.left);
  expect(snapshot.self).toBe(snapshot);
  expect(equal(source, snapshot)).toBe(true);
  source.left.count++;
  expect(snapshot.left.count).toBe(1);
  expect(equal(source, snapshot)).toBe(false);
  const split = { left: { count: 1 }, right: { count: 1 }, list: [{ count: 1 }] };
  split.self = split;
  expect(equal(snapshot, split)).toBe(false);
  expect(equal(split, snapshot)).toBe(false);
});

it('[INTERNAL-DEEP.12] Map key 식별성과 Set의 일대일 대응을 보존하며 순서 차이를 변경으로 세지 않는다', () => {
  const key = {}, value = { n: 1 }, source = new Map([[key, value]]);
  const snapshot = clone(source);
  expect(snapshot.has(key)).toBe(true);
  expect(snapshot.get(key)).not.toBe(value);
  expect(equal(source, new Map([[{}, { n: 1 }]]))).toBe(false);
  expect(equal(new Set([{ n: 1 }, { n: 2 }]), new Set([{ n: 2 }, { n: 1 }]))).toBe(true);
  expect(equal(new Set([{ n: 1 }, { n: 1 }]), new Set([{ n: 1 }, { n: 2 }]))).toBe(false);
  value.n++;
  expect(snapshot.get(key).n).toBe(1);
});

it('[INTERNAL-DEEP.13] own __proto__ 복제는 데이터만 보존하고 prototype을 바꾸지 않는다', () => {
  const source = JSON.parse('{"__proto__":{"polluted":true}}');
  const snapshot = clone(source);
  expect(Object.hasOwn(snapshot, '__proto__')).toBe(true);
  expect(Object.getPrototypeOf(snapshot)).toBe(Object.prototype);
  expect(snapshot.polluted).toBeUndefined();
  expect(snapshot.__proto__).not.toBe(source.__proto__);
  expect({}.polluted).toBeUndefined();
});

it('[INTERNAL-VNODE.10] frozen props와 자식을 정규화하며 입력 객체를 변경하거나 0을 제거하지 않는다', () => {
  const props = Object.freeze({ title: 'value' });
  const vnode = AEUI.createVNode('p', props, [0, null, false], 'text');
  expect(vnode.children).toEqual([0, 'text']);
  expect(vnode.props.children).toBe(vnode.children);
  expect(vnode.props).not.toBe(props);
  expect(props).toEqual({ title: 'value' });
  expect(Object.keys(vnode).sort()).toEqual(['children', 'props', 'tag']);
  expect(clone(vnode)).toBe(vnode);
  expect(equal(vnode, AEUI.createVNode('p', props, 0, 'text'))).toBe(false);
  const ordinary = { tag: 'p', props: {}, children: [] };
  expect(clone(ordinary)).not.toBe(ordinary);
});
