// Babel rejects adjacent JSX before visitors run. Temporary operators let its
// parser identify JSX boundaries without treating strings or comments as markup.
function insertAt(source, insertions) {
  const edits = [...insertions].sort((a, b) => a.at - b.at);
  const spans = [];
  let code = '';
  let cursor = 0;
  for (const { at, text } of edits) {
    code += source.slice(cursor, at);
    spans.push({ start: code.length, end: code.length + text.length, at });
    code += text;
    cursor = at;
  }
  code += source.slice(cursor);
  return {
    code,
    originalOffset(offset) {
      let low = 0;
      let high = spans.length;
      while (low < high) {
        const middle = (low + high) >>> 1;
        if (spans[middle].start <= offset) low = middle + 1;
        else high = middle;
      }
      if (!low) return offset;
      const span = spans[low - 1];
      return span.at + Math.max(0, offset - span.end);
    },
  };
}

function walk(value, visit, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  visit(value);
  for (const child of Object.values(value)) walk(child, visit, seen);
}

function restorePositions(value, source, edited, options) {
  const startIndex = options.startIndex || 0;
  const lines = [0];
  const breaks = /\r\n|[\n\r\u2028\u2029]/g;
  for (const match of source.matchAll(breaks)) lines.push(match.index + match[0].length);
  const offset = (index) => edited.originalOffset(index - startIndex);
  const position = (index) => {
    const original = offset(index);
    let low = 0;
    let high = lines.length;
    while (low + 1 < high) {
      const middle = (low + high) >>> 1;
      if (lines[middle] <= original) low = middle;
      else high = middle;
    }
    return {
      line: (options.startLine || 1) + low,
      column: original - lines[low] + (low === 0 ? options.startColumn || 0 : 0),
      index: original + startIndex,
    };
  };
  walk(value, (node) => {
    if (typeof node.start === 'number') node.start = offset(node.start) + startIndex;
    if (typeof node.end === 'number') node.end = offset(node.end) + startIndex;
    if (Array.isArray(node.range)) node.range = node.range.map((index) => offset(index) + startIndex);
    if (typeof node.index === 'number' && typeof node.line === 'number') {
      Object.assign(node, position(node.index));
    }
    if (typeof node.parenStart === 'number') node.parenStart = offset(node.parenStart) + startIndex;
  });
  // Parser errors expose pos as a getter backed by loc.index.
  if (value instanceof SyntaxError && value.loc) {
    value.message = value.message.replace(/\(\d+:\d+\)$/, `(${value.loc.line}:${value.loc.column})`);
  }
  return value;
}

export function parseWithAutomaticFragments(source, options, parse) {
  const boundaries = [];
  let edited = insertAt(source, boundaries);
  let ast;
  for (;;) {
    try {
      ast = parse(edited.code, options);
      break;
    } catch (error) {
      if (error.reasonCode !== 'UnwrappedAdjacentJSXElements') {
        throw restorePositions(error, source, edited, options);
      }
      const at = edited.originalOffset(error.pos - (options.startIndex || 0));
      if (boundaries.some((boundary) => boundary.at === at)) {
        throw restorePositions(error, source, edited, options);
      }
      boundaries.push({ at, text: '+' });
      edited = insertAt(source, boundaries);
    }
  }
  if (!boundaries.length) return ast;

  const elements = [];
  walk(ast, (node) => {
    if (node.type === 'JSXElement' || node.type === 'JSXFragment') elements.push(node);
  });
  restorePositions(ast, source, edited, options);
  const base = options.startIndex || 0;
  const starts = new Set();
  const ends = new Set();
  const middle = [];
  for (const { at } of boundaries) {
    const left = elements.filter((node) => node.end - base <= at)
      .sort((a, b) => b.end - a.end)[0];
    const right = elements.filter((node) => node.start - base >= at)
      .sort((a, b) => a.start - b.start)[0];
    if (!left || !right || right.start - base !== at) {
      // A '<' comparison or another malformed expression is not a JSX sibling.
      return parse(source, options);
    }
    starts.add(left);
    ends.add(right);
    middle.push({ at, text: '}{' });
  }
  const wrappers = [
    ...[...starts].filter((node) => !ends.has(node)).map((node) => ({ at: node.start - base, text: '<>{' })),
    ...middle,
    ...[...ends].filter((node) => !starts.has(node)).map((node) => ({ at: node.end - base, text: '}</>' })),
  ];
  // Expression containers preserve JavaScript comments between siblings. A final
  // parse gives the fragment the same precedence as explicitly written JSX.
  edited = insertAt(source, wrappers);
  try {
    return restorePositions(parse(edited.code, options), source, edited, options);
  } catch (error) {
    throw restorePositions(error, source, edited, options);
  }
}
