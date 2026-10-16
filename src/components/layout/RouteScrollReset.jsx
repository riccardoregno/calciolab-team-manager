import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

// New screens start at the top; Back/Forward and in-page anchors keep browser behavior.
export default function RouteScrollReset() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();
  const previousPath = useRef(pathname);
  useLayoutEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (navigationType !== "POP" && !hash) window.scrollTo(0, 0);
  }, [pathname, hash, navigationType]);
  return null;
}
