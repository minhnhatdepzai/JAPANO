# Lời thoại thuyết trình AI JAPANO

Ngày đối chiếu mã nguồn và kết quả: 28/09/2026. Đọc cùng [README huấn luyện](README_AI_TRAINING.md). Các số dưới đây là kết quả thử nghiệm giới hạn, không phải cam kết chất lượng cho mọi khách hàng.

## 1. Mở đầu — khoảng 1 phút

“JAPANO là ứng dụng bán thời trang có các tính năng AI hỗ trợ tìm sản phẩm, tư vấn, thử đồ, ghép cảnh Nhật Bản và tạo chuyển động. Em chia hệ thống thành ba phần: dữ liệu kinh doanh hiện tại; các mô hình học máy; và lớp điều phối, kiểm tra kết quả. Cách chia này giúp thay đổi giá hoặc tồn kho mà không phải huấn luyện lại mô hình. Đồng thời, một ảnh được sinh thành công chưa có nghĩa là ảnh đúng: hệ thống còn phải kiểm tra người, trang phục và độ che phủ.”

## 2. LangChain và LangGraph — khoảng 2 phút

“LangChain là bộ công cụ giúp nối mô hình ngôn ngữ với dữ liệu và các công cụ. LangGraph là thư viện điều phối tác vụ dưới dạng đồ thị có trạng thái. Tên đúng là LangGraph. Đây là thư viện phần mềm, không phải mô hình có trọng số để fine-tune.

Trong JAPANO, em đã tích hợp LangGraph JavaScript ở backend. Một lượt chat đi qua bốn bước: phân tích tương tác khách hàng; truy xuất catalog; phân loại ý định; và kiểm tra câu trả lời trước khi trả về. Trạng thái đồ thị mang theo câu hỏi, dữ liệu sản phẩm, kết quả truy xuất và thông tin phương pháp đã dùng.

Nếu luật nhận diện chưa hiểu câu hỏi, hệ thống có thể gọi Qwen3-4B với adapter đã huấn luyện để phân loại ý định. Adapter chỉ được trả nhãn như hỏi giá, hỏi size hoặc phối đồ. Nó không tự đặt giá, tồn kho hay chính sách cửa hàng. Khi GPU bận tạo ảnh hoặc quá thời gian, chatbot dùng kết quả truy xuất có sẵn.

Ví dụ khách hỏi giá Yukata: câu trả lời lấy sản phẩm đang published và còn hàng từ catalog. Khi không tìm thấy món phù hợp, bot phải nói chưa xác định được thay vì bịa ra sản phẩm.”

**Mã để mở khi trình bày:** `backend/lib/chatGraph.js`, `backend/routes/stylist.js`. Graph hiện là chuỗi xử lý cố định, chưa phải agent tự lập kế hoạch hoặc hệ multi-agent. Chất lượng tìm kiếm vẫn cần thêm đánh giá tiếng Việt và tình huống thực.

## 3. Vector, embeddings, VectorDB và RAG — khoảng 2 phút

“Embedding biến một đoạn văn thành dãy số biểu diễn đặc trưng ngữ nghĩa. Ta có thể so độ gần bằng cosine similarity để tìm các mô tả liên quan, kể cả khi từ khóa không trùng hoàn toàn. VectorDB là hệ lưu trữ và tìm kiếm vector, thường hỗ trợ chỉ mục truy vấn gần đúng, metadata và lọc dữ liệu.

Trong mã JAPANO có module gọi dịch vụ sentence-transformer, chuẩn hóa vector và lưu cache sản phẩm bằng Map trong bộ nhớ Node. Phép so vector chuẩn hóa dùng dot product, tương đương cosine similarity. Đây là cache vector trong RAM; em không gọi nó là một VectorDB độc lập đã triển khai. Database kinh doanh hiện tại là MongoDB. Em chưa có bằng chứng trong đợt demo này rằng một Qdrant, Milvus, Chroma hay chỉ mục MongoDB Atlas Vector Search đang phục vụ chatbot.

RAG là truy xuất dữ liệu rồi sử dụng dữ liệu đó làm ngữ cảnh cho câu trả lời. Luồng hiện tại thiên về truy xuất catalog và dựng câu trả lời có kiểm soát. Fine-tuning giúp mô hình học tác vụ, còn truy xuất giúp lấy thông tin mới. Hai việc bổ sung cho nhau; fine-tune không thay thế database sản phẩm.”

