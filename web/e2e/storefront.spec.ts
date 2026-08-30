import { expect, test } from "@playwright/test";
import {
  TEST_ACCOUNT,
  TINY_PNG,
  apiJson,
  expectNoBrokenImages,
  expectNoHorizontalOverflow,
  expectTapTargets,
  firstProductHref,
  gotoReady,
  login,
  productNames,
  quickAddFirstProduct,
  watchConsole,
} from "./helpers";

type ApiProduct = { slug: string; name: string; sold?: number; price: number; variants?: Array<{ size: string; stock: number }> };
type HomePayload = { newArrivals: ApiProduct[]; bestSellers: ApiProduct[]; shop: { locations?: Array<{ latitude: number; longitude: number; address: string }> } };

// 1. Trang chủ dựng từ catalog thật của backend, không phải dữ liệu mẫu.
test("home renders the live JAPANO catalog", async ({ page }) => {
  // Chromium headless/SwiftShader có thể tự ghi cảnh báo ReadPixels khi hủy
  // WebGL context lúc điều hướng; đây không phải console của ứng dụng.
  const console_ = watchConsole(page, [/GL Driver Message.*GPU stall due to ReadPixels/i]);
  const response = await page.goto("/");
  expect(response?.ok()).toBeTruthy();

  // Tên khả truy cập được tính từ chữ đang hiển thị: dưới 640px dòng phụ
  // "Thời trang Nhật Bản" bị ẩn nên tên rút gọn lại — đúng theo WCAG 2.5.3.
  await expect(page.getByRole("link", { name: /^JAPANO.*Trang chủ$/i })).toBeVisible();
  await expect(page.locator(".api-notice")).toHaveCount(0);

  const home = await apiJson<HomePayload>(page, "/api/storefront/home");
  expect(home.newArrivals.length, "backend phải có hàng mới thật").toBeGreaterThan(0);

  const cards = page.locator(".product-card");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(4);
  await expect(page.locator(".product-card").filter({ hasText: home.newArrivals[0].name })).toHaveCount(1);

  await expectNoBrokenImages(page);
  await expectNoHorizontalOverflow(page);
  await expectTapTargets(page);
  console_.assertClean();
});

