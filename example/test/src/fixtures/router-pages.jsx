export function Layout({ route, children }) {
  return (
    <section id="layout" data-path={route.pathname}>
      {children}
    </section>
  );
}

export function Home({ route }) {
  return (
    <div>
      <h1 id="page-title">Home {route.pathname}</h1>
      <a id="product-link" href="/products/42?tab=details">Product 42</a>
    </div>
  );
}

export function Product({ route }) {
  return (
    <div>
      <h1 id="page-title">Product {route.params.id}</h1>
      <span id="query-tab">{route.query.tab}</span>
      <a id="home-link" href="/">Home</a>
    </div>
  );
}

export function NotFound({ route }) {
  return <h1 id="page-title">Missing {route.pathname}</h1>;
}

