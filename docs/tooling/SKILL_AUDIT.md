# Audit skill và MCP đang cài trong repo

Ngày kiểm tra: **2026-08-28**. Người kiểm tra: phiên làm việc trên SHA gốc
`fb856f9b4`. Phạm vi: mọi thứ nằm trong `.claude/` và mọi MCP server được cấu
hình cho project này.

> [!NOTE]
> Skill đã được cài từ một phiên trước đó. Phiên này **không cài thêm gì** — nó
> kiểm tra lại những thứ đang có. Vì vậy mục "commit SHA đã pin lúc cài" là một
> khoảng trống thật sự, không phải thiếu sót của lần kiểm tra này.

## Tóm tắt rủi ro

| Mức | Số lượng | Nội dung |
|---|---|---|
| 🔴 Cao | 1 | `gitnexus` chạy dưới license **PolyForm-Noncommercial-1.0.0** |
| 🟠 Trung bình | 3 | `graphify` không khai báo license; skill nội bộ ghi `gitnexus@latest` không pin; repo nguồn trong yêu cầu là fork đã cũ |
| 🟢 Thấp | — | Không có script thực thi, không hook, không postinstall, không secret |

## Kết quả quét an toàn

Đây là kết quả có ý nghĩa nhất của audit: **toàn bộ skill là tài liệu tĩnh**.

| Hạng mục | Kết quả |
|---|---|
| File thực thi (`.sh`, `.py`, `.js`, `.mjs`) | **0** |
| File có bit execute | **0** |
| `package.json` / `postinstall` | **0** |
| `.claude/settings.json` hoặc `.claude/hooks/` | **không tồn tại** |
| Mẫu `curl \| bash`, `wget \| sh`, `eval(`, `npm i -g`, `sudo`, `chmod +x` | **0 kết quả** |
| Secret cứng (api key, token, password, `ghp_`, `sk-…`) | **0 kết quả** |
| Loại file thực tế | 24 `.md`, 6 `.json`, 1 `LICENSE`, 1 file version |

Không có gì trong `.claude/` tự chạy được. Rủi ro còn lại nằm ở **MCP server** —
thứ chạy code thật — chứ không ở skill.

## Từng nguồn

### 1. drawio — 🟢 dùng được

| Mục | Giá trị |
|---|---|
| URL trong yêu cầu | <https://github.com/jgraph/drawio-mcp> |
| SHA upstream lúc kiểm tra | `14b318b19cc37b159f841227b9d11fbd18ce18ea` |
| License | **Apache-2.0** — cho phép thương mại |
| File đã ghi vào repo | `.claude/skills/drawio/` (3 file, 80 KB) |
| Command / hook / postinstall | không có |
| Rủi ro | Không. Chỉ là hướng dẫn sinh XML Draw.io native. |

### 2. dashboard-design — 🟢 dùng được

| Mục | Giá trị |
|---|---|
| URL | <https://github.com/mares29/dashboard-design-skill> |
| SHA upstream lúc kiểm tra | `bbed535a08f0e1768b40087996fe019370312374` |
| License | **MIT** (có file `LICENSE`, © 2026 Karel Mares) |
| File đã ghi | `.claude/skills/dashboard-design/` (3 file, 32 KB) |
| Rủi ro | Không. |

### 3. graphify — 🟠 license không rõ

| Mục | Giá trị |
|---|---|
| URL | <https://github.com/darce07/graphify-claude-skill> |
| SHA upstream lúc kiểm tra | `d3e392967dcd6aa17db1a5c29e52fb33208288f5` |
| License | **không khai báo** — GitHub API trả về rỗng |
| File đã ghi | `.claude/skills/graphify/` (11 file, 120 KB) |
| Rủi ro | Không có license nghĩa là mặc định **giữ toàn quyền tác giả**. Về mặt pháp lý, việc sao chép vào repo này chưa được cấp phép rõ ràng. |
| Khuyến nghị | Chỉ dùng nội bộ cho sơ đồ kiến trúc như yêu cầu; **không phát hành lại**. Nếu định public repo, hỏi tác giả hoặc gỡ. |

### 4. gitnexus — 🔴 license phi thương mại

Đây là phát hiện quan trọng nhất, và nó **khác với những gì yêu cầu mô tả**.