// Motion có chất lượng nhưng không được trở thành điều kiện để mua hàng.
// Kiểm tra riêng desktop: footage cục bộ thực sự phát, GSAP phản hồi giỏ/đơn
// và lớp chuyển trang xuất hiện; mobile/reduced-motion đã có test riêng.
test("cinematic motion enhances hero, cart, order and route transitions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "Footage cinematic được kiểm tra chuyển động ở desktop.");
  const console_ = watchConsole(page, [/GL Driver Message.*GPU stall due to ReadPixels/i]);
  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.dataset.cinematicMotion === "ready");
  await expect(page.locator(".hero-three")).toHaveAttribute("data-three-status", "ready", { timeout: 8_000 });
  const sakuraVideo = page.locator(".sakura-scene-video");
  await expect(sakuraVideo).toBeVisible();
  await expect(sakuraVideo).toHaveAttribute("src", /sakura-petal-rain\.mp4$/);
  const sakuraTime = await sakuraVideo.evaluate((video: HTMLVideoElement) => video.currentTime);
  await page.waitForTimeout(320);
  expect(await sakuraVideo.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(sakuraTime);

  const fuji = page.locator(".fuji-cinematic");
  await fuji.scrollIntoViewIfNeeded();
  await expect(fuji).toHaveAttribute("data-fuji-status", "ready", { timeout: 8_000 });
  const fujiVideo = fuji.locator(".fuji-scene-video");
  await expect(fujiVideo).toBeVisible();
  await expect(fujiVideo).toHaveAttribute("src", /fuji-birds-lake\.mp4$/);
  const fujiTime = await fujiVideo.evaluate((video: HTMLVideoElement) => video.currentTime);
  await page.waitForTimeout(320);
  expect(await fujiVideo.evaluate((video: HTMLVideoElement) => video.currentTime)).toBeGreaterThan(fujiTime);
  await expect(page.locator(".experience-split")).toHaveAttribute("data-fade-state", "visible");

  const spotlights = page.locator(".react-bits-spotlight");
  await expect(spotlights).toHaveCount(3);
  await spotlights.first().scrollIntoViewIfNeeded();
  const spotlightBox = await spotlights.first().boundingBox();
  expect(spotlightBox).not.toBeNull();
  await page.mouse.move(spotlightBox!.x + spotlightBox!.width * 0.7, spotlightBox!.y + spotlightBox!.height * 0.45);
  await expect.poll(() => spotlights.first().evaluate((element) => getComputedStyle(element).getPropertyValue("--spotlight-x").trim())).not.toBe("");

  const homeMap = page.locator(".store-map-live iframe");
  await homeMap.scrollIntoViewIfNeeded();
  await expect(homeMap).toBeVisible();
  await expect(homeMap).toHaveAttribute("src", /^https:\/\/www\.google\.com\/maps\/embed\?pb=/);

  const card = page.locator(".product-card").first();
  await card.hover();
  await card.locator(".quick-actions button").click();
  await expect(page.locator(".cinematic-cart-flight")).toHaveCount(1);
  await expect(page.locator(".cart-drawer")).toBeVisible();

  await page.evaluate(() => document.dispatchEvent(new CustomEvent("japano:order-success", {
    detail: { orderId: "E2E-MOTION", done: () => undefined },
  })));
  await expect(page.locator(".order-success-overlay")).toBeVisible();
  await expect(page.locator(".order-success-overlay")).toContainText("E2E-MOTION");
  await expect(page.locator(".order-success-overlay")).toBeHidden({ timeout: 3_000 });

  await page.goto("/");
  await page.waitForFunction(() => document.documentElement.dataset.cinematicMotion === "ready");
  await page.locator(".desktop-nav a", { hasText: "Hàng mới" }).click({ noWaitAfter: true });
  await expect(page.locator(".cinematic-route-brush")).toBeVisible({ timeout: 3_000 });
  await expect(page).toHaveURL(/\/hang-moi$/);
  console_.assertClean();
});

// 2. Hàng mới có dữ liệu và khớp đúng rail của backend.
test("new arrivals page mirrors the backend rail", async ({ page }) => {
  const console_ = watchConsole(page);
  const home = await apiJson<HomePayload>(page, "/api/storefront/home");
  expect(home.newArrivals.length).toBeGreaterThan(0);

  await page.goto("/hang-moi");
  await expect(page.getByRole("heading", { level: 1, name: "Hàng mới" })).toBeVisible();
  const rendered = await productNames(page);
  expect(rendered.length).toBe(home.newArrivals.length);
  for (const product of home.newArrivals) expect(rendered).toContain(product.name);
  console_.assertClean();
});

// 3. Bán chạy chỉ xếp hạng từ đơn thật; không sản phẩm nào được gắn nhãn giả.
test("best sellers carry real sales, never a decorative badge", async ({ page }) => {
  const console_ = watchConsole(page);
  const home = await apiJson<HomePayload>(page, "/api/storefront/home");
  expect(home.bestSellers.length, "cần ít nhất một sản phẩm bán chạy thật").toBeGreaterThan(0);
  for (const product of home.bestSellers) expect(Number(product.sold || 0)).toBeGreaterThan(0);

  await page.goto("/ban-chay");
  const cards = page.locator(".product-card");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBe(home.bestSellers.length);

  // Mỗi thẻ mang nhãn "Bán chạy" đều phải kèm số lượng đã bán thật.
  const labelled = page.locator(".product-card", { has: page.locator(".product-label", { hasText: "Bán chạy" }) });
  const labelledCount = await labelled.count();
  for (let index = 0; index < labelledCount; index += 1) {
    await expect(labelled.nth(index).locator(".product-meta")).toContainText(/Đã bán \d+/);
  }
  console_.assertClean();
});

