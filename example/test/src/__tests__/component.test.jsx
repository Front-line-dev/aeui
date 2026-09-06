import { Layout, Home, Product, NotFound } from '../fixtures/router-pages.jsx';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AEUI, watch, clean } from 'aeui';
import { watch as observe, clean as dispose } from 'aeui';
import { resetRuntimeState } from '../../../../packages/core/src/runtime-state.js';

/**
 * 실제 AEUI 컴포넌트를 작성하고 DOM에 마운트하여 동작을 검증하는 통합 테스트.
 * Babel 플러그인이 JSX를 변환하고, public render() 또는 DOM 이벤트 fast path로 상태 변화를 반영한다.
 */

const runtime = AEUI.__runtime;
let container;

beforeEach(() => {
  container = document.createElement('div');
  container.id = 'root';
  document.body.appendChild(container);
});

afterEach(() => {
  runtime.stopScheduler();
  for (const child of runtime.state.rootNode?.children || []) runtime.unmountNode(child);
  resetRuntimeState(runtime.state);
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

describe('lifecycle characterization', () => {
  it('component setup runs once across repeated ticks', () => {
    const calls = [];

    function App() {
      calls.push('setup');
      let count = 0;

      return (
        <button id="setup-once-btn" onClick={() => { count += 1; }}>
          {count}
        </button>
      );
    }

    AEUI.init(App, container);
    container.querySelector('#setup-once-btn').click();
    AEUI.render();
    AEUI.render();

    expect(calls).toEqual(['setup']);
  });

  it('cleanup runs once when a keyed component is replaced', () => {
    const cleanups = [];

    function Child({ id }) {
      clean(() => { cleanups.push(id); });
      return <span id={`child-${id}`}>{id}</span>;
    }

    function App() {
      let id = 'a';

      return (
        <div>
          <Child key={id} id={id} />
          <button id="swap-child" onClick={() => { id = 'b'; }}>swap</button>
        </div>
      );
    }

    AEUI.init(App, container);
    container.querySelector('#swap-child').click();
    AEUI.render();

    expect(cleanups).toEqual(['a']);
    expect(container.querySelector('#child-b').textContent).toBe('b');
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
    AEUI.render();

    expect(container.querySelector('#count').textContent).toBe('1');
  });

  it('여러 번 클릭 후 한 번의 tick으로 반영', () => {
    AEUI.init(CounterApp, container);

    container.querySelector('#btn').click();
    container.querySelector('#btn').click();
    container.querySelector('#btn').click();

    AEUI.render();

    expect(container.querySelector('#count').textContent).toBe('3');
  });
});

describe('DOM 이벤트 자동 렌더', () => {
  it('오래 유휴 상태여도 클릭 이벤트는 다음 프레임에 자동 반영', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(() => callback(0), 16));
    vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id));

    try {
      function AutoRenderApp() {
        let count = 0;

        return (
          <div>
            <span id="auto-count">{count}</span>
            <button id="auto-btn" onClick={() => { count += 1; }}>+</button>
          </div>
        );
      }

      AEUI.init(AutoRenderApp, container);
      expect(container.querySelector('#auto-count').textContent).toBe('0');

      await vi.advanceTimersByTimeAsync(4000);

      container.querySelector('#auto-btn').click();

      expect(container.querySelector('#auto-count').textContent).toBe('0');

      await vi.advanceTimersByTimeAsync(16);

      expect(container.querySelector('#auto-count').textContent).toBe('1');
    } finally {
      runtime.stopScheduler();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('다음 프레임 전 여러 DOM 이벤트가 발생해도 한 번의 자동 렌더로 합쳐진다', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(() => callback(0), 16));
    vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id));

    const renders = vi.fn();

    try {
      function CoalescedAutoRenderApp() {
        let count = 0;
        watch(renders);

        return (
          <div>
            <span id="coalesced-count">{count}</span>
            <button id="coalesced-btn" onClick={() => { count += 1; }}>+</button>
          </div>
        );
      }

      AEUI.init(CoalescedAutoRenderApp, container);
      expect(renders).toHaveBeenCalledTimes(1);

      const button = container.querySelector('#coalesced-btn');
      button.click();
      button.click();

      expect(container.querySelector('#coalesced-count').textContent).toBe('0');

      await vi.advanceTimersByTimeAsync(16);

      expect(container.querySelector('#coalesced-count').textContent).toBe('2');
      expect(renders).toHaveBeenCalledTimes(2);
    } finally {
      runtime.stopScheduler();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });

  it('외부 타이머의 let 변경을 유휴 상태에서도 1초 이내 자동 반영', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (callback) => setTimeout(callback, 16));
    vi.stubGlobal('cancelAnimationFrame', clearTimeout);
    try {
      function TimerApp() {
        let message = 'waiting';
        const timer = setTimeout(() => { message = 'complete'; }, 4000);
        clean(() => clearTimeout(timer));
        return <p>{message}</p>;
      }
      AEUI.init(TimerApp, container);
      await vi.advanceTimersByTimeAsync(3999);
      expect(container.textContent).toBe('waiting');
      await vi.advanceTimersByTimeAsync(1001);
      expect(container.textContent).toBe('complete');
    } finally {
      runtime.stopScheduler();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});

