import { AEUI, watch, clean } from 'aeui';
import TreeTest from './TreeTest.jsx';
import ComplexExample from './ComplexExample.jsx';

// --- Original Demo Components ---
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

// --- Reactive Props Verification Components ---

// 1. Destructuring Test
function DestructuredCounter({ count }) {
  watch(() => {
    console.log("Destructured Watch:", count);
  }, [count]);
  
  return (
    <div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0;">
      <h3>1. Destructuring: {count}</h3>
      <p>Check console for "Destructured Watch"</p>
    </div>
  );
}

// 2. Aliased Props Test (p)
function AliasedCounter(p) {
  watch(() => {
    console.log("Aliased Watch:", p.count);
  }, [p.count]);

  return (
    <div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0;">
      <h3>2. Aliased (p): {p.count}</h3>
      <p>Check console for "Aliased Watch"</p>
    </div>
  );
}

// 3. Direct Props Usage
function DirectCounter(props) {
  watch(() => {
    console.log("Direct Watch:", props.count);
  }, [props.count]);

  return (
    <div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0;">
      <h3>3. Direct Usage: {props.count}</h3>
      <p>Check console for "Direct Watch"</p>
    </div>
  );
}

function TestingContainer() {
  let globalCount = 0;

  // Local state update via interval
  const timer = setInterval(() => {
    globalCount++;
    // No explicit watch or update call!
    // AEUI core will pick this up via the polling fallback render path.
  }, 2000);

  clean(() => clearInterval(timer));

  return (
     <div style="margin-top: 20px; border-top: 2px solid #333; padding-top: 20px;">
        <h2>Reactive Props Verification Suite</h2>
        <p>Global Count (Auto-increments every 2s): {globalCount}</p>
        <DestructuredCounter count={globalCount} />
        <AliasedCounter count={globalCount} />
        <DirectCounter count={globalCount} />
     </div>
  );
}

export default function App() {
  return (
    <div>
      <h1>AEUI Vite Demo</h1>
      <p>This is a standard Vite project using AEUI.</p>
      
      <div style="display: flex; gap: 10px;">
        <Counter title="Counter 1" />
        <Counter title="Counter 2" />
      </div>

      <TreeTest />

      <ComplexExample />

      <TestingContainer />
    </div>
  );
}
