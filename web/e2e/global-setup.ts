import { request } from "@playwright/test";
import { TEST_ACCOUNT } from "./helpers";

/**
 * Bảo đảm tài khoản e2e tồn tại đúng một lần, trước khi bất kỳ project nào chạy.
 *
 * Trước đây mỗi project tự đăng ký, nên hai project chạy song song cùng POST một
 * email và va nhau. Làm ở đây thì chỉ có một lần gọi, và cũng chỉ tốn một suất
 * trong bộ giới hạn brute-force 20 lần/15 phút của backend.
 */
export default async function globalSetup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4200";
  const context = await request.newContext({ baseURL });
  try {
    const response = await context.post("/api/auth/register", {
      headers: { "content-type": "application/json", origin: baseURL },
      data: TEST_ACCOUNT,
    });
    // 201 = vừa tạo, 409 = đã có từ lượt trước, 429 = bộ giới hạn auth đang bão
    // hoà nhưng tài khoản gần như chắc chắn đã tồn tại. Bước đăng nhập trong
    // test mới là bằng chứng quyết định, nên không dừng ở đây.
    if (![200, 201, 409, 429].includes(response.status())) {
      throw new Error(`Không chuẩn bị được tài khoản e2e: HTTP ${response.status()}`);
    }
  } finally {
    await context.dispose();
  }
}