describe('directory router runtime', () => {
  it('renders matching pages, delegates internal anchors, and handles popstate', () => {
    window.history.replaceState({}, '', '/');

    AEUI.__runtime.initDirectoryRouter({
      '/src/pages/_layout.jsx': { default: Layout },
      '/src/pages/index.jsx': { default: Home },
      '/src/pages/products/[id].jsx': { default: Product },
      '/src/pages/404.jsx': { default: NotFound },
    }, container);

    expect(container.querySelector('#layout').getAttribute('data-path')).toBe('/');
    expect(container.querySelector('#page-title').textContent).toBe('Home /');

    container.querySelector('#product-link').dispatchEvent(new MouseEvent('click', { button: 0, bubbles: true, cancelable: true }));
    AEUI.render();

    expect(window.location.pathname).toBe('/products/42');
    expect(container.querySelector('#layout').getAttribute('data-path')).toBe('/products/42');
    expect(container.querySelector('#page-title').textContent).toBe('Product 42');
    expect(container.querySelector('#query-tab').textContent).toBe('details');

    window.history.pushState({}, '', '/unknown');
    window.dispatchEvent(new Event('popstate'));
    AEUI.render();

    expect(container.querySelector('#page-title').textContent).toBe('Missing /unknown');
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
    AEUI.render();

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

  it('deps가 없으면 첫 render를 포함해 매 render 직전에 callback이 실행된다', () => {
    function AlwaysWatch() {
      let count = 0;

      watch(() => {
        count += 1;
        watchLog.push(count);
      });

      return <span id="always-watch-count">{count}</span>;
    }

    AEUI.init(AlwaysWatch, container);

    expect(watchLog).toEqual([1]);
    expect(container.querySelector('#always-watch-count').textContent).toBe('1');

    AEUI.render();

    expect(watchLog).toEqual([1, 2]);
    expect(container.querySelector('#always-watch-count').textContent).toBe('2');
  });

  it('props 변경 시 watch callback이 실행됨', () => {
    AEUI.init(WatchApp, container);

    // 마운트 시에는 watch 미실행 (초기값이 oldDeps에 저장됨)
    expect(watchLog).toEqual([]);

    container.querySelector('#watch-btn').click();
    AEUI.render();

    // props value가 10→20으로 변경되어 watch callback 실행
    expect(watchLog).toEqual([20]);
  });

  it('props가 변하지 않으면 watch callback 미실행', () => {
    AEUI.init(WatchApp, container);
    AEUI.render();
    expect(watchLog).toEqual([]);
  });

  it('deps getter의 길이가 줄어들어도 watch callback이 실행된다', () => {
    function ShrinkingDepsWatch() {
      let includeExtra = true;

      watch(() => {
        watchLog.push(includeExtra ? 'full' : 'shrunk');
      }, () => (includeExtra ? [1, 2] : [1]));

      return (
        <button id="shrink-watch" onClick={() => { includeExtra = false; }}>
          shrink
        </button>
      );
    }

    AEUI.init(ShrinkingDepsWatch, container);
    expect(watchLog).toEqual([]);

    container.querySelector('#shrink-watch').click();
    AEUI.render();

    expect(watchLog).toEqual(['shrunk']);

    AEUI.render();
    expect(watchLog).toEqual(['shrunk']);
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
    AEUI.render();

    expect(watchLog).toEqual([1]);
    expect(container.querySelector('#lcount').textContent).toBe('1');
  });

  it('named callback을 사용하는 watch(callback, deps)도 deps를 함수화해 감지한다', () => {
    function NamedCallbackWatch() {
      let count = 0;
      const syncCount = () => {
        watchLog.push(count);
      };

      watch(syncCount, [count]);

      return (
        <div>
          <span id="named-count">{count}</span>
          <button id="named-btn" onClick={() => count++}>+</button>
        </div>
      );
    }

    AEUI.init(NamedCallbackWatch, container);
    expect(watchLog).toEqual([]);

    container.querySelector('#named-btn').click();
    AEUI.render();

    expect(watchLog).toEqual([1]);
    expect(container.querySelector('#named-count').textContent).toBe('1');
  });

  it('local state와 props deps가 같은 tick에 바뀌어도 watch callback은 한 번만 실행된다', () => {
    let updateChildLocal = () => { };

    function MixedDepsChild({ value }) {
      let localCount = 0;

      updateChildLocal = () => {
        localCount += 1;
      };

      watch(() => {
        watchLog.push([value, localCount]);
      }, [value, localCount]);

      return <span id="mixed-value">{value}:{localCount}</span>;
    }

    function MixedDepsApp() {
      let parentCount = 0;

      return (
        <div>
          <MixedDepsChild value={parentCount} />
          <button
            id="mixed-btn"
            onClick={() => {
              parentCount = 1;
              updateChildLocal();
            }}
          >
            change
          </button>
        </div>
      );
    }

    AEUI.init(MixedDepsApp, container);
    expect(watchLog).toEqual([]);

    container.querySelector('#mixed-btn').click();
    AEUI.render();

    expect(watchLog).toEqual([[1, 1]]);
    expect(container.querySelector('#mixed-value').textContent).toBe('1:1');
  });

  it('watch callback이 deps를 다시 바꾸면 callback 이후 최종 deps를 snapshot으로 저장한다', () => {
    function ClampWatch() {
      let count = 0;

      watch(() => {
        if (count > 1) count = 1;
        watchLog.push(count);
      }, [count]);

      return (
        <div>
          <span id="clamp-count">{count}</span>
          <button id="clamp-btn" onClick={() => { count = 2; }}>set</button>
        </div>
      );
    }

    AEUI.init(ClampWatch, container);
    expect(watchLog).toEqual([]);

    container.querySelector('#clamp-btn').click();
    AEUI.render();

    expect(watchLog).toEqual([1]);
    expect(container.querySelector('#clamp-count').textContent).toBe('1');

    AEUI.render();

    expect(watchLog).toEqual([1]);
    expect(container.querySelector('#clamp-count').textContent).toBe('1');
  });

  it('render phase에서 호출된 watch는 등록되지 않는다', () => {
    function RenderPhaseWatch() {
      let count = 0;

      return () => {
        watch(() => { watchLog.push(count); }, [count]);

        return (
          <button id="render-phase-watch" onClick={() => { count += 1; }}>
            {count}
          </button>
        );
      };
    }

    AEUI.init(RenderPhaseWatch, container);
    expect(watchLog).toEqual([]);

    container.querySelector('#render-phase-watch').click();
    AEUI.render();
    AEUI.render();

    expect(container.querySelector('#render-phase-watch').textContent).toBe('1');
    expect(watchLog).toEqual([]);
  });

  it('watch(deps, callback) 구버전 순서는 등록되지 않고 guard 에러를 기록한다', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

    function LegacyOrderWatch() {
      let count = 0;
      watch([count], () => { watchLog.push(count); });
      return <span>{count}</span>;
    }

    AEUI.init(LegacyOrderWatch, container);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[AEUI] Render error:',
      expect.objectContaining({
        message: expect.stringMatching(/must be compiled by the AEUI Babel plugin/),
      })
    );
    expect(watchLog).toEqual([]);
    consoleSpy.mockRestore();
  });
});

