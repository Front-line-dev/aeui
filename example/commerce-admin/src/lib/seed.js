import { makeId } from "./id.js";

function now() {
  return Date.now();
}

export function makeSeedState() {
  const t = now();

  const products = [
    {
      id: makeId("p"),
      name: "AEUI 머그컵 (라바 글레이즈)",
      category: "굿즈",
      price: 12000,
      stock: 12,
      rating: 4.7,
      tags: ["new", "hot"],
      active: true,
      description:
        "한 손에 감기는 두께. 매일 쓰기 좋은 무게. 커피가 식어도 멋은 식지 않는다.",
      createdAt: t - 1000 * 60 * 60 * 24 * 22,
      updatedAt: t - 1000 * 60 * 60 * 3,
    },
    {
      id: makeId("p"),
      name: "AEUI 노트 (그리드, 120p)",
      category: "문구",
      price: 6800,
      stock: 3,
      rating: 4.4,
      tags: ["low-stock"],
      active: true,
      description:
        "18px 그리드처럼 촘촘하게. 계획과 회고를 한 장에 정리하는 사람을 위한 노트.",
      createdAt: t - 1000 * 60 * 60 * 24 * 58,
      updatedAt: t - 1000 * 60 * 45,
    },
    {
      id: makeId("p"),
      name: "브루잉 원두 200g (미디엄 로스트)",
      category: "커피",
      price: 14800,
      stock: 0,
      rating: 4.9,
      tags: ["sold-out"],
      active: true,
      description:
        "산미는 얇고 단맛은 길게. 핸드드립에 최적화된 블렌드.",
      createdAt: t - 1000 * 60 * 60 * 24 * 12,
      updatedAt: t - 1000 * 60 * 60 * 24 * 1,
    },
    {
      id: makeId("p"),
      name: "포스터 A2 (VDOM / Polling)",
      category: "굿즈",
      price: 9000,
      stock: 18,
      rating: 4.2,
      tags: ["art"],
      active: true,
      description:
        "벽에 붙이면 팀의 대화가 빨라진다. VDOM은 가볍게, 변경은 정확하게.",
      createdAt: t - 1000 * 60 * 60 * 24 * 85,
      updatedAt: t - 1000 * 60 * 60 * 24 * 18,
    },
    {
      id: makeId("p"),
      name: "스티커 팩 (5종)",
      category: "굿즈",
      price: 3000,
      stock: 42,
      rating: 4.3,
      tags: ["tiny"],
      active: true,
      description:
        "노트북, 텀블러, 케이스 어디든. 작지만 자주 보이는 메시지.",
      createdAt: t - 1000 * 60 * 60 * 24 * 9,
      updatedAt: t - 1000 * 60 * 60 * 8,
    },
    {
      id: makeId("p"),
      name: "티셔츠 (AEUI: let is state)",
      category: "의류",
      price: 21900,
      stock: 7,
      rating: 4.6,
      tags: ["soft"],
      active: true,
      description:
        "설명은 등판에, 실천은 코드에. 세탁해도 문구는 남는다(아마도).",
      createdAt: t - 1000 * 60 * 60 * 24 * 33,
      updatedAt: t - 1000 * 60 * 60 * 5,
    },
    {
      id: makeId("p"),
      name: "키캡 (Tick Key, 4개)",
      category: "커스텀",
      price: 16000,
      stock: 4,
      rating: 4.1,
      tags: ["mechanical"],
      active: true,
      description:
        "tick처럼 규칙적인 타건감을 위해. 손끝에 남는 작은 재미.",
      createdAt: t - 1000 * 60 * 60 * 24 * 44,
      updatedAt: t - 1000 * 60 * 60 * 10,
    },
    {
      id: makeId("p"),
      name: "비활성 상품 (숨김 테스트)",
      category: "문구",
      price: 5000,
      stock: 99,
      rating: 3.8,
      tags: ["inactive"],
      active: false,
      description: "스토어에는 기본적으로 노출되지 않는다. 어드민에서 활성화 가능.",
      createdAt: t - 1000 * 60 * 60 * 24 * 6,
      updatedAt: t - 1000 * 60 * 60 * 24 * 3,
    },
  ];

  const cart = { items: [], couponCode: "" };

  const sampleOrderId = makeId("o");
  const orders = [
    {
      id: sampleOrderId,
      createdAt: t - 1000 * 60 * 60 * 26,
      status: "DELIVERED",
      customer: {
        name: "홍길동",
        email: "hong@example.com",
        address1: "서울시 어딘가 123",
        address2: "101호",
        zip: "04524",
      },
      items: [
        {
          productId: products[0].id,
          nameSnapshot: products[0].name,
          priceSnapshot: products[0].price,
          qty: 1,
        },
      ],
      totals: {
        subtotal: products[0].price,
        discount: 0,
        shipping: products[0].price >= 20000 ? 0 : 3000,
        tax: Math.floor(products[0].price * 0.10),
        total:
          products[0].price +
          Math.floor(products[0].price * 0.10) +
          (products[0].price >= 20000 ? 0 : 3000),
      },
    },
  ];

  const activity = [
    {
      at: t - 1000 * 60 * 12,
      type: "SYSTEM",
      message: "시드 데이터로 시작했습니다. 상단의 '초기화'로 언제든 리셋 가능합니다.",
    },
    {
      at: t - 1000 * 60 * 60 * 2,
      type: "ORDER",
      message: `샘플 주문이 존재합니다: ${sampleOrderId}`,
    },
  ];

  return { products, cart, orders, activity };
}