| Mục | Giá trị |
|---|---|
| URL trong yêu cầu | <https://github.com/harryweiser/gitnexus> |
| Thực tế repo đó là | **fork** của `abhigyanpatwari/GitNexus`, push lần cuối **2026-05-02** (cũ ~4 tháng) |
| Upstream thật | `abhigyanpatwari/GitNexus`, push **2026-08-28**, 46.067 sao |
| Cái đang CHẠY | `npx -y gitnexus@1.6.10 mcp` — lấy từ **npm**, tức là từ upstream, không phải từ fork |
| License gói npm | **PolyForm-Noncommercial-1.0.0** |
| Cấu hình MCP | `~/.claude.json`, scope project; `env` **rỗng** (không secret) |
| File đã ghi | 7 thư mục skill `.claude/skills/gitnexus-*` (~88 KB) |
| Index sinh ra | `.gitnexus/` — **184 MB**, đã nằm trong `.gitignore` ✅ |

**Vì sao đáng lưu ý:** PolyForm-Noncommercial cấm dùng cho mục đích thương mại.
JAPANO đang được mô tả là đồ án/nghiên cứu nên hiện tại phù hợp, nhưng nếu dự án
chuyển sang thương mại thì đây là **công cụ phát triển phải gỡ**, giống hệt tình
trạng của dataset VITON-HD và BodyM. Nó không nhúng gì vào sản phẩm — chỉ là công
cụ đọc code — nên gỡ ra không ảnh hưởng runtime.

**Không pin đúng chỗ:** sáu file `.claude/skills/gitnexus-*/mcp.json` đóng gói
sẵn ghi `gitnexus@latest`. Cấu hình đang chạy thì pin `1.6.10`, nhưng nếu ai copy
mẫu trong skill ra dùng sẽ mất pin. Xem mục Khuyến nghị.

### 5. japano-db-erd — 🟢 skill nội bộ

Skill tự viết cho dự án, không có upstream. Nội dung hiện có: thứ tự nguồn sự
thật, quy trình giản lược an toàn, cấm tạo database thứ hai, cấm xóa mù, yêu cầu
migration có dry-run/backup/rollback, media chỉ lưu URL, một ERD canonical duy
nhất, cấm watermark. Đã được bổ sung trong phiên này (xem mục Việc đã làm).

## Công cụ KHÔNG cài, theo đúng yêu cầu

| Công cụ | Lý do |
|---|---|
| Heretic và mọi công cụ gỡ safety alignment | Bị cấm |
| Watermark remover | Bị cấm; Draw.io native vốn không có watermark nên không cần |
| Graft | Chưa xác định được chính xác repository, chưa audit bootstrap |
| CodeGraph, codebase-memory | Trùng chức năng với GitNexus. Yêu cầu là benchmark GitNexus trước và **không bật đồng thời**. Hiện chỉ GitNexus được cấu hình. |

## Việc đã làm trong phiên này

1. Viết file audit này (trước đó chưa tồn tại).
2. Bổ sung `.claude/skills/japano-db-erd/SKILL.md`: thêm chuỗi nguồn sự thật đúng
   đường dẫn JAPANO, quy tắc "không xóa collection chỉ vì trống", bộ nhãn
   `[THỰC TẾ] / [SUY LUẬN] / [ĐỀ XUẤT]`, và lệnh cấm tạo database `japano_erd`.
3. Bịt lỗ `.gitignore`: `gitnexus-out/` và `.graphify/` trước đó chưa được ignore.

## Khuyến nghị chưa làm

| # | Việc | Vì sao chưa làm |
|---|---|---|
| 1 | Pin `gitnexus@1.6.10` trong 6 file `mcp.json` của skill | Sửa file thuộc skill upstream; cần xác nhận có muốn phân nhánh khỏi bản gốc không |
| 2 | Quyết định số phận `graphify` khi public repo | Cần quyết định của chủ dự án về license |
| 3 | Benchmark GitNexus index trên JS/TS/Python của repo | Chưa chạy; index 184 MB đã tồn tại nhưng chưa đo chất lượng |
| 4 | Ghi SHA vào lúc cài cho lần cài sau | Lần cài trước không ghi; chỉ ghi được SHA tại thời điểm kiểm tra |

## Cách kiểm tra lại

```bash
# Không có gì tự chạy được?
find .claude -type f -perm -u+x                       # phải rỗng
find .claude -name "package.json" -o -name "*.sh"     # phải rỗng
grep -rniE "curl.*\| *sh|postinstall" .claude/skills/ # phải rỗng

# Index lớn không bị commit?
git check-ignore -v .gitnexus graphify-out gitnexus-out .graphify

# MCP có secret không?
python3 -c "import json;d=json.load(open('.mcp.json'));print(d)"
```
