// SWC nodes retain resolver contexts, so bindings do not depend on identifier spelling.
export const span = () => ({ start: 0, end: 0 });
export const clone = (node) => structuredClone(node);
export const identifier = (value, ctxt = 0) => ({ type: 'Identifier', span: span(), ctxt, value, optional: false });
export const keyOf = (node) => node?.type === 'Identifier' ? `${node.ctxt}:${node.value}` : null;
export const literal = (value) => value === null ? { type: 'NullLiteral', span: span() }
  : { type: typeof value === 'number' ? 'NumericLiteral' : 'StringLiteral', span: span(), value };
export const member = (object, property) => ({ type: 'MemberExpression', span: span(), object, property: identifier(property) });
export const call = (callee, args) => ({ type: 'CallExpression', span: span(), ctxt: 0, callee,
  arguments: args.map(expression => ({ spread: null, expression })), typeArguments: null });
export const statement = (expression) => ({ type: 'ExpressionStatement', span: span(), expression });
export const returned = (argument = null) => ({ type: 'ReturnStatement', span: span(), argument });
export const block = (stmts, type = 'BlockStatement') => ({ type, span: span(), ctxt: 0, stmts });
export const arrow = (params, body) => ({ type: 'ArrowFunctionExpression', span: span(), ctxt: 0,
  params, body: body?.type === 'BlockStatement' ? { ...body, type: 'FunctionBody' } : body,
  async: false, generator: false, typeParameters: null, returnType: null });
export const variable = (id, init, kind = 'const') => ({ type: 'VariableDeclaration', span: span(), ctxt: 0, kind, declare: false,
  declarations: [{ type: 'VariableDeclarator', span: span(), id, init, definite: false }] });
export const property = (key, value) => ({ type: 'KeyValueProperty', key, value });
export const object = (properties) => ({ type: 'ObjectExpression', span: span(), properties });
export const spread = (argument) => ({ type: 'SpreadElement', spread: span(), arguments: argument });
export const voidValue = () => ({ type: 'UnaryExpression', span: span(), operator: 'void', argument: literal(0) });
export const isFunction = (node) => ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression'].includes(node?.type);
export const isBoundary = (node) => node && Array.isArray(node.params) && node.body;
export const isBlock = (node) => ['BlockStatement', 'FunctionBody'].includes(node?.type);
export const unwrap = (node) => node?.type === 'ParenthesisExpression' ? unwrap(node.expression) : node;
export const paramsOf = (node) => node.params.map(param => param.type === 'Parameter' ? param.pat : param);
export function setParams(node, params) {
  node.params = node.type === 'ArrowFunctionExpression' ? params
    : params.map(pat => ({ type: 'Parameter', span: span(), decorators: [], pat }));
}
export function ensureBody(node) {
  if (!isBlock(node.body)) node.body = block([returned(node.body)], 'FunctionBody');
  return node.body.stmts;
}

export function walk(node, visit, parent = null, key = null, index = null) {
  if (!node || typeof node !== 'object') return;
  if (visit(node, parent, key, index) === false) return;
  for (const [name, value] of Object.entries(node)) {
    if (['span', 'ctxt', 'typeAnnotation', 'typeParameters', 'returnType', 'typeArguments'].includes(name)) continue;
    if (Array.isArray(value)) value.forEach((child, i) => walk(child, visit, node, name, i));
    else if (value && typeof value === 'object') walk(value, visit, node, name);
  }
}

export function patternIds(pattern) {
  if (!pattern) return [];
  if (pattern.type === 'Identifier') return [pattern];
  if (pattern.type === 'Parameter') return patternIds(pattern.pat);
  if (pattern.type === 'AssignmentPattern') return patternIds(pattern.left);
  if (pattern.type === 'RestElement') return patternIds(pattern.argument);
  if (pattern.type === 'ArrayPattern') return pattern.elements.flatMap(patternIds);
  if (pattern.type === 'ObjectPattern') return pattern.properties.flatMap(prop => prop.type === 'AssignmentPatternProperty'
    ? [prop.key] : patternIds(prop.type === 'KeyValuePatternProperty' ? prop.value : prop));
  return [];
}

