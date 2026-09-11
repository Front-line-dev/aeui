import MagicString from 'magic-string';
import { walk } from './swc-ast.js';

function insert(source, edits) {
  let code = '', cursor = 0;
  const ranges = [];
  for (const edit of [...edits].sort((a, b) => a.at - b.at)) {
    code += source.slice(cursor, edit.at);
    ranges.push({ start: code.length, end: code.length + edit.text.length, at: edit.at });
    code += edit.text; cursor = edit.at;
  }
  code += source.slice(cursor);
  return { code, ranges, originalOffset(offset) {
    const range = ranges.findLast(item => item.start <= offset);
    return range ? range.at + Math.max(0, offset - range.end) : offset;
  } };
}

function byteOffsets(source) {
  const offsets = [0];
  let chars = 0;
  for (const char of source) {
    const bytes = Buffer.byteLength(char);
    for (let i = 0; i < bytes; i++) offsets.push(chars);
    chars += char.length;
    offsets[offsets.length - 1] = chars;
  }
  return byte => offsets[Math.max(0, byte - 1)];
}

export default function parseFragments(source, parse, filename) {
  let originalError;
  try { return { program: parse(source), map: null }; }
  catch (error) { originalError = error; }
  // Only a failed parse is probed. Candidates in strings, comments, or ordinary
  // JSX children are discarded unless SWC parses the inserted '+' as an operator.
  const candidates = [...source.matchAll(/>(?:\s|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*(?:\r?\n|$))*</g)]
    .map(match => ({ at: match.index + match[0].length - 1, text: '+' }));
  if (!candidates.length) throw originalError;
  const probe = insert(source, candidates);
  let program;
  try { program = parse(probe.code); } catch { throw originalError; }
  const charOffset = byteOffsets(probe.code);
  const position = byte => probe.originalOffset(charOffset(byte));
  const elements = [], operators = new Set();
  walk(program, node => {
    if (['JSXElement', 'JSXFragment'].includes(node.type)) elements.push(node);
    if (node.type === 'BinaryExpression' && node.operator === '+') {
      const left = charOffset(node.left.span.end), right = charOffset(node.right.span.start);
      for (const range of probe.ranges) if (range.start >= left && range.end <= right) operators.add(range.at);
    }
  });
  const starts = new Set(), ends = new Set(), edits = [];
  for (const at of operators) {
    const left = elements.filter(node => position(node.span.end) <= at).sort((a, b) => b.span.end - a.span.end)[0];
    const right = elements.find(node => position(node.span.start) === at);
    if (!left || !right) throw originalError;
    starts.add(left); ends.add(right); edits.push({ at, text: '}{' });
  }
  if (!edits.length) throw originalError;
  for (const node of starts) if (!ends.has(node)) edits.push({ at: position(node.span.start), text: '<>{' });
  for (const node of ends) if (!starts.has(node)) edits.push({ at: position(node.span.end), text: '}</>' });
  const result = new MagicString(source);
  for (const { at, text } of edits.sort((a, b) => a.at - b.at)) result.appendLeft(at, text);
  try { program = parse(result.toString()); } catch { throw originalError; }
  return { program, map: result.generateMap({ source: filename, includeContent: true, hires: true }) };
}
