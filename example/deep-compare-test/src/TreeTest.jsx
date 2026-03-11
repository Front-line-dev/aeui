import { AEUI, watch } from 'aeui';

function Child({ name }) {
  console.log(`[TreeTest] Rendering Child ${name}`);
  let count = 0;

  watch([count], () => {
    console.log(`[TreeTest] Child ${name} state changed:`, count);
  });

  return (
    <div style="border: 1px solid green; padding: 5px; margin: 5px;">
      <h4>Child {name}</h4>
      <p>Count: {count}</p>
      <button onClick={() => count++}>Increment Child {name}</button>
    </div>
  );
}

export default function TreeTest() {
  console.log("[TreeTest] Rendering Parent");
  
  return (
    <div style="border: 2px solid blue; padding: 10px;">
      <h2>Tree Update Verification</h2>
      <p>Open Console. Clicking Child should NOT log "Rendering Parent".</p>
      <div style="display: flex;">
        <Child name="A" />
        <Child name="B" />
      </div>
    </div>
  );
}
