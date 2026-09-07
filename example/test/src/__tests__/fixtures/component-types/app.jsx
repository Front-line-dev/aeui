import First, { current, selectSecond } from './barrel.js';
import * as views from './barrel.js';

function Slot({ component: View }) { return <View />; }
export default function App() {
  return <main>
    <section id="default"><First /></section>
    <section id="live"><Slot component={current} /></section>
    <section id="namespace"><views.second /></section>
    <a onClick={selectSecond}>switch</a>
  </main>;
}
