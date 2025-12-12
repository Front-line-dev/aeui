import { AEUI, watch } from 'aeui';
import TreeTest from './TreeTest.jsx';

function Counter({ title }) {
  let count = 0;

  // This watch dependency [count] should be transformed to () => [count] by the plugin
  watch(() => {
    console.log(`Counter ${title} changed to:`, count);
  }, [count]);

  return (
    <div style="border: 1px solid #ccc; padding: 10px; margin: 10px;">
      <h3>{title}</h3>
      <p>Count: {count}</p>
      <button onClick={() => count++}>Increment</button>
    </div>
  );
}

export default function App() {
  return (
    <div>
      <h1>AEUI Vite Demo</h1>
      <p>This is a standard Vite project using AEUI.</p>
      <Counter title="Counter 1" />
      <Counter title="Counter 2" />
      <TreeTest />
    </div>
  );
}
