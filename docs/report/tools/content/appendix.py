"""Tài liệu tham khảo và các phụ lục."""
import json
from pathlib import Path

from docx.shared import Cm

EVID = Path(__file__).resolve().parents[2] / 'evidence'

REFS = [
    ('[1]', 'C. C. Gordon, C. L. Blackwell, B. Bradtmiller và cộng sự, *2012 Anthropometric Survey of '
            'U.S. Army Personnel: Methods and Summary Statistics (ANSUR II)*, U.S. Army Natick Soldier '
            'Research, Development and Engineering Center, Technical Report NATICK/TR-15/007, 2014. '
            'Giấy phép CC0-1.0. Truy cập 26/08/2026.'),
    ('[2]', 'N. Ruiz, M. Bell, A. Wang và cộng sự, "Amazon BodyM Dataset", Amazon Science, 2022. '
            'Giấy phép CC-BY-NC-4.0 (phi thương mại). Truy cập 27/08/2026.'),
    ('[3]', 'S. Choi, S. Park, M. Lee và J. Choo, "VITON-HD: High-Resolution Virtual Try-On via '
            'Misalignment-Aware Normalization", *Proceedings of the IEEE/CVF Conference on Computer '
            'Vision and Pattern Recognition (CVPR)*, 2021, tr. 14131–14140. Bộ dữ liệu phát hành theo '
            'CC-BY-NC-SA-4.0. Truy cập 25/08/2026.'),
    ('[4]', 'FASHN AI, "FASHN VTON 1.5 — Model Card", tài liệu chính thức của tác giả mô hình. Vai trò '
            'trong JAPANO: engine sinh ảnh thử đồ chính, **chỉ suy luận, không huấn luyện lại**. Truy '
            'cập 29/08/2026.'),
    ('[5]', 'Black Forest Labs, "FLUX.2 Klein 4B — Model Card", tài liệu chính thức. Vai trò trong '
            'JAPANO: chuyển tư thế, tinh chỉnh phụ kiện, mô phỏng độ vừa vặn. **Suy luận với trọng số '
            'gốc; riêng bước mô phỏng độ vừa vặn có một bộ chuyển thể LoRA do nhóm huấn luyện.** Truy '
            'cập 26/08/2026.'),
    ('[6]', 'E. J. Hu, Y. Shen, P. Wallis và cộng sự, "LoRA: Low-Rank Adaptation of Large Language '
            'Models", *International Conference on Learning Representations (ICLR)*, 2022. Cơ sở lý '
            'thuyết của bộ chuyển thể ở mục 6.5.'),
    ('[7]', 'Wan-AI, "Wan2.1-T2V-1.3B — Model Card", tài liệu chính thức. Vai trò trong JAPANO: mô '
            'hình nền cho bước sinh video. **Tối ưu suy luận, không fine-tune.** Truy cập 29/08/2026.'),
    ('[8]', 'One-to-All Animation, kho mã nguồn và tài liệu chính thức, phiên bản `1.3b_2`. Vai trò: '
            'bộ điều khiển chuyển động chạy trên Wan2.1. Truy cập 29/08/2026.'),
    ('[9]', 'G. Jocher, A. Chaurasia và J. Qiu, "Ultralytics YOLOv8", tài liệu chính thức, 2023. Vai '
            'trò trong JAPANO: mô hình `YOLOv8n-pose` lấy 17 điểm khớp cơ thể. Truy cập 28/08/2026.'),
    ('[10]', 'X. Qin, Z. Zhang, C. Huang, M. Dehghan, O. R. Zaiane và M. Jagersand, "U²-Net: Going '
             'Deeper with Nested U-Structure for Salient Object Detection", *Pattern Recognition*, '
             'tập 106, 2020. Vai trò: tách hình bóng người. Truy cập 28/08/2026.'),
    ('[11]', 'J. Ho, A. Jain và P. Abbeel, "Denoising Diffusion Probabilistic Models", *Advances in '
             'Neural Information Processing Systems (NeurIPS)*, 2020. Cơ sở lý thuyết của mục 2.6.1.'),
    ('[12]', 'A. Gu và T. Dao, "Mamba: Linear-Time Sequence Modeling with Selective State Spaces", '
             'arXiv:2312.00752, 2023. **Nguồn ý tưởng** cho khối không gian trạng thái chọn lọc ở mục '
             '6.8.2; JAPANO không sử dụng checkpoint Mamba nào.'),
    ('[13]', 'X. He, K. Deng, X. Wang, Y. Li, Y. Zhang và M. Wang, "LightGCN: Simplifying and Powering '
             'Graph Convolution Network for Recommendation", *SIGIR*, 2020. **Nguồn ý tưởng** cho khối '
             'lan truyền đồ thị ở mục 6.8.2; JAPANO không sử dụng checkpoint LightGCN nào.'),
    ('[14]', 'M. Beck, K. Pöppel, M. Spanring và cộng sự, "xLSTM: Extended Long Short-Term Memory", '
             '*NeurIPS*, 2024. **Nguồn ý tưởng** cho bộ nhớ hội thoại dạng ma trận ở mục 6.9.2.'),
    ('[15]', 'Y. Koren, R. Bell và C. Volinsky, "Matrix Factorization Techniques for Recommender '
             'Systems", *Computer*, tập 42, số 8, tr. 30–37, 2009. Cơ sở của nguồn gợi ý thứ nhất.'),
    ('[16]', 'B. Sarwar, G. Karypis, J. Konstan và J. Riedl, "Item-Based Collaborative Filtering '
             'Recommendation Algorithms", *WWW*, 2001. Cơ sở của nguồn gợi ý thứ hai.'),
    ('[17]', 'R. Agrawal và R. Srikant, "Fast Algorithms for Mining Association Rules", *VLDB*, 1994. '
             'Cơ sở của phần luật mua kèm ở mục 6.11.5.'),
    ('[18]', 'C. C. Holt, "Forecasting Seasonals and Trends by Exponentially Weighted Moving Averages", '
             '*International Journal of Forecasting*, tập 20, số 1, tr. 5–10, 2004 (bản in lại của báo '
             'cáo năm 1957). Cơ sở của mô hình làm mượt luỹ thừa kép ở mục 6.11.1.'),
    ('[19]', 'J. MacQueen, "Some Methods for Classification and Analysis of Multivariate Observations", '
             '*Proceedings of the Fifth Berkeley Symposium on Mathematical Statistics and Probability*, '
             '1967. Cơ sở của phân cụm ở mục 6.11.3.'),
    ('[20]', 'K. Järvelin và J. Kekäläinen, "Cumulated Gain-Based Evaluation of IR Techniques", *ACM '
             'Transactions on Information Systems*, tập 20, số 4, tr. 422–446, 2002. Định nghĩa NDCG — '
             'chỉ số mà JAPANO **chưa đo được**, xem mục 6.8.6.'),
    ('[21]', 'MongoDB Inc., *MongoDB Manual* — Data Modeling, Indexes, và WiredTiger Storage Engine, '
             'tài liệu chính thức. Truy cập 31/08/2026.'),
    ('[22]', 'Expo, *Expo SDK 51 Documentation*, tài liệu chính thức. Truy cập 30/08/2026.'),
    ('[23]', 'Meta Platforms, *React Native 0.74 Documentation* và *React 19 Documentation*, tài liệu '
             'chính thức. Truy cập 30/08/2026.'),
    ('[24]', 'OpenJS Foundation, *Express 4.x API Reference*, tài liệu chính thức. Truy cập 30/08/2026.'),
    ('[25]', 'Stripe Inc., *Stripe API Reference* và *Testing Guide*, tài liệu chính thức. JAPANO sử '
             'dụng ở chế độ Test Mode. Truy cập 30/08/2026.'),
    ('[26]', 'VNPay, *Tài liệu tích hợp cổng thanh toán VNPay* — môi trường Sandbox, tài liệu chính '
             'thức. Truy cập 30/08/2026.'),
    ('[27]', 'N. Provos và D. Mazières, "A Future-Adaptable Password Scheme", *USENIX Annual Technical '
             'Conference*, 1999. Cơ sở của hàm băm bcrypt.'),
    ('[28]', 'M. Jones, J. Bradley và N. Sakimura, "JSON Web Token (JWT)", RFC 7519, IETF, 2015.'),
    ('[29]', 'OWASP Foundation, *OWASP Top 10:2021* và *Cheat Sheet Series* (XSS Prevention, CSRF '
             'Prevention, SSRF Prevention). Khung tham chiếu cho phần rà soát bảo mật ở mục 7.3.'),
    ('[30]', 'W3C, *Web Content Accessibility Guidelines (WCAG) 2.1*, W3C Recommendation, 2018. Tiêu '
             'chuẩn dùng cho phần kiểm tra khả năng truy cập ở mục 5.2.4 và 5.3.3.'),
    ('[31]', 'Wikimedia Commons, các tệp ảnh địa danh Nhật Bản dùng làm ảnh nền cho tính năng ghép '
             'cảnh. Giấy phép và phần ghi nguồn của từng ảnh được hiển thị kèm ảnh trong ứng dụng và '
             'lưu trong `backend/lib/japanScenes.js`. Truy cập 29/08/2026.'),
]


