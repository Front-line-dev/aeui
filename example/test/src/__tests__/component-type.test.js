import { afterEach, describe, expect, it, vi } from 'vitest';
import { transformSync } from '@babel/core';
import { AEUI } from 'aeui';
import aeuiPlugin from '../../../../packages/core/src/babel-plugin.js';
import { resetRuntimeState } from '../../../../packages/core/src/runtime-state.js';

function compile(source) {
  return transformSync(source, {
    filename: 'component-type.jsx', configFile: false, babelrc: false,
    plugins: [aeuiPlugin, ['@babel/plugin-transform-react-jsx', {
      pragma: 'AEUI.createElement', pragmaFrag: 'AEUI.Fragment',
    }]],
  }).code;
}

function execute(source, values = {}, passes = 1) {
  let code = source;
  for (let i = 0; i < passes; i++) code = compile(code);
  // These isolated snippets only import the runtime automatically.
  code = code.replace(/import \{ AEUI \} from ["']aeui["'];?/g, '');
  return new Function('AEUI', ...Object.keys(values), code)(AEUI, ...Object.values(values));
}

const mount = (source, values = {}, passes = 1) => {
  const container = document.createElement('div');
  execute(source, { container, ...values }, passes);
  AEUI.__runtime.stopScheduler();
  return container;
};

afterEach(() => {
  const runtime = AEUI.__runtime;
  runtime.stopScheduler();
  for (const child of runtime.state.rootNode?.children || []) runtime.unmountNode(child);
  resetRuntimeState(runtime.state);
});

describe('function-value component types', () => {
  it('const aliases retain state and ordinary JSX helper calls return VNodes', () => {
    const setups = [];
    const results = [];
    const container = mount(`
      function badge({ text }) {
        setups.push(text);
        let count = 0;
        return <button onClick={() => count++}>{text}:{count}</button>;
      }
      const Alias = badge;
      results.push(badge({ text: 'helper' }));
      function App() { return <Alias text="component" />; }
      AEUI.init(App, container);
    `, { setups, results });
    expect(results[0].tag).toBe('button');
    expect(container.textContent).toBe('component:0');
    container.querySelector('button').click();
    AEUI.render();
    expect(container.textContent).toBe('component:1');
    expect(setups).toEqual(['helper', 'component']);
  });

  it.each(['View', 'Views.Current'])('destructured props tag %s reads the current type and cleans replaced instances', (tag) => {
    const events = [];
    const container = mount(`
      const first = () => {
        AEUI.__runtime.clean(() => events.push('clean A'));
        events.push('setup A');
        let count = 0;
        return <button onClick={() => count++}>A:{count}</button>;
      };
      const second = () => { events.push('setup B'); return <b>B</b>; };
      const registry = { first, second };
      function Slot({ View, Views }) { return <${tag} />; }
      function App() {
        let Selected = registry.first;
        return <div><Slot View={Selected} Views={{ Current: Selected }} />
          <a onClick={() => Selected = registry.second}>switch</a></div>;
      }
      AEUI.init(App, container);
    `, { events });
    expect(container.querySelector('button').textContent).toBe('A:0');
    container.querySelector('button').click();
    AEUI.render();
    expect(container.querySelector('button').textContent).toBe('A:1');
    container.querySelector('a').click();
    AEUI.render();
    expect(container.querySelector('b').textContent).toBe('B');
    expect(events).toEqual(['setup A', 'clean A', 'setup B']);
  });

  it('same function used directly as a tag and as a helper retains ordinary call semantics', () => {
    const results = [];
    const container = mount(`
      function Label({ text }) { return <span>{text}</span>; }
      results.push(Label({ text: 'plain' }));
      AEUI.init(() => <Label text="mounted" />, container);
    `, { results });
    expect(results[0].tag).toBe('span');
    expect(container.textContent).toBe('mounted');
  });

  it('forward declarations and a second compilation keep registration and identity', () => {
    const container = mount(`
      AEUI.init(App, container);
      function App() { return <Panel />; }
      const unused = 1;
      function Panel() { return <span>hoisted</span>; }
    `, {}, 2);
    expect(container.textContent).toBe('hoisted');
  });

  it('null, text and children return expressions render through aliases', () => {
    const container = mount(`
      const empty = () => null;
      const text = () => 'text';
      const pass = props => props.children;
      const Empty = empty, Text = text, Pass = pass;
      function App() { return <><Empty /><Text /><Pass><b>child</b></Pass></>; }
      AEUI.init(App, container);
    `);
    expect(container.textContent).toBe('textchild');
  });

  it.each([null, 42, {}, { tag: 'span', props: {}, children: [] }])('rejects invalid element types: %j', (invalid) => {
    expect(() => AEUI.createElement(invalid)).toThrow(/\[AEUI\].*type/i);
  });

  it('rejects uncompiled VNode returns and runs setup cleanup once', () => {
    const cleanup = vi.fn();
    const Uncompiled = new Function('AEUI', 'cleanup', `return function () {
      AEUI.__runtime.clean(cleanup);
      return AEUI.createElement('span');
    };`)(AEUI, cleanup);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    AEUI.init(Uncompiled, document.createElement('div'));
    expect(error).toHaveBeenCalledWith('[AEUI] Render error:', expect.objectContaining({
      message: expect.stringMatching(/setup.*render function/i),
    }));
    error.mockRestore();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

import ImportedApp from './fixtures/component-types/app.jsx';
import { events as importEvents, reset as resetImports } from './fixtures/component-types/barrel.js';

describe('module and lexical component boundaries', () => {
  it('Vite compiles real default/named/namespace/re-exports and live bindings', () => {
    resetImports();
    const container = document.createElement('div');
    AEUI.init(ImportedApp, container);
    expect(container.querySelector('#default').textContent).toBe('first:0');
    expect(container.querySelector('#live').textContent).toBe('first:0');
    expect(container.querySelector('#namespace').textContent).toBe('second');
    container.querySelector('#default button').click();
    AEUI.render();
    container.querySelector('a').click();
    AEUI.render();
    expect(container.querySelector('#default').textContent).toBe('first:1');
    expect(container.querySelector('#live').textContent).toBe('second');
    expect(importEvents).toEqual(['setup first', 'setup first', 'clean first']);
  });

  it('nested factories keep distinct closures, inferred names and frozen function identity', () => {
    const results = [];
    const container = mount(`
      function make(text) {
        const view = () => <span>{text}</span>;
        results.push(view.name);
        return Object.freeze(view);
      }
      const A = make('A'), B = make('B');
      results.push(A === B, A === Object.freeze(A));
      function App() { return <><A /><B /></>; }
      AEUI.init(App, container);
    `, { results }, 2);
    expect(container.textContent).toBe('AB');
    expect(results).toEqual(['view', 'view', false, true]);
  });

  it('a named function expression recurses through its ordinary callable', () => {
    const results = [];
    const container = mount(`
      const View = function inner({ n }) {
        if (n > 0) return <div>{inner({ n: n - 1 })}</div>;
        return <span>end</span>;
      };
      results.push(View.name, View({ n: 1 }));
      AEUI.init(() => <View n={2} />, container);
    `, { results }, 2);
    expect(results[0]).toBe('inner');
    expect(results[1].children[0].tag).toBe('span');
    expect(container.textContent).toBe('end');
    expect(container.querySelectorAll('div')).toHaveLength(2);
  });

  it('ordinary calls preserve this, arguments, defaults and arrow lexical captures', () => {
    const results = [];
    mount(`
      function helper(props = { text: 'default' }) {
        return <span>{this.label}:{props.text}:{arguments.length}</span>;
      }
      function outer() {
        const arrow = () => <b>{this.label}:{arguments[0]}</b>;
        return arrow;
      }
      results.push(helper.call({ label: 'this' }));
      const View = outer.call({ label: 'lexical' }, 'arg');
      results.push(View());
      AEUI.init(View, container);
    `, { results });
    expect(results[0].children.join('')).toBe('this:default:0');
    expect(results[1].children.join('')).toBe('lexical:arg');
  });

  it('mutable aliases and shadowed bindings use the actual value on every render', () => {
    const container = mount(`
      const view = () => <i>A</i>;
      const other = () => <b>B</b>;
      let Alias;
      Alias = view;
      function Outer() {
        const view = () => <small>inner</small>;
        const Local = view;
        return <Local />;
      }
      function App() {
        return <div><Alias /><Outer /><a onClick={() => Alias = other}>switch</a></div>;
      }
      AEUI.init(App, container);
    `);
    expect(container.querySelector('i').textContent).toBe('A');
    expect(container.querySelector('small').textContent).toBe('inner');
    container.querySelector('a').click();
    AEUI.render();
    expect(container.querySelector('b').textContent).toBe('B');
    expect(container.querySelector('small').textContent).toBe('inner');
  });

  it('host string aliases and callback props keep their own behavior', () => {
    const callback = vi.fn();
    const container = mount(`
      const Host = 'section';
      function App() { return <Host><button onClick={callback}>click</button></Host>; }
      AEUI.init(App, container);
    `, { callback });
    expect(callback).not.toHaveBeenCalled();
    expect(container.firstChild.tagName).toBe('SECTION');
    container.querySelector('button').click();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('manual setup/render functions still run without compiler registration', () => {
    const setups = vi.fn();
    const Manual = new Function('AEUI', 'setups', `return function () {
      setups(); let count = 0;
      return () => AEUI.createElement('button', { onClick: () => count++ }, count);
    };`)(AEUI, setups);
    const container = document.createElement('div');
    AEUI.init(Manual, container);
    container.querySelector('button').click();
    AEUI.render();
    expect(container.textContent).toBe('1');
    expect(setups).toHaveBeenCalledTimes(1);
  });

  it.each(['async function View()', 'function* View()'])('rejects %s as a component before running its body', (declaration) => {
    const body = vi.fn();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    mount(`
      ${declaration} { body(); return <span />; }
      AEUI.init(View, container);
    `, { body });
    expect(body).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('[AEUI] Render error:', expect.objectContaining({
      message: expect.stringContaining('must be synchronous'),
    }));
    error.mockRestore();
  });

  it('failed first render cleans successful siblings and setup resources exactly once', () => {
    const cleanup = vi.fn();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = mount(`
      function Good() { AEUI.__runtime.clean(cleanup); return <span>temporary</span>; }
      function Bad() { AEUI.__runtime.clean(cleanup); throw new Error('failed'); }
      function App() { AEUI.__runtime.clean(cleanup); return <><Good /><Bad /></>; }
      AEUI.init(App, container);
    `, { cleanup });
    expect(container.childNodes).toHaveLength(0);
    expect(cleanup).toHaveBeenCalledTimes(3);
    expect(error).toHaveBeenCalledWith('[AEUI] Render error:', expect.objectContaining({ message: 'failed' }));
    error.mockRestore();
  });

  it('cleanup can request another unmount without recursively running itself', () => {
    const cleanup = vi.fn();
    const container = mount(`
      function App() {
        const node = AEUI.__runtime.state.currentComponentNode;
        AEUI.__runtime.clean(() => { cleanup(); AEUI.__runtime.unmountNode(node); });
        return <span>mounted</span>;
      }
      AEUI.init(App, container);
    `, { cleanup });
    AEUI.__runtime.unmountNode(AEUI.__runtime.state.rootNode.children[0]);
    expect(container.childNodes).toHaveLength(0);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe('returned component functions', () => {
  it('a factory can return an inline component and manual render functions retain their contract', () => {
    const container = mount(`
      function make(text) { return () => <span>{text}</span>; }
      const A = make('A');
      function Manual({ text }) { return ({ suffix }) => <b>{text}:{suffix}</b>; }
      function App() { return <><A /><Manual text="manual" suffix="render" /></>; }
      AEUI.init(App, container);
    `, {}, 2);
    expect(container.textContent).toBe('Amanual:render');
  });
});

import { empty, text, children } from './fixtures/component-types/plain.js';

describe('non-JSX returns', () => {
  it('exported null, text and children components can be imported from a JSX-free module', () => {
    const container = mount(`
      function Slot({ View }) { return <View><b>child</b></View>; }
      function App() { return <><Empty /><Text /><Slot View={Children} /></>; }
      AEUI.init(App, container);
    `, { Empty: empty, Text: text, Children: children });
    expect(container.textContent).toBe('plainchild');
  });

  it('a local children-only function passed through props receives fresh children', () => {
    const container = mount(`
      const pass = ({ children }) => children;
      function Slot({ View, text }) { return <View>{text}</View>; }
      function App() {
        let text = 'before';
        return <div><Slot View={pass} text={text} /><a onClick={() => text = 'after'}>switch</a></div>;
      }
      AEUI.init(App, container);
    `);
    expect(container.textContent).toBe('beforeswitch');
    container.querySelector('a').click();
    AEUI.render();
    expect(container.textContent).toBe('afterswitch');
  });

  it('named manual render functions and implicit empty returns remain usable', () => {
    const container = mount(`
      function Empty() {}
      function Manual(props) {
        const render = ({ suffix }) => <span>{props.text}:{suffix}</span>;
        return render;
      }
      function App() {
        let text = 'before';
        return <div><Empty /><Manual text={text} suffix="ok" />
          <a onClick={() => text = 'after'}>switch</a></div>;
      }
      AEUI.init(App, container);
    `);
    expect(container.querySelector('span').textContent).toBe('before:ok');
    container.querySelector('a').click();
    AEUI.render();
    expect(container.querySelector('span').textContent).toBe('after:ok');
  });

  it('a rejected Promise from uncompiled setup is diagnosed without an unhandled rejection', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Uncompiled = new Function('return async () => { throw new Error("async failure"); };')();
    AEUI.init(Uncompiled, document.createElement('div'));
    AEUI.__runtime.stopScheduler();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(error).toHaveBeenCalledWith('[AEUI] Render error:', expect.objectContaining({
      message: expect.stringMatching(/setup.*render function/i),
    }));
    error.mockRestore();
  });
});

describe('registration and replacement guarantees', () => {
  it('registration accepts frozen functions without property access or execution', () => {
    const body = vi.fn();
    const property = vi.fn(() => { throw new Error('property must not be read'); });
    const type = new Proxy(Object.freeze(function Original() { body(); }), { get: property });
    const setup = () => () => AEUI.createElement('span', null, 'registered');
    const register = AEUI.__runtime.registerComponent;
    expect(register(type, setup)).toBe(type);
    expect(register(type, setup)).toBe(type);
    expect(() => register(type, () => () => null)).toThrow(/Conflicting component/);
    expect(property).not.toHaveBeenCalled();
    expect(body).not.toHaveBeenCalled();
    const container = document.createElement('div');
    AEUI.init(type, container);
    expect(container.textContent).toBe('registered');
    expect(property).not.toHaveBeenCalled();
    expect(body).not.toHaveBeenCalled();
  });

  it('invalid replacement preserves the current view and its local state', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const container = mount(`
      const good = () => {
        let count = 0;
        return <button onClick={() => count++}>{count}</button>;
      };
      let View = good;
      function App() { return <div><View /><a onClick={() => View = {}}>invalid</a></div>; }
      AEUI.init(App, container);
    `);
    container.querySelector('button').click();
    AEUI.render();
    container.querySelector('a').click();
    AEUI.render();
    expect(container.querySelector('button').textContent).toBe('1');
    expect(error).toHaveBeenCalledWith('[AEUI] Render error:', expect.objectContaining({
      message: expect.stringContaining('Invalid element type'),
    }));
    error.mockRestore();
  });

  it('repeated type replacement balances setup and cleanup and resets only changed types', () => {
    const events = [];
    const container = mount(`
      function make(label) {
        return () => {
          events.push('setup ' + label);
          AEUI.__runtime.clean(() => events.push('clean ' + label));
          let count = 0;
          return <button onClick={() => count++}>{label}:{count}</button>;
        };
      }
      const a = make('A'), b = make('B');
      function Slot({ View }) { return <View key="stable" />; }
      function App() {
        let View = a;
        return <div><Slot View={View} /><a onClick={() => View = View === a ? b : a}>switch</a></div>;
      }
      AEUI.init(App, container);
    `, { events });
    for (let i = 0; i < 50; i++) {
      const label = i % 2 ? 'B' : 'A';
      expect(container.querySelector('button').textContent).toBe(`${label}:0`);
      container.querySelector('button').click();
      AEUI.render();
      AEUI.render();
      expect(container.querySelector('button').textContent).toBe(`${label}:1`);
      container.querySelector('a').click();
      AEUI.render();
    }
    AEUI.__runtime.unmountNode(AEUI.__runtime.state.rootNode.children[0]);
    expect(events.filter(event => event.startsWith('setup'))).toHaveLength(51);
    expect(events.filter(event => event.startsWith('clean'))).toHaveLength(51);
    expect(container.childNodes).toHaveLength(0);
  });
});

import aeuiVite from '../../../../packages/core/src/vite-plugin.js';

describe('Vite transform boundary', () => {
  it('does not register exported functions from bundler virtual runtime modules', async () => {
    const plugin = aeuiVite();
    expect(await plugin.transform('export const copy = value => value;', '\0rolldown/runtime.js')).toBeNull();
    expect(await plugin.transform('export const copy = value => value;', '/node_modules/library/index.js')).toBeNull();
    expect((await plugin.transform('export const text = () => "app";', '/src/view.js')).code)
      .toContain('registerComponent');
  });
});
