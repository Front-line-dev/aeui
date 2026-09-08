import { getMessages } from './i18n.js';

export function getExamples(locale = 'en') {
  const t = getMessages(locale).demo;
  // Quote translated JavaScript strings instead of interpolating into literals.
  const literal = value => JSON.stringify(value);
  return {
    counter: {
      filename: 'Counter.jsx', title: t.counterTitle,
      source: `export default function Counter() {
  let count = 0;

  return (
    <div>
      <p>${t.clicks}</p>
      <h2>{count}</h2>
      <button onClick={() => count++}>
        ${t.add}
      </button>
    </div>
  );
}`,
    },
    nested: {
      filename: 'Cart.jsx', title: t.nestedTitle,
      source: `export default function Cart() {
  let cart = [
    { name: ${literal(t.coffee)}, quantity: 1 },
    { name: ${literal(t.bread)}, quantity: 1 },
  ];

  return (
    <div>
      {cart.map(item => (
        <div key={item.name}>
          <p>{item.name}: {item.quantity}${t.unit}</p>
          <button onClick={() => item.quantity++}>${t.addItem}</button>
        </div>
      ))}
    </div>
  );
}`,
    },
    watch: {
      filename: 'Theme.jsx', title: t.watchTitle,
      source: `import { watch } from 'aeui';

export default function Theme() {
  let dark = false;

  watch(() => {
    document.body.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <button onClick={() => dark = !dark}>
      {dark ? ${literal(t.light)} : ${literal(t.dark)}}
    </button>
  );
}`,
    },
  };
}
