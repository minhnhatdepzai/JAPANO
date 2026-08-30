import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Smoke thật cho AI: gọi đúng hàng đợi bất đồng bộ mà storefront dùng và bắt
 * buộc phải nhận được ảnh/video mở được. Health 200 không được tính là đạt.
 *
 * Cần GPU nên mặc định bỏ qua:  JAPANO_E2E_REAL_AI=1 npm --prefix web run e2e
 */
const enabled = process.env.JAPANO_E2E_REAL_AI === "1";
const PERSON = process.env.JAPANO_E2E_PERSON_IMAGE
  || path.resolve(process.cwd(), "..", "test-assets/people/average/00858_00.jpg");
const OUT = process.env.JAPANO_E2E_ARTIFACT_DIR || path.resolve(process.cwd(), "test-results", "real-ai");

type Job<T> = { id: string; status: "queued" | "running" | "completed" | "failed" | "cancelled"; stage?: string; result?: T; error?: string };

test.describe("real AI smoke", () => {
  test.skip(!enabled, "Đặt JAPANO_E2E_REAL_AI=1 để chạy smoke AI thật trên GPU.");
  test.describe.configure({ mode: "serial", timeout: 15 * 60_000 });

  let tryOnImage = "";

  async function runJob<T>(request: import("@playwright/test").APIRequestContext, route: string, body: unknown) {
    const created = await request.post(route, { data: body });
    expect(created.status(), `${route} phải nhận job`).toBe(202);
    const job = (await created.json()).job as Job<T>;
    expect(job.id).toBeTruthy();
    expect(["queued", "running"]).toContain(job.status);

    const seen = new Set<string>([job.status]);
    const deadline = Date.now() + 13 * 60_000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      const poll = await request.get(`${route}/${job.id}`);
      expect(poll.ok()).toBeTruthy();
      const current = (await poll.json()).job as Job<T>;
      seen.add(current.status);
      if (current.status === "completed") {
        expect(current.result, "job hoàn tất phải kèm kết quả").toBeTruthy();
        return { result: current.result as T, seen };
      }
      if (current.status === "failed") throw new Error(`${route} thất bại: ${current.error}`);
      if (current.status === "cancelled") throw new Error(`${route} bị huỷ`);
    }
    throw new Error(`${route} quá thời gian chờ`);
  }

  test.beforeAll(() => {
    expect(fs.existsSync(PERSON), `thiếu ảnh người thật tại ${PERSON}`).toBeTruthy();
    fs.mkdirSync(OUT, { recursive: true });
  });

  // 15. Try-on thật phải trả ảnh thật.
  test("tryon job returns a real generated image", async ({ page, request }) => {
    await page.goto("/thu-do");
    const products = await (await request.get("/api/products")).json();
    const product = products.find((item: { slug: string; variants?: Array<{ stock: number }> }) => (item.variants || []).some((variant) => variant.stock > 0));
    expect(product, "cần một sản phẩm còn hàng").toBeTruthy();

    const personBase64 = `data:image/jpeg;base64,${fs.readFileSync(PERSON).toString("base64")}`;
    const { result, seen } = await runJob<{ imageBase64?: string; imageUrl?: string; engine?: string; durationMs?: number }>(
      request,
      "/api/tryon/jobs",
      { clientId: "japano-web-e2e", personImageBase64: personBase64, productId: product.slug, size: "M", qualityMode: "balanced" },
    );
    expect([...seen]).toContain("completed");

    const raw = String(result.imageBase64 || result.imageUrl || "");
    expect(raw, "backend phải trả ảnh thử đồ").toBeTruthy();
    const bytes = raw.startsWith("http")
      ? Buffer.from(await (await request.get(raw)).body())
      : Buffer.from(raw.replace(/^data:image\/[a-z+]+;base64,/, ""), "base64");
    // Ảnh thật, không phải placeholder 1x1 hay chuỗi rỗng.
    expect(bytes.length, "ảnh thử đồ phải là ảnh thật").toBeGreaterThan(50_000);
    const isPng = bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    expect(isPng || isJpeg, "ảnh phải là PNG hoặc JPEG hợp lệ").toBeTruthy();
    fs.writeFileSync(path.join(OUT, `tryon.${isPng ? "png" : "jpg"}`), bytes);
    tryOnImage = raw.startsWith("data:") ? raw : `data:image/${isPng ? "png" : "jpeg"};base64,${bytes.toString("base64")}`;
    console.log(`[real-ai] try-on ${bytes.length} bytes, engine=${result.engine}, ${result.durationMs}ms`);
  });

  // 16. Motion thật phải trả video mở được.
  test("motion job returns a playable MP4", async ({ request }) => {
    expect(tryOnImage, "cần kết quả thử đồ từ bước trước").toBeTruthy();
    const presets = await (await request.get("/api/tryon/motion/presets")).json();
    const motion = String(presets.presets?.[0]?.id || presets.presets?.[0]?.action || "walk_natural");

    const { result } = await runJob<{ videoUrl?: string }>(request, "/api/tryon/motion/jobs", {
      imageBase64: tryOnImage, motion, profile: "fast", clientId: "japano-web-e2e",
    });
    expect(result.videoUrl, "backend phải trả videoUrl").toBeTruthy();

    const video = await request.get(String(result.videoUrl));
    expect(video.ok()).toBeTruthy();
    const bytes = Buffer.from(await video.body());
    expect(bytes.length, "video phải có nội dung thật").toBeGreaterThan(100_000);
    // Hộp `ftyp` của ISO-BMFF: chứng minh file mở được, không phải rác.
    expect(bytes.subarray(4, 8).toString("ascii")).toBe("ftyp");
    fs.writeFileSync(path.join(OUT, "motion.mp4"), bytes);
    console.log(`[real-ai] motion ${bytes.length} bytes`);
  });

  // 17. Ghép cảnh Nhật thật phải trả ảnh ghép, giữ attribution.
  test("travel scene job returns a real composite", async ({ request }) => {
    expect(tryOnImage, "cần kết quả thử đồ từ bước trước").toBeTruthy();
    const catalog = await (await request.get("/api/japan-spots/catalog")).json();
    const spot = catalog.spots?.[0];
    expect(spot, "cần ít nhất một địa điểm Nhật").toBeTruthy();

    const { result } = await runJob<{ imageBase64?: string; imageUrl?: string; attribution?: string }>(
      request,
      "/api/japan-spots/scene-photo/jobs",
      { place: spot.place, prefecture: spot.prefecture, personImageBase64: tryOnImage },
    );
    const raw = String(result.imageBase64 || result.imageUrl || "");
    expect(raw, "backend phải trả ảnh ghép").toBeTruthy();
    const bytes = raw.startsWith("http")
      ? Buffer.from(await (await request.get(raw)).body())
      : Buffer.from(raw.replace(/^data:image\/[a-z+]+;base64,/, ""), "base64");
    expect(bytes.length, "ảnh ghép phải là ảnh thật").toBeGreaterThan(50_000);
    fs.writeFileSync(path.join(OUT, "travel.png"), bytes);
    console.log(`[real-ai] travel ${bytes.length} bytes, attribution=${result.attribution || "(kèm trong payload spot)"}`);
  });

  // DELETE phải huỷ được job đang chạy và giải phóng ảnh đầu vào.
  test("cancelling an in-flight job actually aborts it", async ({ request }) => {
    const personBase64 = `data:image/jpeg;base64,${fs.readFileSync(PERSON).toString("base64")}`;
    const created = await request.post("/api/tryon/jobs", {
      data: { clientId: "japano-web-e2e-cancel", personImageBase64: personBase64, productId: "yukata-xanh", size: "M" },
    });
    const job = (await created.json()).job as Job<unknown>;
    const cancelled = await request.delete(`/api/tryon/jobs/${job.id}`);
    expect(cancelled.ok()).toBeTruthy();
    expect((await cancelled.json()).job.status).toBe("cancelled");

    const after = await request.get(`/api/tryon/jobs/${job.id}`);
    expect((await after.json()).job.status).toBe("cancelled");
  });
});