// 4. Tìm kiếm / lọc / sắp xếp nằm trên URL nên chia sẻ và tải lại được.
test("search, filter and sort stay addressable in the URL", async ({ page }) => {
  const console_ = watchConsole(page);
  await gotoReady(page, "/san-pham");
  const total = await page.locator(".product-card").count();
  expect(total).toBeGreaterThan(4);

  await page.getByPlaceholder(/Tìm kimono/i).fill("kimono");
  // URL được ghi trong một transition của router, nên chờ rộng tay hơn mặc định.
  await expect(page).toHaveURL(/q=kimono/, { timeout: 15_000 });
  await expect(page.locator(".product-card").first()).toBeVisible();
  const filtered = await page.locator(".product-card").count();
  expect(filtered).toBeLessThan(total);

  await page.getByLabel("Sắp xếp sản phẩm").selectOption("price-asc");
  await expect(page).toHaveURL(/sap-xep=price-asc/, { timeout: 15_000 });

  // Tải lại: bộ lọc phải sống sót vì nó nằm trên URL chứ không trong state.
  await page.reload();
  await expect(page.getByPlaceholder(/Tìm kimono/i)).toHaveValue("kimono");
  const prices = await page.locator(".price-line strong").allTextContents();
  const numeric = prices.map((value) => Number(value.replace(/\D/g, "")));
  expect(numeric).toEqual([...numeric].sort((left, right) => left - right));

  await page.getByRole("button", { name: "Đặt lại" }).click();
  await expect(page).toHaveURL(/\/san-pham$/, { timeout: 15_000 });
  console_.assertClean();
});

// 5. PDP: chọn màu, size và phản ánh tồn kho thật.
test("product detail exposes real colours, sizes and stock", async ({ page }) => {
  const console_ = watchConsole(page);
  await gotoReady(page, "/san-pham");
  const href = await firstProductHref(page);
  await gotoReady(page, href);

  const slug = href.split("/").pop() as string;
  const payload = await apiJson<{ product: ApiProduct }>(page, `/api/products/${slug}`);
  const sellable = (payload.product.variants || []).filter((variant) => variant.stock > 0);
  expect(sellable.length, "sản phẩm mẫu phải còn hàng").toBeGreaterThan(0);

  await expect(page.getByRole("heading", { level: 1, name: payload.product.name })).toBeVisible();

  const colours = page.locator(".color-options button");
  await expect(colours.first()).toBeVisible();
  // Không màu nào được hiển thị là "undefined" — biến thể thiếu colorName phải
  // rơi về "Mặc định" chứ không lộ giá trị rỗng của dữ liệu.
  for (const label of await colours.allInnerTexts()) expect(label).not.toContain("undefined");
  if (await colours.count() > 1) {
    await colours.nth(1).click();
    await expect(colours.nth(1)).toHaveAttribute("aria-pressed", "true");
  }

  const sizes = page.locator(".size-options button");
  const sizeLabels = await sizes.allInnerTexts();
  const expectedSizes = new Set(sellable.map((variant) => variant.size));
  for (const label of sizeLabels) expect([...expectedSizes].some((size) => label.startsWith(size))).toBeTruthy();
  await sizes.last().click();
  await expect(sizes.last()).toHaveAttribute("aria-pressed", "true");

  await expect(page.getByRole("button", { name: /Thêm vào giỏ/i })).toBeEnabled();
  await expect(page.getByRole("link", { name: /Thử sản phẩm này trên ảnh của bạn/i })).toHaveAttribute("href", new RegExp(`/thu-do\\?product=${slug}`));
  await expectTapTargets(page);
  console_.assertClean();
});

