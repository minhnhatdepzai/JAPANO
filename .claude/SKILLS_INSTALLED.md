# Claude Code skills installed for JAPANO

Tất cả đều cài **project-scope** vào `.claude/skills/` (không dùng `-g`). Claude
Code nạp chúng khi mở phiên mới trong repo này. Hash của skill cài từ nguồn
chính thức được ghim trong `skills-lock.json` ở gốc repo.

## Skill cài từ nguồn chính thức

| Skill | Nguồn | Phiên bản / hash | Ngày kiểm tra | Phạm vi |
| --- | --- | --- | --- | --- |
| `docx` | `anthropics/skills` | sha256 `59c70107…4987ec47` (`skills-lock.json`) | 2026-08-31 | project |
| `pdf` | `anthropics/skills` | sha256 `cfbc5393…0837dd62` | 2026-08-31 | project |
| `doc-coauthoring` | `anthropics/skills` | sha256 `b964e4c3…8100cf8e` | 2026-08-31 | project |
| `brand-guidelines` | `anthropics/skills` | sha256 `e48840db…bd845d7d` | 2026-08-31 | project |
| `canvas-design` | `anthropics/skills` | sha256 `3fa7ea60…2ad8e5f4` | 2026-08-31 | project |
| `frontend-design` | `anthropics/skills` | sha256 `4eabc661…d8d62336` (`skills-lock.json`) | 2026-08-30 | project |
| `webapp-testing` | `anthropics/skills` | sha256 `ad5b1fc5…dcc6ccf5` | 2026-08-30 | project |
| `vercel-react-best-practices` | `vercel-labs/agent-skills` (`skills/react-best-practices`) | v1.0.0 · sha256 `ca7b0c0c…a2506212` | 2026-08-30 | project |
| `vercel-react-view-transitions` | `vercel-labs/agent-skills` (`skills/react-view-transitions`) | sha256 `2033ef20…7cc539292001` | 2026-08-30 | project |
| `vercel-composition-patterns` | `vercel-labs/agent-skills` (`skills/composition-patterns`) | sha256 `575757e3…1bc9c7d42` | 2026-08-30 | project |
| `web-design-guidelines` | `vercel-labs/agent-skills` (`skills/web-design-guidelines`) | v1.0.0 · sha256 `f3bc47f8…236ac474` | 2026-08-30 | project |
| `drawio` | `jgraph/drawio-mcp` | commit `14b318b19cc37b159f841227b9d11fbd18ce18ea` | 2026-08-28 | project |
| `dashboard-design` | `mares29/dashboard-design-skill` | commit `bbed535a08f0e1768b40087996fe019370312374` | 2026-08-28 | project |
| `graphify` | `darce07/graphify-claude-skill` | commit `d3e392967dcd6aa17db1a5c29e52fb33208288f5` | 2026-08-28 | project |
| `gitnexus-*` (7 skill) | `harryweiser/gitnexus` | commit `368049576b3ddd31f93ebae7aa08610a9be1c55b`; MCP ghim npm `gitnexus@1.6.10` | 2026-08-28 | project |

Lệnh cài lại (không dùng `-g`):

```bash
npx skills add anthropics/skills \
  --skill frontend-design --skill webapp-testing \
  --agent claude-code --copy --yes

npx skills add vercel-labs/agent-skills \
  --skill react-best-practices --skill react-view-transitions \
  --skill composition-patterns --skill web-design-guidelines \
  --agent claude-code --copy --yes
```

## Skill nội bộ của dự án

| Skill | Nguồn | Phiên bản | Ngày kiểm tra | Phạm vi |
| --- | --- | --- | --- | --- |
| `japano-project-memory` | Local | `local` | 2026-08-30 | project |
| `japano-travel-tryon` | Local | `local` | 2026-08-30 | project |
| `japano-motion-fast-inference` | Local | `local` | 2026-08-30 | project |
| `japano-db-erd` | Local | `local` | 2026-08-28 | project |
| `japano-mongodb-erd` | Local | `local` | 2026-08-29 | project |
| `japano-ui-ux-95` | Local | `local` | 2026-09-02 | project |
| `japano-full-outfit-tryon` | Local | `local` | 2026-09-02 | project |
| `japano-thesis-docx-patch` | Local | `local` | 2026-09-04 | project |