**Nếu sếp hỏi tại sao chưa có VectorDB:** “Catalog còn nhỏ nên cache và lọc trực tiếp đủ cho demo. Khi lượng tài liệu tăng, bước tiếp theo là benchmark chất lượng truy xuất rồi chọn chỉ mục vector phù hợp, có lọc hàng còn bán và quyền truy cập.”

**Mã đối chiếu:** `backend/lib/embeddings.js`. Dịch vụ embedding có thể chưa sẵn sàng trên máy; không nói mọi câu chat hiện tại đều đã đi qua tìm kiếm vector.

## 4. Em fine-tune như thế nào? — khoảng 3 phút

“Em dùng Qwen3-4B-Instruct-2507 làm mô hình nền, khóa revision để tái lập. Tác vụ em huấn luyện là phân loại ý định hội thoại, không phải học thuộc toàn bộ câu trả lời.

Dữ liệu gồm 312 câu tiếng Việt tự xây dựng, có đánh dấu tổng hợp, và 120 câu chọn từ bộ Bitext customer support trên Kaggle. Catalog snapshot có 53 sản phẩm công khai được dùng làm ngữ cảnh; dữ liệu khách hàng riêng tư không được đưa vào tập train. Metadata Kaggle công bố Bitext theo CDLA Sharing 1.0. Công cụ lưu nguồn, giấy phép và checksum.

Em chia 432 mẫu thành 280 train, 76 validation và 76 test. Tách theo nhóm mẫu câu để giảm trùng lặp giữa các tập. Validation dùng chọn checkpoint, test giữ riêng để đánh giá cuối cùng. Vì tên sản phẩm vẫn có thể lặp giữa các tập và câu tiếng Việt là tổng hợp, kết quả này chỉ đánh giá tác vụ intent trên bộ kiểm tra nhỏ.

Với LoRA, em đóng băng trọng số nền và học ma trận cập nhật hạng thấp cho q_proj và v_proj: rank 16, alpha 32. Mô hình có khoảng 5,9 triệu tham số được cập nhật. Em dùng AdamW, learning rate 0,0002, batch 8, BF16 và gradient checkpointing, chạy 60 bước optimizer. Loss chỉ tính token câu trả lời assistant.

Với VeRA, ma trận chiếu được giữ cố định và chia sẻ, chủ yếu học các vector tỉ lệ. Em dùng rank 256, 202.752 tham số học, learning rate 0,004, batch 16 và 60 bước. Hai cấu hình khác batch và learning rate, nên đây chưa phải so sánh hoàn toàn ngang điều kiện.

Trên 76 câu test: mô hình nền đúng 57 câu, LoRA đúng 75 câu, VeRA đúng 76 câu. Không thể suy từ đó rằng chatbot đúng 100% ngoài thực tế. LoRA được chọn cho demo theo validation loss. Em đã lưu adapter, tính SHA-256, nạp lại và chạy đánh giá. Đó là bằng chứng fine-tuning thật: có cập nhật optimizer và checkpoint sử dụng lại được, không chỉ sửa prompt.”

**Công thức có thể viết trên slide:** LoRA: `W_mới = W_gốc + (alpha/r) × B × A`. VeRA: `W_mới = W_gốc + diag(b) × B_cố_định × diag(d) × A_cố_định`. Các ma trận/vector có kích thước theo từng layer; công thức diễn giải nguyên lý.

**Demo công cụ:** chạy `data_workbench.py export` để xuất trường sản phẩm cho phép từ JSON/CSV; `build_chat_sft.py` tạo JSONL; `train_chat_adapter.py --method lora ...` train vào thư mục mới; mở `report.json` và `evaluation.json`. Lệnh cụ thể trong README huấn luyện. Không chạy lại train lúc khách đang tạo ảnh trên cùng GPU.

## 5. Các AI ảnh — khoảng 2 phút

“Em đã fine-tune thêm ResNet18 pretrained ImageNet, cập nhật layer4 và classifier để phân loại ba nhóm Apparel, Footwear và Accessories. Dữ liệu Fashion Product Images Small từ Kaggle công bố giấy phép MIT. Em chọn 4.800 ảnh: 3.600 train, 600 validation, 600 test; train ba epoch, 171 bước. Kết quả test đúng 593/600 ảnh, tương đương 98,83%. Đây là ảnh catalog, chưa chứng minh chất lượng trên ảnh khách chụp và chưa kiểm toán hết ảnh gần trùng.