// 6. Thêm nhanh từ lưới và chỉnh số lượng trong ngăn giỏ hàng.
test("quick-add fills the cart and quantity controls work", async ({ page }) => {
  const console_ = watchConsole(page);
  await gotoReady(page, "/san-pham");
  const card = page.locator(".product-card").first();
  await card.scrollIntoViewIfNeeded();
  const name = (await card.locator(".product-name").textContent())?.trim() || "";
  await card.locator(".quick-actions button").click();

  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name })).toBeVisible();
  await expect(page.getByRole("button", { name: /Mở giỏ hàng, 1 sản phẩm/ })).toBeVisible();

  await drawer.locator(".quantity button").nth(1).click();
  await expect(page.getByRole("button", { name: /Mở giỏ hàng, 2 sản phẩm/ })).toBeVisible();
  await drawer.locator(".quantity button").first().click();
  await expect(page.getByRole("button", { name: /Mở giỏ hàng, 1 sản phẩm/ })).toBeVisible();

  // Giỏ sống sót qua điều hướng vì được ghi xuống thiết bị.
  await gotoReady(page, "/gio-hang");
  await expect(page.getByRole("link", { name })).toBeVisible();
  await expect(page.locator(".cart-table .quantity span").first()).toHaveText("1");
  console_.assertClean();
});

// 7. Wishlist lưu trên thiết bị và hiện lại ở trang Yêu thích.
test("wishlist persists across navigation", async ({ page }) => {
  const console_ = watchConsole(page);
  await gotoReady(page, "/san-pham");
  const card = page.locator(".product-card").first();
  await card.scrollIntoViewIfNeeded();
  const name = (await card.locator(".product-name").textContent())?.trim() || "";
  const heart = card.getByRole("button", { name: /vào yêu thích/ });
  await heart.click();
  await expect(card.getByRole("button", { name: /khỏi yêu thích/ })).toHaveAttribute("aria-pressed", "true");

  await page.goto("/yeu-thich");
  await expect(page.locator(".product-card")).toHaveCount(1);
  expect(await productNames(page)).toEqual([name]);
  console_.assertClean();
});

// 8. Giỏ khách được hợp nhất vào tài khoản sau khi đăng nhập thật.
test("guest cart merges into the account after a real login", async ({ page }) => {
  const console_ = watchConsole(page);
  // Tài khoản đã được chuẩn bị một lần trong global setup.
  await gotoReady(page, "/san-pham");
  const name = await quickAddFirstProduct(page);
  await gotoReady(page, "/gio-hang");
  await page.locator(".cart-table .quantity button").nth(1).click();
  await expect(page.getByRole("button", { name: /Mở giỏ hàng, 2 sản phẩm/ })).toBeVisible();

  const response = await login(page);
  expect(response.status(), `đăng nhập phải thành công thật (nhận ${response.status()}; 429 nghĩa là bộ giới hạn auth của backend đang bão hoà)`).toBe(200);
  const body = await response.json();
  expect(body.user?.email).toBe(TEST_ACCOUNT.email);
  // JWT không bao giờ được trả về cho JavaScript của trang.
  expect(body.token, "token phải bị BFF giữ lại").toBeUndefined();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain("eyJ");

  await expect(page.getByRole("heading", { name: /Không gian của bạn/ })).toBeVisible();
  // Sau merge, sản phẩm và số lượng của khách vẫn còn nguyên.
  await expect(page.getByRole("button", { name: /Mở giỏ hàng, [2-9] sản phẩm/ })).toBeVisible();
  await gotoReady(page, "/gio-hang");
  await expect(page.getByRole("link", { name })).toBeVisible();
  await expect(page.locator(".cart-table .quantity span").first()).toHaveText("2");
  console_.assertClean();
});

