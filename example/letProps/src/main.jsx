import { AEUI } from 'aeui';

const Child = ({ count, onIncrement }) => {
  return (
    <div style="border: 1px solid #ccc; padding: 10px; margin: 10px;">
      <h3>Child Component</h3>
      <p>Received Count: <strong>{count}</strong></p>
      <button onClick={onIncrement}>Increment Parent's Let Variable</button>
    </div>
  );
};

const Parent = () => {
  // Variable created via let
  let count = 0;

  const increment = () => {
    count++;
    console.log("Parent count incremented to:", count);
  };

  return (
    <div style="padding: 20px;">
      <h1>Parent Component</h1>
      <p>Local Count: {count}</p>
      <Child count={count} onIncrement={increment} />
      <p style="font-size: 0.8em; color: #666;">
        Note: DOM 이벤트 변경은 다음 프레임에 바로 반영되고, 비동기 변경은 polling fallback으로 반영됩니다.
      </p>
    </div>
  );
};

const App = () => {
  return <Parent />;
};

const root = document.getElementById("root");
AEUI.init(App, root);