def _api_appendix(r):
    path = EVID / 'api_endpoints.json'
    if not path.exists():
        return
    data = json.loads(path.read_text())
    labels = {
        'auth': 'Xác thực và tài khoản', 'catalog': 'Danh mục sản phẩm và dữ liệu hành chính',
        'orders': 'Đơn hàng', 'returns': 'Trả hàng và hoàn tiền', 'payments': 'Thanh toán chung',
        'paymentsStripe': 'Thanh toán Stripe', 'paymentsVnpay': 'Thanh toán VNPay',
        'reviews': 'Đánh giá và kiểm duyệt', 'loyalty': 'Khách hàng thân thiết',
        'stylist': 'Stylist, đo cơ thể và trợ lý', 'tryon': 'Thử đồ ảo và video',
        'asyncAiJobs': 'Hàng đợi công việc AI bất đồng bộ', 'japanSpots': 'Địa danh Nhật Bản',
        'customerData': 'Dữ liệu khách hàng: giỏ, yêu thích, nhật ký', 'addresses': 'Sổ địa chỉ',
        'admin': 'Quản trị', 'health': 'Sức khoẻ hệ thống và chẩn đoán', 'push': 'Thông báo đẩy',
        'apkDownload': 'Tải bản cài đặt Android',
    }
    total = sum(len(v) for v in data.values())
    r.p(f'Tổng cộng **{total} điểm cuối** trong {len(data)} tệp chia theo miền nghiệp vụ. Danh sách '
        'được sinh trực tiếp từ mã nguồn ngày 31/08/2026, không chép tay.', indent=False)
    for stem, rows in sorted(data.items(), key=lambda kv: -len(kv[1])):
        r.table(f'Điểm cuối thuộc miền {labels.get(stem, stem)} (`backend/routes/{stem}.js`).',
                ['Phương thức', 'Đường dẫn'],
                [[m, f'`{p}`'] for m, p in rows],
                widths=[Cm(2.6), Cm(12.9)], font=10)


