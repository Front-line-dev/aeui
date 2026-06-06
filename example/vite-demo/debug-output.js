import { AEUI, watch, clean } from 'aeui';
import TreeTest from './TreeTest.jsx';
import ComplexExample from './ComplexExample.jsx';

// --- Original Demo Components ---
function Counter(_initialProps) {
  const __props = {
    ..._initialProps
  };
  let {
    title
  } = _initialProps;
  const _resolveProps = () => {
    const {
      title
    } = __props;
    return {
      title
    };
  };
  let count = 0;
  AEUI.__runtime.watch(() => {
    const _resolvedProps2 = _resolveProps();
    console.log(`Counter ${_resolvedProps2.title} changed to:`, count);
  }, () => {
    const _resolvedProps = _resolveProps();
    return [count];
  });
  return _newProps => AEUI.__runtime.runRenderPhase(_newProps, __props, _renderProps => {
    const _resolvedProps3 = _resolveProps();
    return AEUI.createElement("div", {
      style: "border: 1px solid #ccc; padding: 10px; margin: 10px;"
    }, AEUI.createElement("h3", null, _resolvedProps3.title), AEUI.createElement("p", null, "Count: ", count), AEUI.createElement("button", {
      onClick: () => count++
    }, "Increment"));
  });
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
  const _resolveProps2 = () => {
    const {
      count
    } = __props;
    return {
      count
    };
  };
  AEUI.__runtime.watch(() => {
    const _resolvedProps5 = _resolveProps2();
    console.log("Destructured Watch:", _resolvedProps5.count);
  }, () => {
    const _resolvedProps4 = _resolveProps2();
    return [_resolvedProps4.count];
  });
  return _newProps2 => AEUI.__runtime.runRenderPhase(_newProps2, __props, _renderProps2 => {
    const _resolvedProps6 = _resolveProps2();
    return AEUI.createElement("div", {
      style: "border: 1px solid #ddd; padding: 10px; margin: 10px 0;"
    }, AEUI.createElement("h3", null, "1. Destructuring: ", _resolvedProps6.count), AEUI.createElement("p", null, "Check console for \"Destructured Watch\""));
  });
}

// 2. Aliased Props Test (p)
function AliasedCounter(_initialProps3) {
  const __props = {
    ..._initialProps3
  };
  const p = __props;
  AEUI.__runtime.watch(() => {
    console.log("Aliased Watch:", p.count);
  }, () => [p.count]);
  return _newProps3 => AEUI.__runtime.runRenderPhase(_newProps3, __props, _renderProps3 => {
    return AEUI.createElement("div", {
      style: "border: 1px solid #ddd; padding: 10px; margin: 10px 0;"
    }, AEUI.createElement("h3", null, "2. Aliased (p): ", p.count), AEUI.createElement("p", null, "Check console for \"Aliased Watch\""));
  });
}

// 3. Direct Props Usage
function DirectCounter(_initialProps4) {
  const __props = {
    ..._initialProps4
  };
  const props = __props;
  AEUI.__runtime.watch(() => {
    console.log("Direct Watch:", props.count);
  }, () => [props.count]);
  return _newProps4 => AEUI.__runtime.runRenderPhase(_newProps4, __props, _renderProps4 => {
    return AEUI.createElement("div", {
      style: "border: 1px solid #ddd; padding: 10px; margin: 10px 0;"
    }, AEUI.createElement("h3", null, "3. Direct Usage: ", props.count), AEUI.createElement("p", null, "Check console for \"Direct Watch\""));
  });
}
function TestingContainer() {
  let globalCount = 0;

  // Local state update via interval
  const timer = setInterval(() => {
    globalCount++;
    // No explicit watch or update call!
    // AEUI core will pick this up via the polling fallback render path.
  }, 2000);
  AEUI.__runtime.clean(() => clearInterval(timer));
  return _newProps5 => AEUI.__runtime.runRenderPhase(_newProps5, null, _renderProps5 => {
    return AEUI.createElement("div", {
      style: "margin-top: 20px; border-top: 2px solid #333; padding-top: 20px;"
    }, AEUI.createElement("h2", null, "Reactive Props Verification Suite"), AEUI.createElement("p", null, "Global Count (Auto-increments every 2s): ", globalCount), AEUI.createElement(DestructuredCounter, {
      count: globalCount
    }), AEUI.createElement(AliasedCounter, {
      count: globalCount
    }), AEUI.createElement(DirectCounter, {
      count: globalCount
    }));
  });
}
export default function App() {
  return _newProps6 => AEUI.__runtime.runRenderPhase(_newProps6, null, _renderProps6 => {
    return AEUI.createElement("div", null, AEUI.createElement("h1", null, "AEUI Vite Demo"), AEUI.createElement("p", null, "This is a standard Vite project using AEUI."), AEUI.createElement("div", {
      style: "display: flex; gap: 10px;"
    }, AEUI.createElement(Counter, {
      title: "Counter 1"
    }), AEUI.createElement(Counter, {
      title: "Counter 2"
    })), AEUI.createElement(TreeTest, null), AEUI.createElement(ComplexExample, null), AEUI.createElement(TestingContainer, null));
  });
}
