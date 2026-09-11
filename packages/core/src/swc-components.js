import {
  analysis, arrow, block, call, clone, ensureBody, identifier, isBlock, isBoundary, isFunction,
  keyOf, literal, member, object, paramsOf, patternIds, property, replaceAt, returned,
  rewriteReferences, setParams, span, spread, statement, unwrap, variable, voidValue, walk,
} from './swc-ast.js';

const functionLike = node => ['ArrowFunctionExpression', 'FunctionExpression'].includes(unwrap(node)?.type);
const argsOf = node => node.arguments.map(arg => arg.expression);
const isLiteral = node => /Literal$/.test(node?.type || '');

export default function transformComponents(program) {
  const { bindings, parents, exported, uid } = analysis(program);
  const bindingOf = node => bindings.get(keyOf(node));
  const isAeui = node => bindingOf(node)?.source === 'aeui' && bindingOf(node)?.imported === 'AEUI';
  const runtimeId = uid('runtime');
  const runtimeMember = name => member(member(clone(runtimeId), '__runtime'), name);
  let needsRuntime = false;
  const runtimeCall = (name, args) => { needsRuntime = true; return call(runtimeMember(name), args); };
  const isRuntimeCall = (node, methods, internal = false) => {
    if (node?.type !== 'CallExpression') return false;
    const callee = node.callee;
    if (callee.type !== 'MemberExpression' || !methods.includes(callee.property?.value)) return false;
    const root = internal ? callee.object.object : callee.object;
    if (internal && (callee.object.type !== 'MemberExpression' || callee.object.property?.value !== '__runtime')) return false;
    return root?.type === 'Identifier' && (isAeui(root) || keyOf(root) === keyOf(runtimeId) || (!bindingOf(root) && root.value === 'AEUI'));
  };
  const ownReturns = (fn, visit) => {
    walk(fn.body, (node, parent, key, index) => {
      if (isBoundary(node)) return false;
      if (node.type === 'ReturnStatement') { visit(node, parent, key, index); return false; }
    });
  };
  const renderable = input => {
    const node = unwrap(input);
    if (!node) return false;
    if (['JSXElement', 'JSXFragment'].includes(node.type) || isRuntimeCall(node, ['createElement', 'createVNode'])) return true;
    if (node.type === 'ConditionalExpression') return renderable(node.consequent) || renderable(node.alternate);
    if (node.type === 'BinaryExpression' && ['&&', '||', '??'].includes(node.operator)) return renderable(node.left) || renderable(node.right);
    if (node.type === 'SequenceExpression') return node.expressions.some(renderable);
    if (node.type === 'ArrayExpression') return node.elements.some(item => renderable(item?.expression));
    return false;
  };
  const returnsMatching = (fn, predicate) => {
    if (!isBlock(fn.body)) return predicate(fn.body);
    let found = false;
    ownReturns(fn, node => { if (predicate(node.argument)) found = true; });
    return found;
  };
  const returnsRenderable = fn => returnsMatching(fn, node => renderable(node) ||
    (functionLike(node) && returnsMatching(unwrap(node), renderable)));
  const returnsSimple = fn => {
    const params = new Set(paramsOf(fn).flatMap(patternIds).map(keyOf));
    const simple = input => {
      const node = unwrap(input);
      if (!node) return false;
      if (isLiteral(node) && node.type !== 'RegExpLiteral') return true;
      if (node.type === 'Identifier') return params.has(keyOf(node));
      if (node.type === 'MemberExpression') return simple(node.object);
      if (node.type === 'ArrayExpression') return node.elements.every(item => !item || simple(item.expression));
      if (node.type === 'ConditionalExpression') return simple(node.consequent) && simple(node.alternate);
      if (node.type === 'BinaryExpression' && ['&&', '||', '??'].includes(node.operator)) return simple(node.left) && simple(node.right);
      return false;
    };
    return returnsMatching(fn, simple);
  };
  const isExported = fn => {
    const parent = parents.get(fn)?.parent;
    if (parent?.type === 'ExportDefaultDeclaration' || parent?.type === 'ExportDefaultExpression') return true;
    const id = parent?.type === 'VariableDeclarator' ? parent.id : fn.identifier;
    return !!id && exported.has(keyOf(id));
  };

  const used = new Set(), visited = new Set();
  const resolve = input => {
    const node = unwrap(input);
    if (!node || visited.has(node)) return;
    visited.add(node);
    if (isFunction(node)) used.add(node);
    else if (node.type === 'Identifier') {
      const binding = bindingOf(node);
      if (!binding) return;
      if (binding.kind === 'function') resolve(binding.node);
      if (binding.kind === 'variable') resolve(binding.node.init);
      binding.assignments.forEach(resolve);
    } else if (node.type === 'ConditionalExpression') {
      resolve(node.consequent); resolve(node.alternate);
    } else if (node.type === 'BinaryExpression' && ['&&', '||', '??'].includes(node.operator)) {
      resolve(node.left); resolve(node.right);
    } else if (node.type === 'SequenceExpression') resolve(node.expressions.at(-1));
    else if (['MemberExpression', 'JSXMemberExpression'].includes(node.type)) {
      const binding = bindingOf(node.object);
      const value = binding?.kind === 'variable' ? unwrap(binding.node.init) : unwrap(node.object);
      if (value?.type !== 'ObjectExpression') return;
      const key = node.property.type === 'Computed' ? node.property.expression.value : node.property.value;
      for (const prop of value.properties) {
        if (prop.type === 'KeyValueProperty' && prop.key.type !== 'Computed' && prop.key.value === key) resolve(prop.value);
        if (prop.type === 'Identifier' && prop.value === key) resolve(prop);
      }
    }
  };
  const registered = new Set();
  const ignoreFunctions = node => walk(node, child => { if (isFunction(child)) registered.add(child); });
  walk(program, node => {
    if (node.type === 'JSXOpeningElement' && (node.name.type !== 'Identifier' || /^[A-Z]/.test(node.name.value))) resolve(node.name);
    if (node.type === 'JSXAttribute' && node.value?.type === 'JSXExpressionContainer') resolve(node.value.expression);
    if (isRuntimeCall(node, ['createElement', 'createVNode', 'init'])) resolve(node.arguments[0]?.expression);
    if (!isRuntimeCall(node, ['registerComponent'], true)) return;
    for (const arg of argsOf(node)) {
      if (isFunction(arg)) ignoreFunctions(arg);
      const binding = bindingOf(arg);
      if (binding?.kind === 'function') ignoreFunctions(binding.node);
      if (binding?.kind === 'param') {
        const wrapper = binding.node, invocation = parents.get(wrapper)?.parent;
        if (invocation?.type === 'CallExpression' && invocation.callee === wrapper) {
          ignoreFunctions(wrapper); invocation.arguments.forEach(item => ignoreFunctions(item.expression));
        }
      }
    }
  });
  const hasRenderBridge = fn => returnsMatching(fn, input => {
    const wrapper = unwrap(input);
    if (wrapper?.type !== 'ArrowFunctionExpression' || wrapper.params.length !== 1 || wrapper.params[0].type !== 'Identifier') return false;
    if (!isRuntimeCall(wrapper.body, ['runRenderPhase'], true)) return false;
    const args = argsOf(wrapper.body);
    if (args.length !== 3 || keyOf(args[0]) !== keyOf(wrapper.params[0]) || !functionLike(args[2]) || paramsOf(args[2]).length !== 1) return false;
    if (args[1].type === 'NullLiteral') return paramsOf(fn).length === 0;
    const binding = bindingOf(args[1]), init = binding?.node.init;
    return binding?.constant && init?.type === 'ObjectExpression' && init.properties.length === 1 && init.properties[0].type === 'SpreadElement';
  });
  const candidates = [];
  walk(program, node => {
    if (!isFunction(node)) return;
    if (registered.has(node) || hasRenderBridge(node)) return false;
    if (used.has(node) || returnsRenderable(node) || (isExported(node) && returnsSimple(node))) candidates.push(node);
  });

  const unregisteredFunction = input => {
    const node = unwrap(input);
    if (node?.type !== 'CallExpression' || node.callee.type !== 'ArrowFunctionExpression' || node.arguments.length !== 1) return null;
    if (!isRuntimeCall(node.callee.body, ['registerComponent'], true)) return null;
    const value = unwrap(node.arguments[0].expression);
    if (functionLike(value)) return value;
    if (value?.type === 'MemberExpression' && value.object.type === 'ObjectExpression') {
      const original = value.object.properties[0]?.value;
      if (value.object.properties.length === 1 && functionLike(original)) return original;
    }
    return null;
  };
  const makeFactory = fn => {
    const body = ensureBody(fn);
    if (!['ReturnStatement', 'ThrowStatement'].includes(body.at(-1)?.type)) body.push(returned());
    ownReturns(fn, (node, parent, key, index) => {
      const arg = unwrap(node.argument), original = unregisteredFunction(arg);
      if (original) { node.argument = clone(original); return; }
      if (functionLike(arg)) { node.argument = arg; return; }
      const binding = bindingOf(arg);
      if (binding && (binding.kind === 'function' || (binding.kind === 'variable' &&
          (functionLike(binding.node.init) || unregisteredFunction(binding.node.init))))) {
        const render = uid('render'), props = uid('renderProps');
        node.argument = arrow([clone(props)], call(clone(render), [clone(props)]));
        replaceAt(parent, key, index, block([variable(render, arg), node]));
        return;
      }
      node.argument = arrow([], arg || voidValue());
    });
  };
  const defaultValue = (source, fallback) => ({ type: 'ConditionalExpression', span: span(),
    test: { type: 'BinaryExpression', span: span(), operator: '===', left: clone(source), right: voidValue() },
    consequent: clone(fallback), alternate: clone(source) });
  const supportedPattern = param => ['Identifier', 'ObjectPattern', 'ArrayPattern'].includes(param?.type);
  const bindRenderParam = (param, source) => {
    if (supportedPattern(param)) return [variable(clone(param), clone(source))];
    if (param?.type === 'AssignmentPattern' && supportedPattern(param.left)) return [variable(clone(param.left), defaultValue(source, param.right))];
    return [];
  };
  const dependencyGetter = node => {
    if (functionLike(node)) return unwrap(node);
    if (node.type === 'Identifier') {
      const binding = bindingOf(node);
      if (binding?.constant) {
        if (binding.kind === 'function') return node;
        const init = unwrap(binding.node.init);
        if (binding.kind === 'variable' && functionLike(init)) return node;
        if (binding.kind === 'variable' && (isLiteral(init) || ['ArrayExpression', 'ObjectExpression'].includes(init?.type))) return arrow([], clone(node));
      }
    } else if (isLiteral(node) || ['ArrayExpression', 'ObjectExpression'].includes(node.type)) return arrow([], clone(node));
    throw new SyntaxError('[AEUI] Ambiguous watch dependency. Use an explicit getter: () => [value] or () => getDeps().');
  };
  const injectProps = fn => {
    const params = paramsOf(fn), body = ensureBody(fn);
    let propsId = null, resolver = null;
    const destructured = new Map();
    const first = params[0], pattern = first?.type === 'AssignmentPattern' ? first.left : first;
    if (supportedPattern(pattern)) {
      const initial = uid('initialProps');
      propsId = uid('props');
      let source = initial;
      const prefix = [];
      if (first.type === 'AssignmentPattern') {
        source = uid('initialValue'); prefix.push(variable(clone(source), defaultValue(initial, first.right)));
      }
      prefix.push(variable(clone(propsId), object([spread(clone(source))])));
      if (pattern.type === 'Identifier') prefix.push(variable(clone(pattern), clone(propsId)));
      else {
        const ids = patternIds(pattern);
        for (const id of ids) destructured.set(keyOf(id), id.value);
        resolver = uid('resolveProps');
        prefix.push(variable(clone(resolver), arrow([], block([
          variable(clone(pattern), clone(propsId)), returned(object(ids.map(id => property(identifier(id.value), clone(id))))),
        ]))));
        prefix.push(variable(clone(pattern), clone(source), 'let'));
      }
      params[0] = initial; setParams(fn, params); body.unshift(...prefix);
    }
    const rewriteProps = (target, resolved) => rewriteReferences(target, id => destructured.has(keyOf(id))
      ? member(clone(resolved), destructured.get(keyOf(id))) : null);
    const prepareProps = target => {
      if (!resolver || !functionLike(target)) return [];
      const resolved = uid('resolvedProps');
      rewriteProps(target, resolved);
      return [variable(resolved, call(clone(resolver), []))];
    };
    // Process hook bindings before inserting render bridges. Context identities
    // preserve nested shadowing without constructing a second scope resolver.
    walk(fn, node => {
      if (node.type !== 'CallExpression' || node.callee.type !== 'Identifier') return;
      const binding = bindingOf(node.callee);
      const hook = binding?.kind === 'import' && binding.source === 'aeui' ? binding.imported : !binding ? node.callee.value : null;
      if (hook === 'clean') { node.callee = runtimeMember('clean'); needsRuntime = true; return; }
      if (hook !== 'watch' || ![1, 2].includes(node.arguments.length) || node.arguments[0].expression.type === 'ArrayExpression') return;
      if (node.arguments.length === 2) node.arguments[1].expression = dependencyGetter(node.arguments[1].expression);
      node.callee = runtimeMember('watch'); needsRuntime = true;
      for (const arg of node.arguments) {
        const target = unwrap(arg.expression);
        if (functionLike(target)) { const prefix = prepareProps(target); ensureBody(target).unshift(...prefix); }
      }
    });
    ownReturns(fn, node => {
      const render = unwrap(node.argument);
      if (!functionLike(render)) return;
      const originalParam = paramsOf(render)[0], next = uid('newProps'), inner = uid('renderProps');
      const prefix = bindRenderParam(originalParam, inner);
      setParams(render, [clone(inner)]);
      const renderBody = ensureBody(render);
      // Include default expressions of the original render parameter in rewriting.
      renderBody.unshift(...prefix);
      const resolved = prepareProps(render);
      renderBody.unshift(...resolved);
      node.argument = arrow([clone(next)], runtimeCall('runRenderPhase', [next, propsId ? clone(propsId) : literal(null), render]));
    });
  };

  for (const fn of candidates.reverse()) {
    const location = parents.get(fn), parent = location.parent;
    const declaration = fn.type === 'FunctionDeclaration' || parent.type === 'ExportDefaultDeclaration';
    if (declaration && !fn.identifier) fn.identifier = uid('component');
    const original = clone(fn), setup = clone(fn);
    const type = declaration ? clone(fn.identifier) : fn.identifier ? clone(fn.identifier) : uid('component');
    if (setup.async || setup.generator) {
      setup.async = false; setup.generator = false; setParams(setup, []);
      setup.body = block([{ type: 'ThrowStatement', span: span(), argument: { type: 'NewExpression', span: span(), ctxt: 0,
        callee: identifier('TypeError'), arguments: [{ spread: null, expression: literal('[AEUI] Component setup must be synchronous; async and generator functions cannot be element types.') }], typeArguments: null } }], 'FunctionBody');
    } else { makeFactory(setup); injectProps(setup); }
    if (setup.type === 'FunctionDeclaration') setup.type = 'FunctionExpression';
    setup.identifier = null;
    const registration = runtimeCall('registerComponent', [clone(type), setup]);
    if (declaration) {
      let owner = parent;
      if (['ExportDefaultDeclaration', 'ExportDeclaration'].includes(owner.type)) owner = parents.get(owner).parent;
      const list = owner?.type === 'Module' || owner?.type === 'Script' ? owner.body : isBlock(owner) ? owner.stmts : null;
      if (!list) throw new SyntaxError('[AEUI] Component function declarations need a block scope.');
      // Preserve the source node in its original container even after earlier hoists.
      Object.assign(fn, original);
      list.unshift(statement(registration));
    } else {
      let inferred = null;
      if (!original.identifier) {
        if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') inferred = parent.id.value;
        if (parent.type === 'KeyValueProperty' && parent.key.type !== 'Computed') inferred = parent.key.value;
        if (['AssignmentExpression', 'AssignmentPattern'].includes(parent.type) && parent.left.type === 'Identifier') inferred = parent.left.value;
        if (parent.type === 'ExportDefaultExpression') inferred = 'default';
      }
      const value = inferred === null ? original : { type: 'MemberExpression', span: span(),
        object: object([property(literal(inferred), original)]), property: { type: 'Computed', span: span(), expression: literal(inferred) } };
      const wrapped = call(arrow([clone(type)], registration), [value]);
      // Mutate the node itself: sibling declaration hoists may have shifted indices.
      for (const key of Object.keys(fn)) delete fn[key];
      Object.assign(fn, wrapped);
    }
  }
  // Explicit unbound AEUI references remain supported, as in the Babel frontend.
  rewriteReferences(program, id => {
    if (id.value === 'AEUI' && !bindingOf(id)) { needsRuntime = true; return clone(runtimeId); }
    return null;
  });
  if (needsRuntime) program.body.unshift({ type: 'ImportDeclaration', span: span(),
    specifiers: [{ type: 'ImportSpecifier', span: span(), local: clone(runtimeId), imported: identifier('AEUI'), isTypeOnly: false }],
    source: literal('aeui'), typeOnly: false, with: null, phase: 'evaluation' });
  return program;
}