describe('props 구조분해 반응성', () => {
  it('alias 구조분해된 props가 render와 watch에서 최신값을 본다', () => {
    const aliasWatchLog = [];

    function AliasChild({ title: label }) {
      watch(() => {
        aliasWatchLog.push(label);
      }, [label]);

      return <span id="alias-label">{label}</span>;
    }

    function AliasApp() {
      let title = 'first';

      return (
        <div>
          <AliasChild title={title} />
          <button id="alias-change" onClick={() => { title = 'second'; }}>change</button>
        </div>
      );
    }

    AEUI.init(AliasApp, container);
    expect(container.querySelector('#alias-label').textContent).toBe('first');
    expect(aliasWatchLog).toEqual([]);

    container.querySelector('#alias-change').click();
    AEUI.render();

    expect(container.querySelector('#alias-label').textContent).toBe('second');
    expect(aliasWatchLog).toEqual(['second']);
  });

  it('default 값이 있는 props는 새 값이 전달되면 render에 반영된다', () => {
    function DefaultChild({ count = 0 }) {
      return <span id="default-count">{count}</span>;
    }

    function DefaultApp() {
      let count;

      return (
        <div>
          <DefaultChild count={count} />
          <button id="default-change" onClick={() => { count = 5; }}>change</button>
        </div>
      );
    }

    AEUI.init(DefaultApp, container);
    expect(container.querySelector('#default-count').textContent).toBe('0');

    container.querySelector('#default-change').click();
    AEUI.render();

    expect(container.querySelector('#default-count').textContent).toBe('5');
  });

  it('default parameter 구조분해 props도 새 값이 전달되면 render에 반영된다', () => {
    function DefaultParamChild({ name } = { name: 'Guest' }) {
      return <span id="default-param-name">{name}</span>;
    }

    function DefaultParamApp() {
      let name = 'first';

      return (
        <div>
          <DefaultParamChild name={name} />
          <button id="default-param-change" onClick={() => { name = 'second'; }}>change</button>
        </div>
      );
    }

    AEUI.init(DefaultParamApp, container);
    expect(container.querySelector('#default-param-name').textContent).toBe('first');

    container.querySelector('#default-param-change').click();
    AEUI.render();

    expect(container.querySelector('#default-param-name').textContent).toBe('second');
  });

  it('nested 구조분해된 props가 최신값으로 갱신된다', () => {
    function NestedChild({ user: { name } }) {
      return <span id="nested-name">{name}</span>;
    }

    function NestedApp() {
      let user = { name: 'Kim' };

      return (
        <div>
          <NestedChild user={user} />
          <button id="nested-change" onClick={() => { user = { name: 'Lee' }; }}>change</button>
        </div>
      );
    }

    AEUI.init(NestedApp, container);
    expect(container.querySelector('#nested-name').textContent).toBe('Kim');

    container.querySelector('#nested-change').click();
    AEUI.render();

    expect(container.querySelector('#nested-name').textContent).toBe('Lee');
  });

  it('rest 구조분해된 props가 최신 객체를 본다', () => {
    function RestChild({ title, ...rest }) {
      return (
        <span id="rest-id">
          {title}:{rest.id}
        </span>
      );
    }

    function RestApp() {
      let meta = { title: 'Item', id: 'A' };

      return (
        <div>
          <RestChild title={meta.title} id={meta.id} />
          <button id="rest-change" onClick={() => { meta = { title: 'Item', id: 'B' }; }}>change</button>
        </div>
      );
    }

    AEUI.init(RestApp, container);
    expect(container.querySelector('#rest-id').textContent).toBe('Item:A');

    container.querySelector('#rest-change').click();
    AEUI.render();

    expect(container.querySelector('#rest-id').textContent).toBe('Item:B');
  });
});

