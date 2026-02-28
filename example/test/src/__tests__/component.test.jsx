import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AEUI, watch, clean } from 'aeui';

/**
 * 실제 AEUI 컴포넌트를 작성하고 DOM에 마운트하여 동작을 검증하는 통합 테스트.
 * Babel 플러그인이 JSX를 변환하고, _tick() 호출로 상태 변화를 반영합니다.
 */

let container;

beforeEach(() => {
  container = document.createElement('div');
  container.id = 'root';
  document.body.appendChild(container);
});

afterEach(() => {
  AEUI._stopScheduler();
  AEUI._rafId = null;
  AEUI._frameDelay = 1;
  AEUI._framesUntilNextTick = 0;
  AEUI._rootInstance = null;
  AEUI._previousVNode = null;
  AEUI._RootComponent = null;
  AEUI._containerElement = null;
  AEUI._isRendering = false;
  container.remove();
});

// ─── 기본 컴포넌트 마운트 ───

function SimpleApp() {
  return (
    <div>
      <h1>Hello AEUI</h1>
      <p>This works!</p>
    </div>
  );
}

describe('컴포넌트 마운트', () => {
  it('기본 컴포넌트가 올바르게 DOM에 렌더됨', () => {
    AEUI.init(SimpleApp, container);

    expect(container.querySelector('h1').textContent).toBe('Hello AEUI');
    expect(container.querySelector('p').textContent).toBe('This works!');
  });
});

// ─── 상태 변경 (let 변수) ───

function CounterApp() {
  let count = 0;

  return (
    <div>
      <span id="count">{count}</span>
      <button id="btn" onClick={() => count++}>+</button>
    </div>
  );
}

describe('상태 변경 (let 변수)', () => {
  it('버튼 클릭 후 tick을 돌리면 카운트가 업데이트됨', () => {
    AEUI.init(CounterApp, container);

    expect(container.querySelector('#count').textContent).toBe('0');

    // 클릭
    container.querySelector('#btn').click();

    // 아직 tick 전이므로 DOM은 변하지 않음
    expect(container.querySelector('#count').textContent).toBe('0');

    // tick 강제 실행
    AEUI._tick();

    expect(container.querySelector('#count').textContent).toBe('1');
  });

  it('여러 번 클릭 후 한 번의 tick으로 반영', () => {
    AEUI.init(CounterApp, container);

    container.querySelector('#btn').click();
    container.querySelector('#btn').click();
    container.querySelector('#btn').click();

    AEUI._tick();

    expect(container.querySelector('#count').textContent).toBe('3');
  });
});

// ─── Props 전달 ───

function Display({ message }) {
  return <p id="msg">{message}</p>;
}

function PropsApp() {
  let text = 'initial';

  return (
    <div>
      <Display message={text} />
      <button id="change" onClick={() => { text = 'updated'; }}>change</button>
    </div>
  );
}

describe('Props 전달', () => {
  it('부모 상태 변경 시 자식 props가 업데이트됨', () => {
    AEUI.init(PropsApp, container);

    expect(container.querySelector('#msg').textContent).toBe('initial');

    container.querySelector('#change').click();
    AEUI._tick();

    expect(container.querySelector('#msg').textContent).toBe('updated');
  });
});

// ─── watch 훅 ───

let watchLog = [];

// watch는 props 기반 deps를 감지하는 데 설계됨
function WatchChild({ value }) {
  watch(() => {
    watchLog.push(value);
  }, [value]);

  return <span id="watch-value">{value}</span>;
}

function WatchApp() {
  let val = 10;

  return (
    <div>
      <WatchChild value={val} />
      <button id="watch-btn" onClick={() => { val = 20; }}>change</button>
    </div>
  );
}

describe('watch 훅', () => {
  beforeEach(() => {
    watchLog = [];
  });

  it('props 변경 시 watch callback이 실행됨', () => {
    AEUI.init(WatchApp, container);

    // 마운트 시에는 watch 미실행 (초기값이 oldDeps에 저장됨)
    expect(watchLog).toEqual([]);

    container.querySelector('#watch-btn').click();
    AEUI._tick();

    // props value가 10→20으로 변경되어 watch callback 실행
    expect(watchLog).toEqual([20]);
  });

  it('props가 변하지 않으면 watch callback 미실행', () => {
    AEUI.init(WatchApp, container);
    AEUI._tick();
    expect(watchLog).toEqual([]);
  });

  it('local let 변수 변경도 watch deps getter가 감지함', () => {
    function LocalWatch() {
      let count = 0;
      watch(() => { watchLog.push(count); }, [count]);
      return (
        <div>
          <span id="lcount">{count}</span>
          <button id="lbtn" onClick={() => count++}>+</button>
        </div>
      );
    }

    AEUI.init(LocalWatch, container);
    expect(watchLog).toEqual([]);

    container.querySelector('#lbtn').click();
    AEUI._tick();

    expect(watchLog).toEqual([1]);
    expect(container.querySelector('#lcount').textContent).toBe('1');
  });
});

