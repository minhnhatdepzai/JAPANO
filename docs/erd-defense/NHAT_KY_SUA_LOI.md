# JAPANO — Gói bảo vệ ERD

Đóng gói 20/08/2026. Toàn bộ số liệu đối chiếu từ ba nguồn: `erd.drawio`,
MongoDB `japano` đang chạy, và mã nguồn `backend/`.

**36 thực thể logic · 50 quan hệ · 35 collection vật lý.**

---

## Dùng cái gì cho việc gì

| Việc cần làm | Mở tệp |
|---|---|
| Trình chiếu, chỉ sơ đồ trên màn hình | `01_Word/ERD_DEFENSE_JAPANO_TRON_BO.docx` |
| Luyện đối đáp phản biện chuyên sâu | `01_Word/ERD_BAO_VE_PHAN_BIEN_CHUYEN_SAU.docx` |
| Xem hình từng bảng riêng lẻ | `01_Word/ERD_HINH_ANH_CHI_TIET.docx` |
| Ôn nhanh 30 phút trước khi vào | `03_Markdown/codex/12_CHEATSHEET.md` |
| Luyện bằng ngân hàng câu hỏi | `03_Markdown/claude/ERD_QUESTION_BANK.md` |
| Mở ERD gốc để sửa | `02_So_do/ERD_goc/erd.drawio` |

Hai tệp Word bổ sung nhau, không thay thế nhau: một bên mạnh về **sơ đồ và phân
cụm**, một bên mạnh về **chiều sâu từng câu hỏi**.

---

## Đã sửa trong lần đóng gói này

Ba nhãn tên trường trong sơ đồ ERD con ghi sai so với cơ sở dữ liệu thật. Nếu
hội đồng yêu cầu mở database xem đúng trường đó thì sẽ không tìm thấy.

| Sơ đồ ghi (sai) | Trường thật | Nguồn xác minh |
|---|---|---|
| `vouchers.ownerId` | `vouchers.issuedBy` — người cấp | `backend/routes/admin.js:81` |
| `vouchers.userId` | `vouchers.ownerUserId` — người nhận | `backend/routes/admin.js:78`, `routes/health.js:135` |
| `chats.productId` | `chats.productIds` — **mảng**, nên là N:N nhúng chứ không phải khoá ngoại đơn | snapshot collection `chats` |

Lưu ý khi bảo vệ: tên `ownerUserId` dễ gây hiểu nhầm — trường có chữ *owner*
lại là **người nhận**, không phải người cấp.

Đã đối chiếu lại toàn bộ **49 nhãn `collection.field`** trong 7 sơ đồ với schema
thật: **49/49 khớp**.

Sơ đồ cụm nghiệp vụ cũng được vẽ lại bằng bộ bố cục ELK — cạnh đi vuông góc và
nhãn không còn đè lên nhau như bản trước.

---

## Điểm yếu thiết kế đã ghi nhận

Đọc `03_Markdown/codex/11_DATABASE_REVIEW.md` và Phần 12 của
`ERD_BAO_VE_PHAN_BIEN_CHUYEN_SAU.docx`. Những chỗ **không nên cố bảo vệ**:

1. `users.email` có chỉ mục nhưng **không** đặt duy nhất — chặn trùng chỉ ở tầng ứng dụng.
2. `reviews` thiếu ràng buộc duy nhất `(userId, productId)`, trong khi `wishlist_items` lại có.
3. `orders.clientRequestId` — khoá chống đặt trùng — **không có chỉ mục nào**.
4. Kiểm tra toàn vẹn tham chiếu **không chạy** trên nhánh ghi tệp JSON dự phòng.
5. Hàm toàn vẹn chỉ phủ khoảng 9 nhóm bảng con trên 36 thực thể.
6. **Không dùng giao dịch của MongoDB** — tính nguyên tử đến từ một tiến trình một luồng.
7. Hai thực thể ảnh trùng vai trò trên sơ đồ; chỉ `product_media` tồn tại thật.
8. `flagcard_collections` lưu mảng `cardIds` chứ không phải một dòng mỗi thẻ.

---

## Tái sinh gói

```bash
python3 docs/erd-defense/tools/build_erd_defense.py       # sinh .md và .mmd
python3 docs/erd-defense/tools/build_erd_defense_docx.py  # dựng lại Word
```

Vẽ lại PNG từ `.mmd`:

```bash
export PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome
npx -y @mermaid-js/mermaid-cli@11 -i <tệp>.mmd -o <tệp>.png -w 3400 -s 2 -b white
```

Ảnh chụp cấu trúc cơ sở dữ liệu nằm ở `04_Cong_cu/snapshots/`. Muốn cập nhật thì
chạy lại công cụ trích trên MongoDB đang chạy trước khi dựng tài liệu.
