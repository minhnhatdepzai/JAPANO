# JAPANO: dữ liệu, fine-tuning và chatbot có căn cứ

Ngày chạy: **28/09/2026**. Tài liệu này phân biệt phần đã huấn luyện, phần chỉ suy luận và phần chưa đạt. Mở [bản trình chiếu HTML](ai-evidence-20260928/presentation.html), dùng nút **In / lưu PDF** để trình bày.

## Có thể nói gì với sếp?

“JAPANO đã huấn luyện hai adapter LoRA và VeRA trên Qwen3-4B để hiểu ý định khách hàng. LangGraph điều phối việc phân tích tương tác, truy xuất sản phẩm và kiểm tra câu trả lời. Giá, size và tồn kho lấy từ database hiện tại. Hệ thống còn có một mô hình ảnh được fine-tune để phân loại sản phẩm; đây là mô hình khác với bộ sinh ảnh thử đồ.”

Không nói “fine-tune LangChain”: LangChain/LangGraph là thư viện điều phối, không phải trọng số mô hình. Không nói đã fine-tune toàn bộ AI, hoặc độ chính xác chatbot đạt 100% trong thực tế.

## Kỹ thuật và kết quả thực tế

| Thành phần | Kỹ thuật | Bằng chứng |
|---|---|---|
| Qwen3-4B + LoRA | PEFT, rank 16, alpha 32, q_proj/v_proj, AdamW 2e-4, BF16, gradient checkpointing, batch 8, 60 bước | 5.898.240 tham số học; 75/76 câu test đúng (98,68%), baseline 57/76 (75%) |
| Qwen3-4B + VeRA | PEFT, rank 256, ma trận chiếu cố định dùng chung, vector tỉ lệ được học; AdamW 4e-3, batch 16, 60 bước | 202.752 tham số học; 76/76 câu test đúng (100% **chỉ trên tập này**) |
| Ảnh sản phẩm | ResNet18 pretrained ImageNet; fine-tune layer4 và classifier, AdamW 1e-4, 3 epoch, 171 bước | 593/600 ảnh test đúng (98,83%); ba nhóm Apparel/Footwear/Accessories |
| Chatbot | LangGraph JS: analyze_behavior → retrieve_catalog → classify_intent → ground_output | Đã tích hợp `/api/stylist/chat`, bật bằng `JAPANO_CHAT_LANGGRAPH=1` |
| Cá nhân hóa | Trọng số view/click/wishlist/cart/purchase, suy giảm theo thời gian, cửa sổ 90 ngày | Chỉ tương tác của người dùng xác thực, loại sự kiện bot tự sinh, không học thuộc dữ liệu cá nhân |
| Thử đồ | FASHN VTON 1.5; FLUX.2 Klein 4B cho pose/bikini hai mảnh | Suy luận mô hình có sẵn; **không có fine-tune bộ sinh ảnh mới trong đợt này** |
| Nhật Bản | Phân đoạn người và ghép vào cảnh có vùng đứng đã duyệt | Không phải fine-tuning; ảnh thực tế có `groundSafe:true` |
| Chuyển động | Wan2.1 + One-to-All 1.3B | Đã khôi phục model, tạo MP4 thật qua API trong 57,13 giây; không train mới |

Base Qwen khóa revision `cdbee75f17c01a7cc42f958dc650907174af0554`. Loss chỉ tính trên token assistant. Chọn checkpoint theo validation loss, sau đó mới đo test. Mỗi lượt có optimizer updates, nhật ký, adapter/checkpoint, SHA-256 và kiểm tra nạp lại. LoRA đang được dùng cho demo; không lựa chọn theo điểm test cao hơn của VeRA. Hai phương pháp khác batch và learning rate nên đây không phải thí nghiệm đối chứng hoàn toàn ngang điều kiện.

Tập chat: **280 train / 76 validation / 76 test**. Tách theo mẫu câu tiếng Việt và nhóm intent nguồn Bitext để tránh đưa biến thể cùng nhóm vào cả train/test. Tên sản phẩm có thể xuất hiện ở nhiều tập: phép đo đánh giá ý định, không phải khả năng nhớ sản phẩm chưa thấy. Nhãn tổng hợp chưa được chuyên gia rà soát; điểm test không chứng minh chất lượng trả lời tự do, tiếng Việt ngoài phân phối, hay khả năng chống mọi prompt injection.

Tập ảnh: **3.600 train / 600 validation / 600 test**, cân bằng ba lớp. ID và hash ảnh chính xác không trùng giữa các tập; chưa kiểm toán near-duplicate theo dòng sản phẩm. Các ảnh studio này không chứng minh nhận diện tốt trên người, chất lượng bikini, giữ khuôn mặt hoặc số đo cơ thể.

## Dữ liệu nào, lấy từ đâu?

