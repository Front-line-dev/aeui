import { AEUI, watch } from 'aeui';

function Counter({ title }) {
  let count = 0;

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
    <main>
      <h1>AEUI App</h1>
      <p>State changes through ordinary JavaScript variables.</p>
      <Counter title="Counter 1" />
      <Counter title="Counter 2" />
    </main>
  );
}
