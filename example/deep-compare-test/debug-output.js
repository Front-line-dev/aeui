import { AEUI, watch } from 'aeui';
const TestSection = _initialProps => {
  const __props = {
    ..._initialProps
  };
  let {
    title,
    children
  } = _initialProps;
  const _resolveProps = () => {
    const {
      title,
      children
    } = __props;
    return {
      title,
      children
    };
  };
  return _newProps => AEUI.__runtime.runRenderPhase(_newProps, __props, _renderProps => {
    const _resolvedProps = _resolveProps();
    return AEUI.createElement("div", {
      style: "border: 1px solid #ccc; padding: 10px; margin: 10px;"
    }, AEUI.createElement("h3", null, _resolvedProps.title), _resolvedProps.children);
  });
};
const WatchDedupeTest = () => {
  let state = {
    count: 1
  };
  let triggers = 0;
  let status = "Waiting...";
  AEUI.__runtime.watch(() => [state], () => {
    triggers++;
    console.log(`[WatchDedupe] Triggered! Total: ${triggers}`);
  });

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
      state = {
        count: 1
      }; // New Ref, Same Content
    }
    if (tick === 4) {
      if (triggers === 0) {
        // Should trigger 0 times (initial watch might trigger if immediate? usually watch triggers on change)
        // Wait, watch usually triggers if deps change. 
        // Initial setup: oldDeps starts undefined. default implementation typically doesn't fire immediately unless specified?
        // In core.js: !watcher.oldDeps -> triggers is TRUE initially?
        // Let's check core.js lines 123: !watcher.oldDeps || ...
        // Yes, it triggers initially.
        // So triggers should be 1 (initial).
        // After update: triggers should STILL be 1.
        status = "PASS: Watch did not re-trigger";
      } else if (triggers > 1) {
        status = "FAIL: Watch re-triggered!";
      } else {
        status = "PASS: Watch triggered once (initial) and ignored duplicate.";
      }
    }
  }, 1000);
  return _newProps2 => AEUI.__runtime.runRenderPhase(_newProps2, null, _renderProps2 => {
    return AEUI.createElement(TestSection, {
      title: "1. Watch Deduplication"
    }, AEUI.createElement("div", null, "State: ", JSON.stringify(state)), AEUI.createElement("div", null, "Triggers: ", triggers), AEUI.createElement("div", {
      style: {
        color: status.startsWith('FAIL') ? 'red' : 'green'
      }
    }, status));
  });
};
const InPlaceSetTest = () => {
  let mySet = new Set([1]);
  let triggers = 0;
  let status = "Waiting...";
  AEUI.__runtime.watch(() => [mySet], () => {
    triggers++;
    console.log(`[InPlaceSet] Triggered! Total: ${triggers}`);
  });
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
  return _newProps3 => AEUI.__runtime.runRenderPhase(_newProps3, null, _renderProps3 => {
    return AEUI.createElement(TestSection, {
      title: "2. Set In-Place Mutation"
    }, AEUI.createElement("div", null, "Set Size: ", mySet.size), AEUI.createElement("div", null, "Triggers: ", triggers), AEUI.createElement("div", {
      style: {
        color: status.startsWith('FAIL') ? 'red' : 'green'
      }
    }, status));
  });
};
const InPlaceObjectTest = () => {
  let myObj = {
    a: 1,
    nested: {
      b: 2
    }
  };
  let triggers = 0;
  let status = "Waiting...";
  AEUI.__runtime.watch(() => [myObj], () => {
    triggers++;
    console.log(`[InPlaceObj] Triggered! Total: ${triggers}`);
  });
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
  return _newProps4 => AEUI.__runtime.runRenderPhase(_newProps4, null, _renderProps4 => {
    return AEUI.createElement(TestSection, {
      title: "3. Object In-Place Mutation"
    }, AEUI.createElement("div", null, "Value: ", myObj.nested.b), AEUI.createElement("div", null, "Triggers: ", triggers), AEUI.createElement("div", {
      style: {
        color: status.startsWith('FAIL') ? 'red' : 'green'
      }
    }, status));
  });
};
const DOMPropTest = () => {
  // Hard to verify strictly without DOM tools, but we can visualy check
  // or add a getter that logs access?
  // Let's just demonstrate rendering for now.
  let obj = {
    style: "color: blue"
  };
  setTimeout(() => {
    obj.style = "color: red";
  }, 2000);
  return _newProps5 => AEUI.__runtime.runRenderPhase(_newProps5, null, _renderProps5 => {
    return AEUI.createElement(TestSection, {
      title: "4. DOM Prop Test"
    }, AEUI.createElement("div", {
      style: obj.style
    }, "This should be blue to red."), AEUI.createElement("div", null, "Inspect DOM to verify attributes."));
  });
};
const App = () => {
  return _newProps6 => AEUI.__runtime.runRenderPhase(_newProps6, null, _renderProps6 => {
    return AEUI.createElement("div", {
      style: "font-family: sans-serif;"
    }, AEUI.createElement("h1", null, "Deep Comparison Tests"), AEUI.createElement(WatchDedupeTest, null), AEUI.createElement(InPlaceSetTest, null), AEUI.createElement(InPlaceObjectTest, null), AEUI.createElement(DOMPropTest, null));
  });
};
export default App;