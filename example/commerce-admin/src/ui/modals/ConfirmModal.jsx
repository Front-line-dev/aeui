import { AEUI } from "aeui";
import Modal from "../components/Modal.jsx";

function ConfirmModalFooter({ tone, confirmLabel, onClose, onConfirm }) {
  return (
    <div style="display: flex; gap: 8px; justify-content: flex-end; width: 100%;">
      <button className="btn btn--ghost" type="button" onClick={onClose}>
        취소
      </button>
      <button
        className={`btn ${tone === "danger" ? "btn--danger" : "btn--primary"}`}
        type="button"
        onClick={onConfirm}
      >
        {confirmLabel || "확인"}
      </button>
    </div>
  );
}

export default function ConfirmModal({ title, message, detail, confirmLabel, tone, onConfirm, onClose }) {
  const handleConfirm = () => {
    if (typeof onConfirm === "function") onConfirm();
  };

  return (
    <Modal
      title={title || "확인"}
      onClose={onClose}
      footer={
        <ConfirmModalFooter tone={tone} confirmLabel={confirmLabel} onClose={onClose} onConfirm={handleConfirm} />
      }
    >
      <div style="line-height: 1.55;">
        <div style="font-weight: 800; letter-spacing: -0.01em; margin-bottom: 6px;">
          {message}
        </div>
        {detail ? <div className="help">{detail}</div> : null}
      </div>
    </Modal>
  );
}