def build(r):
    # ------------------------------------------------------- tài liệu tham khảo
    r.front_h1('Tài liệu tham khảo')
    r.p('Trích dẫn theo chuẩn IEEE. Mỗi mô hình và mỗi bộ dữ liệu đều được ghi kèm vai trò của nó trong '
        'JAPANO và trạng thái huấn luyện, để người đọc không phải suy đoán. Các nguồn được đánh dấu '
        '"nguồn ý tưởng" là những công trình mà JAPANO lấy cảm hứng về kiến trúc nhưng **không** sử '
        'dụng checkpoint của chúng.', indent=False)
    for tag, text in REFS:
        para = r.doc.add_paragraph()
        para.paragraph_format.first_line_indent = Cm(0)
        para.paragraph_format.left_indent = Cm(1.2)
        para.paragraph_format.space_after = Cm(0.15)
        para.paragraph_format.line_spacing = 1.3
        from report_engine import _set_font
        _set_font(para.add_run(f'{tag}\t'), size=12, bold=True)
        r._rich(para, text, size=12)

    # =============================================================== PHỤ LỤC
    r.appendix('A', 'Phụ lục A — Danh sách điểm cuối API theo miền nghiệp vụ')
    _api_appendix(r)

    r.appendix('B', 'Phụ lục B — Từ điển dữ liệu bổ sung')
    r.p('Mục 4.8 đã mô tả chi tiết mười collection quan trọng nhất. Phụ lục này bổ sung hai mươi '
        'collection còn lại ở mức tóm tắt.', indent=False)
    r.table(
        'Hai mươi collection còn lại: vai trò, trường chính và ghi chú vận hành.',
        ['Collection', 'Trường chính', 'Ghi chú'],
        [
            ['`categories`', '`id`, `name`, `kanji`, `slug`', 'Danh mục sản phẩm; 5 bản ghi.'],
            ['`product_media`', '`productId`, `type`, `url`, `position`',
             'Chỉ URL và metadata. Không byte ảnh nào nằm trong cơ sở dữ liệu.'],
            ['`cart_items`', '`userId`, `productId`, `variant`, `qty`',
             'Trạng thái tạm. Hợp nhất với giỏ trên thiết bị khi đăng nhập.'],
            ['`wishlist_items`', '`userId`, `productId`, `createdAt`',
             'Cũng là nguồn tín hiệu dương cho hệ gợi ý (trọng số 3).'],
            ['`return_requests`', '`orderId`, `items[]`, `status`, `reason`, `trackingCode`',
             'Theo từng dòng hàng, không theo cả đơn.'],
            ['`vouchers`', '`code`, `type`, `value`, `minOrder`, `expiry`, `usageLimit`',
             'Mọi phép tính giảm giá đều chạy lại phía máy chủ.'],
            ['`voucher_redemptions`', '`voucherCode`, `userId`, `orderId`, `usedAt`',
             'Sổ đối chiếu; giữ riêng để mỗi mã chỉ dùng đúng số lần cho phép.'],
            ['`flagcards`', '`id`, `name`, `prefecture`, `imageUrl`, `rarity`',
             'Bảy thẻ địa danh của chương trình khách hàng thân thiết.'],
            ['`flagcard_collections`', '`userId`, `cardIds[]`, `redeemedAt`',
             'Giữ riêng vì có thể chứa thẻ do quản trị viên cấp mà không đơn hàng nào ngụ ý.'],
            ['`goals`', '`userId`, `productId`, `targetAmount`, `savedAmount`, `kind`',
             'Trường `kind` tách mục tiêu mua sắm khỏi mục tiêu sức khoẻ.'],
            ['`notifications`', '`userId`, `title`, `body`, `data`, `readAt`',
             'Trường `data` mang đường dẫn sâu tới màn hình đích.'],
            ['`push_tokens`', '`userId`, `token`, `platform`, `updatedAt`',
             'Đã có bảng nhưng **thông báo đẩy từ xa chưa gửi được** — xem mục 5.1.10.'],
            ['`chats`', '`userId`, `role`, `message`, `createdAt`',
             'Lịch sử hội thoại; cũng là nguồn tín hiệu nhắc sản phẩm cho điểm nhu cầu.'],
            ['`search_logs`', '`userId`, `query`, `resultCount`, `createdAt`',
             'Trường `resultCount` bằng 0 là dữ liệu có giá trị nhất: nhu cầu chưa đáp ứng.'],
            ['`review_reactions`', '`reviewId`, `userId`, `type`',
             'Chỉ mục duy nhất trên cặp (đánh giá, người dùng) để mỗi người phản hồi một lần.'],
            ['`moderation_samples`', '`normalizedText`, `label`, `learnedPhrases[]`',
             'Bộ nhớ mẫu của bộ kiểm duyệt; **không phải** dữ liệu huấn luyện mô hình.'],
            ['`japan_spot_reviews`', '`spotId`, `userId`, `rating`, `content`',
             'Đi qua cùng bộ kiểm duyệt với đánh giá sản phẩm.'],
            ['`japan_spot_suggestions`', '`userId`, `prefecture`, `place`, `suggestion`, `reward`',
             'Trường `reward` là **voucher thưởng nghiệp vụ**, không liên quan tới học tăng cường — '
             'xem mục 6.6.'],
            ['`settings`', '`_id`, `items[]`',
             'Đã nhận cả banner và quy tắc giảm giá sau lần gộp collection. Bản ghi '
             '`_id=storage_schema` là dấu mốc nhận biết cơ sở dữ liệu đã khởi tạo.'],
            ['`addresses`', '`userId`, `name`, `phone`, `province`, `ward`, `detail`',
             'Theo cơ cấu hành chính Việt Nam sau sáp nhập: **34 tỉnh/thành và 3 321 phường/xã**, '
             '**không có cấp quận/huyện**.'],
        ],
        widths=[Cm(3.4), Cm(5.2), Cm(6.9)], font=9.5)

    r.appendix('C', 'Phụ lục C — Tóm tắt thuật toán và mã giả')
    r.table(
        'Tóm tắt các thuật toán chính, độ phức tạp và vị trí trong mã nguồn.',
        ['Thuật toán', 'Độ phức tạp', 'Tệp nguồn', 'Mục'],
        [
            ['Cắt tay khỏi thân bằng khung xương', 'O(H·W)', '`backend/body_geometry.py`', '6.2.4'],
            ['Hậu nghiệm chiều cao từ tiên nghiệm dân số', 'O(1)', '`backend/body_analysis.py`', '6.2.5'],
            ['Cổng tỉnh táo giải phẫu', 'O(1)', '`backend/body_analysis.py`', '6.2.7'],
            ['Suy luận độ vừa vặn', 'O(1)', '`backend/lib/fitAnalysis.js`', '6.3'],
            ['Hàng chờ ưu tiên GPU', 'O(log n) mỗi thao tác', '`backend/lib/gpuJobQueue.js`', '6.4.6'],
            ['Khoá bộ nhớ đệm thử đồ (SHA-256)', 'O(k)', '`backend/lib/tryonCache.js`', '6.4.5'],
            ['Phân rã ma trận bằng hạ gradient ngẫu nhiên', 'O(epochs·|R|·k)',
             '`backend/lib/analytics.js`', '6.8.2a'],
            ['Lọc cộng tác theo sản phẩm (cosine)', 'O(n²·d) khi dựng lại', '`backend/lib/recommend.js`', '6.8.2b'],
            ['Không gian trạng thái chọn lọc', 'O(người dùng · 64 · 12)',
             '`backend/lib/advancedRecommend.js`', '6.8.2f'],
            ['Lan truyền đồ thị hai lớp', 'O(cạnh · lớp · 12)', '`backend/lib/advancedRecommend.js`', '6.8.2g'],
            ['Phân phối chuyển tiếp bậc một', 'O(sự kiện)', '`backend/lib/advancedRecommend.js`', '6.8.2h'],
            ['Xếp hạng logistic theo cặp', 'O(12 · mẫu dương · 4)', '`backend/lib/advancedRecommend.js`', '6.8.2i'],
            ['Đa dạng hoá theo danh mục', 'O(n)', '`backend/lib/recommend.js`', '6.8.5'],
            ['Chấm điểm gợi ý theo địa điểm', 'O(sản phẩm · nhãn)',
             '`backend/lib/japanSpotRecommendations.js`', '6.10.1'],
            ['Hồi quy tuyến tính bình phương tối thiểu', 'O(n)', '`backend/lib/analytics.js`', '6.11.1a'],
            ['Làm mượt luỹ thừa kép của Holt + quét lưới', 'O(12·n)', '`backend/lib/analytics.js`', '6.11.1b'],
            ['Trung bình trượt có trọng số', 'O(n·w)', '`backend/lib/analytics.js`', '6.11.1c'],
            ['Điểm nhu cầu tám thành phần', 'O(sản phẩm + tương tác)', '`backend/lib/analytics.js`', '6.11.2'],
            ['K-Means chuẩn hoá z-score', 'O(30·n·k·3)', '`backend/lib/analytics.js`', '6.11.3'],
            ['Chấm điểm RFM', 'O(n)', '`backend/lib/analytics.js`', '6.11.4'],
            ['Luật kết hợp kiểu Apriori', 'O(đơn · m²)', '`backend/lib/analytics.js`', '6.11.5'],
            ['Chuẩn hoá văn bản chống lách luật', 'O(độ dài)', '`backend/lib/reviewModeration.js`', '6.12.2'],
            ['Hợp nhất quyết định kiểm duyệt', 'O(luật · độ dài)', '`backend/lib/reviewModeration.js`', '6.12.4'],
        ],
        widths=[Cm(5.4), Cm(3.4), Cm(5.2), Cm(1.5)], font=9.5)

    r.appendix('D', 'Phụ lục D — Bảng kết quả kiểm thử và chỉ số')
    r.table(
        'Tổng hợp mọi chỉ số định lượng được nêu trong báo cáo, kèm nguồn và ngày đo.',
        ['Chỉ số', 'Giá trị', 'Nguồn', 'Ngày'],
        [
            ['Kiểm thử backend', '345/345 đạt', '`npm run check`', '31/08/2026'],
            ['Kiểm thử Python', '102 (100 đạt, 2 bỏ qua)', '`npm run check`', '31/08/2026'],
            ['Kiểm thử đơn vị website', '7/7 đạt', '`npm --prefix web run test`', '31/08/2026'],
            ['Kiểm thử đầu-cuối website', '30/30 đạt trên 2 thiết bị', 'Playwright', '30/08/2026'],
            ['Kiểm thử khói AI thật', '4/4 đạt, có tệp mở được', 'Playwright + cờ môi trường', '30/08/2026'],
            ['Kiểm tra ERD', 'ĐẠT — đúng 19 bảng, 24 quan hệ', '`validate_drawio.py`', '04/09/2026'],
            ['Database Compass trình bày', 'ĐẠT — đúng 19 bảng trùng ERD, dữ liệu đã che',
             '`sync_compass_presentation_erd19.js`', '04/09/2026'],
            ['Nguồn dữ liệu runtime', 'MongoDB Atlas — kết nối thành công', '`GET /api/health`', '04/09/2026'],
            ['MAE chiều cao', '6,56 cm', '`body_pipeline_testB.json`', '28/08/2026'],
            ['MAE cân nặng', '9,59 kg', '`body_pipeline_testB.json`', '28/08/2026'],
            ['MAE vòng ngực / eo / hông', '6,49 / 6,45 / 5,70 cm', '`body_pipeline_testB.json`', '28/08/2026'],
            ['Độ trễ phân tích cơ thể', '0,35 s (P50), 0,37 s (P90)', 'Đo 8 lượt gọi', '28/08/2026'],
            ['MAE bề ngang thân (ngực/eo/hông)', '23,00 / 16,37 / 20,63 px', '`torso_extraction.json`', '28/08/2026'],
            ['Thử đồ — ca thường', '37,865 s', '`TRYON_CHAT_GOALS_2026-08-29.md`', '29/08/2026'],
            ['Thử đồ — hồ sơ `balanced`', '57,9 s, PNG 641 KB 1152×1536', '`WEB_STOREFRONT_2026-08-30.md`', '30/08/2026'],
            ['Thử đồ — đồ bơi hai mảnh', '58,066 s (đệm ấm) / ~73 s (đệm nguội)',
             '`BRAND_CINEMATIC_SWIMWEAR_2026-08-29.md`', '29/08/2026'],
            ['Thử đồ — trúng bộ nhớ đệm', '~27 ms so với 40,8 s', '`TRYON_PRESETS_SCENE_2026-08-29.md`', '29/08/2026'],
            ['Video — đi tự nhiên', '57,834 s trực tiếp / 64,925 s qua backend',
             '`MOTION_INFERENCE_2026-08-29.md`', '29/08/2026'],
            ['Video — xoay người / tạo dáng', '71,144 s / 65,527 s', '`MOTION_INFERENCE_2026-08-29.md`', '29/08/2026'],
            ['Ghép cảnh Nhật Bản', '912 ms (ảnh dựng sẵn) / 1 195 ms (ảnh vừa thử đồ)',
             '`TRYON_PRESETS_SCENE_2026-08-29.md`', '29/08/2026'],
            ['Gợi ý theo địa điểm', '8 ms tính mới / 25 ms trúng đệm', 'Đo trực tiếp', '29/08/2026'],
            ['LoRA — thời gian huấn luyện', '80,3 phút, đỉnh VRAM 15,2 GB', '`fit_lora.status.json`', '26/08/2026'],
            ['LoRA — sai lệch cơ thể', '0,1145 so với 0,1148 của đường cơ sở', '`fit_lora.status.json`', '26/08/2026'],
            ['LoRA — thay đổi cấu trúc do fit', '19,0849 so với 16,7195', '`fit_lora.status.json`', '26/08/2026'],
            ['Lighthouse website', 'Hiệu năng 93–99; 100/100/100 ba mục còn lại',
             '`WEB_STOREFRONT_2026-08-30.md`', '30/08/2026'],
            ['NDCG@10 và Recall@10 của hệ gợi ý', '**chưa đo**', '`getRecommendationDiagnostics`', '31/08/2026'],
            ['Tỉ lệ chặn nhầm của bộ kiểm duyệt', '**chưa đo**', '—', '—'],
            ['Khả năng phục vụ đồng thời', '**chưa đo**', '—', '—'],
        ],
        widths=[Cm(4.6), Cm(4.6), Cm(4.4), Cm(1.9)], font=9)

    r.appendix('E', 'Phụ lục E — Bản kê khai mô hình và bộ dữ liệu')
    r.table(
        'Bản kê khai mô hình, checkpoint và giấy phép.',
        ['Tên đầy đủ', 'Vai trò trong JAPANO', 'Checkpoint / mã băm', 'Giấy phép'],
        [
            ['FASHN VTON 1.5', 'Engine sinh ảnh thử đồ chính', 'Trọng số gốc của tác giả; không huấn '
             'luyện lại (kho mã cục bộ chỉ có phần suy luận)', 'Theo giấy phép mô hình'],
            ['FLUX.2 Klein 4B', 'Chuyển tư thế, tinh chỉnh phụ kiện, ghép đồ bơi hai mảnh, mô phỏng độ '
             'vừa vặn', 'Trọng số gốc', 'Theo giấy phép mô hình'],
            ['LoRA hạng 8 trên FLUX.2 (do nhóm huấn luyện)', 'Mô phỏng độ chật/vừa/rộng cho danh mục '
             '`tops`', '`checkpoint-400`; `a1643dda4cdb1f3c-16731128`; 16 731 128 byte',
             'Kế thừa CC-BY-NC-SA-4.0 của VITON-HD — **phi thương mại**'],
            ['Wan2.1-T2V-1.3B + One-to-All `1.3b_2`', 'Sinh video chuyển động', 'Trọng số gốc; **không '
             'có checkpoint mới**', 'Theo giấy phép mô hình'],
            ['YOLOv8n-pose', 'Lấy 17 điểm khớp cơ thể', 'Trọng số gốc', 'Theo giấy phép Ultralytics'],
            ['U²-Net', 'Tách hình bóng người', 'Trọng số gốc', 'Theo giấy phép mô hình'],
            ['`body_bmi_estimator.joblib`', 'Ước lượng BMI từ tỉ lệ bề ngang', 'Huấn luyện lại trên '
             'ANSUR II, 2 572 byte', 'Suy từ CC0-1.0 — **không ràng buộc**'],
            ['`body_weight_estimator.joblib`', 'Ước lượng cân nặng', 'Huấn luyện lại trên ANSUR II, '
             '144 294 byte', 'Suy từ CC0-1.0'],
            ['`body_girth_estimators.joblib`', 'Ước lượng ba vòng đo', 'Huấn luyện lại trên ANSUR II, '
             '145 498 byte', 'Suy từ CC0-1.0'],
            ['`body_geometry.calibration.json`', 'Hằng số cắt tay và trần/sàn giải phẫu',
             'Khớp trên VITON-HD + cực trị ANSUR II, 4 159 byte', 'CC-BY-NC-SA-4.0 — **phi thương mại**'],
            ['`bodym_population_calibration.json`', 'Hiệu chuẩn đầu ra về phân bố dân số',
             'Khớp trên BodyM train, 1 842 byte', 'CC-BY-NC-4.0 — **phi thương mại**'],
            ['`qwen2.5:7b` (qua Ollama)', 'Viết lại câu trả lời đã bám dữ liệu; kiểm duyệt ngữ nghĩa',
             'Trọng số gốc; tuỳ chọn', 'Theo giấy phép mô hình'],
            ['`qwen3-vl:8b` (qua Ollama)', 'Đọc ảnh sản phẩm sinh mô tả', 'Trọng số gốc; tuỳ chọn',
             'Theo giấy phép mô hình'],
        ],
        widths=[Cm(3.6), Cm(4.2), Cm(4.4), Cm(3.3)], font=9)

    r.appendix('F', 'Phụ lục F — Biến môi trường (chỉ tên, không có giá trị)')
    r.p('Không một giá trị bí mật nào xuất hiện trong báo cáo này. Bảng dưới chỉ ghi **tên biến** và '
        'mục đích, để người đọc hiểu hệ thống cần cấu hình những gì. Danh sách tham khảo đầy đủ nằm '
        'trong tệp `.env.example` của kho mã nguồn.', indent=False)
    r.table(
        'Các nhóm biến môi trường và mục đích của chúng.',
        ['Nhóm', 'Tên biến (không kèm giá trị)', 'Mục đích'],
        [
            ['Cơ sở dữ liệu', '`MONGODB_URI`', 'Chuỗi kết nối MongoDB Atlas.'],
            ['Xác thực', '`JWT_SECRET`, `JWT_TTL`', 'Khoá ký thẻ phiên và thời hạn của nó.'],
            ['Khởi tạo quản trị', '`JAPANO_ADMIN_EMAIL`, `JAPANO_ADMIN_PASSWORD`',
             'Tài khoản quản trị đầu tiên khi khởi tạo hệ thống.'],
            ['Bảo mật', '`JAPANO_ALLOWED_ORIGINS`, `JAPANO_RATE_LIMIT_MAX`, '
             '`JAPANO_AUTH_RATE_LIMIT_MAX`', 'Danh sách nguồn được phép và hai mức giới hạn tần suất.'],
            ['Media', '`CLOUDINARY_*`', 'Thông tin xác thực dịch vụ lưu trữ ảnh và video.'],
            ['Thanh toán', '`STRIPE_*`, `VNPAY_*`', 'Khoá API và khoá xác minh webhook của hai cổng.'],
            ['Thư giao dịch', '`SMTP_*`', 'Gửi thư cảnh báo đăng nhập, biên nhận và xác nhận hoàn tiền.'],
            ['Dịch vụ AI', '`JAPANO_FASHN_URL`, `JAPANO_MOTION_URL`, `JAPANO_BODY_URL`, `OLLAMA_URL`',
             'Địa chỉ các tiến trình AI cục bộ.'],
            ['Thử đồ', '`JAPANO_FASHN_STEPS`, `JAPANO_FASHN_BALANCED_STEPS`, '
             '`JAPANO_TRYON_OUTPUT_LONG_EDGE`, `JAPANO_TRYON_CACHE_DIR`, `JAPANO_TRYON_CACHE_TTL_MS`',
             'Tham số chất lượng và bộ nhớ đệm của đường ống thử đồ.'],
            ['Độ vừa vặn', '`JAPANO_FIT_EFFECT_ENABLED`, `JAPANO_FIT_REFINE_MIN_SEVERITY`, '
             '`JAPANO_FIT_TEAR_ENABLED`, `JAPANO_FIT_TEAR_MIN_SEVERITY`, `JAPANO_FIT_LORA_PATH`',
             'Bật/tắt và ngưỡng của tầng mô phỏng độ vừa vặn; đường dẫn bộ chuyển thể LoRA (**mặc định '
             'rỗng**).'],
            ['Đo cơ thể', '`JAPANO_LANDMARK_MIN_CONFIDENCE`, `JAPANO_BODY_POPULATION_CALIBRATION`, '
             '`JAPANO_HEAD_LENGTH_CM`, `JAPANO_BODY_DENSITY`',
             'Ngưỡng lọc khớp và các tham số của đường ống ước lượng số đo.'],
            ['An toàn nội dung', '`JAPANO_ADULT_VISION_CHECK`, `JAPANO_REVIEW_MODERATION_MODEL`',
             'Bật/tắt tầng kiểm tra bằng thị giác và chọn mô hình kiểm duyệt.'],
            ['GPU', '`JAPANO_MIN_GPU_FREE_GB`', 'Ngưỡng bộ nhớ trống tối thiểu trước khi nhận công việc.'],
            ['Website', '`NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID`',
             '**Hiện chưa có giá trị** — đây là lý do đăng nhập Google trên web chưa hoạt động.'],
        ],
        widths=[Cm(2.8), Cm(6.4), Cm(6.3)], font=9.5)

    r.appendix('G', 'Phụ lục G — Hướng dẫn chạy hệ thống')
    r.p('Yêu cầu: Node.js phiên bản 20 trở lên; JDK 17 nếu cần dựng gói Android (JDK 21 trên máy phát '
        'triển thiếu công cụ `jlink` và quá trình dựng sẽ dừng); môi trường Python riêng cho từng kho '
        'mã mô hình AI; GPU NVIDIA khoảng 16 GB nếu muốn chạy thử đồ và tạo video.', indent=False)
    r.code([
        '# 1. Backend và ứng dụng di động (dùng chung không gian gói)',
        'npm ci',
        'cp .env.example .env.server        # điền MONGODB_URI, JWT_SECRET, Cloudinary…',
        '',
        '# 2. Backend và trang quản trị',
        'npm run backend                    # API cổng 4100, trang quản trị tại /admin/',
        '',
        '# 3. Ứng dụng di động',
        'adb reverse tcp:4100 tcp:4100',
        'npm --workspace mobile run android',
        '',
        '# 4. Website — cây phụ thuộc RIÊNG, không cài từ thư mục gốc',
        'npm --prefix web install',
        'npm --prefix web run dev           # http://localhost:4200',
    ], caption='Các bước khởi động hệ thống từ đầu.')
    r.code([
        './scripts/japano-services.sh on      # bật cả cụm AI và chờ sẵn sàng',
        './scripts/japano-services.sh status  # xem ai đang chạy, ai đang giữ GPU',
        './scripts/japano-services.sh off     # tắt tạm, nhường CPU và GPU cho việc khác',
        '',
        '# Dựng gói Android bản phát hành — bắt buộc JDK 17',
        'cd mobile/android',
        'JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64 ./gradlew assembleRelease',
    ], caption='Quản lý cụm dịch vụ AI và dựng gói Android.')
    r.code([
        'npm run check                      # kiểm thử backend + kiểu TypeScript + kiểm thử Python',
        'npm --prefix web run typecheck',
        'npm --prefix web run test',
        'npm --prefix web run e2e           # hai cấu hình thiết bị: 390 px và 1440 px',
        'node scripts/atlas_audit.js        # kiểm tra cơ sở dữ liệu, CHỈ ĐỌC',
        'python3 scripts/validate_erd_against_atlas.py',
    ], caption='Các lệnh kiểm thử và kiểm tra.')
    r.code([
        'python3 docs/report/tools/build_diagrams.py   # sinh lại 20 tệp sơ đồ nguồn',
        'node docs/report/tools/capture_screens.js     # chụp lại màn hình website và trang quản trị',
        'python3 docs/report/tools/build_report.py     # dựng lại DOCX và PDF của chính báo cáo này',
    ], caption='Dựng lại toàn bộ báo cáo này từ đầu.')

    r.appendix('H', 'Phụ lục H — Bảng phân công nhiệm vụ (nhóm tự điền)')
    r.p('Kho mã nguồn không lưu thông tin tác giả cho từng lần ghi nhận thay đổi, nên báo cáo không thể '
        'suy ra bảng phân công từ bằng chứng. Nhóm cần tự điền và ký xác nhận bảng dưới đây trước khi '
        'nộp.', indent=False)
    r.table(
        'Bảng phân công nhiệm vụ — cần nhóm tự điền và xác nhận.',
        ['STT', 'Họ và tên', 'MSSV', 'Nhiệm vụ chính', 'Xác nhận'],
        [
            ['1', 'Lê Minh Nhật', 'PS46869', '[CẦN NHÓM ĐIỀN]', ''],
            ['2', 'Đặng Huy Phát', 'PS43608', '[CẦN NHÓM ĐIỀN]', ''],
            ['3', 'Hồ Ngọc Vũ', 'PS46157', '[CẦN NHÓM ĐIỀN]', ''],
        ],
        widths=[Cm(1.0), Cm(3.6), Cm(2.2), Cm(5.7), Cm(3.0)], font=10.5)


