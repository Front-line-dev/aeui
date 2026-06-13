import { AEUI } from 'aeui';

export default function ProductPage({ route }) {
  return (
    <main>
      <h1>Product {route.params.id}</h1>
      <p>동적 세그먼트는 route.params로 전달됩니다.</p>
      <a href="/">Home</a>
    </main>
  );
}
