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
      filename: 'CartItem.jsx', title: t.nestedTitle,
      source: `export default function CartItem() {
  let cart = [{ name: ${literal(t.coffee)}, quantity: 1 }];

  return (
    <div>
      <p>{cart[0].name}: {cart[0].quantity}${t.unit}</p>
      <button onClick={() => cart[0].quantity++}>
        ${t.addItem}
      </button>
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
    props: {
      filename: 'Order.jsx', title: t.propsTitle,
      source: `function Order({ price }) {
  let quantity = 1;

  return (
    <div>
      <p>${t.price}{price}${t.currency}</p>
      <button onClick={() => quantity++}>
        ${t.quantity}{quantity}${t.unit} (+)
      </button>
      <h3>${t.total}{price * quantity}${t.currency}</h3>
    </div>
  );
}

export default function App() {
  let price = 4000;

  return (
    <div>
      <button onClick={() => price = price === 4000 ? 3000 : 4000}>
        {price === 4000 ? ${literal(t.discount)} : ${literal(t.cancelDiscount)}}
      </button>
      <Order price={price} />
    </div>
  );
}`,
    },
  };
}