def build_missing_images(r, missing):
    """Phụ lục I — bảng tổng hợp ảnh cần bổ sung; gọi sau khi thân bài đã dựng xong."""
    r.appendix('I', 'Phụ lục I — Danh sách hình còn thiếu')
    if not missing:
        r.p('Không có hình nào còn thiếu trong bản dựng này.', indent=False)
        return
    r.p(f'Bản dựng này có **{len(missing)} hình** chưa chụp được. Mỗi hình có một khung hướng dẫn đặt '
        'ngay tại vị trí cần chèn trong nội dung; bảng dưới đây là bản tổng hợp để tiện theo dõi.',
        indent=False)
    r.table(
        'Danh sách hình cần nhóm bổ sung trước khi nộp.',
        ['Mã ảnh', 'Hình số', 'Nội dung cần chụp', 'Vị trí', 'Kích thước', 'Ghi chú riêng tư'],
        [[m['code'], m['number'], m['title'], m['where'], m['ratio'], m['privacy']] for m in missing],
        widths=[Cm(2.4), Cm(1.5), Cm(3.6), Cm(3.0), Cm(2.4), Cm(2.6)], font=9.5)


def build_evidence_matrix(r):
    r.appendix('J', 'Phụ lục J — Ma trận tuyên bố → bằng chứng → tệp nguồn')
    r.p('Bảng này tồn tại để một người phản biện có thể kiểm chứng từng tuyên bố quan trọng của báo cáo '
        'mà không cần tin vào lời của nhóm.', indent=False)
    r.table(
        'Ma trận đối chiếu tuyên bố và bằng chứng.',
        ['Tuyên bố trong báo cáo', 'Bằng chứng', 'Tệp nguồn hoặc lệnh'],
        [
            ['Hệ thống có 138 điểm cuối REST trong 19 tệp.', 'Đếm trực tiếp từ mã nguồn',
             '`backend/routes/*.js`; `docs/report/evidence/api_endpoints.json`'],
            ['ERD chuẩn gồm đúng 19 bảng và 24 quan hệ.', 'Bộ kiểm tra tự động, ĐẠT',
             '`python3 scripts/validate_drawio.py JAPANO_ERD.drawio`'],
            ['Database trình bày trên Compass có đúng 19 bảng trùng ERD; backend vẫn chạy bằng Atlas.',
             'Đối chiếu tên collection và kiểm tra health runtime',
             '`node scripts/sync_compass_presentation_erd19.js`; `GET /api/health`, 04/09/2026'],
            ['345 kiểm thử Node đạt toàn bộ.', 'Nhật ký chạy thật',
             '`docs/report/evidence/npm_check_20260831.log`'],
            ['102 kiểm thử Python, 100 đạt và 2 bỏ qua có chủ đích.', 'Nhật ký chạy thật',
             'Cùng tệp trên'],
            ['Sai số đầu-cuối đo cơ thể: 6,56 cm / 9,59 kg / 5,70–6,49 cm.', 'Tệp kết quả đánh giá',
             '`backend/ai_training/evaluation/body_pipeline_testB.json`'],
            ['Bộ hồi quy mới tốt hơn khoảng 4 lần ở điều kiện ảnh thật.', 'So sánh có quyết định promote',
             '`backend/ai_training/evaluation/body_estimator_baseline_vs_new.json`'],
            ['Cắt tay khỏi thân giảm sai số vòng eo từ 79,34 xuống 16,37 px.', 'Tệp kết quả đánh giá',
             '`backend/ai_training/evaluation/torso_extraction.json`'],
            ['Giữ đặc trưng độ rộng quần áo là quyết định đúng.', 'Thí nghiệm cắt bỏ',
             '`backend/ai_training/evaluation/ablation_clothing_slack.json`'],
            ['Chỉ một thành phần được fine-tune, dùng `checkpoint-400`.', 'Tệp trạng thái huấn luyện',
             '`backend/ai_training/models/fit_lora.status.json`'],
            ['Bộ chuyển thể LoRA **không được nạp** ở thời điểm chạy.', 'Điểm cuối sức khoẻ trả '
             '`fitLoraPath: ""`', '`GET /api/health`, 31/08/2026'],
            ['Checkpoint 500 và 600 bị cổng nghiệm thu loại.', 'Nhật ký nghiệm thu',
             '`fit_lora.status.json`, mục `acceptance`'],
            ['Video nhanh hơn khoảng 5,1 lần mà không hạ ngưỡng chất lượng.', 'Bảng hồ sơ đã chấp nhận '
             'và bảng phương án bị loại',
             '`docs/project_evidence/ai_benchmarks/MOTION_INFERENCE_2026-08-29.md`'],
            ['Thử đồ ca thường mất 37,865 giây.', 'Kiểm thử khói thật trả ảnh mở được',
             '`docs/project_evidence/ai_benchmarks/TRYON_CHAT_GOALS_2026-08-29.md`'],
            ['Trúng bộ nhớ đệm trả về trong ~27 ms, ảnh giống hệt từng byte.', 'Kiểm thử ma trận ảnh mẫu',
             '`docs/project_evidence/ai_benchmarks/TRYON_PRESETS_SCENE_2026-08-29.md`'],
            ['Hiệu ứng độ vừa vặn thay đổi theo size một cách đơn điệu.', 'Ma trận 5 dáng × 7 size với '
             'ảnh kết quả', '`test-results/qa-matrix/results.json`'],
            ['Ghép cảnh mất 912 ms và 1 195 ms.', 'Đo trực tiếp',
             '`docs/project_evidence/ai_benchmarks/TRYON_PRESETS_SCENE_2026-08-29.md`'],
            ['Gợi ý theo địa điểm mất 8 ms / 25 ms và không gọi mô hình ngôn ngữ.', 'Đo trực tiếp và '
             'đọc mã nguồn', '`backend/lib/japanSpotRecommendations.js`'],
            ['Website đạt Lighthouse 93–99 và 100 điểm khả năng truy cập.', 'Báo cáo Lighthouse',
             '`docs/project_evidence/ai_benchmarks/WEB_STOREFRONT_2026-08-30.md`'],
            ['JAPANO **không** sử dụng học tăng cường.', 'Rà toàn bộ mã nguồn theo 8 tiêu chí',
             'Mục 6.6; tìm kiếm trên `backend/`, `mobile/`, `web/`, `admin/`, `scripts/`'],
            ['NDCG@10 và Recall@10 chưa đo.', 'API chẩn đoán của hệ thống trả `not-measured`',
             '`backend/lib/recommend.js`, hàm `getRecommendationDiagnostics`'],
            ['GPU là RTX 5060 Ti 16 311 MiB, driver 595.84.', 'Đọc trực tiếp từ trình điều khiển',
             '`nvidia-smi`, 31/08/2026'],
            ['Sáu tiến trình đang chạy trên các cổng đã nêu.', 'Đọc trực tiếp trạng thái hệ thống',
             '`ss -ltnp` và `systemctl --user list-units`, 31/08/2026'],
            ['Chính sách chống chèn mã đang tắt trên trang quản trị.', 'Đọc mã nguồn kèm chú thích của '
             'chính tác giả', '`backend/server.js`, dòng cấu hình helmet'],
            ['Chia sẻ tài nguyên giữa các nguồn đang mở mặc định.', 'Đọc mã nguồn',
             '`backend/server.js`, cấu hình CORS'],
            ['Giới hạn tần suất chỉ áp cho các điểm cuối nhận thông tin đăng nhập.', 'Đọc mã nguồn kèm '
             'chú thích giải thích sự cố cũ', '`backend/server.js`'],
            ['Ảnh khách không bao giờ được ghi vào bộ nhớ đệm.', 'Đọc mã nguồn của khoá bộ nhớ đệm',
             '`backend/lib/tryonCache.js`'],
            ['Điểm cuối ghép ảnh không nhận đường dẫn từ client.', 'Đọc mã nguồn',
             '`backend/lib/japanSceneBackgrounds.js`'],
            ['Sản phẩm không bị xoá vĩnh viễn.', 'Đọc mã nguồn vòng đời sản phẩm',
             '`backend/lib/productLifecycle.js`, `backend/routes/catalog.js`'],
            ['Kho mã nguồn không lưu thông tin tác giả.', 'Lệnh thống kê trả về rỗng',
             '`git shortlog -sne`, 31/08/2026'],
        ],
        widths=[Cm(5.6), Cm(4.4), Cm(5.5)], font=9)
