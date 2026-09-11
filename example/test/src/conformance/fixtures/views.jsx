import { clean } from 'aeui';
export const history = [];
export function valueView({ label }) {
  history.push('setup');
  let count = 0;
  clean(() => history.push('cleanup'));
  return <button onClick={() => count++}>{label}:{count}</button>;
}
export const aliasView = valueView;
