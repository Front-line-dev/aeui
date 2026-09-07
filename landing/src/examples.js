export const examples = {
  counter: {
    filename: 'Counter.jsx', title: 'let 상태 예제',
    source: `export default function Counter() {
  let count = 0;

  return (
    <div>
      <p>클릭 횟수</p>
      <h2>{count}</h2>
      <button onClick={() => count++}>
        + 1 더하기
      </button>
    </div>
  );
}`,
  },
  nested: {
    filename: 'CartItem.jsx', title: '배열 안 객체의 값 변경',
    source: `export default function CartItem() {
  let cart = [{ name: '커피', quantity: 1 }];

  return (
    <div>
      <p>{cart[0].name}: {cart[0].quantity}개</p>
      <button onClick={() => cart[0].quantity++}>
        한 개 추가
      </button>
    </div>
  );
}`,
  },
  watch: {
    filename: 'Theme.jsx', title: 'watch로 테마 변경',
    source: `import { watch } from 'aeui';

export default function Theme() {
  let dark = false;

  watch(() => {
    document.body.classList.toggle('dark', dark);
  }, [dark]);

  return (
    <button onClick={() => dark = !dark}>
      {dark ? '밝은 화면으로' : '어두운 화면으로'}
    </button>
  );
}`,
  },
  props: {
    filename: 'Order.jsx', title: '한 컴포넌트에서 props와 let 사용',
    source: `function Order({ price }) {
  let quantity = 1;

  return (
    <div>
      <p>커피 한 개: {price}원</p>
      <button onClick={() => quantity++}>
        수량: {quantity}개 (+)
      </button>
      <h3>합계: {price * quantity}원</h3>
    </div>
  );
}

export default function App() {
  let price = 4000;

  return (
    <div>
      <button onClick={() => price = price === 4000 ? 3000 : 4000}>
        {price === 4000 ? '할인 적용' : '할인 취소'}
      </button>
      <Order price={price} />
    </div>
  );
}`,
  },
};
