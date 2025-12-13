import { AEUI, watch, clean } from 'aeui';
import TreeTest from './TreeTest.jsx';

// --- Original Demo Components ---
function Counter(_initialProps) {
  const __props = {
    ..._initialProps
  };
  let {
    title
  } = _initialProps;
  let count = 0;
  watch(() => {
    console.log(`Counter ${__props.title} changed to:`, count);
  }, () => [count]);
  return _newProps => {
    AEUI.updateProps(__props, _newProps);
    return AEUI.createElement("div", {
      style: "border: 1px solid #ccc; padding: 10px; margin: 10px;"
    }, AEUI.createElement("h3", null, __props.title), AEUI.createElement("p", null, "Count: ", count), AEUI.createElement("button", {
      onClick: () => count++
    }, "Increment"));
  };
}

// --- Reactive Props Verification Components ---

// 1. Destructuring Test
function DestructuredCounter(_initialProps2) {
  const __props = {
    ..._initialProps2
  };
  let {
    count
  } = _initialProps2;
  watch(() => {
    console.log("Destructured Watch:", __props.count);
  }, () => [__props.count]);
  return _newProps2 => {
    AEUI.updateProps(__props, _newProps2);
    return AEUI.createElement("div", {
      style: "border: 1px solid #ddd; padding: 10px; margin: 10px 0;"
    }, AEUI.createElement("h3", null, "1. Destructuring: ", __props.count), AEUI.createElement("p", null, "Check console for \"Destructured Watch\""));
  };
}

// 2. Aliased Props Test (p)
function AliasedCounter(_initialProps3) {
  const __props = {
    ..._initialProps3
  };
  const p = __props;
  watch(() => {
    console.log("Aliased Watch:", p.count);
  }, () => [p.count]);
  return _newProps3 => {
    AEUI.updateProps(__props, _newProps3);
    return AEUI.createElement("div", {
      style: "border: 1px solid #ddd; padding: 10px; margin: 10px 0;"
    }, AEUI.createElement("h3", null, "2. Aliased (p): ", p.count), AEUI.createElement("p", null, "Check console for \"Aliased Watch\""));
  };
}

// 3. Direct Props Usage
function DirectCounter(_initialProps4) {
  const __props = {
    ..._initialProps4
  };
  const props = __props;
  watch(() => {
    console.log("Direct Watch:", props.count);
  }, () => [props.count]);
  return _newProps4 => {
    AEUI.updateProps(__props, _newProps4);
    return AEUI.createElement("div", {
      style: "border: 1px solid #ddd; padding: 10px; margin: 10px 0;"
    }, AEUI.createElement("h3", null, "3. Direct Usage: ", props.count), AEUI.createElement("p", null, "Check console for \"Direct Watch\""));
  };
}

// Force Rebuild
function TestingContainer() {
  let globalCount = 0;

  // Local state update via interval
  const timer = setInterval(() => {
    globalCount++;
    // No explicit watch or update call!
    // AEUI core will now pick this up via root re-render on tick.
  }, 2000);
  clean(() => clearInterval(timer));
  return () => AEUI.createElement("div", {
    style: "margin-top: 20px; border-top: 2px solid #333; padding-top: 20px;"
  }, AEUI.createElement("h2", null, "Reactive Props Verification Suite"), AEUI.createElement("p", null, "Global Count (Auto-increments every 2s): ", globalCount), AEUI.createElement(DestructuredCounter, {
    count: globalCount
  }), AEUI.createElement(AliasedCounter, {
    count: globalCount
  }), AEUI.createElement(DirectCounter, {
    count: globalCount
  }));
}
export default function App() {
  return () => AEUI.createElement("div", null, AEUI.createElement("h1", null, "AEUI Vite Demo"), AEUI.createElement("p", null, "This is a standard Vite project using AEUI."), AEUI.createElement("div", {
    style: "display: flex; gap: 10px;"
  }, AEUI.createElement(Counter, {
    title: "Counter 1"
  }), AEUI.createElement(Counter, {
    title: "Counter 2"
  })), AEUI.createElement(TreeTest, null), AEUI.createElement(TestingContainer, null));
}