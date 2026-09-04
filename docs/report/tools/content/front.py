"""Phần đầu sách: bìa, lời cảm ơn, cam đoan, tóm tắt, mục lục, danh mục."""
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt

from report_engine import ACCENT, INK, MUTED, _field, _set_font

TRUONG = 'TRƯỜNG CAO ĐẲNG FPT POLYTECHNIC'
DE_TAI = 'JAPANO — NỀN TẢNG THƯƠNG MẠI ĐIỆN TỬ THỜI TRANG NHẬT BẢN\nCÓ THỬ ĐỒ ẢO VÀ ƯỚC LƯỢNG SỐ ĐO TỪ ẢNH'
GVHD = 'Thầy Nguyễn Ngọc Chấn'
SINH_VIEN = [
    ('1', 'Lê Minh Nhật', 'PS46869'),
    ('2', 'Đặng Huy Phát', 'PS43608'),
    ('3', 'Hồ Ngọc Vũ', 'PS46157'),
]
DIA_DIEM = 'TP. Hồ Chí Minh, tháng 08 năm 2026'


def _center(r, text, size=13, bold=False, italic=False, color=INK, after=6, spacing=1.3):
    para = r._consume_break(r.doc.add_paragraph())
    para.alignment = WD_ALIGN_PARAGRAPH.CENTER
    para.paragraph_format.first_line_indent = Cm(0)
    para.paragraph_format.space_after = Pt(after)
    para.paragraph_format.line_spacing = spacing
    for index, line in enumerate(str(text).split('\n')):
        if index:
            para.add_run().add_break()
        _set_font(para.add_run(line), size=size, bold=bold, italic=italic, color=color)
    return para


