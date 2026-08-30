import { expect, type Page, type Response } from "@playwright/test";

export const TEST_ACCOUNT = {
  name: "JAPANO Web E2E",
  email: process.env.JAPANO_E2E_EMAIL || "web-e2e@japano.test",
  password: process.env.JAPANO_E2E_PASSWORD || "JapanoWebE2E!2026",
};

/**
 * Bắt lỗi console cho mọi test. Yêu cầu của bài: không còn console error,
 * hydration mismatch hay cảnh báo key của React ở bất kỳ trang nào.
 */
export function watchConsole(page: Page, ignore: RegExp[] = []) {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error" && message.type() !== "warning") return;
    const text = message.text();
    // Bỏ qua nhiễu của trình duyệt về tài nguyên bên thứ ba khi chạy ngoại tuyến.
    if (/favicon|Download the React DevTools/i.test(text)) return;
    if (ignore.some((pattern) => pattern.test(text))) return;
    problems.push(`${message.type()}: ${text}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  return {
    problems,
    assertClean() {
      expect(problems, `Console phải sạch, nhận được:\n${problems.join("\n")}`).toEqual([]);
    },
  };
}

/** Không có tràn ngang thật, kể cả khi bỏ chốt `body { overflow-x: hidden }`. */
export async function expectNoHorizontalOverflow(page: Page) {
  // Nội dung SSR có thể đã nhìn thấy trước khi root client hydrate xong. Chờ
  // marker này trước khi test tạm ghi style lên <body>, nếu không chính test
  // sẽ tạo ra một hydration mismatch giả.
  await page.waitForFunction(() => document.documentElement.dataset.cinematicMotion === "ready");
  const overflow = await page.evaluate(() => {
    const previous = document.body.style.overflowX;
    document.body.style.overflowX = "visible";
    void document.body.offsetWidth;
    const value = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) - window.innerWidth;
    document.body.style.overflowX = previous;
    return value;
  });
  expect(overflow, "trang không được cuộn ngang").toBeLessThanOrEqual(1);
}

/**
 * Không control tương tác nào nhỏ hơn 44x44.
 * Checkbox/radio gốc được tính theo `<label>` bao quanh — đúng cách WCAG 2.5.8
 * đo mục tiêu, vì bấm vào nhãn cũng đổi trạng thái.
 */
export async function expectTapTargets(page: Page) {
  const small = await page.evaluate(() => {
    const selector = "a[href], button, input[type=checkbox], input[type=radio], select, [role=button]";
    const bad: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (rect.width <= 0 || rect.height <= 0) continue;
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (rect.width >= 44 && rect.height >= 44) continue;
      if (element.tagName === "INPUT") {
        const label = element.closest("label");
        const labelRect = label?.getBoundingClientRect();
        if (labelRect && labelRect.width >= 44 && labelRect.height >= 44) continue;
      }
      const name = element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName;
      bad.push(`${name.slice(0, 30)} ${Math.round(rect.width)}x${Math.round(rect.height)}`);
    }
    return bad;
  });
  expect(small, "mọi nút phải đạt tối thiểu 44x44").toEqual([]);
}

export async function expectNoBrokenImages(page: Page) {
  const broken = await page.evaluate(() => [...document.images]
    .filter((image) => image.complete && image.naturalWidth === 0)
    .map((image) => image.currentSrc || image.src));
  expect(broken, "không được có ảnh vỡ").toEqual([]);
}

/**
 * `.product-card` dùng `content-visibility: auto`, nên thẻ nằm ngoài khung nhìn
 * không có `innerText`. Đọc `textContent` để so khớp với dữ liệu backend.
 */
export async function productNames(page: Page) {
  return (await page.locator(".product-name").allTextContents()).map((value) => value.trim());
}

/** Thêm sản phẩm đầu tiên vào giỏ bằng nút Thêm nhanh và đóng ngăn giỏ hàng. */
export async function quickAddFirstProduct(page: Page) {
  await page.waitForLoadState("networkidle");
  const card = page.locator(".product-card").first();
  await card.scrollIntoViewIfNeeded();
  const name = (await card.locator(".product-name").textContent())?.trim() || "";
  await card.locator(".quick-actions button").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  return name;
}

/**
 * Điều hướng rồi đợi trang hydrate xong.
 *
 * HTML từ máy chủ đã có sẵn ô tìm kiếm và input file, nhưng trình xử lý sự kiện
 * của React chỉ gắn sau khi hydrate. Gõ hoặc nạp file trước thời điểm đó thì
 * thao tác rơi vào khoảng trống — đây là ràng buộc của test, không phải lỗi
 * hiển thị.
 */
export async function gotoReady(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

export async function firstProductHref(page: Page) {
  const href = await page.locator('.product-card a[href^="/san-pham/"]').first().getAttribute("href");
  expect(href, "catalog phải có ít nhất một sản phẩm thật").toBeTruthy();
  return href as string;
}

/** Đọc thẳng backend qua BFF same-origin để so giao diện với dữ liệu thật. */
export async function apiJson<T>(page: Page, path: string): Promise<T> {
  const response = await page.request.get(path);
  expect(response.ok(), `${path} phải trả 200, nhận ${response.status()}`).toBeTruthy();
  return response.json() as Promise<T>;
}

export async function login(page: Page) {
  await gotoReady(page, "/dang-nhap");
  await page.getByLabel("Email", { exact: true }).fill(TEST_ACCOUNT.email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(TEST_ACCOUNT.password);
  const [response] = await Promise.all([
    page.waitForResponse((res: Response) => res.url().includes("/api/auth/login") && res.request().method() === "POST"),
    page.getByRole("button", { name: "Đăng nhập", exact: true }).click(),
  ]);
  return response;
}

export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