| Nguồn | Giấy phép được API Kaggle công bố | Cách sử dụng |
|---|---|---|
| [Bitext customer support](https://www.kaggle.com/datasets/bitext/bitext-gen-ai-chatbot-customer-support-dataset) | CDLA Sharing 1.0 | Chọn 120 câu hướng dẫn thuộc các nhóm đơn hàng/giao hàng/hoàn tiền; ánh xạ intent. Không nhập chính sách bán hàng của Bitext vào JAPANO |
| [Fashion Product Images Small](https://www.kaggle.com/datasets/paramaggarwal/fashion-product-images-small) | MIT | Tải gói 592.614.936 byte; chọn 4.800 ảnh để train/eval classifier. Không biến sản phẩm Kaggle thành hàng JAPANO |
| [Retail Sales Dataset](https://www.kaggle.com/datasets/mohammadtalib786/retail-sales-dataset) | CC0-1.0 | 1.000 dòng **tổng hợp của tác giả** cho demo phân tích doanh thu theo nhóm; không phải hành vi hay doanh thu thật của JAPANO |
| Catalog JAPANO cục bộ | Người dùng cho phép sử dụng nội bộ | Xuất 53 sản phẩm published từ snapshot JSON, chỉ các trường cho phép; không xuất users, orders, addresses, chats, mật khẩu |
| Mẫu câu tiếng Việt | Tự xây dựng nội bộ, gắn `synthetic:true` | 312 câu phân loại ý định dùng tên sản phẩm làm ngữ cảnh |

Tại runtime, MongoDB trả catalog mới hơn (70 sản phẩm trong lần đọc API). Snapshot 53 sản phẩm chỉ dùng tạo ví dụ, không phải nguồn tồn kho live. Metadata nguồn, giấy phép, checksum và báo cáo nằm trong [evidence.json](ai-evidence-20260928/evidence.json). File metadata Kaggle gốc được giữ bên cạnh. Cần rà soát quyền ảnh thượng nguồn và điều khoản phân phối trước triển khai thương mại rộng.

Không tải “toàn bộ Kaggle”: dữ liệu không liên quan không tăng chất lượng và có thể có điều khoản không phù hợp. Công cụ có lệnh tìm kiếm và tải ba nguồn đã chọn; không chạy code đi kèm dataset. ZIP được kiểm tra đường dẫn, symlink, số file và dung lượng trước giải nén.

## Công cụ demo database → JSONL → train

Chạy từ thư mục gốc JAPANO. Máy hiện tại dùng Python ML đã cài trong dự án tham chiếu; không sửa mã nguồn hay dữ liệu `fanpage-chatbot`.

```bash
export JAPANO_TRAIN_PYTHON="$HOME/Downloads/fanpage-chatbot/.venv/bin/python"

# Không in hay ghi API key vào log. Tool đọc kaggle.json đã có trong repo,
# hoặc KAGGLE_API_TOKEN từ môi trường. Credential được gitignore.
"$JAPANO_TRAIN_PYTHON" backend/ai_training/data_workbench.py search 'fashion product'
"$JAPANO_TRAIN_PYTHON" backend/ai_training/data_workbench.py download support
"$JAPANO_TRAIN_PYTHON" backend/ai_training/data_workbench.py download fashion
"$JAPANO_TRAIN_PYTHON" backend/ai_training/data_workbench.py download retail

# Chỉ đọc database snapshot; không migrate hay ghi lại MongoDB.
python3 backend/ai_training/data_workbench.py export --input backend/data/db.json
# Cũng nhận mảng JSON sản phẩm hoặc CSV có status=published.
python3 backend/ai_training/build_chat_sft.py
python3 backend/ai_training/data_workbench.py retail-report
```

Các file nằm ở `backend/ai_training/workbench/`: catalog.json, train.jsonl, validation.jsonl, test.jsonl, sft.manifest.json, raw/*/manifest.json. Không commit dataset hay checkpoint. Với database khác, xuất collection sản phẩm sang JSON/CSV rồi dùng cùng lệnh; công cụ không tự sao chép toàn bộ database khách hàng.

```bash
# Dùng thư mục output MỚI, script từ chối ghi đè lượt cũ.
# Chạy huấn luyện khi không có job thử đồ/chuyển động đang chạy.
"$JAPANO_TRAIN_PYTHON" backend/ai_training/train_chat_adapter.py \
  --method lora --steps 60 --batch-size 8 --output backend/ai_training/runs/chat-lora-new
"$JAPANO_TRAIN_PYTHON" backend/ai_training/train_chat_adapter.py \
  --method vera --steps 60 --batch-size 16 --output backend/ai_training/runs/chat-vera-new
"$JAPANO_TRAIN_PYTHON" backend/ai_training/train_fashion_classifier.py \
  --epochs 3 --output backend/ai_training/runs/fashion-new

"$JAPANO_TRAIN_PYTHON" backend/ai_training/predict_fashion.py \
  --run backend/ai_training/runs/fashion-resnet18-20260928 \
  --image backend/ai_training/workbench/raw/fashion/files/images/15970.jpg
python3 backend/ai_training/build_presentation.py
```

Kết quả hiện tại nằm trong `backend/ai_training/runs/chat-lora-20260928`, `chat-vera-20260928`, `fashion-resnet18-20260928`. Mở `report.json`, `training-log.json`, `baseline.json`, `evaluation.json` để xem chứng cứ. `engineeringGate:true` chỉ cho phép demo intent giới hạn; `productionApproved:false` vẫn được ghi rõ. VeRA quan sát được GPU 100%, VRAM 15.193/16.311 MiB. Cố chiếm đúng 100% VRAM làm tăng OOM, không phải tiêu chí chất lượng.

## Runtime và kiểm soát câu trả lời

### Khôi phục artifact/model đã có trên máy khác

GitHub Release `ai-runtime-2026-10-07` chứa các archive chia part dưới 2 GiB,
kèm `SHA256SUMS`: toàn bộ `runs/`, `workbench/`, model FASHN/FLUX, One-to-All,
Hugging Face cache cần cho Qwen adapter, model Ollama `qwen3-vl:8b` và U2Net
cho phân đoạn cơ thể. Release cũng chứa ba virtualenv Python đã được kiểm tra
import lại trong image Ubuntu 24.04; Docker image runtime chứa Node, dependency
backend và thư viện hệ thống, còn image storefront chứa build web cùng
dependency. Sau khi clone repo, chạy `./scripts/docker-up.sh` để pull image,
khôi phục artifact và bật stack mà không chạy npm/pip/train/downloader.

Luồng không Docker vẫn dùng `./scripts/restore-ai-release.sh`; script kiểm
checksum rồi đặt file vào đúng đường dẫn mặc định mà `run-all.sh` sử dụng.
`.env`, token, signing key và dữ liệu khách hàng không được đóng gói vì là bí
mật. Checkpoint fit LoRA FLUX được tài liệu cũ ghi nhận nhưng không còn file
weight trên workstation nguồn; release chỉ giữ status/evidence và không tuyên
bố có thể nạp checkpoint đó.

Docker yêu cầu Linux x86_64, Docker Compose, NVIDIA driver và NVIDIA Container
Toolkit. CPU/import của FASHN, Motion và chatbot adapter cùng storefront HTTP
200 đã được kiểm tra trong container. Host đóng gói chưa có NVIDIA Container
Toolkit nên chưa có bằng chứng GPU end-to-end bên trong Docker; runtime AI gốc
trên host vẫn vượt các readiness check.

```bash
./scripts/start-ai-demo.sh
curl http://127.0.0.1:7866/health
curl http://127.0.0.1:4100/api/health
curl -H 'content-type: application/json' \
  -d '{"message":"Yukata xanh giá bao nhiêu?"}' \
  http://127.0.0.1:4100/api/stylist/chat
```

Website: http://localhost:4200. Admin: http://localhost:4100/admin/. Các unit systemd user là phiên phát triển, không tự cài khởi động sau reboot. Script giữ nguyên unit đang chạy; cấu hình mới cần restart có chủ đích.

Adapter chỉ trả một intent thuộc whitelist, không sinh nội dung giá, tên hàng, mã giảm hay link. GPU arbiter nhả adapter về CPU trước khi FASHN/FLUX chạy; nếu GPU bận hoặc hết hạn chờ, chatbot dùng trả lời có căn cứ sẵn có. Câu hỏi tài khoản dùng `sub` của JWT, không tin `userId` trong body khi bật graph. Không phân tích tâm lý nhạy cảm hay suy diễn số đo từ ảnh. Sự kiện bot tự gợi ý không được dùng làm bằng chứng sở thích.

Intent `inventory` ngày 04/10/2026 là luật + truy hồi database, không phải một
lượt fine-tune mới. Nó trả tổng số sản phẩm công khai, tổng đơn vị tồn đã khai
báo, tồn theo tên/màu/size, hàng hết và trạng thái không tìm thấy. Cả câu trả
lời lẫn `productIds` đều được dựng từ state tại thời điểm request; adapter chỉ
có thể định tuyến intent và không được giữ số lượng sản phẩm trong trọng số.
Backend đạt 477/477 test sau thay đổi, trong đó các ca inventory mới kiểm tra
số đếm bằng phép tính độc lập từ fixture.

## SEO

SEO áp dụng chủ yếu cho trang sản phẩm công khai: title, description, canonical và Product JSON-LD đã có trong storefront. Graph trả đường dẫn `/san-pham/<slug>` chỉ từ sản phẩm hiện có. Không nhồi từ khóa vào chat, không công khai hội thoại khách cho máy tìm kiếm và không hứa thứ hạng Google. Bằng chứng kiểm tra DOM lưu ở `test-results/ai-upgrade-20260928/seo-check.json`.

## Kiểm tra và giới hạn đang theo dõi

- Backend: 450/450 kiểm thử đạt sau sửa lỗi khoanh tay và readiness chuyển động. Các test riêng kiểm tra dữ liệu cá nhân không xuất ra SFT, ZIP path traversal và loại file thực thi đạt 3/3; kiểm tra file/shard FLUX đạt 2/2.
- Mobile TypeScript đạt; Redmi đã mở màn chat và nhận phản hồi API thực. OPPO chưa được kiểm tra trên thiết bị.
- Browser đã hiển thị câu trả lời giá sản phẩm ở viewport 390px. Phiên QA dùng JWT ngắn hạn, mock `/auth/me` để vào giao diện; API chatbot thật, không dùng kết quả chat giả.
- Bộ Python toàn dự án trong môi trường ảnh: 113 test chạy, 2 fail + 1 error + 2 skipped; các lỗi liên quan calibration cơ thể còn thiếu trên máy hiện tại. Không sửa số đo hay giảm ngưỡng để làm test xanh.
- Thử đồ lần đầu: sơ mi bị chặn `face_changed_or_covered`; thử lại với preset khác tạo được ảnh thật 32,55 giây. Không bỏ gate nhận diện để ép tất cả ảnh thành công.
- Bikini ban đầu lỗi do FLUX thiếu transformer và một shard text encoder sau lần tải dở trước đây; đã tải bù. Preset `nu-thanh-manh` tạo được ảnh bikini thật trong 45,64 giây; preset `nu-can-doi` vẫn bị chặn do thay đổi cơ thể. Không suy rộng thành mọi ảnh đều đạt.
- Lỗi đầu/khuôn mặt trên ảnh khoanh tay: `garmentRegion.ok=false` vô tình ép FLUX dựng lại toàn thân dù lý do `hands_cover_torso` đã được loại. Đã sửa để `hands_cover_chest` đi trực tiếp qua FASHN, giữ kiểm tra danh tính nghiêm ngặt. Chạy lại đúng ảnh trên Redmi với `happi-matsuri`, size S: HTTP 200, 32,79 giây, `poseTransferred:false`, không có cảnh báo/attempt lỗi. Đã xem ảnh thực tế; gate ghi `faceDiff:24.383`, không có lỗi chất lượng. Đây là một ca hồi quy, không phải bảo đảm giữ mặt tuyệt đối trên mọi ảnh. Xem `test-results/ai-upgrade-20260928/happi-head-fixed.png` và `happi-head-quality.json`. Ảnh khách chỉ giữ làm bằng chứng cục bộ, không đưa vào dữ liệu huấn luyện.
- Motion: đã khôi phục source One-to-All, môi trường Python và toàn bộ 395 file pose detector. Hai nhóm trọng số animation/text encoder còn đang tải; **chưa có MP4 mới được xác nhận đạt**. Route đã sửa lỗi báo `ready:true` chỉ từ HTTP 200; nay kiểm tra `modelReady`, `cudaRuntimeReady` và `ok`. Các lượt tải chạy độc lập trong user units `japano-download-motion-animation` và `japano-download-motion-text`; xem bằng `journalctl --user -u <unit>`. Có thể tiếp tục bằng Python ML chạy `backend/ai_training/download_motion_models.py animation` hoặc `text-vae` sau khi unit tương ứng dừng. Không chạy hai downloader cùng đích.
- Preflight fine-tune bộ sinh ảnh thử đồ không đạt: thiếu dataset condition/target, trainer và môi trường cũ `/home/nhat/...`. Không dùng ảnh sản phẩm đơn lẻ thay cho cặp dữ liệu try-on.
- Langfuse skill được dùng để thiết kế bằng chứng/eval cục bộ; không có dữ liệu hội thoại nào được upload lên Langfuse và không tuyên bố đã bật tracing cloud.

## Nguồn kỹ thuật

[PEFT LoRA](https://huggingface.co/docs/peft/en/package_reference/lora), [PEFT VeRA](https://huggingface.co/docs/peft/en/package_reference/vera), [Qwen model card](https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507), [LangGraph](https://docs.langchain.com/oss/javascript/langgraph/graph-api), [Torchvision ResNet18](https://docs.pytorch.org/vision/stable/models/generated/torchvision.models.resnet18.html), [Langfuse datasets](https://langfuse.com/academy/datasets).

## Cập nhật cuối lượt: video và số đo

- Đọc [lời thoại thuyết trình chi tiết](LOI_THOAI_THUYET_TRINH_AI.md), gồm kịch bản nói, công thức, demo và hỏi đáp.
- Motion đã tải đủ animation/text/VAE/pose và tạo cache 7 prompt. MP4 `test-results/ai-upgrade-20260928/motion-live.mp4`: 49 frame, 12 fps, API 200 trong 57,13s; quality gate đạt. Đã xem contact sheet: chuyển động có thật, bước chân còn hơi trình diễn. Chưa xác nhận phát video trên OPPO/Redmi trong lượt này. Thông tin “đang tải/chưa có MP4” phía trên là trạng thái trước khôi phục.
- Số đo: thêm `body_evidence.py`, không công bố chiều cao từ prior không có vật chuẩn; không công bố cân nặng/vòng đo suy từ ảnh đơn. Giữ số nhập tay, chiều cao có vật chuẩn; vô hiệu prior mẫu người cho tư vấn size khi thiếu bằng chứng. API đã kiểm chứng ảnh không chuẩn trả null, nhập 160 cm/150 kg giữ nguyên. Đây là chính sách đầu ra trung thực, **không phải fine-tuning mới và không chứng minh MAE tốt hơn**. Mobile generation 4 loại estimate cũ, giữ số nhập tay.
- Backend 451/451 test đạt; mobile typecheck đạt; policy số đo 3/3 test đạt.

- Bikini mẫu `nu-can-doi` trước đó lỗi đã tạo lại thành công: lượt seed đầu bị chặn `body_changed_not_garment`, lượt thứ hai qua đủ gate danh tính/che phủ, API 200 trong 70,36s. Ảnh đã xem trực tiếp: `test-results/ai-upgrade-20260928/bikini-retry2.png`. Retry có thể tăng thời gian chờ; chưa bảo đảm mọi ảnh khách đều đạt.
- Bộ kiểm tra `test_body_analysis.py` đã cập nhật kỳ vọng đầu ra thiếu bằng chứng và đạt 13/13; bộ đầy đủ vẫn có các lỗi calibration cũ chưa giải quyết.

### Ước lượng ảnh theo yêu cầu mới

Đã khôi phục dự đoán tham khảo cho ảnh toàn thân rõ, có phân đoạn, không nghiêng nhiều hoặc tay dính vào thân. Hiển thị khoảng bất định thay vì thu hẹp tùy ý thành bin 10 kg/cm. Đây là gợi ý thống kê chưa được hiệu chuẩn, không phải số đo thật và không tự quyết định size. Ảnh không đủ cơ sở vẫn báo thiếu bằng chứng; số nhập tay ưu tiên. Máy hiện thiếu file hồi quy cân nặng/BMI/vòng đo và hiệu chuẩn BodyM nên chưa thể tuyên bố chính xác như phiên bản cũ. Chưa có benchmark cân nặng/vòng đo mới trên người có số đo thật.

### Khôi phục hồi quy ANSUR — kết quả mới

Đã tải ANSUR II từ Kaggle `seshadrikolluri/ansur-ii`, kiểm tra CC0-1.0, huấn luyện lại HistGradientBoostingRegressor cho cân nặng/BMI/vòng đo bằng `restore_body_regressors.py`. Chọn cấu hình trên validation; test riêng 1.214 người. Checkpoint có hash và nạp lại được; nối các đường model còn thiếu tới run `body-regression-20260928`. Đây là huấn luyện hồi quy bảng số đo, không phải fine-tuning mô hình ảnh. BodyM và hiệu chuẩn hình học cũ vẫn chưa khôi phục.

MAE bảng số đo: cân nặng 3,207 kg; ngực 2,668 cm; eo 2,362 cm; hông 1,797 cm. Không phải sai số đọc từ ảnh. Test có 117 người >=100 kg, không có người >=150 kg; MAE cân nặng nhóm >=100 kg là 4,663 kg. [Báo cáo](ai-evidence-20260928/body-regression-report.json).

Đã chạy 6 ảnh preset qua worker: 5 ảnh trả đủ giả thuyết chiều cao/cân nặng/vòng đo; mẫu ngoại cỡ chỉ trả chiều cao, chưa đủ bằng chứng cho cân nặng/vòng đo. Ảnh preset là ảnh dựng, không có số đo thật để tính độ chính xác. Đầu ra hiển thị khoảng bất định, không phải một số chính xác; chỉ là gợi ý, không tự quyết định size. 13 test body-analysis và 4 test policy đạt.

### Hiệu chỉnh hình học cho vóc dáng rộng — 29/09/2026

Lỗi được tái hiện trên 10 ảnh hồ sơ tổng hợp: khoảng cách hai khớp hông nằm sâu
bên trong cơ thể đã kéo bề ngang người thân rộng về gần trung bình; phần mô mềm
còn lại lại bị coi là quần áo rộng và bị trừ lần nữa. Bản sửa chỉ kích hoạt khi
ba tín hiệu độc lập cùng đạt ngưỡng: silhouette hông, trung vị thân và bề ngang
đùi trên. Hồi quy sau đó dùng silhouette đã cắt tay và không để chỉ số “độ rộng
quần áo” trừ mất chính mô mềm vừa quan sát. Ảnh chỉ rộng ở thân áo nhưng đùi
không rộng là đối chứng âm và không được hiệu chỉnh.

Kết quả chạy lại trên 10 ảnh, theo thứ tự `mau-01` đến `mau-10`, là khoảng
49,5; 55,9; 100,3; 51,3; 54,9; 79,4; 111,8; 52,3; 51,4; 84,2 kg. Các mẫu
thân rộng `03/06/07/10` được hiệu chỉnh, sáu mẫu còn lại giữ nguyên. `mau-06`
cho vòng ngực/eo/hông 99,3/94,0/120,4 cm; `mau-07` cho
126,4/122,8/124,3 cm. Đây chỉ chứng minh pipeline phản ứng đúng thứ tự hình học;
10 ảnh không có cân và thước dây nên **không dùng các số này làm accuracy hay
ground truth**. Khoảng bất định vẫn được trả riêng và mọi gợi ý ảnh vẫn mang
`insufficient_evidence`, `usableForSizing=false`.

Targeted test đạt 16/16 cho body analysis và 5/5 cho evidence policy. Full
Python suite hiện còn các lỗi cũ do thiếu `body_geometry.calibration.json` /
BodyM cùng các test contract cũ chưa đồng bộ; không được trình bày là toàn bộ
suite đã xanh.

### Rà soát lệch cân nặng và độ trễ — 30/09/2026

Audit cục bộ dùng Celeb-FBI với split rời danh tính đã khóa. Chiều cao
nhãn được truyền vào để tách lỗi hồi quy cân nặng khỏi lỗi suy chiều
cao. Trên 30 ảnh test 92–151 kg, pipeline trả được giả thuyết cho 21 ảnh:
MAE 18,10 kg, bias −15,79 kg và 12/21 ảnh thấp hơn nhãn filename
tối thiểu 10 kg. Đây xác nhận xung đột giữa pipeline và nhãn yếu, chưa
xác nhận sai số so với cân nặng được đo cùng thời điểm chụp.

Không cộng một hằng số cho mọi ảnh: trên 84 kết quả validation hợp lệ,
nhóm dưới 50 kg đang lệch **cao** +10,72 kg trong khi nhóm từ 110 kg
lệch **thấp** −10,54 kg, và nhóm này chỉ có 5 kết quả usable.
Tăng đồng loạt sẽ sửa người nặng bằng cách làm sai người gầy. Vì Celeb-FBI
là ảnh người nổi tiếng và nhãn filename, audit này là bằng chứng chẩn đoán,
chưa đủ để promote calibration mới. Báo cáo và 133 hàng kết quả nằm ở
[`body_weight_bias_audit_20260930.json`](../backend/ai_training/evaluation/body_weight_bias_audit_20260930.json),
Kiểm tra tay một ngoại lệ `132w` cũng cho thấy metadata có thể cũ hoặc không
khớp thời điểm chụp. SHA-256 báo cáo:
`ae7dc1a8795a059d08aa7bebd02b2de0860c3a568bebbeb25a17f5057a91cd8e`.

Phần runtime đã sửa riêng: giữ FASHN ấm trong idle 180 giây khi đi qua
Home/Duyệt sản phẩm. Cold-start đo được 7,515 s; sau đó
`tryon → browse → tryon` còn 10 ms và 9 ms. Bốn lượt body-analysis qua
backend đạt 1,17–1,29 s và trả lần lượt 100,3; 79,4; 111,8; 84,2 kg
cho `mau-03/06/07/10`. Đây là kiểm tra hành vi, vì 10 ảnh dựng
không có cân nặng thật.

Kiểm thử runtime cùng ngày:

- Chat LangGraph sửa lỗi Unicode khiến chữ “hi” trong “hiện” bị nhận nhầm là
  lời chào. Câu hỏi giá bikini trả đúng `Bikini hai mảnh hoa anh đào —
  790.000₫` từ catalog live; 21/21 test chat liên quan đạt.
- Bikini hai mảnh chạy mới, không dùng cache, preset người lớn `nu-nang-dong`,
  size L, fast: HTTP 200 trong 51,34 giây, FLUX.2, không cảnh báo danh tính hay
  che phủ.
- Ảnh bikini thật được ghép vào scene `naoshima-miyanoura-promenade` trong
  1,29 giây; `groundSafe=true`. Đây là kiểm thử API và xem ảnh đầu ra, không
  phải cam kết mọi ảnh người dùng đều thành công.
- Trên chính Redmi, ảnh `mau-07` đã mặc bikini được và nút **Tạo chuyển động
  bằng AI local** sinh clip đi bộ trong 57,33 giây. Worker báo 49 frame, 12 fps,
  384×512, profile turbo; quality gate đạt (`continuity=0,8374`,
  `motionScore=2,8214`). Video hiện trực tiếp trong app cùng nhãn “Clip đã qua
  kiểm tra chất lượng chuyển động local”. Đây là một ca thiết bị đã kiểm chứng,
  không suy rộng thành mọi ảnh/tư thế đều đạt.

## Chạy toàn bộ bằng một lệnh

```bash
cd /home/admin123/Documents/JAPANO
./run-all.sh
```

Lệnh bật chatbot LoRA/LangGraph, Ollama thị giác cho bikini, thử đồ FASHN/FLUX,
phân tích cơ thể/ghép cảnh Nhật Bản, chuyển động, backend, website và Metro.
Kết nối điện thoại đã cấp quyền ADB bằng USB hoặc Wi-Fi đã ghép đôi.
Giữ máy tính chạy khi dùng app; đăng nhập trên điện thoại nếu được yêu cầu.
GPU nạp mô hình theo hàng chờ khi bấm chức năng, không nạp tất cả đồng thời.
Nếu có `scrcpy`, cùng lệnh tự mở và giám sát màn hình điện thoại trên máy tính.
Chỉ chạy web/AI: `./run-all.sh --no-phone`. Chọn máy khi có nhiều máy:
`./run-all.sh --device SERIAL`. Website: http://localhost:4200.

Đã chạy lại nguyên lệnh với Redmi ngày 30/09: app và màn hình scrcpy tự mở, ADB
reverse 4100/8081 được tạo, database/AI/Metro đều đạt readiness. Readiness không
bảo đảm mọi ảnh qua được kiểm tra người, tuổi, danh tính và chất lượng. Môi
trường Python/model hiện có là điều kiện đầu vào; đây không phải bộ cài tự động
cho máy mới.

Kiểm chứng lại ngày 30/09 trên Redmi: lệnh đã bật đủ các
service, app nhận đúng ảnh `mau-10`, tạo sơ mi trắng size S và hiện nhãn **Rất
chật**. Ảnh kết quả tạo tiếp video H.264 384x640, 10 fps, 3,3 giây; video được
phát trực tiếp trong app. CUDA đạt 100% trong lúc render, khoảng 10 GB VRAM, và
API `/animate` trả 200.

ADB Wi-Fi trên Redmi có thể đổi cổng TCP trong cùng phiên. `run-all.sh` hiện tự
chuyển từ serial cũ sang thiết bị đã ghép đôi duy nhất và chạy watchdog
`japano-adb-reverse`. Kiểm thử phá lỗi đã xóa chủ động toàn bộ ADB reverse;
watchdog dựng lại cả 4100 và 8081 trong khoảng 2 giây. Ngay sau đó app phân tích
ảnh qua backend trong 1.213 ms và tạo Kimono qua `/api/tryon` với HTTP 200 trong
28.004 ms. Ảnh kết quả **Hoàn tất / Rất chật** đã được quan sát trên chính màn
hình Redmi; ảnh chụp bằng chứng nằm tại
`test-results/ai-upgrade-20260930/kimono-redmi-adb-recovery.png`. Đây là kiểm
chứng một ảnh và một lần phục hồi kết nối, không bảo đảm mọi ảnh hoặc mọi lần
mất Wi-Fi đều thành công.

## Cách đọc số đo mới

Nhóm 150–160 cm hoặc79–89 cm là nhóm hiển thị10đơn vị quanh dự đoán sẵn có,
không phải khoảng tin cậy10đơn vị. Khoảng bất định thật của mô hình vẫn hiển thị
riêng. Số đo nhập tay và chiều cao từ vật chuẩn không bị đổi thành nhóm.
Ảnh thiếu bằng chứng tiếp tục trả trống, không tự gán150kg theo vẻ ngoài.
Phản hồi ảnh cũ không ghi đè ảnh mới; có ô nhập cả năm số đo, và Phân tích lại
nhận thông tin nhập bổ sung. Các sửa này chưa phải cải thiện độ chính xác đã
được kiểm chứng hoặc fine-tuning mới.

App hiện đọc đúng **một tập byte ảnh** từ URI đã chọn rồi dùng cùng dữ liệu đó
cho ảnh xem trước, phân tích vóc dáng và thử đồ. Nút Phân tích lại không gửi
profile ước lượng cũ của ảnh/người trước. Với `mau-10`, Redmi hiện nhóm
156-166 cm, 79-89 kg, ngực 97-107, eo 95-105 và hông 114-124 cm; khoảng bất định
thật rộng hơn vẫn hiện riêng: 146-176 cm, 71-97 kg, 92-113/90-111/106-131 cm.
Ảnh tổng hợp này không có cân, thước hoặc vật chuẩn nên không thể dùng để kết
luận các số đó chính xác.

Kiểm tra thiết bị ngày 30/09 còn sửa trạng thái tưởng như nút phân tích không
chạy: worker thực tế trả 200 rất nhanh nhưng kết quả cùng ảnh không đổi nên trước
đây không có phản hồi nhìn thấy. Ảnh mới giờ luôn hiện “Đã phân tích ảnh đang
hiển thị”; khi đã có kết quả, nút **Kiểm tra lại** xác nhận đúng ảnh và thời gian
mà không tải lại cùng payload qua ADB. Nếu lượt phân tích ảnh mới bị đứt kết nối,
app dừng sau 20 giây và báo lỗi thay vì quay tối đa ba phút.

Khi ba tín hiệu hình học cùng xác nhận vóc dáng rộng và khách chọn size S nhỏ
nhất, bộ fit có thể báo `very_tight` dù không tự quyết định size từ ảnh. Sơ mi
thường có thể nhận hiệu ứng bục một đoạn đường may nhỏ ở vai/cánh tay ngoài;
không để lộ ngực, vùng chậu hoặc mông. Bikini/đồ bơi, crop top, quần và váy không
áp dụng hiệu ứng này. Đây là luật suy luận và hậu kỳ xác định, **không phải
fine-tuning**.

Ảnh10mẫu không chữ: `output/imagegen/10-mau-voc-dang.png`, tạo bằng imagegen.
Prompt:10người nữ trưởng thành, toàn thân, vóc dáng đa dạng, nền studio trung
 tính, lưới5x2, không chữ/nhãn. Đây là ảnh tổng hợp không có số đo thật.
Cần tách từng người trước khi thử; app hiện chọn một người chính trong ảnh.
Không dùng ảnh này để tuyên bố sai số cân nặng hay vòng đo.

## Huấn luyện ảnh và rà soát dữ liệu mới — 30/09/2026

Lượt này có **optimizer update thật**, checkpoint nạp lại được, SHA-256 và tập
test bị khóa trước khi chọn model. Đây là fine-tuning backbone thị giác
ImageNet; không gọi việc sửa prompt, luật hay hiệu chuẩn là fine-tuning. Không
checkpoint mới nào được nối vào app vì chưa vượt đủ cổng chất lượng và giấy
phép.

### Dữ liệu đã tải và kiểm toán

| Bộ dữ liệu | Dữ liệu dùng được | Vai trò | Giấy phép / quyết định |
|---|---:|---|---|
| Celeb-FBI, Kaggle | 6.196 ảnh toàn thân; 4.958/619/619 train/val/test | RGB → chiều cao, BMI/cân nặng | Kaggle khai báo CDLA-Permissive-1.0; nhãn là metadata người nổi tiếng, không phải đo lúc chụp |
| Celeb-FBI crop | 6.196/6.196 ảnh được YOLOv8-pose bắt người và cắt | Ablation giảm nhiễu nền | Cùng license nguồn; không sửa được nhãn yếu |
| Amazon BodyM | 6.133 train, 1.662 val, 1.160 testB silhouette | Silhouette → cao/nặng/ngực/eo/hông | CC-BY-NC-4.0; chỉ nghiên cứu, không đưa vào sản phẩm thương mại |
| jpersonwiki | 236.717 dòng; 15.752 dòng có cao+nặng hợp lệ | Prior dân số Nhật khi đã biết chiều cao | CC-BY-SA-4.0; không phải model nhìn ảnh |
| BODIES v1.0 `data16`, Zenodo | 12.000 người tổng hợp; 8.000/2.000/2.000 train/val/test; 2 góc nhìn | Tiền huấn luyện cao+BMI, tăng phủ 110–226,7 kg | CC-BY-4.0; ảnh SUPR tổng hợp T-pose, chỉ dùng làm pretraining |

Celeb-FBI có 12 ảnh gắn nhãn từ 140 kg trở lên; test chỉ có **1**. Bài báo của
bộ dữ liệu chỉ xác nhận miền cân nặng 41–110 kg, nên các nhãn cao hơn được xem là
weak label. BodyM testB không có người từ 140 kg. Vì vậy chưa có bằng chứng để
nói model dự đoán đúng người 150 kg. Gán 150 kg chỉ vì nhìn “rất mập” là tạo số
giả, không phải cải thiện AI.

BODIES bổ sung 91 subject từ 140 kg trở lên trong test tổng hợp và nhãn tới
226,7 kg. Hai archive nữ/nam đã được kiểm MD5, giải nén, train theo split chính
thức và ghi provenance tại
`backend/ai_training/body_dataset/provenance/bodies_zenodo.manifest.json`.
Tập này giải quyết độ phủ hình thể để học representation, nhưng không thay thế
test ảnh thật vì người tổng hợp đứng T-pose trên nền trắng.

BodyM công bố một subject trùng giữa testA và testB. Script giữ testB nguyên và
loại 22 ảnh của subject đó khỏi validation; sau lọc, train/validation/testB rời
danh tính. Chi tiết nguồn và hash nằm ở
`backend/ai_training/body_dataset/provenance/`.

### Kỹ thuật và kết quả held-out

| Thí nghiệm | Kiến trúc / mục tiêu | MAE test | Baseline cùng split | Quyết định |
|---|---|---:|---:|---|
| RGB trực tiếp | ResNet18, cao+cân nặng | 6,903 kg | 6,260 kg | Không promote |
| RGB → cao+BMI | ResNet18 | 7,151 kg tự suy cao; 5,124 kg khi biết cao thật | 6,244 / 4,946 kg | Không promote |
| RGB → cao+BMI | DenseNet201 | 6,912 kg tự suy cao; 5,055 kg khi biết cao thật | 6,244 / 4,946 kg | Không promote |
| RGB đã crop người | ResNet18 | 6,986 kg tự suy cao; 5,326 kg khi biết cao thật | 6,244 / 4,946 kg | Không promote |
| RGB → cao+BMI | ConvNeXt-Tiny | 6,486 kg tự suy cao; **4,804 kg** khi biết cao thật | 6,244 / 4,946 kg | Chỉ thắng baseline ở chế độ biết chiều cao; không promote |
| RGB đã crop người | ConvNeXt-Tiny | 6,594 kg tự suy cao; 4,810 kg khi biết cao thật | 6,244 / 4,946 kg | Không promote |
| BODIES tổng hợp | ConvNeXt-Tiny, cao+BMI | 3,076 kg tự suy cao; 1,249 kg khi biết cao thật; nhóm ≥140 kg: 6,771 / 1,941 kg | 25,521 / 23,017 kg | Prior phụ có gate cho ảnh toàn thân rất rộng; không phải accuracy ảnh thật |
| BODIES → Celeb-FBI | ConvNeXt-Tiny transfer | 6,620 kg tự suy cao; 4,876 kg khi biết cao thật | 6,244 / 4,946 kg | Domain transfer không cải thiện model ImageNet thuần; không promote |
| BodyM silhouette | ResNet18, 5 đầu ra | nặng 7,293 kg; ngực 4,084 cm; eo 4,667 cm; hông 3,958 cm | 13,543 / 9,287 / 10,627 / 8,369 | Tốt hơn baseline nhưng research-only |
| Prior người Nhật | HistGradientBoosting, biết chiều cao | 6,379 kg | median 11,330 kg | Chỉ là prior; không nhìn ảnh |

DenseNet201 chạy batch 96, GPU quan sát 99% và khoảng 11.919/16.311 MiB VRAM.
ConvNeXt-Tiny batch 192 đạt 100% utilization và 15.686/16.311 MiB VRAM ở thời
điểm quan sát; BODIES report ghi peak reserved 14.422 MiB. Dùng batch lớn nhất
ổn định tốt hơn ép đúng 100% VRAM rồi OOM. ConvNeXt ImageNet thuần là ứng viên
RGB tốt nhất khi người dùng cung cấp chiều cao, nhưng photo-only vẫn thua
baseline. Khởi tạo bằng BODIES làm test ảnh thật kém hơn nhẹ, cho thấy domain
gap tổng hợp → ảnh đời thực; nhóm Celeb-FBI 110–139 kg vẫn bị ước lượng thấp vì
test thật chỉ có 9 ảnh.

Checkpoint chính để kiểm tra. Chỉ TorchScript BODIES được nối vào runtime qua
gate broad-build mô tả bên dưới; các checkpoint còn lại không dùng production:

- BodyM ResNet18:
  `ad23f48e05218d289553ce3de98134dd38ffc9fac0159aeb78a2a16a830292d5`.
- Celeb-FBI DenseNet201:
  `6f985bf8b9c07e36f6d9ff396200795518273fd604fbadc279f1681ccf1694df`.
- Celeb-FBI cropped ResNet18:
  `a96ffd5a524f5fe05f5ee923a350cdea917b9b365de37e4597d3960871a48ce3`.
- Celeb-FBI ConvNeXt-Tiny ImageNet:
  `eeb035f0d0b15e3308b9dfa93fc51495ee272787ef2776608dd558c6e16eac4c`.
- BODIES ConvNeXt-Tiny hai giới:
  `2eabff59cd0470c2881604e1b5cf7aa836275cf1c696052ec9c971505694141c`.
  TorchScript runtime:
  `f032720235e3d53f8c22a727008ec1c55fec5d2d456004252bc2591f0be79562`.
- Celeb-FBI ConvNeXt-Tiny khởi tạo từ BODIES:
  `8a87f897222fa797e8ac34474698fd8f900853567cce3130c457c7b16ed329e2`.
- Prior Nhật:
  `7327839c5644f3ac4dfc364adb823df94bf8921379efa302e00aa4524a67b753`.

Báo cáo gộp máy đọc được:
`backend/ai_training/evaluation/body_training_20260930.json`. Mỗi thư mục run
có `report.json`, training log, prediction test, checkpoint, TorchScript (nếu là
CNN), hash và reload check.

### Gate cân nặng cho vóc dáng rất rộng — 01/10/2026

Runtime không cộng một offset cho mọi ảnh. Checkpoint BODIES chỉ chạy như prior
phụ khi ảnh thấy trọn người, silhouette có đủ ba tín hiệu rộng độc lập ở thân,
hông và đùi, và chính checkpoint dự đoán từ 135 kg trở lên. Kết quả cuối bị
chặn ở BMI 49,8 theo chiều cao đang hiển thị, confidence tối đa 0,45, giữ khoảng
bất định rộng, `usableForSizing=false`, và số cân nặng người dùng nhập luôn thắng.
Giới hạn BMI hợp lệ cuối pipeline được đồng bộ từ 45 lên 50 vì estimator vốn đã
dùng trần 50; trên BMI 50 vẫn bị loại.

Kiểm tra hành vi trên 10 ảnh tổng hợp cho kết quả 49,5 / 55,9 / **137,2** / 51,3
/ 54,9 / 79,4 / **137,2** / 52,3 / 51,4 / **128,9 kg**. Chỉ `mau-03/07/10`
qua gate rất nặng; `mau-06` vẫn 79,4 kg. Trên Redmi, `mau-07` hiện trực tiếp
**Nhóm 132–142 kg**. Bằng chứng màn hình:
`test-results/body-analysis-debug-20260930/redmi-heavy-bodies-prior.png`.
Báo cáo máy đọc được:
`backend/ai_training/evaluation/broad_build_prior_20261001.json`, SHA-256
`e9c473e2619f87834dc99c4f4a1f289cc0d4f8d5beb5890888fcd032b1bfa24b`.

Mười ảnh này do AI tạo và không có số đo thật. Kết quả trên chỉ chứng minh gate
phân tách nhóm rất rộng khỏi nhóm thường và sửa ca đánh giá quá nhẹ; chưa chứng
minh MAE trên ảnh khách hoặc rằng người trong một ảnh cụ thể thật sự nặng 120 kg.

### Kiểm tra hai ảnh người thật trên Redmi — 01/10/2026

Hai ảnh Messenger cho hai kết quả khác nhau theo bằng chứng nhìn thấy trong ảnh:

- Ảnh ngồi/tựa bị cắt dưới đầu gối: fallback ConvNeXt crop trả giả thuyết
  161,4cm / 56,6kg; prior ANSUR II trả ngực/eo/hông 87,0/76,4/95,3cm. UI hiển
  thị nhóm 156–166cm, 52–62kg, 82–92/71–81/90–100cm. Confidence chỉ 0,22–0,28,
  khoảng bất định rộng và toàn bộ đều `usableForSizing=false`.
- Ảnh váy trắng đứng toàn thân: UI Redmi hiển thị chiều cao157–167cm, cân nặng
  43–53kg, ngực74–84cm, eo60–70cm và hông80–90cm. Worker mất khoảng1,2 giây.

Một lỗi luồng đã được sửa: `/api/stylist/body-analysis` từng chạy thêm model
kiểm tra ảnh 18+ theo sản phẩm đang mở, khiến mobile hết timeout20 giây dù worker
CPU đã đo xong. Endpoint đo vóc dáng nay trả kết quả ngay; kiểm tra người lớn vẫn
fail-closed tại `POST /api/tryon` trước khi ảnh đi vào model thử đồ. 26/26 test
mục tiêu và mobile typecheck đạt. Ảnh bằng chứng:
`test-results/live-debug/real-fullbody-selected-final.png`.

### Fallback ảnh thiếu bộ phận hoặc đang ngồi — 01/10/2026

Luồng này dùng hai checkpoint thật, không dùng hằng số cộng cân nặng:

1. ConvNeXt-Tiny đã fine-tune toàn bộ layer trên crop người Celeb-FBI dự đoán
   chiều cao và BMI từ RGB. SHA-256 TorchScript:
   `615cfb1f19c95c8cb40834911250a700c5e94ff12f9b538d27debed2bbf36c1d`.
   Split rời danh tính 4.958/619/619; test MAE 6,116cm chiều cao và 6,594kg cân
   nặng khi tự suy chiều cao.
2. `train_partial_girth_prior.py` train HistGradientBoosting trên 6.068 người
   ANSUR II CC0-1.0, đầu vào là chiều cao+BMI, đầu ra ngực/eo/hông. Split
   3.883/971/1.214; held-out MAE lần lượt 2,954/3,612/3,090cm. Checkpoint:
   `9f6bf3f477aa3a448798be1d27790d47096dc1c28d9810658d2349775cfe5b6e`.

MAE tầng hai chỉ là hồi quy bảng số đo. Sai số của ảnh được cộng thêm nên runtime
nới khoảng bất định lên tối thiểu 12cm cho các vòng, confidence tối đa 0,28 và
không cho tự chọn size. Celeb-FBI dùng metadata người nổi tiếng; ANSUR II là
quân nhân Mỹ. Hai nguồn này chưa chứng minh độ chính xác trên khách hàng Việt.
Các smoke crop riêng đã đi qua ba ca: mất bàn chân, chỉ còn thân trên và mất
đầu. Cả ba đều trả trạng thái `partial`, đủ năm khoảng và
`usableForSizing=false`; ảnh chỉ được coi là toàn thân khi đầu, coverage và bàn
chân đều hiện diện. Bằng chứng Redmi:
`test-results/live-debug/partial-seated-visible-final.png`.

Lệnh train lại prior ba vòng vào một thư mục run mới:

```bash
/home/admin123/jp/ai/fashn-vton-1.5/.venv/bin/python \
  backend/ai_training/train_partial_girth_prior.py \
  --data backend/ai_training/workbench/raw/ansur2/files \
  --output backend/ai_training/runs/partial-girth-prior-new
```

### Model và dữ liệu bên ngoài Kaggle đã rà soát

- [Amazon BodyM](https://registry.opendata.aws/bodym/): 2.505 subject, 8.978
  silhouette chính diện/nghiêng, cao+nặng và 14 số đo; đã tải và train, nhưng
  CC-BY-NC-4.0.
- [Digital Scale](https://github.com/im-ethz/DigitalScale): kiến trúc
  ViT/DINOv2 đáng tham khảo và WayBED lớn, nhưng repo yêu cầu liên hệ tác giả để
  xin dữ liệu/trọng số BMI; chưa có quyền nên không train.
- [SHAPY datasets](https://shapy.is.tue.mpg.de/datasets.html): Model Agency có
  nhiều ảnh URL và cao/ngực/eo/hông, nhưng phải đăng ký và dùng nghiên cứu phi
  thương mại; không tự động tải bằng credential Kaggle.
- [2DImage2BMI](https://github.com/FVL2020/2DImage2BMI): code công khai, nhưng
  điều khoản dữ liệu/triển khai chưa đủ rõ để đưa vào sản phẩm; chỉ audit.
- [Body2BMI-ITU](https://arxiv.org/abs/2607.26104): paper báo miền 34–250 kg,
  nhưng dữ liệu/model được mô tả là sẽ công bố; hiện chưa có artifact hợp pháp để
  tải và train.
- [BODIES v1.0](https://zenodo.org/records/17912003): đã tải `data16` nữ+nam,
  checksum đúng, CC-BY-4.0, 12.000 người tổng hợp với ảnh trước/nghiêng và nhãn
  cao+nặng; đã train và đo domain transfer như bảng trên.

### Lệnh tái lập

```bash
cd /home/admin123/Documents/JAPANO

# Tải BodyM công khai và tạo crop Celeb-FBI bằng detector hiện có.
/home/admin123/venvs/ai/bin/python backend/ai_training/fetch_bodym_dataset.py \
  --root /home/admin123/jp/datasets/bodym --splits train testA testB --views mask --workers 24
/home/admin123/jp/ai/fashn-vton-1.5/.venv/bin/python \
  backend/ai_training/prepare_celeb_fbi_person_crops.py

# Fine-tune RGB, mọi layer đều được optimizer cập nhật.
/home/admin123/venvs/ai/bin/python backend/ai_training/train_photo_bmi_model.py \
  --architecture densenet201 --epochs 20 --batch-size 96 \
  --output backend/ai_training/runs/photo-bmi-densenet201-new
/home/admin123/venvs/ai/bin/python backend/ai_training/train_photo_bmi_model.py \
  --dataset /home/admin123/jp/datasets/celeb-fbi-person-crops \
  --epochs 24 --batch-size 192 \
  --output backend/ai_training/runs/photo-bmi-cropped-new

# Fine-tune silhouette và train prior bảng.
/home/admin123/venvs/ai/bin/python backend/ai_training/train_bodym_silhouette_model.py \
  --root /home/admin123/jp/datasets/bodym \
  --output backend/ai_training/runs/bodym-silhouette-new
/home/admin123/venvs/ai/bin/python backend/ai_training/train_japanese_weight_prior.py \
  --output backend/ai_training/runs/japanese-weight-prior-new

# Pretrain ConvNeXt trên BODIES rồi chỉ nạp backbone để fine-tune ảnh thật.
/home/admin123/venvs/ai/bin/python backend/ai_training/train_bodies_pretrain.py \
  --dataset /home/admin123/jp/datasets/bodies/extracted/data16 \
  --architecture convnext_tiny --genders female male --epochs 16 \
  --batch-size 192 --output backend/ai_training/runs/bodies-convnext-new
/home/admin123/venvs/ai/bin/python backend/ai_training/train_photo_bmi_model.py \
  --architecture convnext_tiny --epochs 24 --batch-size 192 \
  --init-backbone backend/ai_training/runs/bodies-convnext-new/bodies_height_bmi_convnext_tiny.pt \
  --output backend/ai_training/runs/photo-bmi-bodies-init-new
```

Không ghi đè thư mục run cũ khi thuyết trình. Model chỉ được nối vào app sau khi
vượt baseline trên tập khách hàng có đồng thuận, có cân/thước thật, đủ số mẫu ở
mỗi dải cân nặng, và giấy phép cho phép triển khai thương mại. LangChain/
LangGraph điều phối chatbot và gọi tool; chúng không phải model để fine-tune.
LoRA/VeRA hiện chỉ fine-tune intent adapter chatbot và không thể làm số đo ảnh
chính xác hơn.