// 9. Voucher do backend quyết định; giao diện không tự bịa giảm giá.
test("voucher validation comes from the backend", async ({ page }) => {
  // Voucher sai bị backend từ chối bằng HTTP 400 — trình duyệt ghi một dòng
  // "Failed to load resource" cho chính phản hồi đó, đây là hành vi đúng.
  const console_ = watchConsole(page, [/Failed to load resource.*40\d/]);
  await gotoReady(page, "/san-pham");
  await quickAddFirstProduct(page);
  await gotoReady(page, "/thanh-toan");

  const summary = page.locator(".order-summary");
  await expect(summary).toBeVisible();
  await page.getByPlaceholder("Nhập mã…").fill("khong-ton-tai-2026");

  const [rejection] = await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/vouchers/validate")),
    page.getByRole("button", { name: "Áp dụng" }).click(),
  ]);
  expect(rejection.status(), "backend phải là bên từ chối voucher").toBe(400);
  const message = String((await rejection.json()).message);

  // Thông báo hiển thị đúng câu của backend, và không có dòng ưu đãi nào.
  await expect(summary).toContainText(message);
  await expect(summary.locator("dt", { hasText: "Ưu đãi" })).toHaveCount(0);
  console_.assertClean();
});

// 10. Store locator có JAPANO Store QTSC9 và chỉ tải Google Maps khi được mở.
test("store locator lists JAPANO QTSC9 and lazy-loads the supplied Google map", async ({ page }) => {
  const console_ = watchConsole(page);
  await gotoReady(page, "/cua-hang");
  await expect(page.getByRole("heading", { name: /Gặp JAPANO ngoài màn hình/i })).toBeVisible();

  const shop = await apiJson<HomePayload["shop"]>(page, "/api/shop");
  const store = shop.locations?.[0];
  expect(store?.latitude).toBe(10.8537915);
  expect(store?.longitude).toBe(106.6260636);

  const card = page.locator(".store-card").first();
  await expect(card).toContainText("QTSC9");
  await expect(card.getByRole("link", { name: /Chỉ đường/i })).toHaveAttribute("href", /10\.8537915,106\.6260636/);

  const openMap = page.getByRole("button", { name: /Mở bản đồ tương tác/i });
  const mapFrame = page.locator("iframe.map-embed");
  await expect(openMap).toBeVisible();
  await expect(mapFrame).toHaveCount(0);
  await openMap.click();
  await expect(mapFrame).toBeVisible();
  await expect(mapFrame).toHaveAttribute("src", /^https:\/\/www\.google\.com\/maps\/embed\?pb=/);
  console_.assertClean();
});

// 11. 360 và 390 không tràn ngang và không có nút dưới 44x44.
for (const width of [360, 390]) {
  test(`mobile ${width} has no horizontal overflow or tiny targets`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    const page = await context.newPage();
    const console_ = watchConsole(page);
    for (const path of ["/", "/san-pham", "/thu-do", "/du-lich-nhat-ban", "/cua-hang", "/gio-hang", "/dang-nhap"]) {
      await gotoReady(page, path);
      await expectNoHorizontalOverflow(page);
      await expectTapTargets(page);
      await expectNoBrokenImages(page);
    }
    console_.assertClean();
    await context.close();
  });
}

// 12. Điều hướng bằng bàn phím: skip link, tiêu điểm và Escape.
test("keyboard navigation reaches the skip link, cart and back out", async ({ page }) => {
  const console_ = watchConsole(page);
  await gotoReady(page, "/san-pham");

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: /Chuyển tới nội dung chính/ });
  await expect(skipLink).toBeFocused();
  // Skip link trượt vào bằng transition; đợi nó dừng hẳn trong khung nhìn.
  await expect.poll(
    async () => Math.round((await skipLink.boundingBox())?.y ?? -999),
    { message: "skip link phải hiện ra khi được focus" },
  ).toBeGreaterThanOrEqual(0);

  const cartButton = page.getByRole("button", { name: /Mở giỏ hàng/ });
  await cartButton.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(page.getByRole("button", { name: /Đóng giỏ hàng/ }).last()).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(cartButton).toBeFocused();

  const outline = await cartButton.evaluate((element) => getComputedStyle(element).outlineWidth);
  expect(outline).not.toBe("0px");
  console_.assertClean();
});

