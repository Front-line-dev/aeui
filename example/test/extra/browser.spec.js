import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { root } from '../conformance/check.mjs';

const port = Number(process.env.AEUI_TEST_PORT || 43820);
const url = offset => `http://127.0.0.1:${port + offset}`;
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const messages = []; errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  page.on('console', message => { if (message.type() === 'error') messages.push(message.text()); });
});
test.afterEach(async ({ page }) => { expect(errors.get(page), '브라우저 실행 오류').toEqual([]); });

test('[CONFIG-BUILD.10] 생성 앱의 preview는 내부 이동과 동적 경로 새로고침을 처리하며 404 페이지를 남기지 않는다', async ({ page }) => {
  await page.goto(url(0));
  await expect(page.getByRole('heading', { name: 'AEUI App' })).toBeVisible();
  await page.getByRole('link', { name: 'Sample Product' }).click();
  await expect(page).toHaveURL(/\/products\/sample$/);
  await expect(page.locator('main')).toContainText('sample');
  await page.reload();
  await expect(page.locator('main')).toContainText('sample');
  await expect(page.locator('main')).not.toContainText('404');
});

test('[START-CLI.11] 개발 서버에서 페이지 파일을 수정하면 수동 새로고침 없이 새 화면이 나타난다', async ({ page }) => {
  const { project } = JSON.parse(fs.readFileSync(path.join(root, '.conformance/extra-context.json'), 'utf8'));
  const entry = path.join(project, 'src/pages/index.jsx');
  const original = fs.readFileSync(entry, 'utf8');
  await page.goto(url(5));
  await expect(page.getByRole('heading', { name: 'AEUI App' })).toBeVisible();
  try {
    fs.writeFileSync(entry, original.replace('AEUI App', 'Edited contract page'));
    await expect(page.getByRole('heading', { name: 'Edited contract page' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AEUI App', exact: true })).toHaveCount(0);
  } finally { fs.writeFileSync(entry, original); }
});

test('[REFERENCE-APPS.10] 기본 예제의 한 카운터 변경이 다른 인스턴스와 setup을 초기화하지 않는다', async ({ page }) => {
  await page.goto(url(2));
  const buttons = page.getByRole('button', { name: 'Increment', exact: true });
  await expect(buttons).toHaveCount(2);
  const first = buttons.nth(0).locator('..'), second = buttons.nth(1).locator('..');
  await buttons.nth(0).click();
  await expect(first).toContainText('Count: 1');
  await expect(second).toContainText('Count: 0');
  await buttons.nth(0).click();
  await expect(first).toContainText('Count: 2');
});

test('[REFERENCE-APPS.11] 깊은 비교 예제는 같은 값 재할당에 반응하지 않고 직접 변이에 한 번 반응한다', async ({ page }) => {
  await page.clock.install();
  await page.goto(url(3));
  await expect(page.getByRole('heading', { name: '1. Watch Deduplication' })).toBeVisible();
  await page.clock.runFor(5100);
  const equal = page.getByRole('heading', { name: '1. Watch Deduplication' }).locator('..');
  const set = page.getByRole('heading', { name: '2. Set In-Place Mutation' }).locator('..');
  await expect(equal).toContainText('Triggers: 0');
  await expect(set).toContainText('Triggers: 1');
  await expect(page.locator('body')).not.toContainText('FAIL:');
});

async function loadBuiltExample(page, offset) {
  const requested = [];
  page.on('request', request => requested.push(request.url()));
  // Only the local static build is available; compiler CDN requests cannot pass.
  await page.route('**/*', route => new URL(route.request().url()).origin === url(offset) ? route.continue() : route.abort());
  await page.goto(url(offset));
  await expect(page.locator('script[type="text/aeui-code"]')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.Babel)).toBe('undefined');
  expect(requested.every(request => new URL(request).origin === url(offset))).toBe(true);
  expect(requested.some(request => /\/assets\/[^/]+\.js$/.test(new URL(request).pathname))).toBe(true);
}

test('[REFERENCE-APPS.12] 빌드한 props 예제는 웹 컴파일러 없이 부모·자식을 갱신한다', async ({ page }) => {
  await loadBuiltExample(page, 4);
  await page.getByRole('button', { name: "Increment Parent's Let Variable" }).click();
  await expect(page.locator('#root')).toContainText('Local Count: 1');
  await expect(page.locator('strong')).toHaveText('1');
  await expect(page.locator('pre')).toHaveCount(0);
});

test('[REFERENCE-APPS.13] 빌드한 장바구니는 웹 컴파일러 없이 항목을 유지하며 수량·합계를 갱신한다', async ({ page }) => {
  await loadBuiltExample(page, 6);
  await expect(page.locator('li')).toHaveCount(3);
  const first = page.locator('li').first();
  await first.evaluate(node => { node.dataset.identity = 'retained'; });
  await first.getByRole('button', { name: '+', exact: true }).click();
  await expect(page.getByRole('heading', { name: '총 합계: 21000원' })).toBeVisible();
  await expect(first).toHaveAttribute('data-identity', 'retained');
  await expect(first.locator('span').nth(1)).toHaveText('2');
});

function field(scope, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return scope.locator('.formRow').filter({ has: scope.locator('.label', { hasText: new RegExp(`^${escaped}$`) }) }).locator('input, textarea, select');
}

async function checkout(page) {
  await page.goto(url(1) + '/');
  await page.locator('.card--product').first().getByRole('button', { name: '장바구니 담기' }).click();
  await page.locator('a[href="/cart"]').first().click();
  await page.getByRole('link', { name: '체크아웃', exact: true }).click();
  for (const [label, value] of [['이름', 'Contract Buyer'], ['이메일', 'buyer@example.invalid'], ['주소 1', 'Test street'], ['우편번호', '00000']]) await field(page, label).fill(value);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '다음', exact: true }).click();
}