### Ghi chú 2026-09-04 — `japano-thesis-docx-patch`

Skill này buộc Claude Code vá trực tiếp từ DOCX gốc thay vì dựng lại báo cáo,
khóa phạm vi sửa Chương 4 về đúng ERD 19 bảng, thay đúng hai hình Use Case và
cập nhật ảnh điện thoại tại vị trí tương ứng. Skill yêu cầu dùng kèm `docx`, giữ
nguyên file gốc, so sánh cấu trúc trước/sau và kiểm tra trực quan PDF. Prompt
dùng kèm: `PROMPT_CLAUDE_UPDATE_JAPANO_THESIS_ERD19.md` ở gốc repo.

### Ghi chú 2026-09-02 — `japano-full-outfit-tryon`

Skill mở rộng thử đồ ảo từ một món lên nguyên bộ (áo, quần, váy, giày, phụ kiện
trong cùng một ảnh), gợi ý món còn thiếu theo slot, ghép cảnh Nhật chân thật và
bắt buộc app/web phải giống nhau. Prompt dùng kèm:
`PROMPT_CLAUDE_FULL_OUTFIT_TRYON.md` ở gốc repo.

Skill này **tham chiếu tới 4 skill khác**, trong đó hai cái nằm ngoài repo:

| Skill được tham chiếu | Vị trí | Có trong repo? |
| --- | --- | --- |
| `japano-project-memory` | `.claude/skills/` | có |
| `japano-travel-tryon` | `.claude/skills/` | có |
| `japano-gpu-performance` | `~/.claude/skills/` | **không** — user scope |
| `japano-fit-trainer` | `~/.claude/skills/` | **không** — user scope |

Máy khác clone repo này sẽ **không** có hai skill user-scope đó. Chúng chỉ là
tham chiếu bổ trợ (ngân sách độ trễ GPU, và quy trình LoRA thật khi cần huấn
luyện), nên `japano-full-outfit-tryon` vẫn chạy được nếu thiếu — nhưng nếu muốn
đủ bộ thì phải chép chúng vào `.claude/skills/` hoặc cài lại ở máy mới.

## Giấy phép

- `anthropics/skills`: xem `LICENSE.txt` kèm trong từng thư mục skill.
- `vercel-labs/agent-skills`: MIT.
- `drawio`: Apache-2.0, tài liệu tham chiếu đã vendor tại chỗ.
- `dashboard-design`: MIT.
- `gitnexus`: PolyForm Noncommercial.
- `graphify`: không tìm thấy giấy phép trong repo nguồn; đã thêm ghi chú an toàn
  cục bộ và chỉ dùng đọc.

## Cố ý không cài

- **Heretic** — gỡ căn chỉnh an toàn của mô hình, không liên quan tới chất lượng
  fit. Kiểm thử đồ bơi người lớn có đồng thuận phải dùng chính sách ảnh tường
  minh, kiểm toán được.
- **Công cụ xoá watermark** — Draw.io bản gốc không có watermark, và công cụ xoá
  chung dễ bị dùng sai với tài sản của bên thứ ba.
- **Graft, CodeGraph, codebase-memory** — Graft tự sửa chính nó và mơ hồ về hành
  vi; các công cụ đồ thị còn lại trùng chức năng với GitNexus, chỉ làm tăng số
  index và lượng token.
- **Skill cộng đồng không rõ nguồn** — không cài.

## Ghi chú 2026-08-31

Năm skill tài liệu ở trên được cài bằng
`npx skills add anthropics/skills --skill docx --skill pdf --skill doc-coauthoring --skill brand-guidelines --skill canvas-design --agent claude-code --copy --yes`
để phục vụ việc dựng báo cáo tốt nghiệp trong `docs/report/`. Lệnh cài tự cập nhật
`skills-lock.json`; bảng trên được cập nhật tay cho khớp. Không skill nào được cài
ở phạm vi toàn máy, và không skill nào chạm vào mã nguồn sản phẩm.
