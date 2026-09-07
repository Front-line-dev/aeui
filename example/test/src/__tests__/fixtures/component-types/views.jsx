export const events = [];

const first = () => {
  events.push('setup first');
  AEUI.__runtime.clean(() => events.push('clean first'));
  let count = 0;
  return <button onClick={() => count++}>first:{count}</button>;
};
const second = () => <strong>second</strong>;

export let current = first;
export function selectSecond() { current = second; }
export function reset() { current = first; events.length = 0; }
export { first as default, second };