describe('Babel 플러그인 변환 경계', () => {
  it('expression-body 화살표 컴포넌트의 구조분해 props가 최신값으로 갱신된다', () => {
    const Greeting = ({ name }) => <span id="expr-name">{name}</span>;

    function GreetingApp() {
      let name = 'first';

      return (
        <div>
          <Greeting name={name} />
          <button id="expr-change" onClick={() => { name = 'second'; }}>change</button>
        </div>
      );
    }

    AEUI.init(GreetingApp, container);
    expect(container.querySelector('#expr-name').textContent).toBe('first');

    container.querySelector('#expr-change').click();
    AEUI.render();

    expect(container.querySelector('#expr-name').textContent).toBe('second');
  });

  it('top-level conditional return을 사용하는 컴포넌트가 정상 업데이트된다', () => {
    function ConditionalLeaf({ ok }) {
      return ok ? <p id="conditional-leaf">yes</p> : <button id="conditional-leaf">no</button>;
    }

    function ConditionalLeafApp() {
      let ok = false;

      return (
        <div>
          <ConditionalLeaf ok={ok} />
          <button id="conditional-toggle" onClick={() => { ok = true; }}>toggle</button>
        </div>
      );
    }

    AEUI.init(ConditionalLeafApp, container);
    expect(container.querySelector('#conditional-leaf').tagName).toBe('BUTTON');
    expect(container.querySelector('#conditional-leaf').textContent).toBe('no');

    container.querySelector('#conditional-toggle').click();
    AEUI.render();

    expect(container.querySelector('#conditional-leaf').tagName).toBe('P');
    expect(container.querySelector('#conditional-leaf').textContent).toBe('yes');
  });

  it('top-level logical return을 사용하는 컴포넌트가 mount/unmount 된다', () => {
    function LogicalLeaf({ show }) {
      return show && <span id="logical-leaf">visible</span>;
    }

    function LogicalLeafApp() {
      let show = false;

      return (
        <div>
          <LogicalLeaf show={show} />
          <button id="logical-show" onClick={() => { show = true; }}>show</button>
          <button id="logical-hide" onClick={() => { show = false; }}>hide</button>
        </div>
      );
    }

    AEUI.init(LogicalLeafApp, container);
    expect(container.querySelector('#logical-leaf')).toBeNull();

    container.querySelector('#logical-show').click();
    AEUI.render();
    expect(container.querySelector('#logical-leaf').textContent).toBe('visible');

    container.querySelector('#logical-hide').click();
    AEUI.render();
    expect(container.querySelector('#logical-leaf')).toBeNull();
  });

  it('수동 render 함수가 구조분해 props 파라미터를 사용해도 동작한다', () => {
    function ManualRenderChild() {
      return ({ value }) => <span id="manual-render-value">{value}</span>;
    }

    function ManualRenderApp() {
      let value = 'alpha';

      return (
        <div>
          <ManualRenderChild value={value} />
          <button id="manual-render-change" onClick={() => { value = 'beta'; }}>change</button>
        </div>
      );
    }

    AEUI.init(ManualRenderApp, container);
    expect(container.querySelector('#manual-render-value').textContent).toBe('alpha');

    container.querySelector('#manual-render-change').click();
    AEUI.render();

    expect(container.querySelector('#manual-render-value').textContent).toBe('beta');
  });

  it('수동 render 함수의 기본값 식이 최신 외부 props를 참조한다', () => {
    function ManualRenderDefaultChild({ outer }) {
      return ({ value = outer }) => <span id="manual-render-default-value">{value}</span>;
    }

    function ManualRenderDefaultApp() {
      let outer = 'alpha';

      return (
        <div>
          <ManualRenderDefaultChild outer={outer} />
          <button id="manual-render-default-change" onClick={() => { outer = 'beta'; }}>change</button>
        </div>
      );
    }

    AEUI.init(ManualRenderDefaultApp, container);
    expect(container.querySelector('#manual-render-default-value').textContent).toBe('alpha');

    container.querySelector('#manual-render-default-change').click();
    AEUI.render();

    expect(container.querySelector('#manual-render-default-value').textContent).toBe('beta');
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

  it('조건부 렌더링으로 자식 컴포넌트가 제거되면 clean callback 실행', () => {
    const childCleanups = [];

    function CleanChild() {
      clean(() => { childCleanups.push('child-cleaned'); });
      return <p>child</p>;
    }

    function ParentApp() {
      let show = true;
      return (
        <div>
          {show && <CleanChild />}
          <button id="hide-btn" onClick={() => { show = false; }}>hide</button>
        </div>
      );
    }

    AEUI.init(ParentApp, container);
    expect(container.querySelector('p').textContent).toBe('child');
    expect(childCleanups).toEqual([]);

    container.querySelector('#hide-btn').click();
    AEUI.render();

    expect(childCleanups).toEqual(['child-cleaned']);
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
    AEUI.render();

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
    AEUI.render();

    expect(container.querySelectorAll('#list li').length).toBe(4);
  });

  it('아이템 제거 시 DOM에서 삭제', () => {
    AEUI.init(ListApp, container);

    container.querySelector('#remove').click();
    AEUI.render();

    const lis = container.querySelectorAll('#list li');
    expect(lis.length).toBe(2);
    expect(lis[0].textContent).toBe('A');
    expect(lis[1].textContent).toBe('B');
  });
});

describe('key 기반 reconciliation', () => {
  it('keyed 컴포넌트 재정렬 시 상태와 props.key를 함께 유지함', () => {
    function KeyedCounter(props) {
      let count = 0;
      return (
        <button className={`counter-${props.key}`} onClick={() => { count++; }}>
          {props.key}:{count}
        </button>
      );
    }

    function KeyedComponentListApp() {
      let items = ['a', 'b'];
      return (
        <div>
          <div id="keyed-components">
            {items.map((item) => <KeyedCounter key={item} />)}
          </div>
          <button id="reverse-components" onClick={() => { items = [...items].reverse(); }}>reverse</button>
        </div>
      );
    }

    AEUI.init(KeyedComponentListApp, container);

    container.querySelector('.counter-b').click();
    AEUI.render();
    expect(Array.from(container.querySelectorAll('#keyed-components button')).map(node => node.textContent)).toEqual(['a:0', 'b:1']);

    container.querySelector('#reverse-components').click();
    AEUI.render();

    expect(Array.from(container.querySelectorAll('#keyed-components button')).map(node => node.textContent)).toEqual(['b:1', 'a:0']);
    expect(container.querySelector('.counter-b').textContent).toBe('b:1');
  });

  it('keyed DOM 래퍼 재정렬 시 내부 컴포넌트 상태를 유지함', () => {
    function InnerCounter({ label }) {
      let count = 0;
      return (
        <button className={`inner-${label}`} onClick={() => { count++; }}>
          {label}:{count}
        </button>
      );
    }

    function KeyedWrapperApp() {
      let items = ['a', 'b'];
      return (
        <div>
          <ul id="wrapper-list">
            {items.map((item) => (
              <li key={item} data-key={item}>
                <InnerCounter label={item} />
              </li>
            ))}
          </ul>
          <button id="reverse-wrappers" onClick={() => { items = [...items].reverse(); }}>reverse</button>
        </div>
      );
    }

    AEUI.init(KeyedWrapperApp, container);

    container.querySelector('.inner-b').click();
    AEUI.render();
    expect(Array.from(container.querySelectorAll('#wrapper-list button')).map(node => node.textContent)).toEqual(['a:0', 'b:1']);

    container.querySelector('#reverse-wrappers').click();
    AEUI.render();

    expect(Array.from(container.querySelectorAll('#wrapper-list li')).map(node => node.getAttribute('data-key'))).toEqual(['b', 'a']);
    expect(Array.from(container.querySelectorAll('#wrapper-list button')).map(node => node.textContent)).toEqual(['b:1', 'a:0']);
  });
});

// ─── Fragment ───

describe('Fragment', () => {
  it('JSX Fragment의 children이 부모 DOM에 직접 렌더되고 갱신됨', () => {
    let first = 'First';
    function FragmentUser() {
      return (
        <div id="frag-wrap">
          <><p id="frag1">{first}</p><p id="frag2">Second</p></>
        </div>
      );
    }

    AEUI.init(FragmentUser, container);

    const wrapper = container.querySelector('#frag-wrap');
    expect(Array.from(wrapper.childNodes).map(node => node.textContent)).toEqual(['First', 'Second']);
    first = 'Updated';
    AEUI.render();
    expect(Array.from(wrapper.childNodes).map(node => node.textContent)).toEqual(['Updated', 'Second']);
  });

  it('Fragment를 반환하는 중첩 컴포넌트 다음 형제 컴포넌트가 정상 업데이트됨', () => {
    function Pair() {
      return AEUI.createVNode(
        AEUI.Fragment,
        null,
        AEUI.createVNode('p', { className: 'pair-1' }, 'A'),
        AEUI.createVNode('p', { className: 'pair-2' }, 'B')
      );
    }

    function Wrapper() {
      return <Pair />;
    }

    function Counter() {
      let count = 0;
      return (
        <p id="counter" onClick={() => count++}>
          {count}
        </p>
      );
    }

    function App() {
      return (
        <div id="frag-app">
          <Wrapper />
          <Counter />
        </div>
      );
    }

    AEUI.init(App, container);

    const appRoot = container.querySelector('#frag-app');
    expect(Array.from(appRoot.childNodes).map(node => node.textContent)).toEqual(['A', 'B', '0']);

    container.querySelector('#counter').click();
    AEUI.render();

    expect(Array.from(appRoot.childNodes).map(node => node.textContent)).toEqual(['A', 'B', '1']);
    expect(container.querySelector('.pair-2').textContent).toBe('B');
    expect(container.querySelectorAll('#counter').length).toBe(1);
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
    AEUI.render();

    expect(container.querySelector('.count-a').textContent).toBe('3');
    expect(container.querySelector('.count-b').textContent).toBe('0'); // B는 안 바뀜
  });
});

// ── Reconcile Remove 시 컴포넌트 unmount ───

describe('Reconcile Remove 시 컴포넌트 cleanup 실행', () => {
  it('배열에서 컴포넌트가 null로 바뀌면 cleanup이 실행됨', () => {
    const cleanups = [];

    function RemovableChild() {
      clean(() => { cleanups.push('removed'); });
      return <span>child</span>;
    }

    function RemoveApp() {
      let show = true;
      return (
        <div>
          {show ? <RemovableChild /> : null}
          <button id="remove-btn" onClick={() => { show = false; }}>remove</button>
        </div>
      );
    }

    AEUI.init(RemoveApp, container);
    expect(container.querySelector('span').textContent).toBe('child');
    expect(cleanups).toEqual([]);

    container.querySelector('#remove-btn').click();
    AEUI.render();

    expect(cleanups).toEqual(['removed']);
    expect(container.querySelector('span')).toBeNull();
  });

  it('동일 컴포넌트 형제 중 두 번째 제거 시 올바른 cleanup이 실행됨', () => {
    const cleanups = [];

    function SiblingChild({ id }) {
      clean(() => { cleanups.push(id); });
      return <span data-id={id}>{id}</span>;
    }

    function RemoveSecondSiblingApp() {
      let showSecond = true;
      return (
        <div>
          <SiblingChild id="first" />
          {showSecond ? <SiblingChild id="second" /> : null}
          <button id="remove-second" onClick={() => { showSecond = false; }}>remove second</button>
        </div>
      );
    }

    AEUI.init(RemoveSecondSiblingApp, container);
    expect(cleanups).toEqual([]);

    container.querySelector('#remove-second').click();
    AEUI.render();

    expect(cleanups).toEqual(['second']);
    expect(container.querySelector('span[data-id="first"]')).not.toBeNull();
    expect(container.querySelector('span[data-id="second"]')).toBeNull();
  });
});

// ── DOM 타입 교체 시 내부 컴포넌트 unmount ───

describe('DOM 타입 교체 시 내부 컴포넌트 cleanup 실행', () => {
  it('부모 DOM 태그가 바뀌면 내부 자식 컴포넌트의 cleanup이 실행됨', () => {
    const cleanups = [];

    function InnerChild() {
      clean(() => { cleanups.push('inner-cleaned'); });
      return <span>inner</span>;
    }

    function TypeSwitchApp() {
      let useSection = false;
      return (
        <div>
          {useSection
            ? <section><p>replaced</p></section>
            : <div id="old-wrapper"><InnerChild /></div>
          }
          <button id="switch-btn" onClick={() => { useSection = true; }}>switch</button>
        </div>
      );
    }

    AEUI.init(TypeSwitchApp, container);
    expect(container.querySelector('span').textContent).toBe('inner');
    expect(cleanups).toEqual([]);

    container.querySelector('#switch-btn').click();
    AEUI.render();

    expect(cleanups).toEqual(['inner-cleaned']);
    expect(container.querySelector('span')).toBeNull();
    expect(container.querySelector('section p').textContent).toBe('replaced');
  });

  it('DOM 타입 교체 시 뒤 형제 컴포넌트 상태는 유지됨', () => {
    function Counter({ id }) {
      let count = 0;
      return (
        <button className={id} onClick={() => { count++; }}>
          {id}:{count}
        </button>
      );
    }

    function PreserveSiblingStateApp() {
      let useSection = false;
      return (
        <div>
          {useSection
            ? <section><Counter id="B" /></section>
            : <div><Counter id="A" /></div>
          }
          <Counter id="C" />
          <button id="switch-preserve" onClick={() => { useSection = true; }}>switch</button>
        </div>
      );
    }

    AEUI.init(PreserveSiblingStateApp, container);

    const cButton = () => container.querySelector('button.C');
    cButton().click();
    AEUI.render();
    expect(cButton().textContent).toBe('C:1');

    container.querySelector('#switch-preserve').click();
    AEUI.render();

    expect(cButton().textContent).toBe('C:1');
  });
});

describe('훅의 실행과 정리', () => {
  it('watch에 함수가 아닌 callback을 전달하면 TypeError로 거부', () => {
    let failure;
    const observed = vi.fn();
    function App() {
      try {
        watch(null);
      } catch (error) {
        failure = error;
      }
      watch(observed);
      return <p>ready</p>;
    }
    AEUI.init(App, container);
    expect(failure).toBeInstanceOf(TypeError);
    expect(failure.message).toContain('requires callback to be a function');
    expect(container.textContent).toBe('ready');
    expect(observed).toHaveBeenCalledTimes(1);
  });

  it('watch에 배열이 아닌 deps를 전달하면 등록을 거부하고 callback을 실행하지 않음', () => {
    let failure;
    const rejected = vi.fn();
    function App() {
      try {
        watch(rejected, { count: 0 });
      } catch (error) {
        failure = error;
      }
      return <p>ready</p>;
    }
    AEUI.init(App, container);
    AEUI.render();
    expect(failure).toBeInstanceOf(TypeError);
    expect(failure.message).toContain('requires deps to be an array');
    expect(rejected).not.toHaveBeenCalled();
    expect(container.textContent).toBe('ready');
  });

  it('dependency getter가 잘못된 값을 반환하면 오류를 기록하고 정상 배열로 복구되면 다시 관찰', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const observed = vi.fn();
    const otherWatcher = vi.fn();
    let deps = [0];
    try {
      function App() {
        watch(observed, () => deps);
        watch(otherWatcher);
        return <p>{Array.isArray(deps) ? 'valid' : 'invalid'}</p>;
      }
      AEUI.init(App, container);
      deps = null;
      AEUI.render();
      expect(errors).toHaveBeenCalledWith('[AEUI] Watcher error:', expect.any(TypeError));
      expect(errors.mock.calls[0][1].message).toContain('requires deps to be an array');
      expect(observed).not.toHaveBeenCalled();
      expect(otherWatcher).toHaveBeenCalledTimes(2);
      expect(container.textContent).toBe('invalid');

      deps = [1];
      AEUI.render();
      AEUI.render();
      expect(observed).toHaveBeenCalledTimes(1);
      expect(container.textContent).toBe('valid');
      expect(errors).toHaveBeenCalledTimes(1);
    } finally {
      errors.mockRestore();
    }
  });

  it('같은 객체의 중첩 값을 직접 변이해도 watch가 변경을 감지하고 중복 실행하지 않음', () => {
    const values = [];
    function App() {
      const state = { profile: { count: 0 } };
      watch(() => { values.push(state.profile.count); }, [state]);
      return <button onClick={() => state.profile.count++}>{state.profile.count}</button>;
    }
    AEUI.init(App, container);
    expect(values).toEqual([]);
    const button = container.querySelector('button');
    button.click();
    AEUI.render();
    AEUI.render();
    expect(values).toEqual([1]);
    button.click();
    AEUI.render();
    expect(values).toEqual([1, 2]);
    expect(container.textContent).toBe('2');
  });

  it('import 별칭과 이름 있는 dependency getter도 최신 상태를 관찰하고 한 번 정리', () => {
    const values = [];
    const inlineValues = [];
    const disposed = vi.fn();
    function App() {
      let count = 0;
      const deps = () => [count];
      observe(() => { values.push(count); return [count]; }, deps);
      observe(() => { inlineValues.push(count); }, [count]);
      dispose(disposed);
      return <button onClick={() => count++}>{count}</button>;
    }
    AEUI.init(App, container);
    expect(values).toEqual([]);
    expect(inlineValues).toEqual([]);
    container.querySelector('button').click();
    AEUI.render();
    AEUI.render();
    expect(container.textContent).toBe('1');
    expect(values).toEqual([1]);
    expect(inlineValues).toEqual([1]);
    AEUI.init(SimpleApp, container);
    AEUI.render();
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(values).toEqual([1]);
  });

  it('watch 오류가 뒤의 watcher나 화면 갱신을 막지 않음', () => {
    const failure = new Error('watch failed');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const values = [];
    try {
      function App() {
        let count = 0;
        watch(() => { throw failure; }, [count]);
        watch(() => { values.push(count); }, [count]);
        return <button onClick={() => count++}>{count}</button>;
      }
      AEUI.init(App, container);
      const button = container.querySelector('button');
      button.click();
      AEUI.render();
      button.click();
      AEUI.render();
      expect(container.textContent).toBe('2');
      expect(values).toEqual([1, 2]);
      expect(errors).toHaveBeenCalledWith(expect.any(String), failure);
    } finally {
      errors.mockRestore();
    }
  });

  it('cleanup 오류 뒤에도 등록 순서대로 한 번씩 정리하고 제거된 watcher는 실행하지 않음', () => {
    const failure = new Error('cleanup failed');
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    const calls = [];
    const observed = vi.fn();
    try {
      function Child() {
        watch(observed);
        clean(() => { calls.push('first'); throw failure; });
        clean(() => { calls.push('second'); });
        return <span>child</span>;
      }
      function App() {
        let visible = true;
        return <div>{visible && <Child />}<button onClick={() => { visible = false; }}>remove</button></div>;
      }
      AEUI.init(App, container);
      expect(observed).toHaveBeenCalledTimes(1);
      container.querySelector('button').click();
      AEUI.render();
      AEUI.render();
      expect(container.querySelector('span')).toBeNull();
      expect(observed).toHaveBeenCalledTimes(1);
      expect(calls).toEqual(['first', 'second']);
      expect(errors).toHaveBeenCalledWith(expect.any(String), failure);
    } finally {
      errors.mockRestore();
    }
  });
});