// 13. prefers-reduced-motion tắt hiệu ứng trang trí thật sự.
test("reduced motion neutralises decorative animation", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".hero-three")).toHaveAttribute("data-three-status", "fallback");
  await expect(page.locator(".fuji-cinematic")).toHaveAttribute("data-fuji-status", "fallback");

  const durations = await page.evaluate(() => {
    const read = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      return { animation: style.animationDuration, transition: style.transitionDuration };
    };
    const sakura = document.querySelector<HTMLVideoElement>(".sakura-scene-video");
    const fuji = document.querySelector<HTMLVideoElement>(".fuji-scene-video");
    return {
      sakura: read(".sakura-scene-video"),
      fuji: read(".fuji-scene-video"),
      cue: read(".scroll-cue svg"),
      button: read(".button.primary"),
      videosPaused: Boolean(sakura?.paused && fuji?.paused),
    };
  });
  const seconds = (value: string) => value.split(",").map((part) => (part.trim().endsWith("ms") ? Number.parseFloat(part) / 1000 : Number.parseFloat(part)));
  for (const entry of [durations.sakura, durations.fuji, durations.cue, durations.button]) {
    expect(entry).not.toBeNull();
    for (const value of seconds(entry!.animation)) expect(value).toBeLessThanOrEqual(0.001);
    for (const value of seconds(entry!.transition)) expect(value).toBeLessThanOrEqual(0.001);
  }
  expect(durations.videosPaused).toBeTruthy();
  await context.close();
});

// 14. Hợp đồng try-on chạy được trong CI bằng stub, không cần GPU.
test("try-on studio follows the real async job contract (stubbed)", async ({ page }) => {
  const console_ = watchConsole(page);
  const stages: string[] = [];
  let polls = 0;

  await page.route("**/api/stylist/body-analysis", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, measurementStatus: "insufficient_evidence", measurementMessage: "Chưa đủ bằng chứng để đo cơ thể từ ảnh này.", tryOnEligible: true }),
  }));
  await page.route("**/api/gpu/focus", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }));
  await page.route("**/api/tryon/motion/presets", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"presets":[{"id":"walk_natural","label":"Bước đi tự nhiên"}]}' }));
  await page.route("**/api/tryon/jobs", (route) => route.fulfill({
    status: 202,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, job: { id: "stub-job", type: "tryon", status: "queued", stage: "Đang xếp hàng" } }),
  }));
  await page.route("**/api/tryon/jobs/stub-job", (route) => {
    polls += 1;
    const job = polls < 2
      ? { id: "stub-job", status: "running", stage: "Đang tạo ảnh thử đồ thật" }
      : { id: "stub-job", status: "completed", stage: "Hoàn tất", result: { ok: true, imageBase64: TINY_PNG.toString("base64"), engine: "stub", durationMs: 41000 } };
    stages.push(job.status);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, job }) });
  });

  await gotoReady(page, "/thu-do");
  await expect(page.getByRole("button", { name: /Phân tích & thử ngay/ })).toBeVisible();
  await page.setInputFiles('input[type="file"]', { name: "nguoi-that.png", mimeType: "image/png", buffer: TINY_PNG });
  // Ảnh đọc bằng FileReader nên phải đợi nó lên khung xem trước.
  await expect(page.locator(".tryon-canvas img")).toBeVisible();
  await page.locator(".consent input").first().check();
  const start = page.getByRole("button", { name: /Phân tích & thử ngay/ });
  await expect(start).toBeEnabled();
  await start.click();

  await expect(page.locator(".tryon-canvas img")).toHaveAttribute("src", /^data:image\/png;base64,/, { timeout: 30_000 });
  await expect(page.getByText("Chưa đủ dữ liệu để đo")).toBeVisible();
  await expect(page.getByRole("link", { name: /Lưu ảnh/ })).toBeVisible();

  // Chỉ hiện trạng thái thật của job; không có thanh phần trăm bịa ra.
  expect(stages).toContain("running");
  expect(stages).toContain("completed");
  expect(await page.locator(".tryon-workspace").innerText()).not.toMatch(/\b\d{1,3}\s?%/);
  console_.assertClean();
});