test('[REFERENCE-APPS.14] 상품 생성부터 쿠폰·주문·배송 완료와 새로고침까지 유지되며 중복 주문을 만들지 않는다', async ({ page }) => {
  // 결제 실패 확률을 제거하기 위해 난수를 고정한다. ID의 시각 부분과 상태 변경 경로는 유지한다.
  await page.addInitScript(() => { Math.random = () => 0.8; });
  await page.goto(url(1) + '/admin/products');
  await page.getByRole('button', { name: '새 상품', exact: true }).click();
  const dialog = page.getByRole('dialog');
  for (const [label, value] of [['상품명', 'Contract Product'], ['카테고리', 'Contract'], ['가격 (원)', '10000'], ['재고', '8']]) {
    await dialog.locator('.formRow').filter({ has: page.locator('.label').filter({ hasText: label }) }).locator('input').fill(value);
  }
  await dialog.getByRole('button', { name: '저장', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.locator('a[href="/"]').first().click();
  const card = page.locator('.card--product').filter({ hasText: 'Contract Product' });
  await expect(card).toHaveCount(1);
  const detailUrl = await card.getByRole('link', { name: '상세' }).getAttribute('href');
  await card.getByRole('button', { name: '장바구니 담기' }).click();
  await page.locator('a[href="/cart"]').first().click();
  await page.getByPlaceholder('AEUI10').fill('AEUI10');
  await page.getByRole('button', { name: '적용', exact: true }).click();
  await expect(page.locator('.pill').filter({ hasText: '할인' })).toContainText('1,000');
  await page.getByRole('link', { name: '체크아웃', exact: true }).click();
  for (const [label, value] of [['이름', 'Contract Buyer'], ['이메일', 'buyer@example.invalid'], ['주소 1', 'Test street'], ['우편번호', '00000']]) await field(page, label).fill(value);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await page.getByRole('button', { name: '주문하기', exact: true }).click();
  await expect(page.getByRole('button', { name: '처리 중...' })).toBeDisabled();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('aeui-commerce-admin:v1')).data.orders.filter(order => order.customer.name === 'Contract Buyer').length)).toBe(1);
  const orderId = await page.evaluate(() => JSON.parse(localStorage.getItem('aeui-commerce-admin:v1')).data.orders.find(order => order.customer.name === 'Contract Buyer').id);
  await page.locator('a[href="/orders"]').first().click();
  await expect(page.locator('body')).toContainText('Contract Product');
  await page.locator('a[href="/admin"]').first().click();
  await page.locator('a[href="/admin/orders"]').click();
  const row = page.locator('tr').filter({ hasText: orderId.slice(0, 12) });
  await row.click();
  const status = field(page, '상태 변경');
  await expect(status).toHaveValue('PAID');
  await status.selectOption('SHIPPED');
  await expect(status).toHaveValue('SHIPPED');
  await status.selectOption('DELIVERED');
  await expect(status).toHaveValue('DELIVERED');
  await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem('aeui-commerce-admin:v1')).data.orders.find(order => order.id === id).status, orderId)).toBe('DELIVERED');
  await page.reload();
  await page.locator('tr').filter({ hasText: orderId.slice(0, 12) }).click();
  await expect(field(page, '상태 변경')).toHaveValue('DELIVERED');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('aeui-commerce-admin:v1')).data.orders.filter(order => order.customer.name === 'Contract Buyer').length)).toBe(1);
  await page.goto(url(1) + detailUrl);
  await page.reload();
  await expect(page.locator('.main')).toContainText('Contract Product');
  await expect(page.locator('.main')).not.toContainText('페이지를 찾을 수 없습니다');
});

test('[REFERENCE-APPS.15] 결제 대기 중 route를 이탈하면 주문·재고·장바구니를 변경하지 않는다', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.8; });
  await page.clock.install();
  await checkout(page);
  const snapshot = () => page.evaluate(() => { const { orders, products, cart } = JSON.parse(localStorage.getItem('aeui-commerce-admin:v1')).data; return { orders, products, cart }; });
  const before = await snapshot();
  await page.getByRole('button', { name: '주문하기', exact: true }).click();
  await expect(page.getByRole('button', { name: '처리 중...' })).toBeDisabled();
  await page.locator('a[href="/orders"]').first().click();
  await expect(page).toHaveURL(/\/orders$/);
  await page.clock.runFor(3500);
  expect(await snapshot()).toEqual(before);
});
