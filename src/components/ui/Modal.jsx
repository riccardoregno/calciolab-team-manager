import { useId, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "../../i18n";
import { useDialogFocus } from "../../hooks/useDialogFocus";

function Modal({ title, children, onClose, role = "dialog", compact = false }) {
  const { t } = useTranslation();
  const panelRef = useRef(null);
  const titleId = useId();
  useDialogFocus(panelRef, onClose);

  return createPortal(
    <div className="cl-modal-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`cl-modal-panel${compact ? " cl-modal-panel--compact" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="cl-modal-handle" aria-hidden="true" />
        <div className="cl-modal-heading">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="cl-modal-close" aria-label={t("common.close")} onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export default Modal;
