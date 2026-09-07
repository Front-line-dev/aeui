import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

export const editorHighlighting = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.keyword, class: 'cmt-keyword' },
  { tag: [tags.string, tags.regexp], class: 'cmt-string' },
  { tag: [tags.number, tags.bool, tags.null], class: 'cmt-number' },
  { tag: tags.function(tags.variableName), class: 'cmt-function' },
  { tag: tags.tagName, class: 'cmt-tagName' },
  { tag: [tags.propertyName, tags.attributeName], class: 'cmt-propertyName' },
  { tag: tags.operator, class: 'cmt-operator' },
  { tag: tags.comment, class: 'cmt-comment' },
]));
