import { makeId } from "@/lib/id.js";

export function fakeAuthorizePayment({ amount }) {
  const delayMs = 900 + Math.floor(Math.random() * 1100);
  const failRate = 0.18;

  let timerId = null;
  const promise = new Promise((resolve, reject) => {
    timerId = setTimeout(() => {
      const r = Math.random();
      if (r < failRate) {
        reject(new Error("결제 승인에 실패했습니다. 잠시 후 다시 시도해주세요."));
        return;
      }
      resolve({
        paymentId: makeId("pay"),
        amount,
        approvedAt: Date.now(),
      });
    }, delayMs);
  });

  return {
    promise,
    cancel() {
      if (timerId) clearTimeout(timerId);
      timerId = null;
    },
  };
}
