const runtimeContextStack = [];

export function getRuntimeContext() {
  return runtimeContextStack[runtimeContextStack.length - 1] || null;
}

export function withComponentContext(state, node, phase, callback) {
  const previousNode = state.currentComponentNode;
  const previousPhase = state.currentComponentPhase;

  runtimeContextStack.push(state);

  state.currentComponentNode = node;
  state.currentComponentPhase = phase;

  try {
    return callback();
  } finally {
    runtimeContextStack.pop();
    state.currentComponentNode = previousNode;
    state.currentComponentPhase = previousPhase;
  }
}