Thử đồ là mô hình khác: FASHN VTON thay trang phục; FLUX.2 Klein hỗ trợ chỉnh tư thế hoặc bộ bikini hai mảnh. Các mô hình sinh ảnh này đang dùng trọng số có sẵn, chưa được fine-tune mới trong đợt này. Fine-tune ResNet không làm FASHN tự giữ mặt tốt hơn.

Lỗi đầu trên ảnh khoanh tay vừa được truy ra do điều kiện tay che áo ép dựng lại toàn thân. Em sửa luồng để giữ dáng gốc và đi thẳng FASHN. Cùng ảnh và áo Happi Matsuri đã tạo lại trong khoảng 33 giây, giữ khuôn mặt gần ảnh gốc và vượt kiểm tra chất lượng. Nhưng không tuyên bố mọi ảnh đều sẽ giữ mặt tuyệt đối.

Ghép cảnh Nhật dùng phân đoạn người và bố trí vào vùng đứng đã định nghĩa. Video dùng One-to-All/Wan, là suy luận sinh chuyển động, không phải fine-tuning trong đợt này. Phải trình bày trạng thái runtime mới nhất trước demo, vì model đủ file chưa chứng minh tạo được clip đạt chất lượng.”

## 6. Phân tích hành vi khách hàng — khoảng 1 phút

“Phần cá nhân hóa sử dụng các sự kiện có thể giải thích: xem, nhấp, yêu thích, thêm giỏ và mua. Điểm lần lượt là 1, 2, 3, 4 và 5, giảm theo tuổi sự kiện trong cửa sổ 90 ngày. Hệ thống chỉ lấy tương tác của tài khoản đã xác thực, loại sự kiện bot tự tạo, và cần ít nhất ba tương tác mới coi là có bằng chứng sở thích. Điểm này là quy tắc xếp hạng, không phải một mô hình phân tích tâm lý đã train.

Bộ Retail Sales trên Kaggle gồm 1.000 dòng tổng hợp chỉ để minh họa phân tích doanh thu. Em không trình bày nó là doanh thu thật hoặc hành vi thật của khách JAPANO.”

## 7. Vì sao chiều cao, cân nặng và vòng 1–2–3 không thể đo chuẩn từ mọi ảnh? — khoảng 2 phút

“Một ảnh chỉ cho hình chiếu 2D. Hai người khác chiều cao có thể chiếm cùng số pixel nếu đứng ở khoảng cách khác nhau. Quần áo và tư thế làm thay đổi đường viền. Ảnh chính diện cũng không cho đủ chiều sâu để tính chu vi cơ thể. Cân nặng là khối lượng, không được camera đo trực tiếp.

Do đó, thấy một người có vóc dáng lớn không phải bằng chứng người đó nặng 150 kg. Nếu 150 kg là số từ cân thật, hệ thống phải giữ số đó, không kéo về mức trung bình dân số. Với người rất gầy cũng không được tùy tiện hạ cân nặng chỉ dựa vào bề ngang ảnh.

Em đã bổ sung chính sách bằng chứng: ảnh đơn không có chuẩn không trả chiều cao tuyệt đối; cân nặng và vòng đo chưa được kiểm chứng trả không đủ bằng chứng. Người dùng vẫn thử đồ được. Chiều cao nhập tay hoặc vật chuẩn được ưu tiên; cân nặng nhập từ cân được giữ. Đây là sửa tính trung thực của đầu ra, chưa phải đạt mô hình đo lường chính xác hơn.”

**Lộ trình để cải thiện có kiểm chứng:**

1. Thu dữ liệu tự nguyện gồm ảnh trước và nghiêng, chiều cao đo bằng thước, cân nặng từ cân, vòng ngực/eo/hông từ thước dây; ghi thời điểm và cách đo. Bao phủ người gầy, trung bình và vóc dáng lớn; không chỉ dùng dữ liệu quân nhân hoặc ảnh người mẫu.
2. Kiểm soát camera, khoảng cách, vật chuẩn cùng mặt phẳng và tư thế; lưu thông tin quần áo, che khuất, độ nét. Không dùng số đo tự bịa làm nhãn huấn luyện.
3. Chia train/validation/test theo **người**, mọi ảnh của một người chỉ ở một tập. Kiểm tra riêng người ở hai đầu phân bố cân nặng và các loại camera.
4. Train mô hình hồi quy/mô hình cơ thể 3D phù hợp; so với baseline; báo MAE, sai lệch có hướng và phân vị lỗi cho từng số đo, từng nhóm. Chỉ số MAE trên bảng số đo không thay thế đánh giá end-to-end từ ảnh.
5. Hiệu chuẩn khoảng bất định trên validation; từ chối dự đoán khi ngoài miền dữ liệu hoặc ảnh không đạt. Đặt ngưỡng nghiệm thu trước khi mở dùng thật. Chưa có tập đo thật này trong đợt triển khai, nên chưa có số MAE mới để công bố.

