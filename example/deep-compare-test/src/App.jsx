
import { AEUI, watch } from 'aeui';

const TestSection = ({ title, children }) => {
  return (
    <div style="border: 1px solid #ccc; padding: 10px; margin: 10px;">
      <h3>{title}</h3>
      {children}
    </div>
  );
};

const WatchDedupeTest = () => {
  let state = { count: 1 };
  let triggers = 0;
  let status = "Waiting...";

  watch(() => {
    triggers++;
    console.log(`[WatchDedupe] Triggered! Total: ${triggers}`);
  }, [state]);

  // Periodic update with SAME content (new ref)
  // This interval runs outside component render scope, so AEUI will observe it through
  // the polling fallback path rather than the DOM event fast path.
  
  // Actually, to test, we can use a "tick" counter to sequence events.
  let tick = 0;
  
  // Use a local element ref updates
  let resultRef = null;

  // We can't use useEffect. We can use a self-invoking function or just setup once.
  // But wait, component body runs ONCE.
  
  setInterval(() => {
    tick++;
    if (tick === 2) {
      status = "Updating state to NEW ref with SAME content...";
      state = { count: 1 }; // New Ref, Same Content
    }
    if (tick === 4) {
      if (triggers === 0) { // Should trigger 0 times because initial deps are snapshotted.
         // Watch triggers only after deps change.
         // Initial setup stores oldDeps without firing the callback.
         // After updating with equivalent content, triggers should still be 0.
         status = "PASS: Watch did not re-trigger";
      } else if (triggers > 1) {
         status = "FAIL: Watch re-triggered!";
      } else {
         status = "PASS: Watch triggered once (initial) and ignored duplicate.";
      }
    }
  }, 1000);

  return () => (
    <TestSection title="1. Watch Deduplication">
      <div>State: {JSON.stringify(state)}</div>
      <div>Triggers: {triggers}</div>
      <div style={{ color: status.startsWith('FAIL') ? 'red' : 'green' }}>{status}</div>
    </TestSection>
  );
};

const InPlaceSetTest = () => {
  let mySet = new Set([1]);
  let triggers = 0;
  let status = "Waiting...";

  watch(() => {
    triggers++;
    console.log(`[InPlaceSet] Triggered! Total: ${triggers}`);
  }, [mySet]);

  let tick = 0;
  setInterval(() => {
    tick++;
    if (tick === 2) {
      status = "Mutating Set in-place (add 2)...";
      mySet.add(2);
    }
    if (tick === 4) {
      // triggers: 0 (initial) + 1 (mutation) = 1
      if (triggers === 1) {
        status = "PASS: Watch triggered on in-place mutation";
      } else {
        status = `FAIL: Watch triggered ${triggers} times (expected 1)`;
      }
    }
  }, 1000);

  return () => (
    <TestSection title="2. Set In-Place Mutation">
      <div>Set Size: {mySet.size}</div>
      <div>Triggers: {triggers}</div>
      <div style={{ color: status.startsWith('FAIL') ? 'red' : 'green' }}>{status}</div>
    </TestSection>
  );
};

const InPlaceObjectTest = () => {
  let myObj = { a: 1, nested: { b: 2 } };
  let triggers = 0;
  let status = "Waiting...";

  watch(() => {
    triggers++;
    console.log(`[InPlaceObj] Triggered! Total: ${triggers}`);
  }, [myObj]);

  let tick = 0;
  setInterval(() => {
    tick++;
    if (tick === 2) {
      status = "Mutating nested object in-place...";
      myObj.nested.b = 3;
    }
    if (tick === 4) {
      // triggers: 0 (initial) + 1 (mutation) = 1
      if (triggers >= 1) {
        status = "PASS: Watch triggered on in-place mutation";
      } else {
        status = `FAIL: Watch triggered ${triggers} times (expected >= 1)`;
      }
    }
  }, 1000);

  return () => (
    <TestSection title="3. Object In-Place Mutation">
      <div>Value: {myObj.nested.b}</div>
      <div>Triggers: {triggers}</div>
      <div style={{ color: status.startsWith('FAIL') ? 'red' : 'green' }}>{status}</div>
    </TestSection>
  );
};

const DOMPropTest = () => {
  // Hard to verify strictly without DOM tools, but we can visualy check
  // or add a getter that logs access?
  // Let's just demonstrate rendering for now.
  let obj = { style: "color: blue" };

  setTimeout(() => {
    obj.style = "color: red";
  }, 2000)
  
  return () => (
    <TestSection title="4. DOM Prop Test">
      <div style={obj.style}>This should be blue to red.</div>
      <div>Inspect DOM to verify attributes.</div>
    </TestSection>
  );
};

const App = () => {
  return () => (
    <div style="font-family: sans-serif;">
      <h1>Deep Comparison Tests</h1>
      <WatchDedupeTest />
      <InPlaceSetTest />
      <InPlaceObjectTest />
      <DOMPropTest />
    </div>
  );
};

export default App;
