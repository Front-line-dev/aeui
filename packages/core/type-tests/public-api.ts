import aeuiTransform from 'aeui/babel-plugin';
import aeui from 'aeui/vite';
import {
  AEUI,
  clean,
  watch,
  type Component,
  type Renderable,
  type VNode,
} from 'aeui';

const root = document.createElement('div');

const Counter: Component<{ title: string }> = ({ title }) => {
  let count = 0;

  watch(() => {
    console.log(title, count);
  }, [title, count]);

  clean(() => {
    count = 0;
  });

  return AEUI.createElement(
    'button',
    { onClick: () => { count += 1; } },
    title,
    count
  );
};

const vnode: VNode = AEUI.createVNode('section', { id: 'sample' }, 'hello');
const renderable: Renderable = [
  vnode,
  AEUI.createElement(AEUI.Fragment, null, 'fragment child'),
];

AEUI.init(() => AEUI.createElement(Counter, { title: 'Type smoke' }, renderable), root);

const didRender: boolean = AEUI.render();

console.log(didRender);
console.log(typeof aeuiTransform({ types: {} }));
console.log(typeof aeui());
console.log(typeof aeui({ alias: false }));
console.log(typeof aeui({ alias: '~', aliasDir: 'src' }));