## 8. Hỏi đáp nhanh

**Đã fine-tune LangChain chưa?** “Không có trọng số LangChain để fine-tune. Em fine-tune Qwen bằng LoRA/VeRA, dùng LangGraph để điều phối.”

**Đã train toàn bộ AI chưa?** “Chưa. Đã train intent Qwen và classifier ResNet18. Try-on và motion dùng model có sẵn.”

**Có VectorDB chưa?** “Có module embedding và cache vector trong RAM; chưa xác nhận triển khai VectorDB chuyên dụng.”

**Vì sao bikini đôi khi bị chặn?** “Có kiểm tra đủ tuổi, người trong ảnh, độ che phủ và giữ danh tính. Đã có mẫu người lớn tạo thành công khoảng 46 giây; mẫu khác vẫn có lỗi biến dạng, cần đánh giá tiếp. Không bỏ gate để lấy tỷ lệ thành công giả.”

**Dùng hết VRAM có tốt hơn không?** “VRAM đủ chứa model và activation mới quan trọng. VeRA đã quan sát khoảng 15.193/16.311 MiB và GPU 100%; cố lấp đầy VRAM có thể gây OOM. Hệ thống xếp hàng GPU để chat và tạo ảnh không tranh bộ nhớ.”

**SEO nằm ở đâu?** “Ở trang sản phẩm công khai: title, description, canonical và Product JSON-LD; chatbot trả link catalog. Không hứa thứ hạng Google.”

**Có thể triển khai thương mại ngay không?** “Bộ đánh giá hiện là engineering demo, productionApproved vẫn false. Cần rà soát quyền dữ liệu/model, kiểm thử người dùng và chất lượng trên bộ ảnh độc lập trước khi mở rộng.”

## 9. Kịch bản demo 5 phút

- Mở catalog thật, chọn sản phẩm rồi hỏi giá; đối chiếu giá trong database.
- Mở `backend/lib/chatGraph.js`, chỉ bốn node và nhánh adapter/fallback.
- Mở [bằng chứng huấn luyện](ai-evidence-20260928/presentation.html): số bước optimizer, held-out, hash và nạp lại.
- Mở ảnh thử đồ đã kiểm tra; tách rõ kết quả đã xác nhận và ca còn lỗi.
- Cho xem ảnh không có chuẩn trả thiếu bằng chứng; nhập số đo thật để tư vấn size. Không dùng ảnh đó để khẳng định hệ thống biết chính xác cân nặng.
- Chỉ demo video trực tiếp sau khi health và một lượt MP4 thật đã đạt; nếu chưa, trình bày đúng trạng thái chưa hoàn tất.

## Kết quả demo vừa xác nhận

- Video đi bộ: MP4 thật 49 frame/12fps, 57,13 giây qua API; đã xem các khung hình, bước đi còn hơi kiểu trình diễn.
- Bikini mẫu cân đối: seed đầu bị chặn do biến dạng, seed thứ hai đạt kiểm tra danh tính/che phủ; 70,36 giây tổng, ảnh đã xem. Không cần tắt gate.
- API số đo: ảnh không có chuẩn trả thiếu bằng chứng và không dùng mẫu người để điền số; nhập 160 cm/150 kg được giữ nguyên. Đây là sửa hợp đồng đầu ra, chưa train mô hình số đo mới.

### Bổ sung phần hồi quy số đo vừa khôi phục

“Em đã huấn luyện lại các bộ hồi quy HistGradientBoosting trên ANSUR II để thay các checkpoint bị thiếu. Đây là bảng số đo thật, không có ảnh. Chọn cấu hình trên validation, giữ 1.214 người làm test riêng. MAE bảng số đo khoảng 3,21 kg và 1,80–2,67 cm cho các vòng. Chưa được gọi đó là độ chính xác dự đoán từ ảnh. Tập test không có người trên 150 kg nên em không khẳng định khả năng ở nhóm này. Ảnh đủ rõ được trả giả thuyết theo khoảng; mẫu ngoài miền dữ liệu vẫn cần bổ sung số đo thật.”
