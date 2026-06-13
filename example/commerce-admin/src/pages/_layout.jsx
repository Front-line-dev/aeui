import App from "@/App.jsx";

export default function Layout({ route, children }) {
  return <App route={route}>{children}</App>;
}
