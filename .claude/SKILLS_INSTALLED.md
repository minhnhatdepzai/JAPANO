# Claude Code skills installed for JAPANO

Tất cả đều cài **project-scope** vào `.claude/skills/` (không dùng `-g`). Claude
Code nạp chúng khi mở phiên mới trong repo này. Hash của skill cài từ nguồn
chính thức được ghim trong `skills-lock.json` ở gốc repo.

## Skill cài từ nguồn chính thức

| Skill | Nguồn | Phiên bản / hash | Ngày kiểm tra | Phạm vi |
| --- | --- | --- | --- | --- |
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
