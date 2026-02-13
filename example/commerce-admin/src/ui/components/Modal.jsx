import { AEUI } from "aeui";

export default function Modal({ title, onClose, footer, wide, children }) {
  const onOverlayClick = (e) => {
    if (e.target !== e.currentTarget) return;
    if (typeof onClose === "function") onClose();
  };

  return (
    <div className="modalOverlay" onClick={onOverlayClick} role="dialog" aria-modal="true">
      <div className={`modal ${wide ? "modal--wide" : ""}`}>
        <div className="modal__header">
          <div className="modal__title">{title || ""}</div>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            닫기
          </button>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
