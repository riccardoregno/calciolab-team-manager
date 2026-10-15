import { useEffect, useRef } from "react";

const openDialogs = [];
let previousOverflow;
const focusable = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

// Shared by modal forms, confirmations and the mobile navigation sheet.
export function useDialogFocus(panelRef, onClose, enabled = true) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!enabled) return;
    const token = Symbol("dialog");
    const previousFocus = document.activeElement;
    if (!openDialogs.length) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    openDialogs.push(token);
    const getNodes = () => Array.from(panelRef.current?.querySelectorAll(focusable) || [])
      .filter((node) => node.getClientRects().length > 0 && !node.closest('[inert]'));
    (getNodes()[0] || panelRef.current)?.focus();

    function handleKeyDown(event) {
      if (openDialogs.at(-1) !== token) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current?.();
      }
      if (event.key !== "Tab") return;
      const nodes = getNodes();
      const first = nodes[0];
      const last = nodes.at(-1);
      if (!first) {
        event.preventDefault();
        panelRef.current?.focus();
      } else if (event.shiftKey && (document.activeElement === first || !nodes.includes(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !nodes.includes(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      const wasTopmost = openDialogs.at(-1) === token;
      openDialogs.splice(openDialogs.indexOf(token), 1);
      document.removeEventListener("keydown", handleKeyDown);
      if (!openDialogs.length) document.body.style.overflow = previousOverflow;
      if (wasTopmost && previousFocus?.isConnected) previousFocus.focus();
    };
  }, [enabled, panelRef]);
}