export function replaceAt(parent, key, index, value) {
  if (index === null) parent[key] = value;
  else parent[key][index] = value;
}

export function analysis(program) {
  const bindings = new Map(), parents = new WeakMap(), names = new Set(), exported = new Set();
  const bind = (id, data) => {
    const key = keyOf(id);
    if (key && !bindings.has(key)) bindings.set(key, { id, constant: true, assignments: [], ...data });
  };
  walk(program, (node, parent, key, index) => {
    parents.set(node, { parent, key, index });
    if (node.type === 'Identifier') names.add(node.value);
    if (isFunction(node) && node.identifier) bind(node.identifier, { kind: 'function', node });
    if (isBoundary(node)) for (const id of node.params.flatMap(patternIds)) bind(id, { kind: 'param', node });
    if (node.type === 'VariableDeclarator') for (const id of patternIds(node.id)) bind(id, { kind: 'variable', node });
    if (node.type === 'CatchClause') for (const id of patternIds(node.param)) bind(id, { kind: 'other', node });
    if (['ClassDeclaration', 'ClassExpression'].includes(node.type) && node.identifier) bind(node.identifier, { kind: 'other', node });
    if (node.type === 'ImportDeclaration' && !node.typeOnly) for (const spec of node.specifiers) {
      if (!spec.isTypeOnly) bind(spec.local, { kind: 'import', node: spec, source: node.source.value,
        imported: spec.type === 'ImportSpecifier' ? spec.imported?.value || spec.local.value : null });
    }
  });
  walk(program, (node) => {
    if (node.type === 'AssignmentExpression' || node.type === 'UpdateExpression') {
      for (const id of patternIds(node.left || node.argument)) {
        const binding = bindings.get(keyOf(id));
        if (binding) { binding.constant = false; if (node.right) binding.assignments.push(node.right); }
      }
    }
    if (node.type === 'ExportDeclaration') {
      const decl = node.declaration;
      if (decl.identifier) exported.add(keyOf(decl.identifier));
      for (const item of decl.declarations || []) for (const id of patternIds(item.id)) exported.add(keyOf(id));
    }
    if (node.type === 'ExportNamedDeclaration' && !node.source) for (const spec of node.specifiers) exported.add(keyOf(spec.orig));
    if (node.type === 'ExportDefaultExpression' && keyOf(node.expression)) exported.add(keyOf(node.expression));
  });
  const uid = (hint) => {
    let value = `__aeui_${hint}`, suffix = 0;
    while (names.has(value)) value = `__aeui_${hint}${++suffix}`;
    names.add(value);
    return identifier(value);
  };
  return { bindings, parents, exported, uid };
}

export function rewriteReferences(target, replace) {
  const declarations = new WeakSet();
  walk(target, (node) => {
    if (isBoundary(node)) node.params.flatMap(patternIds).forEach(id => declarations.add(id));
    if (node.identifier) declarations.add(node.identifier);
    if (node.type === 'VariableDeclarator') patternIds(node.id).forEach(id => declarations.add(id));
    if (node.type === 'CatchClause') patternIds(node.param).forEach(id => declarations.add(id));
  });
  walk(target, (node, parent, key, index) => {
    if (node.type === 'ImportDeclaration') return false;
    if (node.type !== 'Identifier' || declarations.has(node) || !parent || node.ctxt === undefined) return;
    if (parent.type === 'ExportSpecifier' && key === 'exported') return;
    if (parent.type === 'AssignmentExpression' && key === 'left') return;
    if ((parent.type === 'JSXOpeningElement' || parent.type === 'JSXClosingElement') && key === 'name' && !/^[A-Z]/.test(node.value)) return;
    const replacement = replace(node);
    if (!replacement) return;
    replacement.span = clone(node.span);
    if (parent.type === 'ObjectExpression' && key === 'properties') {
      replaceAt(parent, key, index, property(identifier(node.value), replacement));
    } else {
      if (replacement.type === 'MemberExpression' && ['JSXOpeningElement', 'JSXClosingElement', 'JSXMemberExpression'].includes(parent.type)) replacement.type = 'JSXMemberExpression';
      replaceAt(parent, key, index, replacement);
    }
    return false;
  });
}
