import Landing from "./Landing";
import Browse from "./browse/Browse";

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "");
  if (path === "/browse" || path.startsWith("/browse/")) {
    return <Browse />;
  }
  return <Landing />;
}
