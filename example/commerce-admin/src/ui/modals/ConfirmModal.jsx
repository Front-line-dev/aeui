import { AEUI } from "aeui";
import { state, actions } from "../../store.js";
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

export default function ConfirmModal() {
  const handleClose = () => actions.closeModal();
  const handleConfirm = () => actions.confirmModal();

  if (state.modal?.type !== "confirm") return null;

  return (
    <Modal
      title={state.modal.title || "확인"}
      onClose={handleClose}
      footer={
        <ConfirmModalFooter
          tone={state.modal.tone}
          confirmLabel={state.modal.confirmLabel}
          onClose={handleClose}
          onConfirm={handleConfirm}
        />
      }
    >
      <div style="line-height: 1.55;">
        <div style="font-weight: 800; letter-spacing: -0.01em; margin-bottom: 6px;">
          {state.modal.message}
        </div>
        {state.modal.detail ? <div className="help">{state.modal.detail}</div> : null}
      </div>
    </Modal>
  );
}