def build(r, outline, pages):
    # ------------------------------------------------------------- trang bìa
    _center(r, TRUONG, size=14, bold=True, after=2)
    _center(r, 'BỘ MÔN CÔNG NGHỆ THÔNG TIN', size=12, after=60)
    _center(r, 'BÁO CÁO ĐỒ ÁN TỐT NGHIỆP', size=15, bold=True, color=MUTED, after=24)
    _center(r, DE_TAI, size=18, bold=True, color=ACCENT, after=48, spacing=1.4)
    _center(r, 'Chuyên ngành: Ứng dụng phần mềm', size=13, after=36)
    _center(r, f'Giảng viên hướng dẫn: {GVHD}', size=13, bold=True, after=8)
    _center(r, 'Nhóm sinh viên thực hiện:', size=13, after=4)
    for _, name, mssv in SINH_VIEN:
        _center(r, f'{name} — {mssv}', size=13, after=2)
    _center(r, DIA_DIEM, size=13, italic=True, after=0)
    _center(r, '', after=0)

    # -------------------------------------------------------- trang phụ bìa
    r.pagebreak()
    _center(r, TRUONG, size=13, bold=True, after=2)
    _center(r, 'BỘ MÔN CÔNG NGHỆ THÔNG TIN', size=11.5, after=40)
    _center(r, 'BÁO CÁO ĐỒ ÁN TỐT NGHIỆP', size=14, bold=True, color=MUTED, after=18)
    _center(r, DE_TAI, size=16, bold=True, color=ACCENT, after=30, spacing=1.4)
    r.table(
        'Thông tin đề tài và nhóm thực hiện.',
        ['Hạng mục', 'Nội dung'],
        [
            ['Tên đề tài', 'JAPANO — nền tảng thương mại điện tử thời trang Nhật Bản có thử đồ ảo, '
                           'ước lượng số đo từ ảnh và trang quản trị phân quyền'],
            ['Loại sản phẩm', 'Ứng dụng di động Android, website bán hàng, trang quản trị web và một cụm '
                              'dịch vụ AI chạy trên GPU nội bộ, dùng chung một backend'],
            ['Giảng viên hướng dẫn', GVHD],
            ['Sinh viên thực hiện', ' · '.join(f'{name} ({mssv})' for _, name, mssv in SINH_VIEN)],
            ['Thời gian thực hiện', 'Tháng 06 năm 2026 – tháng 08 năm 2026 (57 lần ghi nhận thay đổi trong '
                                    'kho mã nguồn Git, từ 26/06/2026 đến 30/08/2026)'],
            ['Địa điểm', DIA_DIEM],
        ],
        widths=[Cm(4.0), Cm(11.5)], font=11.5, numbered=False,
        note='Mốc thời gian lấy từ `git log` của kho mã nguồn tại thời điểm dựng báo cáo, ngày 31/08/2026.')
    r.note(
        'Phân công nhiệm vụ chi tiết giữa ba thành viên **chưa được đưa vào báo cáo này**. '
        'Kho mã nguồn hiện tại không ghi thông tin tác giả cho từng lần ghi nhận thay đổi '
        '(`git shortlog -sne` trả về rỗng), nên không có bằng chứng khách quan để gán từng phần '
        'công việc cho từng người. Nhóm cần tự bổ sung bảng phân công và ký xác nhận trước khi nộp — '
        'xem mục Phụ lục H.', label='Thông tin cần nhóm bổ sung')

    # -------------------------------------------------------- lời cảm ơn
    r.front_h1('Lời cảm ơn')
    r.p('Lời đầu tiên, nhóm chúng em xin gửi lời cảm ơn chân thành đến quý thầy cô Trường Cao đẳng '
        'FPT Polytechnic, những người đã trang bị cho chúng em nền tảng kiến thức và, quan trọng hơn, '
        'thói quen kiểm chứng mọi thứ mình nói ra bằng bằng chứng cụ thể. Chính thói quen đó là thứ '
        'đã định hình cách bản báo cáo này được viết.')
    r.p(f'Nhóm xin đặc biệt cảm ơn {GVHD}, người đã hướng dẫn, phản biện và nhiều lần đặt lại những '
        'câu hỏi khó nhất vào đúng lúc chúng em đang hài lòng với một kết quả chưa đủ vững. Những câu '
        'hỏi ấy đã trực tiếp dẫn tới việc nhóm phải đo lại sai số của bước ước lượng số đo, phải phân '
        'biệt rạch ròi giữa "đã huấn luyện lại" và "chỉ tối ưu suy luận", và phải chấp nhận ghi '
        '"chưa đo được" ở những chỗ mà một con số đẹp sẽ dễ nghe hơn nhiều.')
    r.p('Chúng em cũng xin cảm ơn các tác giả và tổ chức đã công bố công khai những bộ dữ liệu và mô '
        'hình mà đồ án này sử dụng — ANSUR II, BodyM, VITON-HD, FASHN VTON, FLUX.2, Wan2.1, '
        'One-to-All Animation, YOLOv8-pose và U2Net. Không có công trình mở của họ thì một nhóm sinh '
        'viên không thể tự xây dựng được một đường ống thử đồ hoạt động thật. Giấy phép và phạm vi sử '
        'dụng của từng nguồn được ghi đầy đủ trong phần Tài liệu tham khảo và Phụ lục G.')
    r.p('Cuối cùng, xin cảm ơn gia đình và bạn bè đã kiên nhẫn trong suốt ba tháng mà máy tính của '
        'nhóm gần như không lúc nào được nghỉ.')
    _center(r, 'Nhóm sinh viên thực hiện', size=13, italic=True, after=4)

    # -------------------------------------------------------- lời cam đoan
    r.front_h1('Lời cam đoan')
    r.p('Nhóm chúng em xin cam đoan rằng đồ án "JAPANO — nền tảng thương mại điện tử thời trang Nhật '
        'Bản có thử đồ ảo và ước lượng số đo từ ảnh" là công trình do nhóm tự thực hiện dưới sự hướng '
        f'dẫn của {GVHD}. Toàn bộ mã nguồn của ứng dụng di động, website, trang quản trị, backend và '
        'các đoạn mã huấn luyện/đánh giá mô hình đều do nhóm viết hoặc tích hợp một cách có ý thức, '
        'không sao chép nguyên trạng từ một sản phẩm thương mại nào.')
    r.p('Nhóm cam đoan thêm ba điều cụ thể, vì chúng là chỗ mà một báo cáo về AI rất dễ nói quá:')
    r.bullets([
        '**Về số liệu.** Mọi con số đo đạc trong báo cáo (sai số ước lượng số đo, thời gian sinh ảnh, '
        'số lượng kiểm thử và kết quả kiểm tra 19 bảng của ERD) đều được lấy từ một lần '
        'chạy thật trên máy của nhóm, có ghi ngày, lệnh chạy và tệp kết quả kèm theo. Chỗ nào chưa đo '
        'được thì báo cáo ghi rõ là "chưa đo", không thay bằng ước lượng.',
        '**Về khái niệm fine-tune.** Báo cáo chỉ gọi một thành phần là "đã huấn luyện lại" khi có đủ '
        'bốn thứ: bộ dữ liệu có giấy phép rõ ràng, quá trình tối ưu thật sự cập nhật trọng số, một '
        'checkpoint tải lại được kèm mã băm, và đánh giá trên tập tách theo danh tính. Mọi thành phần '
        'còn lại được gọi đúng tên của nó là suy luận, hiệu chuẩn hoặc quy tắc nghiệp vụ.',
        '**Về dữ liệu người dùng.** Cơ sở dữ liệu đang chạy chứa dữ liệu thử nghiệm do nhóm tạo ra. '
        'Không có con số nào trong báo cáo được trình bày như số liệu người dùng thật hay doanh thu thật.',
    ])
    r.p('Nhóm xin chịu hoàn toàn trách nhiệm trước Hội đồng về tính trung thực của những nội dung trên.')
    _center(r, 'Nhóm sinh viên thực hiện', size=13, italic=True, after=4)

    # -------------------------------------------------------- tóm tắt
    r.front_h1('Tóm tắt')
    r.p('Mua quần áo trực tuyến có một khoảng trống mà thêm ảnh hay thêm mô tả đều không lấp được: '
        'khách nhìn thấy bộ đồ trên người mẫu, nhưng thứ họ cần biết là bộ đồ đó trông thế nào trên '
        'chính cơ thể mình, và size nào mới vừa. Khoảng trống đó biến thành tỉ lệ đổi trả cao cho '
        'người bán và sự do dự cho người mua.')
    r.p('JAPANO là một nền tảng thương mại điện tử thời trang Nhật Bản được xây dựng để thu hẹp đúng '
        'khoảng trống đó. Hệ thống gồm bốn sản phẩm chạy trên cùng một backend: ứng dụng di động '
        'Android (Expo SDK 51, React Native 0.74), website bán hàng độc lập (React 19, App Router), '
        'trang quản trị web, và một cụm dịch vụ AI chạy trên GPU nội bộ. Backend là một máy chủ '
        'Express trên Node 20 với 138 điểm cuối REST chia theo miền nghiệp vụ, dùng MongoDB Atlas '
        'làm nơi lưu trữ runtime chính. Mô hình dữ liệu của báo cáo và bản trình bày trên Compass '
        'được thống nhất thành đúng 19 bảng nghiệp vụ và 24 quan hệ.')
    r.p('Về thương mại, hệ thống hoàn chỉnh một vòng đời đơn hàng thật: danh mục và biến thể, giỏ '
        'hàng, mã giảm giá, ba phương thức thanh toán (COD, Stripe Test Mode, VNPay Sandbox), theo '
        'dõi vận chuyển, trả hàng theo từng dòng và hoàn tiền, đánh giá chỉ dành cho người đã mua, '
        'chương trình VIP và Flagcard. Giá, tồn kho, mã giảm giá và tổng tiền luôn được tính lại phía '
        'máy chủ; client không bao giờ là nguồn sự thật.')
    r.p('Về trí tuệ nhân tạo, JAPANO triển khai bốn nhóm năng lực riêng biệt. Thứ nhất, ước lượng số '
        'đo từ một ảnh: YOLOv8n-pose lấy khớp cơ thể, U2Net tách hình bóng, một tầng hình học cắt hai '
        'cánh tay khỏi thân, rồi các bộ hồi quy huấn luyện lại trên ANSUR II dự đoán chiều cao, cân '
        'nặng và ba vòng đo. Sai số đầu-cuối trên BodyM testB (120 người, tách danh tính) là 6,56 cm '
        'chiều cao, 9,59 kg cân nặng và 5,70–6,49 cm cho ba vòng; kết quả luôn được trả về dưới dạng '
        'khoảng có độ tin cậy, và số đo do người dùng tự nhập luôn thắng ước lượng của mô hình. Thứ '
        'hai, thử đồ ảo: FASHN VTON 1.5 là engine chính, FLUX.2 Klein 4B tham gia khi cần chuyển tư '
        'thế hoặc mô phỏng độ chật/rộng, và một cổng chất lượng chấm danh tính, cấu trúc và độ che phủ '
        'trước khi ảnh được trả về. Thứ ba, gợi ý sản phẩm và phân tích kinh doanh chạy thuần Node '
        'trên CPU. Thứ tư, kiểm duyệt nội dung tiếng Việt có chống lách luật.')
    r.p('Đóng góp mà nhóm cho là đáng kể nhất không nằm ở việc gọi được nhiều mô hình, mà ở chỗ hệ '
        'thống biết từ chối. Ảnh thử đồ làm sai cơ thể sẽ bị chặn thay vì được trả về; một ảnh không '
        'đủ bằng chứng sẽ nhận trạng thái "chưa đủ bằng chứng" thay vì một con số bịa; và trong toàn '
        'bộ đồ án chỉ có duy nhất một thành phần được phép gọi là đã fine-tune — bộ chuyển thể LoRA '
        'hạng 8 trên FLUX.2 cho bước mô phỏng độ vừa vặn, có checkpoint, mã băm và đánh giá tách theo '
        'danh tính. JAPANO ở thời điểm nộp là một sản phẩm nghiên cứu và trình diễn hoàn chỉnh, chưa '
        'phải một hệ thống sẵn sàng thương mại; những điều kiện còn thiếu để đi tới đó được liệt kê '
        'cụ thể trong Chương 7 và Chương 8.')
    r.p('**Từ khoá:** thương mại điện tử thời trang, thử đồ ảo, virtual try-on, ước lượng nhân trắc '
        'từ ảnh, hệ gợi ý, MongoDB, React Native, mô hình khuếch tán, LoRA.')

    # -------------------------------------------------------- abstract
    r.front_h1('Abstract')
    r.p('Online apparel shopping has a gap that neither more photos nor longer descriptions can close: '
        'the customer sees the garment on a model, but what they need to know is how it looks on their '
        'own body and which size actually fits. That gap turns into high return rates for the merchant '
        'and hesitation for the buyer.')
    r.p('JAPANO is a Japanese-fashion e-commerce platform built to narrow exactly that gap. It consists '
        'of four products sharing a single backend: an Android application (Expo SDK 51, React Native '
        '0.74), an independent storefront website (React 19, App Router), a web administration console, '
        'and a cluster of AI services running on a local GPU. The backend is an Express server on Node '
        '20 exposing 138 domain-scoped REST endpoints and using MongoDB Atlas as its primary runtime '
        'store. The report and its MongoDB Compass presentation use one consistent model of exactly '
        '19 business tables and 24 relationships.')
    r.p('On the commerce side the system completes a real order lifecycle: catalogue and variants, cart, '
        'vouchers, three payment methods (cash on delivery, Stripe Test Mode, VNPay Sandbox), shipment '
        'tracking, per-line returns and refunds, verified-purchase reviews, a VIP tier and a Flagcard '
        'loyalty scheme. Prices, stock, vouchers and totals are always recomputed server-side; the '
        'client is never the source of truth.')
    r.p('On the AI side, JAPANO implements four distinct capabilities. First, body measurement from a '
        'single photograph: YOLOv8n-pose supplies joints, U2Net supplies the silhouette, a geometry '
        'layer carves the arms away from the torso, and regressors retrained on ANSUR II predict height, '
        'weight and three girths. End-to-end error on BodyM testB (120 identity-disjoint subjects) is '
        '6.56 cm for height, 9.59 kg for weight and 5.70–6.49 cm for the girths; every result is '
        'returned as an interval with a confidence value, and user-supplied measurements always override '
        'the estimate. Second, virtual try-on: FASHN VTON 1.5 is the primary engine, FLUX.2 Klein 4B '
        'assists with pose transfer and fit simulation, and a quality gate scores identity preservation, '
        'garment structure and coverage before any image is returned. Third, recommendation and business '
        'analytics implemented in plain Node.js on CPU. Fourth, Vietnamese content moderation resistant '
        'to common evasion patterns.')
    r.p('The contribution the team considers most significant is not the number of models invoked but '
        'the system’s willingness to refuse. A try-on image that distorts the body is blocked rather '
        'than returned; a photograph without sufficient evidence yields an explicit '
        '"insufficient evidence" state rather than a fabricated number; and exactly one component in the '
        'entire project is permitted to be described as fine-tuned — a rank-8 LoRA adapter on FLUX.2 for '
        'the fit-refinement step, with a saved checkpoint, a hash and identity-disjoint evaluation. At '
        'submission time JAPANO is a complete research and demonstration system, not a production-ready '
        'commercial service; the specific conditions still missing are enumerated in Chapters 7 and 8.')
    r.p('**Keywords:** fashion e-commerce, virtual try-on, single-image anthropometry, recommender '
        'systems, MongoDB, React Native, diffusion models, LoRA.')

    # -------------------------------------------------------- mục lục
    r.front_h1('Mục lục')
    r.toc(outline['headings'], pages)

    r.front_h1('Danh mục hình')
    r.p('Báo cáo có %d hình. Các hình mang nhãn "chờ bổ sung" là ảnh chụp màn hình thiết bị mà '
        'nhóm chưa thực hiện được trong lần dựng báo cáo này; khung hướng dẫn chụp nằm ngay tại vị trí '
        'hình trong nội dung, và bảng tổng hợp nằm ở Phụ lục I.' % len(outline['figures']), indent=False)
    r.catalogue(outline['figures'], pages, 'figure')

    r.front_h1('Danh mục bảng')
    r.p('Báo cáo có %d bảng. Mỗi bảng chứa số liệu đo được đều ghi nguồn ngay dưới bảng: tệp kết quả, '
        'lệnh chạy hoặc điểm cuối đã truy vấn.' % len(outline['tables']), indent=False)
    r.catalogue(outline['tables'], pages, 'table')

    # ------------------------------------------------ danh mục từ viết tắt
    r.front_h1('Danh mục từ viết tắt và thuật ngữ')
    r.p('Bảng dưới đây giải thích các từ viết tắt và thuật ngữ kỹ thuật xuất hiện nhiều lần trong báo '
        'cáo. Thuật ngữ chỉ dùng một lần được giải thích ngay tại chỗ.', indent=False)
    r.table(
        'Danh mục từ viết tắt và thuật ngữ dùng trong báo cáo.',
        ['Viết tắt', 'Dạng đầy đủ', 'Ý nghĩa trong ngữ cảnh JAPANO'],
        [
            ['API', 'Application Programming Interface',
             'Giao diện lập trình; ở đây là 138 điểm cuối REST của backend.'],
            ['BFF', 'Backend For Frontend',
             'Lớp trung gian đặt cùng gốc với website, giữ JWT trong cookie HttpOnly và chặn các route quản trị.'],
            ['BMI', 'Body Mass Index',
             'Chỉ số khối cơ thể; trong JAPANO là biến trung gian được ước lượng từ tỉ lệ bề ngang, không cần thang cm.'],
            ['CF', 'Collaborative Filtering',
             'Lọc cộng tác — gợi ý dựa trên hành vi của những người dùng tương tự.'],
            ['COD', 'Cash On Delivery', 'Thanh toán khi nhận hàng.'],
            ['CORS', 'Cross-Origin Resource Sharing',
             'Cơ chế trình duyệt kiểm soát yêu cầu từ nguồn khác; hiện đang mở mặc định trong môi trường demo.'],
            ['CSP', 'Content Security Policy',
             'Chính sách chống chèn mã; hiện tắt trên trang quản trị — xem mục 7.3.'],
            ['CSRF', 'Cross-Site Request Forgery',
             'Tấn công giả mạo yêu cầu; website chống bằng kiểm tra Origin ở lớp BFF.'],
            ['ERD', 'Entity Relationship Diagram',
             'Sơ đồ thực thể — quan hệ; bản chuẩn của dự án là `JAPANO_ERD.drawio` với 19 bảng logic.'],
            ['FK / PK', 'Foreign Key / Primary Key',
             'Khoá ngoại / khoá chính ở mức logic; MongoDB dùng `_id` làm khoá vật lý và quan hệ do ứng dụng bảo đảm.'],
            ['GPU / VRAM', 'Graphics Processing Unit / Video RAM',
             'Card đồ hoạ và bộ nhớ của nó; máy phát triển dùng RTX 5060 Ti 16 GB.'],
            ['JWT', 'JSON Web Token',
             'Thẻ phiên đăng nhập có chữ ký, mang cả vai trò người dùng.'],
            ['LoRA', 'Low-Rank Adaptation',
             'Kỹ thuật fine-tune chỉ huấn luyện một bộ chuyển thể hạng thấp thay vì toàn bộ mô hình.'],
            ['MAE', 'Mean Absolute Error', 'Sai số tuyệt đối trung bình — đơn vị đo chính của phần ước lượng số đo.'],
            ['MoE', 'Mixture of Experts',
             'Cách trộn nhiều mô hình con; trong JAPANO là trộn có trọng số thích ứng giữa chín nguồn gợi ý.'],
            ['NDCG / Recall', 'Normalized Discounted Cumulative Gain / Recall',
             'Hai chỉ số đánh giá xếp hạng; trong JAPANO hiện được báo là **chưa đo**.'],
            ['RBAC', 'Role-Based Access Control',
             'Phân quyền theo vai trò: `customer < staff < admin < super_admin`.'],
            ['REST', 'Representational State Transfer', 'Kiểu thiết kế API dựa trên tài nguyên và phương thức HTTP.'],
            ['RFM', 'Recency – Frequency – Monetary',
             'Ba trục chấm điểm khách hàng trong phân tích nguy cơ rời bỏ.'],
            ['RL', 'Reinforcement Learning',
             'Học tăng cường. JAPANO **không** sử dụng — lập luận đầy đủ ở mục 6.6.'],
            ['SSM', 'State Space Model',
             'Mô hình không gian trạng thái; JAPANO cài một biến thể chọn lọc 12 chiều lấy cảm hứng từ Mamba.'],
            ['SSRF', 'Server-Side Request Forgery',
             'Lỗ hổng khiến máy chủ đi tải tài nguyên do kẻ tấn công chỉ định; xem mục 6.9 về ghép ảnh cảnh Nhật.'],
            ['TTL', 'Time To Live', 'Thời gian sống của một bản ghi cache hoặc một chỉ mục tự xoá.'],
            ['VTON', 'Virtual Try-On', 'Thử đồ ảo — sinh ảnh người mặc một trang phục cụ thể.'],
        ],
        widths=[Cm(2.2), Cm(4.6), Cm(8.7)], font=11, numbered=False)
