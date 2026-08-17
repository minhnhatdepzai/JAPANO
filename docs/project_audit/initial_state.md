# Hiện trạng dự án trước khi kiểm toán

Ghi nhận lúc bắt đầu phiên kiểm toán, 16/08/2026.

## Kho mã nguồn

| Hạng mục | Giá trị |
|---|---|
| Nhánh hiện tại | `main` |
| Commit gần nhất | `b94290cac Update code` |
| Tệp đã sửa chưa commit | `BAO_CAO_QA.md`, `baocaototnghiep_hoan_thien.docx`, `baocaototnghiep_hoan_thien.pdf`, `erd.drawio` |
| Tệp chưa theo dõi | `Dự án tốt nghiệp.drawio (2).xml`, `erd.before-edge-cleanup.drawio` |

**Không thực hiện `git reset`, không xoá thay đổi nào của người dùng.**

## Tệp đầu vào được nêu trong yêu cầu

| Tệp yêu cầu | Tình trạng |
|---|---|
| `baocaototnghiep_hoan_thien(1).docx` | **Không tồn tại.** Tệp thật là `baocaototnghiep_hoan_thien.docx` |
| `Đã dán markdown (1).md` | **Không tồn tại** ở bất kỳ đâu trong máy. Bản đặc tả nhiệm vụ được dùng làm yêu cầu thay thế |

## Sao lưu đã tạo

```
backup/baocaototnghiep_before_revision.docx   19,9 MB
backup/baocaototnghiep_original.docx           4,0 MB   (bản gốc chưa từng bị sửa)
backup/erd_before_revision.drawio            523 KB
erd.before-edge-cleanup.drawio               530 KB   (từ phiên trước)
```

## Môi trường chạy

| Thành phần | Phiên bản / giá trị |
|---|---|
| Hệ điều hành | Linux 7.0.0-28-generic |
| Node.js | v22.23.1 |
| Python | 3.11.9 |
| PyTorch | 2.11.0+cu128, CUDA khả dụng |
| GPU | 16.311 MiB tổng, 941 MiB đang dùng lúc bắt đầu |
| Cơ sở dữ liệu | MongoDB Atlas, cơ sở dữ liệu `japano` |
| Bản chụp dữ liệu cục bộ | `backend/data/db.json`, 25.534 dòng |

## Cấu trúc dự án

```
mobile/     ứng dụng React Native + Expo
admin/      cổng quản trị: index.html + 5 tệp JavaScript thuần
backend/    Node.js + Express
  routes/   17 tệp, 115 điểm cuối REST
  lib/      44 mô-đun nghiệp vụ dùng chung
  test/     15 tệp kiểm thử (trước kiểm toán)
  *.py      6 dịch vụ AI cục bộ
VNPay/      mã tham khảo tích hợp VNPay
thesis/     bản thảo báo cáo dạng Markdown
```

## Dịch vụ đã biết

| Dịch vụ | Cổng | Trạng thái lúc bắt đầu |
|---|---:|---|
| Backend Express | 4100 (mặc định) | không chạy |
| Ollama | 11434 | trực tuyến |
| Embedding (sentence-transformers) | 7865 | ngoại tuyến |
| CatVTON | 7861 | ngoại tuyến |
| FASHN | 7862 | ngoại tuyến |
| One-to-All (video chuyển động) | 7864 | ngoại tuyến |
| Cổng AI | 8001 | ngoại tuyến |

Trong quá trình kiểm toán, backend được chạy ở **cổng 4199** để không tranh chấp
với cổng 4100 mà người dùng có thể đang dùng.

## Kiểm thử trước khi kiểm toán

```
152 kiểm thử · 145 đạt · 7 hỏng
```

Bảy kiểm thử hỏng thuộc `store-update-throw.test.js` và `user-credentials.test.js`,
**hỏng sẵn từ trước**, đã xác minh bằng cách chạy lại trên bản mã nguồn chưa sửa
(`git stash`).
