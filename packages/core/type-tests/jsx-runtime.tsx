import { createElement, type Component } from 'aeui';
import { Fragment, jsx, jsxs } from 'aeui/jsx-runtime';
import { jsxDEV } from 'aeui/jsx-dev-runtime';

const Item: Component<{ name: string }> = ({ name }) => <span>{name}</span>;
const Empty = () => null;
const Text = () => 'text';
const view = <><Item key="item" name="valid" /><Empty /><Text /></>;
jsx(Item, { name: 'valid' }, 0);
jsx(Fragment, { children: view });
const fragment = <Fragment>{view}</Fragment>;
jsxs(Fragment, { children: [view, 0, null] });
jsxDEV('p', { children: 'text' }, undefined, false, { fileName: 'view.tsx', lineNumber: 1 });
createElement('p', { children: 'prop' });

// @ts-expect-error required component prop
const missing = <Item />;
// @ts-expect-error incorrect component prop
const incorrect = <Item name={42} />;
// @ts-expect-error invalid tag
jsx(42, {});
// @ts-expect-error incorrect component prop in a runtime call
jsx(Item, { name: 42 });
void [fragment, missing, incorrect];