// ─── clean 훅 ───

const cleanupCalls = [];

function CleanableApp() {
  clean(() => {
    cleanupCalls.push('cleaned');
  });

  return <p>hello</p>;
}

function OtherApp() {
  return <p>other</p>;
}

describe('clean 훅', () => {
  beforeEach(() => {
    cleanupCalls.length = 0;
  });

  it('다른 루트 컴포넌트로 교체 시 clean callback 실행', () => {
    AEUI.init(CleanableApp, container);
    expect(container.textContent).toContain('hello');
    expect(cleanupCalls).toEqual([]);

    // 새로운 루트 컴포넌트로 교체 → 이전 인스턴스 unmount
    AEUI.init(OtherApp, container);

    expect(cleanupCalls).toEqual(['cleaned']);
    expect(container.textContent).toContain('other');
  });
});

// ─── 조건부 렌더링 ───

function ConditionalApp() {
  let loggedIn = false;

  return (
    <div>
      {loggedIn
        ? <p id="greeting">Welcome!</p>
        : <button id="login" onClick={() => { loggedIn = true; }}>Login</button>
      }
    </div>
  );
}

describe('조건부 렌더링', () => {
  it('상태에 따라 다른 요소가 렌더됨', () => {
    AEUI.init(ConditionalApp, container);

    expect(container.querySelector('#login')).not.toBeNull();
    expect(container.querySelector('#greeting')).toBeNull();

    container.querySelector('#login').click();
    AEUI._tick();

    expect(container.querySelector('#login')).toBeNull();
    expect(container.querySelector('#greeting')).not.toBeNull();
    expect(container.querySelector('#greeting').textContent).toBe('Welcome!');
  });
});

// ─── 리스트 렌더링 ───

function ListApp() {
  let items = ['A', 'B', 'C'];

  return (
    <div>
      <ul id="list">
        {items.map(item => <li>{item}</li>)}
      </ul>
      <button id="add" onClick={() => { items.push('D'); }}>add</button>
      <button id="remove" onClick={() => { items.pop(); }}>remove</button>
    </div>
  );
}

describe('리스트 렌더링', () => {
  it('배열 상태가 DOM에 올바르게 렌더됨', () => {
    AEUI.init(ListApp, container);

    const lis = container.querySelectorAll('#list li');
    expect(lis.length).toBe(3);
    expect(lis[0].textContent).toBe('A');
    expect(lis[2].textContent).toBe('C');
  });

  it('아이템 추가 시 DOM에 반영', () => {
    AEUI.init(ListApp, container);

    container.querySelector('#add').click();
    AEUI._tick();

    expect(container.querySelectorAll('#list li').length).toBe(4);
  });

  it('아이템 제거 시 DOM에서 삭제', () => {
    AEUI.init(ListApp, container);

    container.querySelector('#remove').click();
    AEUI._tick();

    const lis = container.querySelectorAll('#list li');
    expect(lis.length).toBe(2);
    expect(lis[0].textContent).toBe('A');
    expect(lis[1].textContent).toBe('B');
  });
});

// ─── Fragment ───

// Fragment는 babel 플러그인이 PascalCase 함수를 컴포넌트로 변환하므로,
// JSX <></> 구문 대신 createVNode으로 직접 테스트
describe('Fragment', () => {
  it('Fragment children이 부모 DOM에 직접 렌더됨', () => {
    // Fragment를 사용하는 컴포넌트를 createVNode으로 구성
    function FragmentUser() {
      return (
        <div id="frag-wrap">
          {AEUI.createVNode(AEUI.Fragment, null,
            AEUI.createVNode('p', { id: 'frag1' }, 'First'),
            AEUI.createVNode('p', { id: 'frag2' }, 'Second')
          )}
        </div>
      );
    }

    AEUI.init(FragmentUser, container);

    expect(container.querySelector('#frag1').textContent).toBe('First');
    expect(container.querySelector('#frag2').textContent).toBe('Second');
  });
});

// ─── 여러 컴포넌트 상태 독립성 ───

function IndependentCounter({ label }) {
  let count = 0;

  return (
    <div>
      <span className={`count-${label}`}>{count}</span>
      <button className={`btn-${label}`} onClick={() => count++}>+</button>
    </div>
  );
}

function MultiCounterApp() {
  return (
    <div>
      <IndependentCounter label="a" />
      <IndependentCounter label="b" />
    </div>
  );
}

describe('여러 컴포넌트 상태 독립성', () => {
  it('각 인스턴스의 상태가 독립적으로 유지됨', () => {
    AEUI.init(MultiCounterApp, container);

    // A 카운터만 3번 클릭
    container.querySelector('.btn-a').click();
    container.querySelector('.btn-a').click();
    container.querySelector('.btn-a').click();
    AEUI._tick();

    expect(container.querySelector('.count-a').textContent).toBe('3');
    expect(container.querySelector('.count-b').textContent).toBe('0'); // B는 안 바뀜
  });
});
