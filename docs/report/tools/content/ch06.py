"""Chương 6 — Thuật toán và trí tuệ nhân tạo."""
from docx.shared import Cm

from paths import DIAG, QA, SCENES


def build(r):
    r.h1('Thuật toán và trí tuệ nhân tạo')
    r.p('Đây là chương dài nhất của báo cáo, và nó được viết theo một nguyên tắc duy nhất: **mỗi tuyên '
        'bố phải kèm bằng chứng, và mỗi thành phần phải được gọi đúng tên của nó**. Có bốn cách một '
        'hệ thống có thể "dùng AI", và chúng khác nhau về bản chất — huấn luyện lại trọng số, hiệu '
        'chuẩn đầu ra, tối ưu suy luận, và quy tắc nghiệp vụ minh bạch. Gộp cả bốn vào một chữ "AI" '
        'là cách nhanh nhất để một báo cáo mất độ tin cậy, nên chương này tách chúng ra ngay từ đầu.')

    r.h2('6.1. Bản đồ các thành phần AI')
    r.table(
        'Toàn bộ thành phần AI trong JAPANO, phân loại theo bản chất kỹ thuật.',
        ['Thành phần', 'Bản chất', 'Chạy ở đâu', 'Mục'],
        [
            ['YOLOv8n-pose — lấy 17 khớp cơ thể', 'Suy luận, trọng số gốc', 'CPU, thường trú', '6.2'],
            ['U2Net — tách hình bóng người', 'Suy luận, trọng số gốc', 'CPU, thường trú', '6.2'],
            ['Bộ hồi quy BMI, cân nặng và ba vòng', '**Huấn luyện lại** trên ANSUR II', 'CPU', '6.2'],
            ['Hiệu chuẩn hình học thân người', 'Hiệu chuẩn hằng số trên VITON-HD', 'CPU', '6.2'],
            ['Hiệu chuẩn dân số', 'Hiệu chuẩn tuyến tính trên BodyM', 'CPU', '6.2'],
            ['Phân tích độ vừa vặn', 'Quy tắc nghiệp vụ định lượng', 'CPU', '6.3'],
            ['FASHN VTON 1.5 — sinh ảnh thử đồ', 'Suy luận, trọng số gốc', 'GPU ~15 GB', '6.4'],
            ['FLUX.2 Klein 4B — chuyển tư thế, tinh chỉnh', 'Suy luận, trọng số gốc', 'GPU', '6.4'],
            ['LoRA hạng 8 cho bước mô phỏng độ vừa vặn', '**Fine-tune** — thành phần duy nhất', 'GPU', '6.5'],
            ['Wan2.1 + One-to-All — sinh video', 'Tối ưu suy luận, **không** fine-tune', 'GPU ~13,5 GB', '6.7'],
            ['Chín nguồn gợi ý và bộ xếp hạng theo cặp', 'Học trực tuyến trong hệ thống', 'CPU', '6.8'],
            ['Trợ lý Ori', 'Định tuyến + truy hồi + quy tắc; **không có checkpoint**', 'CPU (+LLM tuỳ chọn)', '6.9'],
            ['Gợi ý trang phục theo địa điểm', 'Quy tắc chấm điểm, **không gọi mô hình ngôn ngữ**', 'CPU', '6.10'],
            ['Dự báo, phân cụm, luật mua kèm', 'Thống kê và học máy cổ điển', 'CPU', '6.11'],
            ['Kiểm duyệt nội dung', 'Quy tắc + ngữ nghĩa (tuỳ chọn)', 'CPU (+LLM tuỳ chọn)', '6.12'],
        ],
        widths=[Cm(5.4), Cm(4.6), Cm(3.6), Cm(1.9)], font=10)

    # ==================================================== 6.2 BODY
    r.h2('6.2. Ước lượng số đo cơ thể từ một ảnh')
    r.h3('6.2.1. Bài toán và giới hạn vật lý của nó')
    r.p('Bài toán: cho một ảnh chụp thường của một người, ước lượng chiều cao, cân nặng, vòng ngực, '
        'vòng eo và vòng hông. Trước khi nói về giải pháp, cần nói rõ giới hạn, vì nó quyết định toàn '
        'bộ thiết kế: **một ảnh hai chiều không có vật chuẩn kích thước thì không xác định được kích '
        'thước tuyệt đối**. Một người cao 1,60 mét đứng gần ống kính và một người cao 1,80 mét đứng xa '
        'hơn hoàn toàn có thể chiếm cùng số điểm ảnh. Đây không phải hạn chế của mô hình mà là hạn chế '
        'của thông tin có trong ảnh.')
    r.p('Hệ quả thiết kế: hệ thống không được phép trả về một con số đơn lẻ với vẻ chắc chắn. Nó phải '
        'trả về một khoảng, kèm độ tin cậy, và phải có một trạng thái "chưa đủ bằng chứng" thật sự '
        'được sử dụng chứ không chỉ tồn tại trên giấy.')

    r.h3('6.2.2. Lỗi gốc: bốn nguyên nhân độc lập, đều đo được')
    r.p('Phiên bản đầu tiên của đường ống này sai nghiêm trọng, và việc phân tích nó là phần có giá '
        'trị nhất của cả mục. Với ảnh một người mẫu nữ dáng gầy mặc áo đỏ dài tay, ảnh bị cắt ngang '
        'đùi, hệ thống trả về chiều cao 200–210 cm, cân nặng 110–120 kg và vòng eo 150–160 cm.')
    r.table(
        'Bốn nguyên nhân độc lập của lỗi ước lượng ban đầu, và cách xử lý từng nguyên nhân.',
        ['Nguyên nhân', 'Bằng chứng đo được', 'Cách xử lý'],
        [
            ['Phân đoạn gộp hai cánh tay vào thân',
             'Từ dòng 460 tới dòng 1100, hình bóng chỉ có **một** đoạn liên tục rộng 460–503 điểm ảnh, '
             'trong khi khoảng cách hai khớp hông chỉ 214 điểm ảnh. "Vòng eo" 497 điểm ảnh thực chất là '
             'tay + thân + tay.',
             'Cắt tay khỏi thân bằng khung xương, rồi hợp nhất với dự đoán từ khoảng cách khớp theo '
             'trọng số chọn bằng sai số.'],
            ['Dùng khớp giả làm mốc đo',
             'Ảnh cắt ở dòng 1320, nhưng mô hình vẫn xuất đầu gối ở dòng 1303 và 1319 với độ tin cậy '
             '0,25 và 0,32. Hệ thống tưởng nhìn thấy đầu gối và ngoại suy chiều cao từ đó.',
             'Loại khớp có độ tin cậy dưới 0,5 và khớp nằm trong phạm vi 1,5% mép ảnh.'],
            ['Suy chiều dài đầu từ một hệ số cố định',
             'Công thức (mắt − đỉnh đầu)/0,55 cho 208 điểm ảnh, trong khi đầu thật khoảng 233–278. Hệ '
             'số đúng, đo trên 6 479 khuôn mặt có nhãn, là **0,511 ± 0,048**.',
             'Ba đường đo độc lập, hợp nhất theo nghịch đảo phương sai; hệ số khớp trên dữ liệu có nhãn.'],
            ['Kẹp về biên rồi nhân hằng số',
             '8,61 đầu trên thân bị kẹp còn 8,6 rồi nhân 24,0 cm ra 206,4 cm.',
             'Bỏ hẳn cách này. Kẹp về biên rồi trả một con số trông hợp lý là bịa, không phải đo.'],
        ],
        widths=[Cm(3.4), Cm(6.6), Cm(5.5)], font=10)
    r.p('Bốn nguyên nhân này còn nhân nhau: chiều cao sai 40 cm làm mọi bề ngang quy ra cm sai theo, '
        'khiến véc-tơ đặc trưng lệch miền huấn luyện tới tám độ lệch chuẩn, khiến cổng kiểm tra ngoài '
        'phân bố phủ quyết kết quả của mô hình học máy, và nhánh dự phòng tuyến tính cuối cùng trả về '
        '119,8 kg. Một lỗi ở bước đầu đã lan qua toàn bộ đường ống.')

    r.h3('6.2.3. Đường ống hiện tại: mười hai bước')
    r.figure(DIAG / 'D17-pipeline-do-co-the.png',
             'Đường ống ước lượng số đo cơ thể từ một ảnh: mười hai bước và ba đường ra khác nhau.',
             source='Nhóm tự vẽ từ `backend/body_analysis.py` và `backend/body_geometry.py`; tệp nguồn '
                    '`docs/report/diagrams/D17-pipeline-do-co-the.drawio`.',
             width_cm=15.5)
    r.p('Ba đường ra ở bên phải sơ đồ là phần quan trọng nhất. Hệ thống có thể trả về số đo thật của '
        'khách, hoặc một khoảng ước lượng, hoặc một lời thừa nhận là chưa đủ bằng chứng — và ba đường '
        'này không thể thay thế nhau.')

    r.h3('6.2.4. Trích đặc trưng hình học')
    r.p('Sau khi có hình bóng và bộ khớp đã lọc, bước quan trọng nhất là tách phần thân ra khỏi phần '
        'tay. Ý tưởng là dùng khung xương để biết cánh tay lẽ ra phải ở đâu, rồi cắt hai vùng đó khỏi '
        'hình bóng, và hợp nhất kết quả với một dự đoán độc lập suy từ khoảng cách giữa các khớp.')
    r.p('Kết quả đo trên tập kiểm thử VITON-HD (1 203 ảnh, dùng nhãn phân tích ảnh làm chuẩn, chỉ tính '
        'những dòng có nhãn cả hai cánh tay):')
    r.table(
        'Sai số trích bề ngang thân trước và sau khi cắt tay bằng khung xương — VITON-HD test.',
        ['Mốc đo', 'MAE cũ (px)', 'MAE mới (px)', 'MAPE cũ', 'MAPE mới', 'Trong 10% (mới)'],
        [
            ['Ngực', '45,02', '**23,00**', '16,64%', '**7,95%**', '0,774'],
            ['Eo', '79,34', '**16,37**', '34,77%', '**9,64%**', '0,861'],
            ['Hông', '79,23', '**20,63**', '31,22%', '**9,99%**', '0,810'],
        ],
        widths=[Cm(2.6), Cm(2.6), Cm(2.6), Cm(2.4), Cm(2.6), Cm(2.7)], font=10.5,
        align_right=(1, 2, 3, 4, 5),
        note='`backend/ai_training/evaluation/torso_extraction.json`; chạy lại bằng '
             '`python3 backend/ai_training/evaluate_torso_extraction.py --split test`.')
    r.p('Riêng trên tập con "hai tay dính vào thân" — chính là trường hợp gây ra lỗi gốc — mức cải '
        'thiện còn lớn hơn: vòng eo từ 109,18 xuống 18,68 điểm ảnh, vòng hông từ 97,02 xuống 22,08 '
        'điểm ảnh. Nói cách khác, cách xử lý mới không chỉ tốt hơn trung bình mà tốt hơn đúng ở chỗ '
        'phiên bản cũ hỏng nặng nhất.')
    r.p('Một đặc trưng đáng nói riêng là **độ rộng quần áo** — hiệu giữa bề ngang đo được và bề ngang '
        'suy từ khung xương. Nhóm từng thử coi nó như nhiễu và loại bỏ, kết quả là mô hình trừ đi cả '
        'phần quần áo không tồn tại trên những người mặc đồ bó sát, lệch tới −10 cm ở cả ba vòng. Giả '
        'thuyết đúng hoá ra là ngược lại: phải **nói cho mô hình biết** ảnh này rộng bao nhiêu, thay vì '
        'để nó đoán. Thí nghiệm cắt bỏ trên 87 người của tập BodyM testA xác nhận:')
    r.table(
        'Thí nghiệm cắt bỏ: có và không có đặc trưng độ rộng quần áo (MAE).',
        ['Đại lượng', 'Có độ rộng quần áo', 'Không có'],
        [['Chiều cao (cm)', '12,01', '12,01'],
         ['Cân nặng (kg)', '12,27', '**10,25**'],
         ['Vòng ngực (cm)', '**9,22**', '14,53'],
         ['Vòng eo (cm)', '8,87', '**8,20**'],
         ['Vòng hông (cm)', '**11,44**', '16,51'],
         ['**Tổng bốn mục tiêu cơ thể**', '**41,80**', '49,49']],
        widths=[Cm(5.5), Cm(5.0), Cm(5.0)], font=10.5, align_right=(1, 2),
        note='`backend/ai_training/evaluation/ablation_clothing_slack.json`. Quyết định: **giữ** đặc '
             'trưng này, dù nó thua nhẹ ở cân nặng và vòng eo.')
    r.note('Một ảnh chụp chính diện **không** tách được "áo rộng" khỏi "bụng to". Đặc trưng này thực '
           'chất đo "rộng hơn khung xương bao nhiêu", nên nó là một tín hiệu, không phải một phép đo '
           'quần áo. Gọi đúng tên nó là điều kiện để không diễn giải sai kết quả về sau.',
           label='Đặc trưng này thật sự đo gì')

    r.h3('6.2.5. Ước lượng chiều cao: hậu nghiệm chứ không phải phép nhân')
    r.p('Chiều cao được xử lý riêng vì nó là đại lượng chịu ảnh hưởng nặng nhất của giới hạn thang đo. '
        'Thay vì nhân số "đầu" với một hằng số, hệ thống coi chiều cao là một **phân phối hậu nghiệm**: '
        'bắt đầu từ một tiên nghiệm dân số theo giới tính, rồi cập nhật bằng manh mối đo được từ ảnh, '
        'với trọng số tỉ lệ nghịch với độ bất định của manh mối đó.')
    r.formula([
        'w_cue  =  σ_prior²  /  (σ_prior²  +  σ_cue²)',
        'height =  w_cue · height_cue  +  (1 − w_cue) · height_prior',
    ], note='Trong đó σ_cue phụ thuộc độ phủ cơ thể trong khung hình: 0,07 khi thấy toàn thân, '
            '0,10 khi cắt tới đầu gối, 0,12 tới hông, 0,16 tới vai, 0,18 khi cắt sâu hơn nữa.')
    r.p('Ý nghĩa thực tế của công thức này rất cụ thể. Với bức ảnh áo đỏ đã nói ở trên, trọng số của '
        'manh mối ảnh chỉ đạt **0,168** — nghĩa là hơn tám phần mười kết quả đến từ tiên nghiệm dân số '
        'chứ không phải từ bức ảnh. Hệ thống vì vậy gắn cho kết quả nhãn `basis: population_prior` và '
        '`usableForSizing: false`, và **không** dùng nó để chốt size. Đây là chỗ mà việc trung thực về '
        'độ bất định biến thành một hành vi khác của phần mềm, chứ không chỉ là một dòng ghi chú.')

    r.h3('6.2.6. Hồi quy: huấn luyện lại trên đặc trưng giống ảnh thật')
    r.p('Ba bộ hồi quy được huấn luyện trên ANSUR II (6 068 người, giấy phép CC0-1.0): một bộ dự đoán '
        'BMI từ **tỉ lệ** bề ngang (không cần thang cm — đây là mấu chốt), một bộ dự đoán cân nặng, và '
        'một bộ dự đoán ba vòng. Điểm khác biệt so với cách làm thông thường là dữ liệu huấn luyện '
        'được **làm nhiễu có chủ đích** để mô phỏng điều kiện ảnh thật: quần áo rộng, tay còn sót lại '
        'sau khi cắt, và sai số chiều cao.')
    r.p('Kết quả của lựa chọn này là một đánh đổi rõ rệt và có chủ đích:')
    r.table(
        'Sai số của bộ hồi quy cũ và mới, trên tập kiểm thử ANSUR II 1 214 người.',
        ['Mục tiêu', 'Điều kiện', 'Bộ cũ (MAE)', 'Bộ mới (MAE)'],
        [
            ['Cân nặng', 'Đặc trưng đo bằng thước (phòng thí nghiệm)', '**3,13 kg**', '6,93 kg'],
            ['Cân nặng', 'Đặc trưng giống ảnh thật', '24,96 kg', '**6,37 kg**'],
            ['Vòng ngực', 'Đặc trưng giống ảnh thật', '18,18 cm', '**4,41 cm**'],
            ['Vòng eo', 'Đặc trưng giống ảnh thật', '19,02 cm', '**5,51 cm**'],
            ['Vòng hông', 'Đặc trưng giống ảnh thật', '19,99 cm', '**4,13 cm**'],
        ],
        widths=[Cm(2.8), Cm(6.2), Cm(3.2), Cm(3.3)], font=10.5, align_right=(2, 3),
        note='`backend/ai_training/evaluation/body_estimator_baseline_vs_new.json`; chia theo hàng, '
             'mỗi hàng là một người nên không trùng danh tính. Quyết định của quy trình: `promote`.')
    r.p('Đọc bảng này cần chú ý dòng đầu tiên: bộ mới **kém hơn hai lần** ở điều kiện phòng thí '
        'nghiệm. Nhóm vẫn chọn nó, vì điều kiện phòng thí nghiệm không bao giờ xuất hiện trong sản '
        'phẩm — người dùng không đưa vào số đo bằng thước, họ đưa vào một bức ảnh. Ở điều kiện thật, '
        'bộ mới tốt hơn khoảng **bốn lần**. Đây cũng là lời giải thích cho một hiện tượng khó hiểu ở '
        'phiên bản cũ: cổng kiểm tra ngoài phân bố liên tục phủ quyết mô hình học máy, đơn giản vì mô '
        'hình đó chưa từng thấy loại đặc trưng mà thực tế đưa cho nó.')

    r.h3('6.2.7. Hiệu chuẩn dân số và cổng tỉnh táo giải phẫu')
    r.p('Sau hồi quy còn hai lớp nữa. **Hiệu chuẩn dân số** là một phép hiệu chỉnh tuyến tính khớp '
        'trên tập huấn luyện của BodyM, kéo phân bố đầu ra về gần phân bố dân số chung. **Cổng tỉnh '
        'táo giải phẫu** chạy trên chính đầu ra và loại bỏ những giá trị bất khả thi: vòng ngực ngoài '
        'khoảng 60–170 cm, vòng eo ngoài 48–170 cm, vòng hông ngoài 60–180 cm, tỉ lệ hông trên ngực '
        'ngoài khoảng 0,70–1,45, tỉ lệ eo trên hông ngoài 0,50–1,35, hoặc BMI ngoài khoảng 13–45.')
    r.note('Hiệu chuẩn dân số từng gây ra một lỗi tinh vi đáng ghi lại: nó dịch chuyển **giá trị điểm** '
           'của cân nặng mà quên dịch chuyển khoảng bất định và khoảng hiển thị đi kèm. Kết quả là một '
           'ước lượng 79,4 kg được dán nhãn "50–60 kg" — một khoảng không chứa chính điểm ước lượng của '
           'nó. Lỗi đã được sửa và hiện có một kiểm thử riêng canh gác đúng tình huống này.',
           label='Một lỗi tinh vi đã được sửa')

    r.h3('6.2.8. Kết quả đầu-cuối: từ ảnh ra số đo')
    r.p('Đây là con số quan trọng nhất của cả mục, và cũng là con số mà dự án chưa từng có trước lần '
        'làm lại này: sai số thật **từ ảnh**, không phải sai số của riêng bước hồi quy.')
    r.table(
        'Sai số đầu-cuối từ ảnh ra số đo — BodyM testB, tách danh tính.',
        ['Đại lượng', 'MAE cũ', 'MAE mới', 'Độ lệch cũ', 'Độ lệch mới', 'Bin 10 chứa sự thật'],
        [
            ['Chiều cao (cm)', '19,35', '**6,56**', '+15,41', '**−1,93**', '0,456'],
            ['Cân nặng (kg)', '16,95', '**9,59**', '−1,37', '−1,67', '0,404'],
            ['Vòng ngực (cm)', '12,88', '**6,49**', '−3,22', '−2,26', '0,412'],
            ['Vòng eo (cm)', '9,90', '**6,45**', '+4,26', '**−1,72**', '0,465'],
            ['Vòng hông (cm)', '11,55', '**5,70**', '+6,13', '**−1,27**', '0,561'],
        ],
        widths=[Cm(3.0), Cm(2.2), Cm(2.4), Cm(2.4), Cm(2.6), Cm(2.9)], font=10.5,
        align_right=(1, 2, 3, 4, 5),
        note='`backend/ai_training/evaluation/body_pipeline_testB.json`, chạy ngày 28/08/2026. Tập '
             'BodyM testB, 120 người, tách danh tính khỏi tập huấn luyện; 114 ảnh cho ra kết quả với '
             'đường ống mới. Chạy lại bằng `python3 backend/ai_training/evaluate_body_pipeline.py '
             '--split testB`.')
    r.note('Tài liệu kỹ thuật nội bộ `backend/ai_training/BODY_MEASUREMENT.md` (ngày 28/08/2026, buổi '
           'sáng) ghi một bảng tương tự với **400 người** và các giá trị 6,44 / 9,00 / 6,11 / 6,50 / '
           '5,57. Tệp kết quả JSON được ghi **muộn hơn** trong cùng ngày và ứng với 120 người. Báo cáo '
           'này lấy theo tệp JSON vì đó là lần chạy gần nhất còn giữ được đầy đủ dữ liệu; sự chênh '
           'lệch được nêu ra thay vì chọn im lặng bộ số đẹp hơn.', label='Một khác biệt cần nói rõ')
    r.h4('Điều kiện đo và những gì con số này chưa bao gồm')
    r.bullets([
        'Tập BodyM cung cấp sẵn hình bóng nhị phân, và phép đo dùng trực tiếp hình bóng đó. Vì vậy đây '
        'là sai số của bước **suy luận hình học cộng hồi quy**, **chưa gồm sai số của bước tách nền** '
        'trên ảnh thật.',
        'Người trong BodyM mặc đồ bó sát. **Chế độ đồ phom rộng chưa đo được** vì nhóm không tìm được '
        'bộ ảnh nào vừa có người mặc đồ rộng vừa có số đo thật.',
        'Kết quả ở nam kém hơn ở nữ (cân nặng 10,11 so với 9,21 kg). Nguyên nhân **chưa được điều tra**.',
        'Khoảng hiển thị rộng 10 đơn vị chỉ chứa giá trị thật **40–56%** số lần. Việc hiển thị bin rộng '
        '10 là yêu cầu sản phẩm; độ phủ thật của nó là con số vừa nêu, và nó thấp. Khoảng bất định '
        'thật vẫn được giữ nguyên trong dữ liệu trả về.',
        'Toàn bộ phần hiệu chuẩn dân số **kế thừa giấy phép phi thương mại** của BodyM.',
    ])
    r.p('Về tốc độ, việc chuyển hai mô hình sang chạy thường trú trong một tiến trình riêng thay vì nạp '
        'lại mỗi lần gọi đã đổi hẳn bậc độ lớn của độ trễ:')
    r.table(
        'Độ trễ từng giai đoạn của bước phân tích cơ thể, trước và sau khi dùng tiến trình thường trú.',
        ['Giai đoạn', 'Trước', 'Sau'],
        [['Nạp YOLOv8n-pose', '0,85 s mỗi yêu cầu', '0 s (thường trú)'],
         ['Nạp và chạy U2Net', '~2,3 s mỗi yêu cầu', '~0,15 s (phiên dùng chung)'],
         ['Suy luận hình học và hồi quy', '~1,2 s', '~0,2 s'],
         ['**Toàn bộ điểm cuối `/api/stylist/body-analysis`**', '**4,12 s**', '**0,35 s** (P50; P90 0,37 s)']],
        widths=[Cm(7.5), Cm(4.0), Cm(4.0)], font=10.5, align_right=(1, 2),
        note='Đo trên 8 lượt gọi liên tiếp. Mục tiêu đặt ra là P50 ≤ 2 s và P90 ≤ 4 s — **đạt**.')

    # ==================================================== 6.3 FIT
    r.h2('6.3. Gợi ý size và suy luận độ vừa vặn')
    r.h3('6.3.1. Vì sao cần một tầng riêng')
    r.p('Trước khi có tầng này, hệ thống chỉ biết chênh lệch bậc size và dùng nó để in một dòng cảnh '
        'báo dưới ảnh. Bản thân bức ảnh thì luôn giống nhau — ai mặc size nào cũng vừa như nhau. Đó là '
        'một lời nói dối bằng hình ảnh, và nó vô hiệu hoá chính giá trị mà tính năng thử đồ hứa hẹn.')
    r.p('Tầng phân tích độ vừa vặn biến nhiều nguồn tín hiệu thành một đại lượng liên tục gọi là '
        '`severity` (mức độ nghiêm trọng) cùng một bản mô tả hiệu ứng thị giác để mô hình sinh ảnh dựng '
        'lại độ căng và độ rủ của vải. Nguyên tắc bất di bất dịch được ghi ngay trong đầu tệp mã nguồn: '
        '**giữ nguyên cơ thể người dùng, chỉ thay đổi cách vải ôm và rủ trên cơ thể đó** — không làm '
        'người gầy đi cho vừa áo nhỏ, cũng không làm người to ra cho vừa áo rộng.')

    r.h3('6.3.2. Hai nguồn tín hiệu và cách hợp nhất')
    r.p('Nguồn thứ nhất luôn có: chênh lệch bậc size giữa size khách chọn và size hệ thống khuyến nghị.')
    r.formula([
        'severity_delta(0) = 0        severity_delta(1) = 0,34',
        'severity_delta(2) = 0,66     severity_delta(n ≥ 3) = min(1;  0,88 + 0,04·(n − 3))',
    ])
    r.p('Nguồn thứ hai mạnh hơn nhưng chỉ có khi biết số đo vòng thật: **ease**, tức khoảng dư giữa '
        'vòng của trang phục theo bảng size và vòng cơ thể. Ease dương nghĩa là trang phục rộng hơn '
        'người; ease âm nghĩa là người lớn hơn trang phục.')
    r.formula([
        'ease = vòng_theo_bảng_size(size_chọn)  −  vòng_cơ_thể',
        '',
        'ease < 0      →  chật;  severity = |ease| / 22',
        '0 ≤ ease ≤ 9  →  vừa;   severity ≈ 0',
        'ease > 9      →  rộng;  severity = (ease − 9) / 24',
    ], note='Ngưỡng 0–9 cm lấy theo kinh nghiệm may mặc; trên 16 cm đã là dáng oversize rõ rệt.')
    r.p('Khi có cả hai nguồn, chúng được hợp nhất theo một quy tắc bất đối xứng có chủ đích:')
    r.formula([
        'severity = max( severity_ease ,  0,45 · severity_delta  +  0,55 · severity_ease )'
    ])
    r.p('Phép lấy giá trị lớn nhất ở đây có nghĩa là **số đo đo được chỉ có thể đẩy mức cảnh báo lên '
        'cao hơn, không bao giờ kéo nó xuống thấp hơn**. Lý do rất thực tế: một người có vòng ngực 100 '
        'cm mặc chiếc áo có vòng ngực 90 cm là chật thật, kể cả khi bảng size vẫn khuyên đúng size đó. '
        'Ngược lại, khi số đo cho thấy vừa vặn thì hệ thống tin số đo và hạ mức cảnh báo theo bậc size '
        'xuống còn 45%.')
    r.p('Khi hoàn toàn không có số đo vòng, hệ thống dùng BMI ước lượng và tỉ lệ bề ngang đo từ ảnh làm '
        'hiệu chỉnh **nhẹ**: cộng 0,08 nếu BMI ≥ 27 và size nhỏ hơn khuyến nghị, cộng thêm 0,07 nếu '
        'BMI ≥ 32, cộng 0,08 nếu BMI ≤ 19 và size lớn hơn khuyến nghị, cộng 0,05 theo tỉ lệ bề ngang. '
        'Các hệ số nhỏ là có chủ đích: đây là tín hiệu gián tiếp, không được phép lấn át tín hiệu trực tiếp.')

    r.h3('6.3.3. Bảy mức verdict và hiệu ứng được phép')
    r.figure(DIAG / 'D20-quyet-dinh-do-vua-van.png',
             'Cây quyết định của tầng phân tích độ vừa vặn, từ đầu vào tới hiệu ứng được phép xuất '
             'hiện trên ảnh.',
             source='Nhóm tự vẽ từ `backend/lib/fitAnalysis.js`; tệp nguồn '
                    '`docs/report/diagrams/D20-quyet-dinh-do-vua-van.drawio`.',
             width_cm=15.0)
    r.table(
        'Bảy mức verdict, ngưỡng severity và hiệu ứng thị giác được phép xuất hiện.',
        ['Verdict', 'Nhãn', 'Ngưỡng severity', 'Hiệu ứng được phép'],
        [
            ['`good`', 'VỪA', '≤ 0,12 hoặc không lệch hướng', 'Không có'],
            ['`slightly_tight`', 'HƠI CHẬT', '≤ 0,42', '`fabric_tension`'],
            ['`tight`', 'CHẬT', '≤ 0,72', '`fabric_tension`, `seam_stress`, `button_strain`'],
            ['`very_tight`', 'RẤT CHẬT', '> 0,72', 'Ba hiệu ứng trên, thêm `seam_separation`; chỉ khi '
             'severity ≥ 0,85 và trang phục cho phép thì thêm `small_seam_split`'],
            ['`slightly_loose`', 'HƠI RỘNG', '≤ 0,42', '`extra_folds`'],
            ['`loose`', 'RỘNG', '≤ 0,72', '`dropped_shoulders`, `oversized_sleeves`, `extra_folds`'],
            ['`very_loose`', 'RẤT RỘNG', '> 0,72', 'Bốn hiệu ứng trên, thêm `wide_drape`, '
             '`oversized_silhouette`'],
            ['`unknown`', 'CHƯA RÕ', '—', 'Không có; áp dụng khi sản phẩm không có bậc size'],
        ],
        widths=[Cm(2.7), Cm(2.0), Cm(3.2), Cm(7.6)], font=10)
    r.p('Danh sách hiệu ứng được phép không phải để trang trí: cổng chất lượng ở bước sau đọc đúng danh '
        'sách này để biết đâu là một nếp nhăn căng **có chủ đích** và đâu là lỗi sinh ảnh. Nếu không có '
        'danh sách này, cổng chất lượng sẽ đánh trượt chính hiệu ứng mà hệ thống vừa cố tình tạo ra.')

    r.h3('6.3.4. Ba tầng chặn hiệu ứng bục đường may')
    r.p('Hiệu ứng "bục một đoạn đường may" là hiệu ứng nhạy cảm nhất, vì ở một số loại trang phục nó '
        'đồng nghĩa với làm hở thêm cơ thể. Vì vậy nó có **ba tầng chặn độc lập**, và chỉ cần một tầng '
        'nói không là hiệu ứng bị loại:')
    r.numbers([
        '**Theo vùng cơ thể.** Trang phục thuộc vùng dưới — quần, chân váy — không bao giờ được bục.',
        '**Theo loại trang phục.** Đồ bơi, bikini, áo crop, quần short, váy ngắn tự cấm hiệu ứng này. '
        'Với đồ bơi, một vết bục làm lộ vùng nhạy cảm nên đây là cấm tuyệt đối; ngay cả hiệu ứng '
        '`seam_separation` nhẹ hơn cũng bị cấm, chỉ còn vải căng và dây hằn nhẹ.',
        '**Theo lời gọi.** Lớp gọi có thể truyền cờ tắt hẳn hiệu ứng, và một biến môi trường có thể tắt '
        'toàn cục.',
    ])
    r.p('Ngoài ba tầng này còn một điều kiện định lượng: hiệu ứng chỉ được xem xét khi verdict là '
        '`very_tight` **và** severity đạt ít nhất 0,85. Ngưỡng cao như vậy là có chủ đích — hiệu ứng '
        'này chỉ nên xuất hiện ở trường hợp cực đoan, không phải ở mọi lần chọn nhầm một bậc size.')

    r.h3('6.3.5. Khi nào chạy bước tinh chỉnh tốn kém')
    r.p('Bước mô phỏng độ vừa vặn bằng FLUX.2 là bước đắt nhất của cả đường ống: nó nạp một mô hình '
        'khoảng 15 GB lên một card 16 GB. Vì vậy nó không chạy vô điều kiện.')
    r.code([
        'function fitRefinePlan(fit) {',
        "  if (disabled) return { shouldRefine: false, reason: 'disabled_by_env' };",
        "  if (!fit || fit.verdict === 'unknown' || fit.verdict === 'good')",
        "    return { shouldRefine: false, mandatory: false, reason: 'fit_good' };",
        "  if (fit.verdict === 'very_tight' || fit.verdict === 'very_loose')",
        "    return { shouldRefine: true, mandatory: true, reason: 'extreme_fit' };",
        "  if (fit.verdict === 'tight' || fit.verdict === 'loose')",
        "    return { shouldRefine: true, mandatory: false, reason: 'clear_fit_gap' };",
        '  return fit.severity >= minSeverity',
        "    ? { shouldRefine: true, reason: 'severity_above_threshold' }",
        "    : { shouldRefine: false, reason: 'severity_below_threshold' };",
        '}',
    ], caption='Quy tắc quyết định có chạy bước tinh chỉnh độ vừa vặn hay không — '
               '`backend/lib/fitAnalysis.js`.')
    r.p('Đọc đoạn mã này theo hướng chi phí: ảnh vừa size thì bỏ qua hoàn toàn, tiết kiệm trọn vẹn một '
        'lượt nạp mô hình; lệch rõ thì chạy nhưng không bắt buộc thành công; lệch cực đoan thì bắt buộc '
        'phải chạy vì nếu không, bức ảnh sẽ nói dối về độ vừa vặn. Ngưỡng mặc định là 0,35 và điều '
        'chỉnh được bằng biến môi trường.')

    r.h3('6.3.6. Bảng quyết định và các ca biên')
    r.table(
        'Bảng quyết định của tầng độ vừa vặn với các ca biên đã được kiểm thử.',
        ['Tình huống', 'Kết quả'],
        [
            ['Sản phẩm không có bậc size (phụ kiện)', '`verdict = unknown`, không hiệu ứng nào. Hệ '
             'thống **không** mặc định gán size M.'],
            ['Khách chọn đúng size khuyến nghị, có số đo, ease = 4 cm',
             '`good`, severity ≈ 0, bỏ qua bước tinh chỉnh.'],
            ['Khách chọn nhỏ hơn một bậc, không có số đo, BMI ước lượng 28',
             'severity = 0,34 + 0,08 = 0,42 → `slightly_tight`, chạy tinh chỉnh vì vượt ngưỡng 0,35.'],
            ['Vòng ngực 100 cm, chọn size M (bảng ghi 90 cm), bảng size vẫn khuyên M',
             'ease = −10 → severity = 0,45 → `tight`. Số đo thắng bậc size.'],
            ['Khách chọn lớn hơn ba bậc', 'severity = 0,88 → `very_loose`, bắt buộc chạy tinh chỉnh.'],
            ['Đồ bơi hai mảnh, severity 0,95', '`very_tight` nhưng **không** có hiệu ứng bục nào; chỉ '
             'vải căng và dây hằn nhẹ.'],
            ['Quần jean, severity 0,92', '`very_tight`, có `seam_stress` nhưng **không** có '
             '`small_seam_split` vì thuộc vùng dưới.'],
            ['Áo Haori dáng dài, chọn rộng hai bậc', '`very_loose`; lời nhắc riêng cho áo khoác về độ '
             'rủ và tay áo rộng, nếu không mô hình dễ kéo nó thành áo thun bó.'],
        ],
        widths=[Cm(6.6), Cm(8.9)], font=10.5)

    # ==================================================== 6.4 TRY-ON
    r.h2('6.4. Thử đồ ảo')
    r.h3('6.4.1. Vì sao hai mô hình chứ không phải một')
    r.p('Ảnh catalog chỉ cho khách thấy trang phục trên người mẫu. Để thu hẹp khoảng cách giữa hình '
        'ảnh quảng cáo và cảm giác mặc trên chính cơ thể khách hàng, JAPANO dùng FASHN VTON 1.5 làm '
        'engine mặc trang phục chính. FASHN mạnh ở đúng thứ mà một cửa hàng cần nhất: nó **giữ đúng '
        'màu, hoạ tiết và kết cấu của trang phục** — nếu một chiếc yukata có hoa anh đào trắng trên nền '
        'chàm thì ảnh sinh ra phải có đúng hoa đó, không phải một hoạ tiết na ná.')
    r.p('Nhưng FASHN không giải quyết được hai việc. Thứ nhất, khi ảnh đầu vào có tư thế khó — người '
        'chụp nghiêng, tay che ngực, đứng lệch — nó khó nhận diện đúng vùng cần thay. Thứ hai, nó '
        'không mô phỏng được **cách bộ đồ nằm trên cơ thể theo size**: cùng một chiếc áo, mặc chật hay '
        'rộng đều ra ảnh như nhau. Hai việc đó do FLUX.2 Klein 4B đảm nhận.')
    r.p('Thứ tự giữa hai mô hình là cố ý và không đảo được: **FASHN chạy trước để giữ đúng thiết kế '
        'trang phục, FLUX.2 chạy sau trên ảnh đã mặc xong để sửa cách bộ đồ nằm trên cơ thể.** Làm '
        'ngược lại — bóp méo ảnh vải trước khi đưa vào bước mặc đồ — sẽ phá luôn thiết kế của sản phẩm, '
        'và khi đó bức ảnh không còn là ảnh của món hàng đang bán nữa.')

    r.h3('6.4.2. Đường ống đầy đủ')
    r.figure(DIAG / 'D12-seq-thu-do.png',
             'Trình tự đầy đủ của một lượt thử đồ, từ lúc khách chọn ảnh tới lúc nhận kết quả hoặc lời '
             'từ chối.',
             source='Nhóm tự vẽ từ `backend/routes/tryon.js`; tệp nguồn '
                    '`docs/report/diagrams/D12-seq-thu-do.drawio`.',
             width_cm=15.5)
    r.p('Ba hồ sơ chất lượng được cấu hình sẵn, và ứng dụng di động dùng hồ sơ `balanced`:')
    r.table(
        'Ba hồ sơ chất lượng của bước sinh ảnh thử đồ.',
        ['Hồ sơ', 'Số bước khử nhiễu', 'Cạnh dài đầu ra', 'Dùng khi nào'],
        [['`fast`', '16', '1 280 px', 'Xem nhanh, ưu tiên tốc độ'],
         ['`balanced`', '20', '1 536 px', '**Mặc định của ứng dụng di động**'],
         ['`high`', '25', '1 536 px', 'Giữ đúng cấu hình nghiệm thu ban đầu']],
        widths=[Cm(3.0), Cm(4.0), Cm(3.5), Cm(5.0)], font=10.5,
        note='`backend/fashn_service.py`, hàm `tryon_quality_profile`. Cạnh dài vẫn giữ 1 536 px ở hồ '
             'sơ `balanced` để ảnh xem trên điện thoại không bị mềm.')
    r.p('Việc chọn 20 bước thay vì 25 là một quyết định đo được chứ không phải cảm tính. Đồng thời, '
        'bước tinh chỉnh cấu trúc bằng FLUX được **bỏ qua** với trang phục thông thường, nhưng vẫn giữ '
        'với áo khoác dài như Haori — vì một thí nghiệm bỏ bước này ở Haori (37,6 giây) cho ra chiếc '
        'áo bị ngắn và sai dáng thấy rõ bằng mắt. Đường đi được chấp nhận cho Haori mất khoảng 75 '
        'giây. Vì vậy **không được tuyên bố một thời gian dưới một phút cho mọi trường hợp**.')

    r.h3('6.4.3. Cổng chất lượng ba tầng')
    r.p('Đây là phần mà nhóm cho là đóng góp kỹ thuật quan trọng nhất của mục này. Một mô hình sinh ảnh '
        'không có gì bảo đảm đầu ra đúng, nên bước kiểm tra sau khi sinh là bắt buộc. Ba tầng kiểm tra '
        'trả lời ba câu hỏi **khác nhau** và có hậu quả khác nhau.')
    r.table(
        'Ba tầng của cổng chất lượng thử đồ.',
        ['Tầng', 'Câu hỏi', 'Hậu quả khi không đạt'],
        [
            ['Danh tính', 'Người trong ảnh có còn là người trong ảnh gốc không? Khuôn mặt và dáng cơ '
             'thể có bị thay đổi không?',
             'Chặn. Ngoại lệ: khi lượt đó có chuyển tư thế thì so pixel không còn ý nghĩa, nên chính '
             'sách chuyển từ chặn sang **cảnh báo**.'],
            ['Cấu trúc trang phục', 'Màu, hoạ tiết và hình dáng có đúng là của sản phẩm đang bán không? '
             'Hiệu ứng xuất hiện có nằm trong danh sách được phép không?',
             'Chặn nếu sai thiết kế; ghi cảnh báo nếu hiệu ứng mong đợi không hiện ra.'],
            ['Độ che phủ', 'Vùng bắt buộc kín có bị hở không, và vùng hở có đúng thiết kế của trang '
             'phục không?',
             'Chặn tuyệt đối. Với đồ bơi tối giản, tầng này dùng một vùng lõi được bảo vệ theo nguyên '
             'tắc **thất bại thì chặn**.'],
        ],
        widths=[Cm(2.6), Cm(6.6), Cm(6.3)], font=10)
    r.p('Ba tầng được tách ra vì gộp chúng lại sẽ sinh lỗi. Một sự cố thật minh hoạ điều này: có lúc '
        'tầng độ che phủ dùng lại khung tư thế lấy từ **ảnh sạch** để kiểm tra **ảnh kết quả**, cộng '
        'với một ngưỡng tính trên toàn vùng. Với đồ bơi hai mảnh, cách đó cho kết quả sai. Sau khi sửa, '
        'tầng này phát hiện tư thế **riêng** cho từng ảnh và dùng một vùng lõi được bảo vệ với nguyên '
        'tắc thất bại thì chặn. Một lượt kiểm tra thật qua đầy đủ API với bộ nhớ đệm nguội trả về mã '
        '200 sau khoảng 73 giây, không có lý do vi phạm nào và không có cảnh báo nào.')
    r.p('Nguyên tắc xử lý khi không đạt cũng quan trọng như bản thân phép kiểm tra: hệ thống **giữ lại '
        'ảnh sạch và nói rõ lý do**, thay vì trả về ảnh hỏng kèm một dòng cảnh báo nhỏ. Hình 5.7 ở '
        'Chương 5 là ảnh chụp thật của hành vi này trên điện thoại.')

    r.h3('6.4.4. Cổng an toàn cho trang phục dành cho người trưởng thành')
    r.p('Với đồ bơi và trang phục hở, có thêm một cổng chạy **trước** khi sinh ảnh. Cổng này có hai '
        'điều kiện độc lập: người dùng tự xác nhận đủ 18 tuổi và có quyền dùng bức ảnh; và ảnh không '
        'mang tín hiệu rõ ràng là trẻ vị thành niên.')
    r.p('Cách xử lý ba kết quả của bước kiểm tra bằng thị giác thể hiện một quan điểm rõ ràng: '
        '**mô hình thị giác không phải giấy tờ xác minh tuổi**.')
    r.bullets([
        'Kết quả `no` (là trẻ vị thành niên): **chặn tuyệt đối**, không có ngoại lệ.',
        'Kết quả `unsure`: thường chỉ có nghĩa ảnh chụp xa hoặc ánh sáng khó. Nếu người dùng đã xác '
        'nhận đủ 18 tuổi thì cho đi tiếp kèm cờ đánh dấu, nhưng kết quả **vẫn phải qua sàn che phủ** '
        'ngực, vùng chậu và mông ở bước sau.',
        'Dịch vụ kiểm tra không chạy được: **thất bại thì chặn**, kèm thông báo mời thử lại sau. Không '
        'có đường vòng nào.',
    ])
    r.p('Năm bộ ảnh mẫu dành cho luồng này nằm trong tài nguyên của ứng dụng. Client chỉ gửi **mã của '
        'ảnh mẫu**; máy chủ tự nạp tệp của mình và đối chiếu mã băm SHA-256 với bản kê khai trước khi '
        'coi lượt đó là ảnh đã được duyệt. Chính phép kiểm tra băm này là thứ mà cờ "đã duyệt cho nội '
        'dung người lớn" bám vào, nên nó không được phép bỏ qua và máy chủ **không bao giờ** chấp nhận '
        'một ảnh do client cung cấp trên đường đi này.')

    r.h3('6.4.5. Bộ nhớ đệm: chỉ cho ảnh mẫu, không bao giờ cho ảnh khách')
    r.p('Một lượt dựng ảnh mất 39–83 giây GPU, nên cám dỗ lưu lại tất cả là rất lớn. Chính sách của dự '
        'án đi theo hướng ngược lại và lý do đã được trình bày ở mục 4.6.3. Về mặt kỹ thuật, khoá của '
        'bộ nhớ đệm gồm **mọi thứ ảnh hưởng tới ảnh đầu ra**: số hiệu phiên bản đường ống, mã ảnh mẫu, '
        'mã băm SHA-256 của chính ảnh mẫu đó, danh sách sản phẩm đã sắp xếp, size, màu, danh sách phụ '
        'kiện và hồ sơ chất lượng. Thiếu một biến là trả nhầm ảnh của cấu hình khác.')
    r.p('Việc đưa mã băm của ảnh mẫu vào khoá là một chi tiết nhỏ nhưng quan trọng: nếu ảnh mẫu được '
        'thay bằng người mẫu khác mà vẫn giữ nguyên mã, khoá sẽ tự đổi theo và bộ nhớ đệm cũ tự động '
        'không còn khớp. Ngoài ra, **kết quả mang bất kỳ cảnh báo nào cũng không bao giờ được lưu**.')
    r.p('Hiệu quả đo được: một lượt trúng bộ nhớ đệm trả về trong khoảng **27 mili giây**, so với '
        '**40,8 giây** khi phải dựng lại, và hai ảnh giống nhau đến từng byte.')

    r.h3('6.4.6. Bộ điều phối GPU')
    r.figure(DIAG / 'D19-gpu-arbiter.png',
             'Bộ điều phối GPU: bốn mức ưu tiên theo màn hình người dùng đang mở, và cơ chế bảo vệ '
             'công việc đang chạy.',
             source='Nhóm tự vẽ từ `backend/lib/gpuArbiter.js` và `backend/lib/gpuJobQueue.js`; tệp '
                    'nguồn `docs/report/diagrams/D19-gpu-arbiter.drawio`.',
             width_cm=15.0)
    r.p('Bài toán: mô hình thử đồ chiếm khoảng 15 GB, mô hình tạo video khoảng 13,5 GB, còn card chỉ '
        'có 16 GB. Nạp đồng thời là tràn bộ nhớ chắc chắn. Giải pháp là một hàng chờ ưu tiên trong đó '
        '**chỉ một công việc sinh ảnh hoặc video chạy tại một thời điểm**, và mức ưu tiên được đặt theo '
        'màn hình mà người dùng đang mở: tạo video 300, thử đồ 200, mô tả ảnh sản phẩm 120, và gợi ý '
        'sản phẩm 100.')
    r.p('Vì sao chọn chính sách "giữ đến khi xong" thay vì chia sẻ thời gian giữa các mô hình? Vì cả '
        'hai mô hình đều mất hàng chục giây **chỉ để nạp**: riêng bước nạp mô hình video đã đo được '
        '8,3 giây. Tráo qua tráo lại giữa chừng sẽ làm cả hai công việc chậm hơn là xếp hàng tuần tự.')
    r.note('Một lỗi thật đáng ghi lại: chính màn hình thử đồ, khi báo cáo trạng thái nền của mình là '
           '"đang duyệt sản phẩm", đã **huỷ chính lượt thử đồ mà nó vừa gửi đi**. Cách sửa là một cặp '
           'hàm đánh dấu khoảng thời gian một công việc GPU đang chạy, để báo cáo trạng thái màn hình '
           'không giết được công việc thuộc về chính màn hình đó. Trước khi kết luận mô hình có vấn đề, '
           'điều đầu tiên cần kiểm tra trong nhật ký là ai đã gửi lệnh huỷ.',
           label='Một lỗi tinh vi về quyền sở hữu công việc')

    r.h3('6.4.7. Kết quả đo và ma trận kiểm thử')
    r.table(
        'Thời gian sinh ảnh thử đồ đo trên NVIDIA RTX 5060 Ti 16 GB.',
        ['Tình huống', 'Thời gian', 'Ghi chú'],
        [
            ['Ca thường', '37,865 s', 'Kiểm tra thật ngày 29/08/2026, trả về ảnh mở được.'],
            ['Ca bắt buộc chuyển tư thế', '61,893 s', 'Trả về kèm một cảnh báo về danh tính — đúng '
             'chính sách đã mô tả ở mục 6.4.3.'],
            ['Hồ sơ `balanced`, ảnh 1152×1536', '57,9 s', 'Kiểm tra AI thật của website, ảnh PNG 641 KB.'],
            ['Đồ bơi hai mảnh, bộ nhớ đệm ấm', '58,066 s', 'Ảnh 1152×1536; các cổng danh tính, cấu '
             'trúc và che phủ đều đạt, không cảnh báo.'],
            ['Đồ bơi hai mảnh, bộ nhớ đệm nguội', '~73 s', 'Mã 200, không có lý do vi phạm nào.'],
            ['Áo khoác Haori giữ bước tinh chỉnh cấu trúc', '~75 s', 'Bỏ bước này còn 37,6 s nhưng áo '
             'bị ngắn và sai dáng.'],
            ['Trúng bộ nhớ đệm (chỉ ảnh mẫu)', '~27 ms', 'So với 40,8 s khi dựng lại; ảnh giống hệt '
             'từng byte.'],
        ],
        widths=[Cm(5.4), Cm(2.6), Cm(7.5)], font=10,
        note='Tổng hợp từ `docs/project_evidence/ai_benchmarks/` các tệp ngày 29–30/08/2026.')
    r.p('Ngoài các phép đo đơn lẻ, nhóm chạy một ma trận kiểm thử 5 dáng người × 7 size để xem hiệu ứng '
        'độ vừa vặn có thật sự thay đổi theo size hay không. Kết quả là bằng chứng trực quan mạnh nhất '
        'của mục 6.3.')
    r.table(
        'Trích ma trận kiểm thử độ vừa vặn — dáng người "gầy và thấp", cùng một chiếc áo.',
        ['Size chọn', 'Size khuyến nghị', 'Lệch bậc', 'Verdict', 'Severity', 'Hiệu ứng đã áp', 'Thời gian'],
        [
            ['S', 'S', '0', '`good`', '0', 'Không', '82,9 s'],
            ['M', 'S', '+1', '`loose`', '0,47', 'Có', '78,5 s'],
            ['L', 'S', '+2', '`very_loose`', '0,79', 'Có', '76,4 s'],
            ['XL', 'S', '+3', '`very_loose`', '1,00', 'Có', '76,8 s'],
        ],
        widths=[Cm(1.9), Cm(2.4), Cm(1.6), Cm(2.5), Cm(1.9), Cm(2.2), Cm(2.0)], font=10,
        align_right=(2, 4, 6),
        note='`test-results/qa-matrix/results.json`. Severity tăng đơn điệu theo bậc lệch, đúng như '
             'công thức ở mục 6.3.2.')
    for name, cap in (
        ('average_XS.png', 'Cùng một chiếc áo len khoác, dáng người trung bình, chọn size XS — vải ôm sát.'),
        ('average_M.png', 'Cùng dáng người và cùng chiếc áo, chọn size M — form vừa vặn.'),
        ('average_XXL.png', 'Cùng dáng người và cùng chiếc áo, chọn size XXL — vai trễ, thân áo rộng và nhiều nếp rủ.'),
    ):
        path = QA / name
        if path.exists():
            r.figure(path, cap,
                     source='Ảnh do đường ống thử đồ của JAPANO sinh ra trong lần chạy ma trận kiểm '
                            'thử, tệp `test-results/qa-matrix/' + name + '`. Người trong ảnh là **mẫu '
                            'dựng sẵn của hệ thống**, không phải ảnh của khách hàng.',
                     width_cm=6.4)
    r.p('Ba bức ảnh trên là cùng một sản phẩm, cùng một người, chỉ khác size được chọn. Đây chính là '
        'điều mà một dòng chữ cảnh báo không làm được, và là lý do tầng phân tích độ vừa vặn ở mục 6.3 '
        'tồn tại.')

    # ==================================================== 6.5 FINE-TUNE
    r.h2('6.5. Fine-tune: cái gì thật sự được huấn luyện')
    r.p('Mục này tồn tại vì đây là chỗ dễ nói quá nhất trong bất kỳ báo cáo nào về AI. Nhóm áp dụng '
        'một định nghĩa chặt: một thành phần chỉ được gọi là **đã fine-tune** khi có đủ bốn điều kiện — '
        'dữ liệu huấn luyện có giấy phép rõ ràng; quá trình tối ưu thật sự cập nhật trọng số; một '
        'checkpoint tải lại được kèm mã băm; và đánh giá trên tập tách theo danh tính. Thiếu một điều '
        'kiện thì thành phần đó được gọi bằng tên khác.')
    r.table(
        'Trạng thái huấn luyện thật của từng thành phần AI trong JAPANO.',
        ['Thành phần', 'Có cập nhật trọng số?', 'Phải gọi đúng là'],
        [
            ['LoRA hạng 8 trên FLUX.2 (bước mô phỏng độ vừa vặn)', '**Có**', '**Fine-tune**'],
            ['Bộ hồi quy cân nặng, BMI và ba vòng đo', '**Có**', '**Huấn luyện có giám sát**'],
            ['Hiệu chuẩn hình học thân người', 'Không — chỉ khớp hằng số', 'Hiệu chuẩn'],
            ['Hiệu chuẩn dân số', 'Không — chỉ khớp hằng số tuyến tính', 'Hiệu chuẩn'],
            ['FASHN VTON 1.5', 'Không', 'Suy luận'],
            ['FLUX.2 Klein 4B (chuyển tư thế, phụ kiện)', 'Không', 'Suy luận'],
            ['Wan2.1 + One-to-All (video)', 'Không', '**Tối ưu suy luận**'],
            ['Trợ lý Ori và tư vấn sức khoẻ', 'Không — **không có checkpoint nào**',
             'Định tuyến + truy hồi + quy tắc'],
            ['Chín nguồn gợi ý và bộ xếp hạng', 'Có, nhưng học **trực tuyến trong hệ thống**',
             'Học trực tuyến — **không phải fine-tune mô hình ngôn ngữ**'],
        ],
        widths=[Cm(5.4), Cm(4.8), Cm(5.3)], font=10)
    r.p('Bảng tiếp theo bổ sung phần bằng chứng cho ba hàng đầu tiên — những thành phần thật sự có '
        'trọng số được cập nhật — cùng ràng buộc giấy phép mà chúng thừa hưởng.')
    r.table(
        'Bằng chứng huấn luyện và ràng buộc giấy phép của các thành phần có cập nhật trọng số.',
        ['Thành phần', 'Dữ liệu', 'Checkpoint / mã băm', 'Đánh giá', 'Giấy phép'],
        [
            ['LoRA hạng 8 trên FLUX.2', 'VITON-HD — 116 mẫu, 21 danh tính',
             '`checkpoint-400`; `a1643dda4cdb1f3c-16731128`; 16 731 128 byte',
             '8 mẫu / 2 danh tính, tập validation', 'CC-BY-NC-SA-4.0 — **phi thương mại**'],
            ['Bộ hồi quy cân nặng, BMI và ba vòng', 'ANSUR II — 6 068 người × 5 bản làm nhiễu',
             'Ba tệp `.joblib` kèm siêu dữ liệu', '1 214 người, tách theo hàng',
             'CC0-1.0 — **không ràng buộc**'],
            ['Hiệu chuẩn hình học thân người', 'VITON-HD + cực trị ANSUR II', 'Tệp JSON hằng số',
             '1 203 ảnh tập test', 'CC-BY-NC-SA-4.0'],
            ['Hiệu chuẩn dân số', 'BodyM train', 'Tệp JSON hằng số', '120 người, tập testB',
             'CC-BY-NC-4.0 — **phi thương mại**'],
            ['Chín nguồn gợi ý và bộ xếp hạng', 'Hành vi người dùng trong chính hệ thống',
             'Không có tệp checkpoint; trọng số dựng lại mỗi 60 giây', '`not-measured`', '—'],
        ],
        widths=[Cm(3.0), Cm(3.0), Cm(3.6), Cm(2.9), Cm(3.0)], font=9)
    r.p('Có bốn thứ mà báo cáo này **cố ý không gọi** là fine-tune, dù chúng đều cải thiện kết quả: đổi '
        'lời nhắc đưa vào mô hình, đổi số bước khử nhiễu, hiệu chuẩn tuyến tính đầu ra, và bổ sung mẫu '
        'vi phạm vào một danh sách cụm khoá. Cả bốn đều không cập nhật một trọng số nào.')

    r.h3('6.5.1. Chi tiết bộ chuyển thể LoRA')
    r.table(
        'Cấu hình huấn luyện bộ chuyển thể LoRA cho bước mô phỏng độ vừa vặn.',
        ['Hạng mục', 'Giá trị'],
        [
            ['Mô hình nền', 'FLUX.2 Klein 4B, chế độ ảnh sang ảnh'],
            ['Kiểu chuyển thể', 'LoRA hạng 8, alpha 8'],
            ['Dữ liệu', 'VITON-HD — 116 mẫu, 21 danh tính, 7 lớp từ `good` tới `very_loose`'],
            ['Cách chia dữ liệu', '**Theo danh tính**: huấn luyện 81 mẫu / 15 người · validation 18 / 3 · '
             'test 17 / 3'],
            ['Cấu hình', '512 px, BF16, batch 1, tích luỹ gradient 4, Adam 8-bit, tốc độ học 1e-4, '
             '600 bước, seed 17'],
            ['Tài nguyên đo được', '80,3 phút · đỉnh bộ nhớ GPU 15,2 GB'],
            ['Checkpoint đang dùng', '`checkpoint-400`; mã băm `a1643dda4cdb1f3c-16731128`; 16 731 128 byte'],
            ['Phạm vi áp dụng', 'Chỉ danh mục `tops` — đúng miền dữ liệu phần thân trên'],
            ['Trạng thái mặc định', '**Tắt**; bật bằng biến môi trường `JAPANO_FIT_LORA_PATH`'],
        ],
        widths=[Cm(3.6), Cm(11.9)], font=10.5,
        note='`backend/ai_training/models/fit_lora.status.json`, trạng thái `ACCEPTED` ghi ngày '
             '26/08/2026.')
    r.p('Việc chia dữ liệu **theo danh tính** chứ không theo mẫu là điều kiện tối thiểu để con số đánh '
        'giá có nghĩa. Nếu cùng một người xuất hiện ở cả tập huấn luyện lẫn tập kiểm thử, mô hình có '
        'thể đơn giản là nhớ mặt người đó, và điểm số thu được sẽ đẹp một cách vô nghĩa.')

    r.h3('6.5.2. Cổng nghiệm thu đã loại hai checkpoint')
    r.p('Chi tiết quan trọng nhất của mục này: **mốc huấn luyện cuối cùng không mặc nhiên là mốc tốt '
        'nhất**. Checkpoint 500 và 600 đã bị cổng nghiệm thu loại vì lỗi ảnh, và checkpoint 400 mới là '
        'bản được chấp nhận. Nếu nhóm chỉ lấy kết quả ở bước cuối như thói quen thông thường, sản phẩm '
        'sẽ chạy một bộ chuyển thể tệ hơn.')
    r.table(
        'So sánh kết quả benchmark giữa đường cơ sở và checkpoint 400 — 8 mẫu, 2 danh tính, tập validation.',
        ['Chỉ số', 'Đường cơ sở', 'LoRA ckpt-400', 'Ý nghĩa'],
        [
            ['Tỉ lệ đạt', '100%', '100%', 'Không thành phần nào bị hỏng thêm.'],
            ['Tỉ lệ lỗi / tỉ lệ artifact', '0% / 0%', '0% / 0%', 'Không tệ đi.'],
            ['Sai lệch cơ thể ↓', '0,1148', '**0,1145**', 'Giữ cơ thể tốt hơn một chút.'],
            ['Thay đổi cấu trúc do fit ↑', '16,7195', '**19,0849**', 'Hiệu ứng độ vừa vặn hiện rõ hơn — '
             'đây là mục tiêu chính của lần huấn luyện.'],
            ['Lệch màu ↓', '6,6574', '8,4305', '**Kém hơn.** Đây là cái giá phải trả.'],
            ['Độ trễ P50', '13,43 s', '14,54 s', 'Chậm hơn khoảng 1,1 giây.'],
            ['Đỉnh bộ nhớ GPU', '5,82 GB', '5,82 GB', 'Không đổi.'],
        ],
        widths=[Cm(4.0), Cm(2.6), Cm(3.0), Cm(5.9)], font=10, align_right=(1, 2))
    r.note('Các chỉ số trên là **proxy tự động lấy từ chính cổng chất lượng, không phải điểm do người '
           'chấm**. Chúng đủ để so sánh hai phiên bản trong cùng một điều kiện, nhưng không thay thế '
           'được một cuộc đánh giá có người tham gia. Cỡ mẫu — 8 ảnh của 2 danh tính — cũng nhỏ, và '
           'báo cáo ghi rõ điều đó thay vì trình bày nó như một kết quả có ý nghĩa thống kê mạnh.',
           label='Bản chất của các chỉ số này')

    r.h3('6.5.3. Artifact đã nghiệm thu khác với adapter đang chạy')
    r.p('Đây là một phân biệt mà nhóm muốn nhấn mạnh, vì nó rất dễ bị bỏ qua. Tệp trạng thái ghi '
        '`ACCEPTED`, nghĩa là bộ chuyển thể đã được huấn luyện xong, đã qua cổng nghiệm thu và sẵn '
        'sàng dùng. Điều đó **không** có nghĩa là nó đang chạy.')
    r.p('Kiểm tra thật điểm cuối sức khoẻ của hệ thống lúc 11 giờ 57 phút ngày 31/08/2026 cho kết quả '
        '`fitLoraPath: ""` — đường dẫn rỗng, tức là **không có bộ chuyển thể nào được nạp ở thời điểm '
        'chạy**, và danh mục áp dụng vẫn là `["tops"]`. Nói cách khác, đường ống thử đồ hiện đang chạy '
        'bằng mô hình gốc cộng với tầng quy tắc độ vừa vặn ở mục 6.3, còn bộ chuyển thể LoRA là một '
        'tuỳ chọn bật được. Báo cáo ghi đúng trạng thái này thay vì viết rằng hệ thống "đang chạy mô '
        'hình đã fine-tune".')

    r.h3('6.5.4. Ràng buộc giấy phép')
    r.note('VITON-HD (`CC-BY-NC-SA-4.0`) và BodyM (`CC-BY-NC-4.0`) đều là dữ liệu **phi thương mại**. '
           'Mọi checkpoint và mọi hằng số hiệu chuẩn suy ra từ chúng **thừa hưởng ràng buộc đó**: phù '
           'hợp cho nghiên cứu và đồ án, không phải tài sản dùng được cho mục đích thương mại. Phần suy '
           'từ ANSUR II (`CC0-1.0`) thì không bị ràng buộc này. Đây là một trong những rào cản thật sự '
           'giữa JAPANO hiện tại và một sản phẩm thương mại — xem mục 7.4.', label='Ràng buộc bắt buộc phải nêu')

    # ==================================================== 6.6 RL
    r.h2('6.6. JAPANO có sử dụng học tăng cường hay không?')
    r.p('Câu trả lời ngắn: **không**. JAPANO chưa sử dụng học tăng cường theo bất kỳ nghĩa chuẩn nào '
        'của thuật ngữ này. Mục này trình bày cách nhóm đi tới kết luận đó, vì một câu trả lời không '
        'kèm lập luận thì cũng không đáng tin hơn một câu trả lời có.')
    r.h3('6.6.1. Tiêu chí kiểm tra')
    r.p('Một hệ thống chỉ được gọi là dùng học tăng cường khi có đủ tám thành phần. Nhóm rà toàn bộ mã '
        'nguồn của backend, ứng dụng di động, website và trang quản trị theo đúng danh sách này.')
    r.table(
        'Tám thành phần bắt buộc của học tăng cường và kết quả rà soát mã nguồn JAPANO.',
        ['Thành phần', 'Có trong JAPANO?', 'Ghi chú'],
        [
            ['Không gian trạng thái (state) được định nghĩa tường minh', 'Không',
             'Có véc-tơ trạng thái 12 chiều trong mô hình chuỗi, nhưng nó là **biểu diễn đặc trưng**, '
             'không phải trạng thái của một quá trình quyết định.'],
            ['Không gian hành động (action)', 'Không',
             'Hệ gợi ý xuất ra một danh sách xếp hạng, không chọn hành động từ một tập rời rạc.'],
            ['Hàm phần thưởng (reward)', 'Không',
             'Từ khoá `reward` **có** xuất hiện trong mã nguồn, nhưng nó là **voucher thưởng** cho '
             'người đóng góp địa danh — một khái niệm nghiệp vụ, không phải tín hiệu học.'],
            ['Chính sách (policy)', 'Không', 'Không có đối tượng nào ánh xạ trạng thái sang phân phối '
             'hành động.'],
            ['Tối ưu chính sách hoặc hàm giá trị', 'Không',
             'Bộ xếp hạng được huấn luyện bằng mất mát logistic theo cặp trên nhãn quan sát được — đây '
             'là **học có giám sát**.'],
            ['Cơ chế khám phá (exploration)', 'Không đúng nghĩa',
             'Có một suất "khám phá" lấy mẫu theo mức độ thịnh hành. Đây là lấy mẫu ngẫu nhiên có trọng '
             'số, **không phải** ε-greedy hay lấy mẫu Thompson trong một bài toán bandit.'],
            ['Vòng lặp huấn luyện theo tập (episode)', 'Không', 'Không có khái niệm tập hay trạng thái '
             'kết thúc ở bất kỳ đâu.'],
            ['Checkpoint hoặc chỉ số tương ứng', 'Không', 'Không có tệp trọng số của chính sách nào.'],
        ],
        widths=[Cm(4.6), Cm(2.6), Cm(8.3)], font=10,
        note='Rà bằng tìm kiếm toàn bộ mã nguồn với các từ khoá `reinforcement`, `q-learning`, '
             '`policy_gradient`, `reward`, `epsilon-greedy`, `bandit`, `actor-critic`, `PPO`, `DQN` '
             'trên `backend/`, `mobile/`, `web/`, `admin/` và `scripts/`, ngày 31/08/2026.')
    r.h3('6.6.2. Bốn thứ trông giống học tăng cường nhưng không phải')
    r.bullets([
        '**Học từ phản hồi âm.** Bỏ giỏ hàng và bỏ yêu thích được lưu thành tín hiệu âm và trừ điểm '
        'trong công thức xếp hạng. Đây là một đặc trưng bổ sung, không phải phần thưởng: nó không dẫn '
        'tới việc cập nhật một chính sách nào.',
        '**Đổi trọng số trực tuyến.** Trọng số của bộ trộn thay đổi theo độ dài lịch sử người dùng. '
        'Nhưng chúng thay đổi theo một **bảng tra cố định**, không phải học được từ tương tác.',
        '**Bộ xếp hạng theo cặp.** Nó thật sự học và thật sự cập nhật trọng số. Nhưng nhãn đến từ hành '
        'vi đã quan sát được, mục tiêu là mất mát logistic, và không có khái niệm phần thưởng trễ hay '
        'chuỗi hành động. Đây là học có giám sát.',
        '**Bộ nhớ mẫu của kiểm duyệt.** Nội dung bị từ chối được lưu thành cụm khoá cho các lần lọc '
        'sau. Đây là **cập nhật một danh sách**, không phải huấn luyện mô hình, và càng không phải học '
        'tăng cường.',
    ])
    r.p('Nhóm cho rằng việc đổi tên bốn cơ chế trên thành "học tăng cường" sẽ làm báo cáo nghe mạnh hơn '
        'và đúng ít hơn, nên không làm.')
    r.h3('6.6.3. Đề xuất cho tương lai')
    r.p('Bài toán xếp hạng gợi ý **là** một bài toán tự nhiên cho contextual bandit: mỗi lần hiển thị '
        'là một cơ hội thăm dò, mỗi lần nhấp hoặc mua là một tín hiệu phản hồi rõ ràng, và bài toán '
        'đánh đổi giữa khai thác và thăm dò là có thật. Một hướng khả thi là thay suất khám phá hiện '
        'tại bằng lấy mẫu Thompson trên các nguồn gợi ý. Đây là **đề xuất cho hướng phát triển**, và nó '
        'chỉ nên được triển khai sau khi đã có hệ thống đánh giá ngoại tuyến ở mục 6.8.5 — nếu không '
        'thì sẽ không có cách nào biết được nó tốt lên hay xấu đi.')

    # ==================================================== 6.7 MOTION
    r.h2('6.7. Video chuyển động')
    r.h3('6.7.1. Vấn đề và cách tiếp cận')
    r.p('Một bức ảnh tĩnh trả lời được câu hỏi "bộ đồ trông thế nào" nhưng không trả lời được "nó rơi '
        'thế nào khi tôi bước đi". Với trang phục Nhật Bản, nơi độ rủ của tay áo và thân áo là một '
        'phần của thiết kế, khác biệt đó không nhỏ.')
    r.p('Điểm mấu chốt về mặt kiến trúc: đầu vào của bước tạo video là **ảnh kết quả thử đồ**, không '
        'phải ảnh gốc của khách. Nghĩa là video kế thừa toàn bộ công sức của đường ống trước đó — đúng '
        'trang phục, đúng cơ thể, đã qua cổng chất lượng — thay vì phải làm lại từ đầu.')
    r.figure(DIAG / 'D13-seq-motion.png',
             'Trình tự tạo video chuyển động và cách bộ điều phối GPU nhường tài nguyên.',
             source='Nhóm tự vẽ từ `backend/motion_service.py` và `backend/one_to_all_runner.py`; tệp '
                    'nguồn `docs/report/diagrams/D13-seq-motion.drawio`.',
             width_cm=15.0)

    r.h3('6.7.2. Tối ưu suy luận, không phải fine-tune')
    r.p('Đây là chỗ mà kỷ luật thuật ngữ ở mục 6.5 được áp dụng nghiêm ngặt nhất. Nhóm đã làm cho bước '
        'tạo video nhanh hơn **khoảng 5,1 lần** — từ 295,4 giây xuống 57,8 giây cho kiểu "đi tự nhiên" '
        '— mà vẫn giữ nguyên số khung hình, độ phân giải, codec và cổng chất lượng. Tuy nhiên **không '
        'một trọng số nào được cập nhật**, không có checkpoint mới nào được sinh ra. Đây là tối ưu suy '
        'luận, và gọi nó là fine-tune sẽ là sai.')
    r.table(
        'Ba hồ sơ chuyển động đã được chấp nhận, đo trên RTX 5060 Ti 16 GB.',
        ['Kiểu chuyển động', 'Hồ sơ đã chọn', 'Đầu-cuối', 'Riêng bước khử nhiễu', 'Cổng chất lượng'],
        [
            ['`walk_natural`', 'turbo, 12 bước, guidance 1,0/1,0',
             '57,834 s trực tiếp; 64,925 s qua backend', '40,569 s', 'ĐẠT'],
            ['`turn_show`', 'turn_fast, 33 khung, 12 bước, guidance 1,5/1,0', '71,144 s', '49,579 s',
             'ĐẠT, đã đối chứng bằng mắt'],
            ['`pose_sway`', 'turbo, tư thế thủ tục phiên bản 2', '65,527 s', '40,768 s',
             'ĐẠT, đã đối chứng bằng mắt'],
        ],
        widths=[Cm(2.8), Cm(4.4), Cm(3.4), Cm(2.5), Cm(2.4)], font=10,
        note='`docs/project_evidence/ai_benchmarks/MOTION_INFERENCE_2026-08-29.md`. Cùng một ảnh thử '
             'đồ đã được chấp nhận, seed 42, đầu ra 384×640, H.264 yuv420p, 49 khung, 12 hình/giây.')
    r.p('Điều đáng nói hơn là **danh sách các phương án bị loại**, vì nó chứng minh không có ngưỡng nào '
        'bị hạ xuống để đạt tốc độ:')
    r.table(
        'Các phương án tăng tốc đã bị loại và lý do loại.',
        ['Phương án', 'Thời gian', 'Lý do bị loại'],
        [
            ['25 khung, 12 bước', '71,81 s', 'Điểm chuyển động 1,1548 — gần như đứng yên.'],
            ['25 khung, 16 bước', '93,18 s', 'Điểm chuyển động 1,1590 — gần như đứng yên.'],
            ['`turn_show` chạy hồ sơ turbo', '59,683 s', 'Qua cổng tự động nhưng chất lượng trang phục '
             'ở góc nghiêng và mặt sau bị loại khi xem bằng mắt.'],
            ['`pose_sway` dùng video dẫn động gốc', '65,284 s', 'Qua cổng tự động nhưng động tác trông '
             'như đang nhảy và trang phục bị nhoè.'],
            ['Tư thế thủ tục phiên bản 1', '60,398 s', 'Điểm chuyển động 1,0581 — gần như đứng yên.'],
        ],
        widths=[Cm(4.6), Cm(2.2), Cm(8.7)], font=10)
    r.p('Nguồn tăng tốc chính đến từ đâu cũng đã được đo: thay ba lượt chạy mô hình trên mỗi bước khử '
        'nhiễu bằng một lượt có điều kiện trực tiếp, cộng với giảm số bước. **Không phải** từ việc giảm '
        'độ phân giải — độ phân giải giữ nguyên 384×640. Phân tách thời gian của lượt chạy được chấp '
        'nhận: tư thế 2,109 giây, nạp mô hình 8,304 giây, khử nhiễu 40,569 giây, chuyển dữ liệu từ GPU '
        'về CPU 1,227 giây, mã hoá H.264 0,236 giây, cổng chất lượng ngữ nghĩa 3,604 giây. Mã hoá video '
        '**không** phải nút thắt, dù đó là giả thuyết đầu tiên của nhóm.')
    r.note('Tính năng tạo video **chỉ chạy trên máy có CUDA** và không có đường lùi trên CPU. Đây là '
           'giới hạn có chủ đích: một đường lùi CPU cho tác vụ này sẽ mất hàng chục phút, tức là vô '
           'dụng trong thực tế, và sự tồn tại của nó chỉ khiến người dùng chờ đợi vô ích.',
           label='Giới hạn của tính năng này')

    # ==================================================== 6.8 RECOMMENDATION
    r.h2('6.8. Hệ gợi ý sản phẩm')
    r.p('Toàn bộ hệ gợi ý chạy **thuần Node trên CPU**, không cần GPU và không gọi dịch vụ ngoài. Đây '
        'là lựa chọn có chủ đích: gợi ý phải hoạt động ngay cả khi cụm AI tắt, vì nó nằm trên đường đi '
        'chính của việc mua hàng.')
    r.figure(DIAG / 'D18-pipeline-goi-y-moe.png',
             'Đường ống gợi ý: chín nguồn ứng viên, cổng trộn thích ứng, và bước xếp hạng chồng.',
             source='Nhóm tự vẽ từ `backend/lib/recommend.js` và `backend/lib/advancedRecommend.js`; '
                    'tệp nguồn `docs/report/diagrams/D18-pipeline-goi-y-moe.drawio`.',
             width_cm=15.5)

    r.h3('6.8.1. Từ hành vi thô tới tín hiệu có trọng số')
    r.p('Mọi thứ bắt đầu từ bảng `interactions`. Mỗi loại hành vi được gán một trọng số phản ánh **mức '
        'độ chủ ý** của nó, và mọi tín hiệu đều suy giảm theo thời gian.')
    r.formula([
        'w(view) = 1     w(search) = 2      w(chat) = 2,5     w(goal) = 2,5',
        'w(wishlist) = 3   w(tryon) = 3,5    w(cart) = 4       w(purchase) = 6',
        '',
        'weight(t) = w(type) · 2 ^ ( − age_days / 14 )',
    ], note='Nửa đời 14 ngày: một hành vi cách đây hai tuần chỉ còn nửa trọng số so với hành vi hôm nay.')
    r.p('Thứ tự trọng số này không tuỳ tiện. Lượt thử đồ (3,5) được đặt cao hơn lượt yêu thích (3) '
        'nhưng thấp hơn lượt thêm vào giỏ (4), vì một người bỏ công tải ảnh của mình lên để thử một '
        'chiếc áo thể hiện ý định mua mạnh hơn một cú nhấn vào trái tim, nhưng chưa mạnh bằng việc đưa '
        'món đó vào giỏ.')

    r.h3('6.8.2. Chín nguồn ứng viên')
    r.h4('a. Phân rã ma trận bằng hạ gradient ngẫu nhiên')
    r.p('Mỗi người dùng và mỗi sản phẩm được gán một véc-tơ ẩn 8 chiều; điểm dự đoán là tích vô hướng '
        'của hai véc-tơ. Các véc-tơ học từ những cặp đã quan sát được, có số hạng phạt để tránh học '
        'thuộc. Nguồn này mạnh khi có nhiều dữ liệu và im lặng khi gặp người dùng mới.')
    r.h4('b. Lọc cộng tác theo sản phẩm')
    r.p('Tính độ tương tự cosine giữa các sản phẩm dựa trên tập người dùng đã tương tác, giữ lại 12 '
        'sản phẩm gần nhất cho mỗi sản phẩm. Điểm của một ứng viên là mức tương tự cao nhất với những '
        'sản phẩm mà người dùng vừa xem gần đây.')
    r.h4('c. Hồ sơ nội dung')
    r.p('Sản phẩm được biểu diễn bằng một túi từ khoá gồm danh mục, nhãn phong cách, nhãn thị giác và '
        'một nhãn khoảng giá. Hồ sơ người dùng là tổng có trọng số của các sản phẩm họ đã tương tác, '
        'cộng thêm sở thích họ tự khai. Điểm là cosine giữa hai túi từ khoá. Nguồn này là thứ duy nhất '
        'hoạt động được cho một sản phẩm hoàn toàn mới.')
    r.h4('d. Luật mua kèm')
    r.p('Từ các đơn hàng hợp lệ, hệ thống rút các luật kết hợp kiểu Apriori giữa từng cặp sản phẩm với '
        'support, confidence và lift. Điểm của ứng viên được chuẩn hoá lại từ confidence và lift, có '
        'chặn trên để một luật cực đoan trên vài đơn hàng không lấn át tất cả.')
    r.h4('e. Điểm thịnh hành')
    r.p('Điểm nhu cầu của từng sản phẩm, cùng nguồn với chỉ số hiển thị cho quản trị viên ở mục 6.11. '
        'Đây là nguồn chủ lực cho người dùng hoàn toàn mới.')
    r.h4('f. Mô hình không gian trạng thái chọn lọc')
    r.p('Đây là nguồn khai thác **thứ tự** của hành vi. Trạng thái là một véc-tơ 12 chiều, cập nhật '
        'tuần tự qua tối đa 64 sự kiện gần nhất của người dùng. Điểm khác biệt so với một trung bình '
        'trượt thông thường là cả cổng vào lẫn hệ số giữ đều **thay đổi theo từng sự kiện**:')
    r.formula([
        'select   = σ( −0,35  +  ln(1 + weight)  −  min(3;  age_days / 14) )',
        'retention = 0,72  +  0,22 · (1 − select)',
        'state[d] = retention · state[d]  +  select · item[d] · ln(1 + weight)',
    ], note='σ là hàm sigmoid. Một sự kiện mạnh và mới có `select` lớn, ghi đè nhiều hơn lên trạng thái; '
            'một sự kiện yếu và cũ gần như chỉ làm trạng thái tự suy giảm.')
    r.p('Cách thiết kế này lấy ý tưởng từ họ mô hình Mamba, nhưng cần nói rõ: **đây là một cài đặt nhỏ '
        'viết bằng JavaScript chạy trực tuyến, không phải một checkpoint Mamba chính thức.** Tên gọi '
        'trong API của hệ thống cũng phản ánh đúng điều đó bằng hậu tố mô tả kiến trúc.')
    r.h4('g. Lan truyền trên đồ thị người dùng – sản phẩm')
    r.p('Xây đồ thị hai phía từ các tương tác, rồi lan truyền hai lớp với chuẩn hoá theo bậc:')
    r.formula([
        'degreeScale(u, i) = ln(1 + w(u,i))  /  sqrt( |N(u)| · |N(i)| )',
        'e_u^(l+1) = Σ_{i ∈ N(u)}  degreeScale(u, i) · e_i^(l)',
        'e_i^(l+1) = Σ_{u ∈ N(i)}  degreeScale(u, i) · e_u^(l)',
        'e_final   = ( e^(0) + e^(1) + e^(2) ) / 3',
    ], note='Không có biến đổi phi tuyến nào giữa các lớp — đây chính là điểm mấu chốt của kiến trúc '
            'kiểu LightGCN. Cũng như trên, đây là cài đặt lấy ý tưởng chứ không phải checkpoint chính thức.')
    r.h4('h. Phân phối món tiếp theo')
    r.p('Một phân phối Markov bậc một trên các bước chuyển trong cùng phiên. Hai điều kiện lọc quan '
        'trọng: khoảng cách giữa hai sự kiện không quá 72 giờ (nếu không thì đó là hai phiên khác nhau, '
        'không phải một bước chuyển), và hai sự kiện phải khác sản phẩm. Mỗi bước chuyển được đánh '
        'trọng số theo `exp(−gap_hours / 24) · ln(1 + weight)`, nghĩa là hai sản phẩm được xem cách '
        'nhau vài phút liên kết chặt hơn hai sản phẩm cách nhau một ngày.')
    r.h4('i. Bộ xếp hạng logistic theo cặp')
    r.p('Nguồn cuối cùng không tạo ứng viên mà học cách kết hợp bốn đặc trưng: điểm chuỗi, điểm đồ thị, '
        'xác suất chuyển tiếp, và điểm thịnh hành. Với mỗi mẫu dương, hệ thống lấy một mẫu âm mà người '
        'dùng chưa từng tương tác, rồi cập nhật trọng số theo hướng làm điểm mẫu dương cao hơn:')
    r.formula([
        'Δ  = features(dương)  −  features(âm)',
        'g  = 1  −  σ( w · Δ )',
        'w[i] ← w[i]  +  0,035 · ( g · Δ[i]  −  0,002 · w[i] )',
    ], note='Tốc độ học 0,035; hệ số phạt 0,002; chạy 12 vòng trên tối đa 500 mẫu dương gần nhất.')

    r.h3('6.8.3. Đánh giá đúng cách: tách theo thời gian')
    r.p('Chi tiết dễ làm sai nhất trong toàn bộ mục này nằm ở đây, và nhóm muốn nêu nó ra vì nó là ranh '
        'giới giữa một con số có nghĩa và một con số vô nghĩa. Nếu bộ xếp hạng được huấn luyện trên '
        'chính những sự kiện đã dùng để dựng trạng thái chuỗi, đồ thị và bảng chuyển tiếp, thì các đặc '
        'trưng của mẫu dương đã "biết trước" đáp án, và trọng số học được sẽ vô nghĩa.')
    r.p('Cách xử lý là **tách theo thứ tự thời gian, giữ lại tương tác tích cực cuối cùng**: với mỗi '
        'người dùng, sự kiện tích cực cuối cùng được rút ra làm mục tiêu huấn luyện, và toàn bộ mô hình '
        'sinh đặc trưng được dựng lại **không có** sự kiện đó. Sau khi trọng số đã học xong, mô hình '
        'suy luận thì dùng lại toàn bộ lịch sử đã quan sát được — chỉ riêng trọng số của bộ xếp hạng là '
        'học trên tập nhân quả.')

    r.h3('6.8.4. Cổng trộn thích ứng')
    r.p('Chín nguồn không thể có trọng số cố định, vì một người mới và một người có ba trăm lượt tương '
        'tác cần hai cách xử lý khác nhau. Trọng số được tra theo số sản phẩm mà người dùng đã tương '
        'tác riêng biệt:')
    r.table(
        'Trọng số của từng nguồn theo độ dài lịch sử người dùng.',
        ['Nguồn', '≥ 3 sản phẩm', '1–2 sản phẩm', '0, có tín hiệu nội dung', '0, không có gì'],
        [
            ['Phân rã ma trận', '0,09', '0,04', '0', '0'],
            ['Lọc cộng tác theo sản phẩm', '0,07', '0,08', '0', '0'],
            ['Luật mua kèm', '0,07', '0,08', '0', '0'],
            ['Hồ sơ nội dung', '0,07', '0,09', '**0,30**', '0'],
            ['Điểm thịnh hành', '0,06', '0,11', '0,45', '**0,70**'],
            ['Không gian trạng thái chọn lọc', '**0,15**', '**0,15**', '0', '0'],
            ['Đồ thị người dùng – sản phẩm', '0,12', '0,10', '0', '0'],
            ['Phân phối món tiếp theo', '0,14', '0,12', '0', '0'],
            ['Bộ xếp hạng theo cặp', '**0,23**', '**0,23**', '0,25', '0,30'],
        ],
        widths=[Cm(4.6), Cm(2.6), Cm(2.6), Cm(3.1), Cm(2.6)], font=10,
        align_right=(1, 2, 3, 4))
    r.p('Bảng này đọc được như một câu chuyện về bài toán khởi động nguội. Với người chưa có tương tác '
        'nào và cũng chưa khai sở thích, hệ thống thừa nhận là nó không biết gì và dựa 70% vào mức độ '
        'thịnh hành. Khi có một chút tín hiệu nội dung, trọng số chuyển 30% sang hồ sơ nội dung. Chỉ '
        'khi có từ ba sản phẩm trở lên thì các nguồn dựa trên hành vi mới thật sự chiếm ưu thế.')
    r.p('Điểm cuối cùng được tính bằng một bước xếp hạng chồng, kết hợp điểm truy hồi đã chuẩn hoá với '
        'logit của bộ xếp hạng:')
    r.formula([
        'retrieval  = ( Σ đóng góp của các nguồn trừ rank và negative ) / max(0,0001;  1 − w_rank)',
        'logit      = 0,7 · logit(p_rank)  +  2,2 · (retrieval − 0,5)  −  5 · negative',
        'score      = σ( clamp(logit, −20, 20) )',
    ], note='`negative` bằng 0,45 nếu người dùng từng bỏ sản phẩm đó khỏi giỏ hoặc khỏi danh sách yêu '
            'thích. Hệ số 5 khiến một tín hiệu âm gần như loại hẳn sản phẩm khỏi danh sách.')

    r.h3('6.8.5. Đa dạng hoá, khám phá và giải thích')
    r.p('Điểm số cao nhất không phải lúc nào cũng là danh sách tốt nhất. Nếu chỉ lấy tám sản phẩm điểm '
        'cao nhất, kết quả rất dễ là tám chiếc kimono gần giống nhau. Vì vậy có thêm hai bước:')
    r.bullets([
        '**Đa dạng hoá:** tối đa **2 sản phẩm mỗi danh mục** trong danh sách chính. Nếu chưa đủ số '
        'lượng thì mới lấy thêm theo điểm.',
        '**Một suất khám phá:** khi danh sách từ bốn mục trở lên, mục cuối cùng được lấy mẫu ngẫu nhiên '
        'có trọng số theo mức độ thịnh hành, trong số các sản phẩm chưa được chọn. Ô này được gắn nhãn '
        'trung thực là gợi ý khám phá.',
    ])
    r.p('Mỗi sản phẩm được trả về kèm một câu giải thích sinh từ **nguồn đóng góp nhiều điểm nhất** cho '
        'chính nó — "Vì bạn đã quan tâm các mẫu áo khoác", "Thường được mua cùng món bạn đã quan tâm", '
        '"Được cộng đồng có sở thích tương tự quan tâm". Đây không phải một câu quảng cáo chung chung '
        'mà là kết quả tra ngược trong bảng đóng góp điểm, nên nó nói đúng lý do thật.')
    r.note('Ba nguyên tắc bảo vệ dữ liệu trong hệ gợi ý. Thứ nhất, **ảnh cơ thể và kết quả thử đồ không '
           'bao giờ được đưa vào bộ gợi ý** — chỉ tín hiệu hành vi thương mại mới vào mô hình. Thứ hai, '
           'các lượt hiển thị do chính hệ thống tạo ra **không** được tính là sở thích dương, để tránh '
           'vòng lặp tự khen: hệ thống gợi ý một món, người dùng nhìn thấy nó, rồi hệ thống coi đó là '
           'bằng chứng người dùng thích nó. Thứ ba, toàn bộ mô hình được dựng lại và giữ trong bộ nhớ '
           'đệm 60 giây, và bị vô hiệu hoá ngay khi có dữ liệu mới, nên nó không bao giờ trả kết quả '
           'quá cũ.', label='Ba ranh giới của hệ gợi ý')

    r.h3('6.8.6. Điều chưa đo được')
    r.p('Hệ thống chẩn đoán của chính JAPANO trả về `evaluation: {status: "not-measured", ndcgAt10: '
        'null, recallAt10: null, sampleSize: 0}`. Nghĩa là: **chất lượng xếp hạng của hệ gợi ý chưa '
        'được đo bằng bất kỳ chỉ số chuẩn nào.** Hạ tầng cần thiết đã có sẵn phần khó nhất — cách tách '
        'dữ liệu theo thời gian ở mục 6.8.3 chính là nền của một khung đánh giá ngoại tuyến — nhưng '
        'phần tính chỉ số và báo cáo thì chưa được viết. Báo cáo ghi nguyên trạng thái này thay vì đưa '
        'ra một con số không có nguồn.')

    # ==================================================== 6.9 CHATBOT
    r.h2('6.9. Trợ lý hội thoại Ori')
    r.h3('6.9.1. Nguyên tắc: bám dữ liệu trước, viết lại sau')
    r.p('Rủi ro lớn nhất của một trợ lý hội thoại trong thương mại điện tử không phải là nói năng vụng '
        'về mà là **nói sai một cách trôi chảy**: bịa ra một sản phẩm không có, một mức giá không đúng, '
        'hoặc khẳng định còn hàng khi đã hết. Kiến trúc của Ori được thiết kế để điều đó không thể xảy '
        'ra, bằng một quy tắc cứng: **mô hình ngôn ngữ chỉ được phép viết lại một bản nháp đã bám dữ '
        'liệu; nó không bao giờ là nguồn của sự thật.**')
    r.p('Trình tự xử lý một câu hỏi:')
    r.numbers([
        'Định tuyến ý định bằng hai tầng: một tập biểu thức quy tắc cho chín ý định thương mại phổ '
        'biến, và một bộ định tuyến ngữ nghĩa cho phần còn lại.',
        'Truy hồi sản phẩm thật từ catalog theo **từ trọn vẹn**, không phải khớp chuỗi con — đây là lý '
        'do "kim" không khớp nhầm vào "kimono".',
        'Dựng bản nháp trả lời chỉ từ dữ liệu vừa truy hồi được: tên, giá, size, tồn kho thật.',
        'Nếu có mô hình ngôn ngữ, gửi bản nháp cho nó viết lại cho tự nhiên hơn.',
        'Nếu bản viết lại không dùng được, **quay về bản nháp** — vẫn đúng, chỉ kém trau chuốt.',
    ])

    r.h3('6.9.2. Bộ nhớ nhiều lượt kiểu ma trận')
    r.p('Để nhớ ngữ cảnh qua nhiều lượt hội thoại, hệ thống dùng một bộ nhớ dạng ma trận xây từ tích '
        'ngoài của các cặp khoá – giá trị, với cổng luỹ thừa, giữ tối đa 12 lượt. Văn bản được nhúng '
        'bằng phép băm đặc trưng 48 chiều tính cục bộ, không gọi dịch vụ ngoài. Cũng như ở mục 6.8, '
        'đây là một cài đặt nhỏ lấy ý tưởng từ họ mô hình mLSTM, **không phải** một checkpoint xLSTM '
        'chính thức, và tên gọi trong API phản ánh đúng điều đó.')

    r.h3('6.9.3. Ranh giới an toàn')
    r.bullets([
        '**Không có checkpoint nào cho trợ lý.** Không có mô hình ngôn ngữ nào được huấn luyện lại '
        'trong dự án này. Các quyết định về nguồn gốc và giấy phép dữ liệu hội thoại được ghi lại '
        'trong thư mục xuất xứ của tập dữ liệu, và **không có dữ liệu hội thoại bên ngoài nào được sao '
        'chép vào sản phẩm**.',
        '**Tư vấn sức khoẻ tách khỏi tư vấn mua sắm.** Hệ thống không đưa lời khuyên y tế, và một mục '
        'tiêu về sức khoẻ không còn bị lưu như một quỹ mua hàng.',
        '**Mô hình ngôn ngữ không được bịa sự thật về cơ thể.** Số đo trong câu trả lời phải đến từ '
        'đường ống ở mục 6.2 hoặc từ dữ liệu người dùng tự nhập.',
        '**Chạy được khi không có mô hình ngôn ngữ.** Khi dịch vụ tắt hoặc GPU bận, toàn bộ tính năng '
        'vẫn hoạt động bằng đường lùi cục bộ.',
    ])

    # ==================================================== 6.10 TRAVEL
    r.h2('6.10. Gợi ý trang phục theo địa điểm và ghép ảnh cảnh Nhật Bản')
    r.h3('6.10.1. Chấm điểm bằng quy tắc, không gọi mô hình ngôn ngữ')
    r.p('Việc gợi ý "mặc gì khi tới Fushimi Inari" nghe như một bài toán dành cho mô hình ngôn ngữ. '
        'Nhóm chọn cách khác: một hàm chấm điểm trên **metadata thật của catalog**, với sáu tiêu chí có '
        'trọng số cố định, tổng 100 điểm.')
    r.table(
        'Sáu tiêu chí chấm điểm gợi ý trang phục theo địa điểm.',
        ['Tiêu chí', 'Điểm tối đa', 'Cách tính'],
        [
            ['Phong cách và văn hoá', '25', 'Số nhãn phong cách của địa điểm khớp với nhãn, tên hoặc '
             'loại trang phục của sản phẩm; chuẩn hoá theo tối đa hai nhãn khớp.'],
            ['Mùa và thời tiết', '20', 'Mùa hiện tại thuộc danh sách mùa của địa điểm cho 60% điểm; '
             'trang phục có nhãn ấm vào thu đông hoặc nhãn mát vào xuân hè cho trọn điểm.'],
            ['Màu so với tông cảnh', '20', 'Ưu tiên **tương phản vừa phải**: khoảng cách màu 0,45–0,75 '
             'cho ảnh dễ nhìn nhất. Cùng tông với nền thì chìm, chọi hẳn thì gắt.'],
            ['Loại đồ hợp hoạt động', '15', 'Đối chiếu loại trang phục với hoạt động chính ở địa điểm.'],
            ['Có size vừa người dùng', '15', 'Suy size từ chiều cao và cân nặng, rồi kiểm tra size đó '
             'còn hàng hay không.'],
            ['Chất lượng dữ liệu sản phẩm', '5', 'Còn hàng 2 điểm, có ảnh 2 điểm, có nhãn 1 điểm.'],
        ],
        widths=[Cm(3.6), Cm(1.8), Cm(10.1)], font=10)
    r.p('Cách làm này có ba ưu điểm mà một lời gọi mô hình ngôn ngữ không có: nó **đo được** (8 mili '
        'giây khi tính mới, 25 mili giây khi trúng bộ nhớ đệm), nó **giải thích được** (mỗi gợi ý kèm '
        'tối đa ba lý do sinh từ chính tiêu chí đã ghi điểm), và nó **không bịa sản phẩm** — hàm này '
        'chỉ chấm điểm những gì thật sự có trong catalog.')
    r.p('Quy tắc lọc trước khi chấm điểm quan trọng không kém quy tắc chấm điểm:')
    r.bullets([
        'Sản phẩm phải ở trạng thái công bố. Một chi tiết nhỏ nhưng từng gây hậu quả lớn: catalog thật '
        'dùng giá trị `published`, không phải `active`; đoán nhầm giá trị này đã lọc sạch 54 trên 54 '
        'sản phẩm và trả về danh sách rỗng.',
        'Sản phẩm hết hàng bị loại. Để khách bấm "Thử ngay" rồi mới báo hết hàng là trải nghiệm tệ và '
        'làm mất niềm tin vào cả danh sách.',
        'Đồ bơi **không bao giờ** xuất hiện ở địa điểm trang nghiêm — đền, chùa, nơi tưởng niệm — và ở '
        'địa điểm biển thì chỉ xuất hiện khi lượt đó đã qua cổng độ tuổi.',
    ])
    r.note('Ngưỡng suy size từ chiều cao và cân nặng ở phía máy chủ phải **giống hệt** ngưỡng ở màn '
           'hình thử đồ của ứng dụng, bao gồm cả các bậc 4XL và 5XL. Hai bên đã từng lệch nhau một lần, '
           'và hậu quả là hai màn hình báo hai size khác nhau cho cùng một người.',
           label='Một điểm đồng bộ bắt buộc')

    r.h3('6.10.2. Ghép ảnh: phân đoạn chứ không sinh lại')
    r.p('Sau khi thử đồ, kết quả được ghép vào ảnh thật của địa danh. Quyết định kỹ thuật quan trọng '
        'nhất ở đây là **không dùng mô hình sinh ảnh cho bước này**. Bước ghép dùng phân đoạn để tách '
        'người khỏi nền rồi đặt lên ảnh cảnh. Lý do: nếu sinh lại toàn bộ ảnh, khuôn mặt và cơ thể của '
        'khách sẽ bị mô hình vẽ lại — và ở bước này thì mọi thay đổi trên cơ thể đều là mất mát, vì '
        'phần thử đồ đã hoàn thành xong ở bước trước. Với phân đoạn, **khuôn mặt và cơ thể sống sót '
        'nguyên vẹn từng điểm ảnh**. Đo được: 912 mili giây cho ảnh dựng sẵn và 1 195 mili giây cho ảnh '
        'vừa thử đồ xong.')

    r.h3('6.10.3. Metadata phối cảnh: vì sao một ảnh đẹp vẫn có thể bị loại')
    r.p('Đây là phần mà nhóm phải học lại từ đầu sau một lỗi rất dễ nhìn thấy. Ban đầu, mọi ảnh nền '
        'dùng chung một quy ước "đặt người ở giữa, sát đáy khung hình". Quy ước đó sai với gần như mọi '
        'bức ảnh phong cảnh thật. Ảnh Naoshima cũ được chụp **từ ngoài biển**, nên đáy khung hình là '
        'mặt nước — và mô hình đứng ngập tới thắt lưng giữa biển.')
    r.p('Cách sửa là gắn cho **từng cảnh** một bộ metadata riêng: điểm đặt chân, đa giác vùng đứng '
        'được, tỉ lệ chiều cao người so với khung hình, vùng an toàn, các vùng không được che khuất '
        'công trình, hướng ánh sáng và thông số bóng đổ.')
    r.p('Một chi tiết tưởng nhỏ nhưng đã gây ra lỗi thứ hai: metadata được đo trên **ảnh gốc**, trong '
        'khi khung hình đầu ra là ảnh dọc còn ảnh phong cảnh thường là ảnh ngang. Vì vậy hàm cắt khung '
        'phải cắt **bám quanh điểm đặt chân** rồi ánh xạ điểm đó sang toạ độ khung mới. Cắt giữa trước '
        'như cách thông thường sẽ âm thầm dịch mặt đất ra khỏi dưới chân người — lỗi đó từng đặt một mô '
        'hình đứng trên một chiếc nón giao thông.')
    r.p('Hệ quả về quy trình: **giấy phép rõ ràng và độ phân giải cao không làm cho một ảnh trở nên '
        'dùng được.** Ba trong sáu ứng viên có giấy phép tốt và độ phân giải cao đã bị loại chỉ vì bố '
        'cục — không có chỗ nào một người có thể đứng. Mọi ảnh mới bắt buộc phải chạy qua bộ kiểm tra '
        'tính hợp lệ của cảnh trước khi được đưa vào.')
    for name, cap in (
        ('naoshima-BEFORE.jpg', 'Ảnh Naoshima trước khi có metadata phối cảnh: quy ước "giữa khung, sát '
                               'đáy" đặt người xuống giữa mặt nước.'),
        ('naoshima-miyanoura-after.jpg', 'Cùng địa danh sau khi thay ảnh nền và gắn metadata điểm đặt '
                                        'chân: người đứng đúng trên mặt đất.'),
        ('e2e-fushimi-happi.jpg', 'Kết quả ghép hoàn chỉnh tại Fushimi Inari: ảnh thử đồ được đặt vào '
                                 'cảnh thật, giữ nguyên khuôn mặt và cơ thể.'),
    ):
        path = SCENES / name
        if path.exists():
            r.figure(path, cap,
                     source=f'`test-results/japan-scenes/{name}`. Ảnh nền lấy từ Wikimedia Commons và '
                            'luôn hiển thị kèm phần ghi nguồn trong ứng dụng.',
                     width_cm=9.0, max_height_cm=9.5)

    r.h3('6.10.4. Một lỗ hổng đã được đóng từ khâu thiết kế')
    r.p('Điểm cuối ghép ảnh nhận **tên địa danh**, không nhận đường dẫn ảnh. Đây là một quyết định bảo '
        'mật chứ không phải một chi tiết giao diện. Nếu điểm cuối chấp nhận đường dẫn do client cung '
        'cấp, thì bất kỳ ai cũng có thể khiến máy chủ đi tải một tài nguyên bất kỳ mà họ chỉ định — '
        'kể cả các địa chỉ nội bộ trong hạ tầng. Đó chính là lỗ hổng SSRF. Cách phòng thủ gồm hai lớp: '
        'đường dẫn được tra trong một bảng ghi cứng trong mã nguồn, và việc tải chỉ được phép qua giao '
        'thức HTTPS tới đúng một tên miền đã định.')
    r.p('Ảnh cảnh còn được **tải sẵn về tài nguyên của ứng dụng** thay vì gọi tới nguồn mỗi lần. Hai lý '
        'do: nguồn ảnh chỉ phục vụ những chiều rộng thu nhỏ mà nó đã dựng sẵn (yêu cầu 1800 điểm ảnh '
        'trả về lỗi trong khi 1920 thì thành công), và việc giữ bản sao của mình nghĩa là bước ghép ảnh '
        'không phát sinh một yêu cầu ra ngoài nào. Phần ghi nguồn và giấy phép vẫn hiển thị đầy đủ.')

    # ==================================================== 6.11 ANALYTICS
    r.h2('6.11. Thuật toán phân tích cho trang quản trị')
    r.p('Mười lăm thuật toán trong mục này đều chạy trên dữ liệu thật của hệ thống và đều minh bạch — '
        'người đọc có thể kiểm tra tay từng công thức. Nhóm nhắc lại một lần nữa: đây là **thống kê và '
        'học máy cổ điển**, không phải "AI dashboard".')

    r.h3('6.11.1. Dự báo doanh thu bằng bộ ba mô hình')
    r.p('Bài toán: từ chuỗi doanh thu 12 tháng gần nhất, dự báo ba tháng tới kèm khoảng tin cậy. Ba mô '
        'hình chạy song song, mỗi mô hình mạnh ở một tình huống khác nhau.')
    r.h4('a. Hồi quy tuyến tính bình phương tối thiểu')
    r.formula([
        'slope     = Σ (i − ī)(y_i − ȳ)  /  Σ (i − ī)²',
        'intercept = ȳ  −  slope · ī',
        'R²        = 1  −  Σ (y_i − ŷ_i)²  /  Σ (y_i − ȳ)²',
    ], note='Độ phức tạp O(n). Ổn định, nhưng phản ứng chậm khi xu hướng đổi chiều.')
    r.h4('b. Làm mượt luỹ thừa kép của Holt')
    r.formula([
        'level_t = α · y_t  +  (1 − α) · ( level_{t−1} + trend_{t−1} )',
        'trend_t = β · ( level_t − level_{t−1} )  +  (1 − β) · trend_{t−1}',
        'dự báo(h) = max( 0;  level_T  +  h · trend_T )',
    ], note='α và β được chọn tự động bằng cách quét lưới {0,25; 0,45; 0,65; 0,80} × {0,10; 0,25; 0,45} '
            'và lấy cặp cho sai số một bước nhỏ nhất. Độ phức tạp O(12·n) — vẫn rẻ.')
    r.h4('c. Trung bình trượt có trọng số')
    r.formula([
        'dự báo = Σ_{k=1..w}  k · y_{T−w+k}   /   Σ_{k=1..w} k',
    ], note='Cửa sổ w từ 2 tới 4 tuỳ độ dài chuỗi. Trọng số tăng dần theo thời gian, nên tháng gần nhất '
            'nặng nhất.')
    r.h4('d. Trộn theo nghịch đảo sai số')
    r.p('Ba dự báo được trộn với trọng số tỉ lệ nghịch với sai số tuyệt đối trung bình của chính chúng '
        'trên dữ liệu quá khứ. Mô hình nào khớp lịch sử tốt hơn thì có tiếng nói lớn hơn — và điều này '
        'tự điều chỉnh mỗi lần tính lại, không cần ai chọn tay.')
    r.formula([
        'w_m  =  ( 1 / max(1;  MAE_m) )   /   Σ_j ( 1 / max(1;  MAE_j) )',
        'dự báo = Σ_m  w_m · dự báo_m',
        'spread = sqrt( Σ_m ( dự báo_m − dự báo )²  /  3 )',
        'khoảng ≈ [ dự báo − 1,28 · spread ,  dự báo + 1,28 · spread ]',
    ], note='Hệ số 1,28 tương ứng khoảng 80%. Khoảng này đo **mức độ bất đồng giữa ba mô hình**, không '
            'phải khoảng tin cậy thống kê đúng nghĩa — và giao diện nói rõ điều đó.')
    r.h4('Ví dụ tính tay')
    r.p('Giả sử chuỗi doanh thu 6 tháng (triệu đồng): 100, 120, 115, 140, 155, 170. Hồi quy tuyến tính '
        'cho slope ≈ 13,4 và dự báo tháng 7 ≈ 176,3. Holt với α = 0,65 và β = 0,25 bám xu hướng gần đây '
        'hơn, cho khoảng 184,1. Trung bình trượt có trọng số cửa sổ 3 cho (1·115 + 2·140 + 3·155)/6 = '
        '143,3 — thấp hơn hẳn vì nó không ngoại suy xu hướng. Nếu sai số quá khứ của ba mô hình lần lượt '
        'là 12, 9 và 15 thì trọng số xấp xỉ 0,30 / 0,40 / 0,24 sau khi chuẩn hoá, và dự báo trộn rơi vào '
        'khoảng 170. Độ phân tán lớn giữa ba mô hình khiến khoảng dự báo rộng ra — đúng như nó nên vậy '
        'khi ba cách nhìn không đồng thuận.')

    r.h3('6.11.2. Điểm nhu cầu và đà 30 ngày')
    r.p('Điểm nhu cầu là một tổ hợp tuyến tính tám thành phần đã chuẩn hoá, cho ra giá trị 0–100:')
    r.formula([
        'raw = 0,35 · (đã bán / max đã bán)      + 0,20 · (yêu thích / max yêu thích)',
        '    + 0,15 · (thêm giỏ / max thêm giỏ)  + 0,15 · (điểm đánh giá / 5)',
        '    + 0,07 · độ mới                     + 0,03 · min(1;  lượt tìm / 5)',
        '    + 0,03 · min(1;  lượt thử đồ / 3)   + 0,02 · (nhắc trong chat / max nhắc)',
        '',
        'độ mới = max( 0;  1 − min(tuổi_ngày;  90) / 90 )',
    ], note='Trọng số phản ánh mức độ chủ ý: doanh số thật nặng nhất, còn lượt nhắc trong hội thoại chỉ '
            'là tín hiệu bổ sung.')
    r.p('Đà 30 ngày và dự báo lượng bán được tính riêng, và chúng là thứ trực tiếp dẫn tới cảnh báo tồn kho:')
    r.formula([
        'momentum      = ( bán_30_ngày − bán_30_ngày_trước ) / bán_30_ngày_trước',
        'trendUnits    = max( 0;  bán_30  +  0,55 · (bán_30 − bán_30_trước) )',
        'forecast_30   = 0,65 · trendUnits  +  0,35 · baselineUnits',
        'daysToStockout = tồn_kho  /  ( forecast_30 / 30 )',
    ])
    r.table(
        'Bốn mức rủi ro tồn kho và hành động tương ứng.',
        ['Điều kiện', 'Mức rủi ro', 'Hành động gợi ý'],
        [['Tồn kho bằng 0', '**Hết hàng**', 'Nhập lại ngay hoặc ẩn sản phẩm để không mất niềm tin.'],
         ['Số ngày tới khi hết ≤ 14', '**Rủi ro cao**', 'Đặt hàng bổ sung trong tuần này.'],
         ['Số ngày tới khi hết ≤ 30', 'Cần theo dõi', 'Đưa vào danh sách kiểm tra hằng tuần.'],
         ['Còn lại', 'An toàn', 'Không cần hành động.']],
        widths=[Cm(4.6), Cm(3.2), Cm(7.7)], font=10.5)

    r.h3('6.11.3. Phân cụm khách hàng bằng K-Means')
    r.p('Mỗi khách hàng là một điểm ba chiều: tổng chi tiêu, số đơn, và số ngày kể từ lần mua gần nhất '
        '(chặn trên ở 365). Thuật toán lặp tối đa 30 vòng với k tối đa bằng 3.')
    r.p('Điều kiện bắt buộc — và cũng là chỗ dễ sai nhất — là **chuẩn hoá z-score trước khi phân cụm**. '
        'Nếu không, chiều chi tiêu tính bằng đồng (hàng triệu) sẽ nuốt hoàn toàn chiều số đơn (hàng đơn '
        'vị), và kết quả phân cụm thực chất chỉ là chia theo mức chi tiêu — một việc mà một phép sắp '
        'xếp đơn giản làm được, không cần K-Means.')
    r.formula([
        'z_j = ( x_j  −  μ_j )  /  σ_j        cho mỗi chiều j',
        'gán:  cluster(x) = argmin_c  || z(x)  −  centroid_c ||²',
        'cập nhật:  centroid_c  =  trung bình của các điểm thuộc cụm c',
    ], note='Ba cụm được đặt tên theo mức chi tiêu trung bình giảm dần: khách VIP / chi cao, khách '
            'thường xuyên, khách mới / ít mua.')
    r.p('Vì sao giới hạn k ở 3? Vì với quy mô dữ liệu hiện tại, nhiều cụm hơn sẽ cho ra những nhóm quá '
        'nhỏ để có ý nghĩa hành động, và một phân khúc mà người vận hành không soạn nổi một thông điệp '
        'riêng cho nó thì không phải một phân khúc hữu ích.')

    r.h3('6.11.4. RFM và điểm nguy cơ rời bỏ')
    r.formula([
        'recency   = min( 1;  số_ngày_chưa_mua  /  max(90;  recency lớn nhất) )',
        'frequency = số_đơn  /  số_đơn lớn nhất',
        'monetary  = tổng_chi_tiêu  /  tổng_chi_tiêu lớn nhất',
        '',
        'churn = 0,62 · recency  +  0,23 · (1 − frequency)  +  0,15 · (1 − monetary)',
    ], note='Nhân 100 và làm tròn để ra một giá trị 0–100. Trọng số 0,62 cho recency phản ánh quan sát '
            'thực tế: thời gian không quay lại là tín hiệu mạnh nhất.')
    r.table(
        'Ba mức nguy cơ rời bỏ và hành động chăm sóc tương ứng.',
        ['Điểm', 'Mức', 'Hành động'],
        [['≥ 70', 'Cao', 'Gửi ưu đãi quay lại hoặc gợi ý cá nhân hoá.'],
         ['45 – 69', 'Trung bình', 'Nhắc bộ sưu tập mới phù hợp gu.'],
         ['< 45', 'Thấp', 'Duy trì chăm sóc hiện tại.']],
        widths=[Cm(2.6), Cm(3.0), Cm(9.9)], font=10.5)
    r.note('Đây là một **heuristic minh bạch**, không phải một mô hình học máy dự đoán rời bỏ. Nó không '
           'được huấn luyện trên nhãn "khách đã thật sự rời bỏ" và không có bất kỳ đánh giá độ chính '
           'xác nào. Con số nó cho ra là **thứ tự ưu tiên chăm sóc**, không phải xác suất một khách sẽ '
           'rời bỏ. Gọi nó là "mô hình dự đoán churn" sẽ là nói quá.', label='Bản chất của chỉ số này')

    r.h3('6.11.5. Luật mua kèm')
    r.formula([
        'support(A, B)    = số đơn chứa cả A và B  /  tổng số đơn có từ 2 món',
        'confidence(A→B)  = số đơn chứa cả A và B  /  số đơn chứa A',
        'lift(A→B)        = confidence(A→B)  /  support(B)',
    ], note='Chỉ giữ luật xuất hiện ít nhất 2 lần, xếp hạng theo tích lift × confidence × support, lấy '
            'tối đa 30 luật. Độ phức tạp O(n · m²) với m là số món trung bình trong một đơn — chấp nhận '
            'được vì m nhỏ.')
    r.p('Ý nghĩa của lift đáng nói riêng vì nó hay bị hiểu nhầm. Lift bằng 1 nghĩa là hai sản phẩm độc '
        'lập; lớn hơn 1 nghĩa là mua A **làm tăng** khả năng mua B so với ngẫu nhiên. Một luật có '
        'confidence cao nhưng lift bằng 1 là vô giá trị: nó chỉ nói rằng B là sản phẩm bán chạy, chứ '
        'không nói gì về mối liên hệ với A.')

    r.h3('6.11.6. Các chỉ số quan sát mô hình và tổng hợp KPI')
    r.p('Trang quản trị còn hiển thị một nhóm chỉ số về chính hệ gợi ý: trạng thái hoạt động của từng '
        'nguồn, số cạnh trong đồ thị người dùng – sản phẩm, mật độ đồ thị, số người dùng có chuỗi hành '
        'vi, số bước chuyển đã ghi nhận, số cặp huấn luyện của bộ xếp hạng, và số mẫu giữ lại theo thứ '
        'tự thời gian. Nhóm chỉ số này tồn tại để trả lời một câu hỏi rất thực tế của người vận hành: '
        '"hệ gợi ý hôm nay có đủ dữ liệu để hoạt động không, hay nó đang chạy trong bóng tối?"')
    r.p('Đi kèm là hai bảng tổng hợp: doanh thu theo bốn mốc thời gian (ngày, tuần, tháng, năm) tính từ '
        'các đơn hợp lệ, và báo cáo từ khoá tìm kiếm — trong đó phần **từ khoá không ra kết quả** là có '
        'giá trị nhất, vì nó chỉ thẳng ra nhu cầu mà cửa hàng chưa đáp ứng được.')
    r.note('Ô đánh giá chất lượng xếp hạng trên bảng quan sát mô hình hiển thị đúng trạng thái '
           '`not-measured`. Trang quản trị **không** hiển thị một con số độ chính xác nào cho hệ gợi ý, '
           'vì hệ thống chưa đo được nó. Việc để trống một ô trên dashboard là lựa chọn khó chịu hơn '
           'nhưng trung thực hơn việc điền vào đó một con số không có nguồn.', label='Một ô cố ý để trống')

    # ==================================================== 6.12 MODERATION
    r.h2('6.12. Kiểm duyệt nội dung tiếng Việt')
    r.h3('6.12.1. Vì sao danh sách từ cấm không đủ')
    r.p('Tiếng Việt có quá nhiều cách viết cùng một từ tục: bỏ dấu, thay chữ bằng số, chèn khoảng '
        'trắng giữa các ký tự, viết tắt, lặp ký tự. Đặc biệt khó là **nói lái** — đảo thứ tự âm tiết để '
        'tạo ra một cụm tục trong khi mặt chữ trông hoàn toàn vô hại. Một danh sách từ cấm thô sẽ bỏ '
        'lọt gần hết, và nếu nới lỏng để bắt được nhiều hơn thì nó bắt đầu chặn oan những đánh giá hợp '
        'lệ.')

    r.h3('6.12.2. Chuẩn hoá văn bản: bước quan trọng hơn cả danh sách từ')
    r.p('Trước khi so khớp bất cứ thứ gì, văn bản đi qua bốn phép biến đổi:')
    r.numbers([
        '**Bỏ dấu.** Chuẩn hoá Unicode rồi loại các dấu thanh và dấu mũ; chữ "đ" quy về "d".',
        '**Gỡ leet.** Ánh xạ số và ký hiệu về chữ cái: 0→o, 1→i, 3→e, 4→a, 5→s, 7→t, @→a, $→s, !→i. '
        'Riêng chữ "j" được quy về "i", vì tiếng Việt không dùng "j" nên nó gần như luôn là cách né '
        'chữ khác ("djt" chính là "địt").',
        '**Dồn ký tự lặp.** Ba ký tự giống nhau trở lên rút về hai.',
        '**Chuẩn hoá khoảng trắng.** Loại mọi ký tự không phải chữ và số, dồn khoảng trắng.',
    ])
    r.p('Việc so khớp sau đó chạy trên **hai dạng**: dạng có khoảng trắng để bắt cụm đứng riêng, và '
        'dạng đã dồn hết khoảng trắng để bắt các trường hợp chèn ký tự phân cách.')

    r.h3('6.12.3. Năm nhóm luật và cách xử lý ngữ cảnh')
    r.table(
        'Năm nhóm luật kiểm duyệt cục bộ và mức nghiêm trọng.',
        ['Nhóm vi phạm', 'Mức nghiêm trọng', 'Ví dụ về loại nội dung'],
        [['Đe doạ', '0,99', 'Doạ hành hung, doạ tìm tới nơi ở, doạ phá cửa hàng.'],
         ['Phân biệt đối xử', '0,99', 'Phân biệt vùng miền, giới tính, khuyết tật, chủng tộc.'],
         ['Công kích cá nhân', '0,96', 'Xúc phạm trực tiếp người bán hoặc nhân viên.'],
         ['Tục tĩu', '0,95', 'Từ tục và các biến thể viết tắt của chúng.'],
         ['Hạ nhục', '0,92', 'Miệt thị, so sánh hạ thấp phẩm giá.']],
        widths=[Cm(4.0), Cm(3.0), Cm(8.5)], font=10.5)
    r.p('Ngoài năm nhóm trên còn ba cơ chế bổ sung. **Viết tắt hai ký tự** chỉ khớp khi đứng riêng như '
        'một từ, để không dính vào từ hợp lệ — nếu không, "vaccine" sẽ bị chặn vì chứa "cc". **Công '
        'kích có chủ đích** được phát hiện khi văn bản đồng thời chứa một từ chỉ mục tiêu (shop, nhân '
        'viên, mày) và một từ hạ nhục. **Bộ nhớ mẫu** lưu lại dạng đã chuẩn hoá của những nội dung bị '
        'người vận hành từ chối, tối đa 400 cụm gần nhất, để dùng cho các lần lọc sau.')
    r.p('Riêng nói lái được xử lý bằng ngữ cảnh, và cách xử lý này minh hoạ đúng triết lý của cả mục. '
        'Sau khi bỏ dấu, cả "ngủ đi" lẫn "đi ngủ" đều trùng với dạng chuẩn hoá của một cụm tục. Mặt chữ '
        '**không** phân biệt được hai trường hợp, nên hệ thống xét độ dài câu: câu từ ba từ trở xuống '
        'gần như chắc chắn là chửi và bị chấm 0,90; câu dài hơn có ngữ cảnh thì chỉ chấm 0,50 và '
        'chuyển sang chờ người duyệt — vì "đi ngủ đi con, muộn rồi" là một câu hoàn toàn bình thường.')

    r.h3('6.12.4. Hợp nhất quyết định')
    r.formula([
        'score = max( severity của mọi luật khớp )',
        '',
        'score ≥ 0,75          →  rejected',
        '0,40 ≤ score < 0,75   →  pending  (chuyển người duyệt)',
        'score < 0,40          →  approved',
    ])
    r.p('Nếu quyết định cục bộ **không** phải là từ chối và có mô hình ngôn ngữ, hệ thống chạy thêm một '
        'lượt kiểm duyệt ngữ nghĩa. Lời nhắc gửi cho mô hình nêu rõ cả hai chiều: phát hiện các cách '
        'lách luật, **nhưng không được chặn phê bình sản phẩm hợp lệ** — giao chậm, vải xấu, không '
        'đúng mô tả, hay nghi ngờ bị lừa đều là những điều khách có quyền viết miễn là không hạ nhục cá '
        'nhân. Mô hình chỉ được phép quyết định từ chối khi độ tin cậy của nó đạt ít nhất 0,62.')
    r.figure(DIAG / 'D15-seq-kiem-duyet.png',
             'Trình tự kiểm duyệt một đánh giá, từ lúc khách gửi tới lúc người vận hành ghi đè quyết định.',
             source='Nhóm tự vẽ từ `backend/lib/reviewModeration.js`; tệp nguồn '
                    '`docs/report/diagrams/D15-seq-kiem-duyet.drawio`.',
             width_cm=15.0)

    r.h3('6.12.5. Chống chặn oan và giới hạn')
    r.bullets([
        '**Vùng xám dẫn tới chờ duyệt, không dẫn tới chặn.** Đây là lựa chọn có chủ đích: một đánh giá '
        'thật bị chặn oan gây thiệt hại lớn hơn một đánh giá xấu bị chậm vài giờ.',
        '**Người vận hành ghi đè được cả hai chiều.** Máy không có tiếng nói cuối cùng.',
        '**Chạy được khi không có mô hình ngôn ngữ.** Bộ luật cục bộ vẫn hoạt động đầy đủ; mô hình ngôn '
        'ngữ là lớp bổ sung, không phải lớp bắt buộc.',
        '**Tỉ lệ chặn nhầm và bỏ lọt chưa được đo trên một tập chuẩn.** Có kiểm thử cho các trường hợp '
        'lách luật cụ thể đã biết, nhưng chưa có tập đánh giá có nhãn đủ lớn để công bố hai con số này. '
        'Báo cáo ghi rõ điều đó.',
    ])
    r.note('Việc lưu cụm khoá từ những nội dung bị từ chối **không phải là fine-tune và cũng không phải '
           'học tăng cường**. Không có trọng số nào được cập nhật; đây đơn thuần là bổ sung phần tử vào '
           'một danh sách so khớp. Gọi nó bằng tên khác sẽ vi phạm chính nguyên tắc thuật ngữ mà đồ án '
           'đặt ra ở Chương 1.', label='Gọi đúng tên')
    r.p('Cuối cùng, một ranh giới an toàn cần nói rõ: các cổng kiểm tra dành cho ảnh người thật — cổng '
        'độ tuổi, cổng độ che phủ, cổng danh tính — **không được phép tháo bỏ** để lấy tốc độ hay để '
        'tăng tỉ lệ tạo ảnh thành công. Trong quá trình phát triển đã có lúc một cổng bị hỏng do lỗi kỹ '
        'thuật, và cách xử lý là sửa cho nó chạy đúng, chứ không phải bỏ nó đi.')

    # =========================================== 6.13 PRESENTATION-READY DETAIL
    r.h2('6.13. Bảng tổng hợp thuật toán, công thức và model dùng trong JAPANO')
    r.p('Mục này gom lại toàn bộ phần kỹ thuật theo cách có thể dùng trực tiếp khi thuyết trình. Mỗi '
        'dòng trả lời năm câu hỏi: **dùng gì, nhận đầu vào nào, tính như thế nào, trả kết quả gì, và '
        'trạng thái bằng chứng ra sao**. Cách trình bày này tránh việc gọi chung mọi thứ là AI: mô '
        'hình học sâu, mô hình học máy cổ điển, thuật toán thống kê và quy tắc nghiệp vụ được tách rõ.')
    r.table(
        'Bản đồ thuật toán và model theo chức năng của hệ thống.',
        ['Chức năng', 'Thuật toán / model', 'Đầu vào → đầu ra', 'Vai trò và trạng thái'],
        [
            ['Phát hiện tư thế', '**YOLOv8n-pose** — 17 keypoint', 'Ảnh RGB → khớp, hộp người, độ tin cậy',
             'Định vị hình học; dùng trọng số có sẵn, chỉ suy luận.'],
            ['Tách người khỏi nền', '**U2Net**', 'Ảnh RGB → alpha mask / silhouette',
             'Đo bề ngang thân và tạo vùng người; dùng trọng số có sẵn.'],
            ['Ước lượng chiều cao', 'Bayes có trọng số theo bất định', 'Tỉ lệ người trong khung + prior → khoảng chiều cao',
             'Không đủ vật chuẩn thì gắn `population_prior`, không dùng để chốt size.'],
            ['Ước lượng cân nặng', 'Gradient Boosting + Ridge BMI', 'Tỉ lệ/bề ngang đã chuẩn hoá → kg hoặc khoảng kg',
             'Đã huấn luyện trên ANSUR II; kết quả từ ảnh vẫn mang bất định.'],
            ['Ước lượng ba vòng', 'Ridge cho ngực/eo; Gradient Boosting cho hông',
             'Chiều cao, vai, ngực, eo, hông, độ rộng quần áo → cm',
             'Đã huấn luyện có augmentation mô phỏng ảnh thật.'],
            ['Hiệu chuẩn đầu ra', 'RidgeCV dân số + cổng giải phẫu', 'Ước lượng thô → giá trị/interval hợp lý',
             'Hiệu chỉnh sai lệch, chặn giá trị bất khả thi; không phải fine-tune model ảnh.'],
            ['Gợi ý size', 'Độ dư ease + lệch bậc size', 'Số đo, bảng size, size chọn → verdict + severity',
             'Quy tắc minh bạch; số đo người dùng nhập luôn thắng ước lượng.'],
            ['Thử đồ ảo', '**FASHN VTON 1.5**', 'Ảnh người + ảnh trang phục + loại đồ → ảnh đã mặc',
             'Engine chính; suy luận trên GPU, không huấn luyện lại trọng số gốc.'],
            ['Chuyển tư thế / fit refine', '**FLUX.2 Klein 4B**', 'Ảnh + prompt/pose/fit → ảnh tinh chỉnh',
             'Chỉ gọi khi cần; nhả FASHN trước khi nạp để không vượt VRAM.'],
            ['Adapter độ vừa vặn', '**LoRA hạng 8** cho bước fit-refine', 'Ảnh + điều kiện fit → hiệu ứng vải',
             'Có checkpoint và đánh giá; hiện tắt ở runtime nên không được tính là đường mặc định.'],
            ['Cổng chất lượng ảnh', 'Keypoint + mask + LPIPS/SSIM + luật che phủ',
             'Ảnh nguồn và ảnh sinh → đạt / từ chối + lý do',
             'Bảo vệ danh tính, cấu trúc và độ che phủ; không hạ ngưỡng để tăng tỉ lệ đạt.'],
            ['Tạo chuyển động', '**Wan2.1-T2V-1.3B + One-to-All**', 'Ảnh đã thử + quỹ đạo pose → MP4',
             'Sinh ngắn hạn trên CUDA; qua optical flow, liên tục thời gian và action-pose gate.'],
            ['Gợi ý sản phẩm', '9 nguồn: MF, Item-CF, content, luật kết hợp, trending, selective state, '
             'LightGCN-style, Markov, pairwise ranker', 'Tương tác + đơn + hồ sơ + catalog → danh sách xếp hạng',
             'Chạy Node/CPU; có cold-start và giải thích, chất lượng NDCG/Recall chưa đo.'],
            ['Dự báo doanh thu', 'OLS + Holt + WMA + trộn nghịch đảo MAE', 'Chuỗi 12 tháng → dự báo 3 tháng',
             'Thống kê minh bạch; khoảng hiển thị đo độ bất đồng giữa mô hình.'],
            ['Phân khúc khách', 'K-Means trên z-score', 'Chi tiêu, số đơn, recency → tối đa 3 cụm',
             'Tối đa 30 vòng; tên cụm đặt sau khi so mức chi tiêu.'],
            ['Nguy cơ rời bỏ', 'RFM heuristic', 'Recency, frequency, monetary → điểm 0–100',
             'Điểm ưu tiên chăm sóc, không phải xác suất churn đã huấn luyện.'],
            ['Mua kèm', 'Luật kết hợp kiểu Apriori', 'Các dòng trong đơn → support/confidence/lift',
             'Chỉ giữ cặp xuất hiện ít nhất hai lần; dùng cho cross-sell.'],
            ['Kiểm duyệt tiếng Việt', 'Chuẩn hoá + luật + Ollama tuỳ chọn', 'Nội dung → approved/pending/rejected',
             'Luật local luôn chạy; LLM chỉ bổ sung ngữ nghĩa, người vận hành có quyền ghi đè.'],
        ],
        widths=[Cm(3.0), Cm(4.3), Cm(4.2), Cm(4.0)], font=8.5)

    r.h3('6.13.1. Công thức đánh giá mô hình và lý do chọn model')
    r.p('Bộ ước lượng cơ thể không chọn model chỉ vì một con số đẹp ở đầu vào phòng thí nghiệm. Mỗi '
        'ứng viên được chấm trên cả đặc trưng sạch và đặc trưng đã làm nhiễu giống ảnh thật; trong các '
        'model có MAE không vượt quá 3% model tốt nhất, hệ thống chọn checkpoint nhỏ nhất để giảm thời '
        'gian nạp và bộ nhớ. Ba chỉ số cơ bản được tính như sau:')
    r.formula([
        'MAE  = (1/n) · Σ | y_i − ŷ_i |',
        'RMSE = sqrt( (1/n) · Σ ( y_i − ŷ_i )² )',
        'R²   = 1 − Σ ( y_i − ŷ_i )² / Σ ( y_i − ȳ )²',
        '',
        'model* = argmin kích_thước(model), với MAE_nhiễu(model) ≤ 1,03 · min MAE_nhiễu',
    ], note='MAE diễn đạt sai số trung bình bằng đúng đơn vị mục tiêu; RMSE phạt sai số lớn mạnh hơn; '
            'R² đo phần biến thiên được giải thích. Quy tắc 3% cân bằng độ chính xác và chi phí runtime.')
    r.table(
        'Kết quả lựa chọn model trên ANSUR II sau khi làm nhiễu đặc trưng giống ảnh.',
        ['Mục tiêu', 'Model được chọn', 'MAE trên đặc trưng nhiễu', 'Checkpoint', 'Lý do'],
        [
            ['Cân nặng', 'Gradient Boosting', '5,122 kg', '142 920 byte',
             'Nằm trong ngưỡng 3% tốt nhất và nhỏ hơn rất nhiều so với Random Forest.'],
            ['Vòng ngực', 'Ridge', '3,630 cm', '1 221 byte',
             'Sai số gần nhóm tốt nhất nhưng checkpoint cực nhỏ, dễ nạp thường trú.'],
            ['Vòng eo', 'Ridge', '4,180 cm', '1 221 byte',
             'Chấp nhận chênh lệch rất nhỏ để tránh checkpoint hàng chục MB.'],
            ['Vòng hông', 'Gradient Boosting', '3,206 cm', '143 064 byte',
             'Đạt vùng 3% và cân bằng sai số với kích thước.'],
            ['BMI', 'Ridge', '1,753 điểm BMI', '1 181 byte',
             'Đầu vào chỉ là bốn tỉ lệ bề ngang và độ rộng quần áo, không phụ thuộc cm tuyệt đối.'],
        ],
        widths=[Cm(2.4), Cm(3.1), Cm(3.2), Cm(2.7), Cm(4.1)], font=9.2,
        note='Nguồn: `backend/ai_training/models/body_estimator.metrics.json`. Các MAE trong bảng này '
             'chỉ chấm bước ánh xạ đặc trưng → mục tiêu, **không** thay thế MAE đầu-cuối từ ảnh ở mục 6.2.8.')
    r.p('Dữ liệu huấn luyện có 6 068 người; chia 80/20 theo người trước khi augmentation. Mỗi mẫu train '
        'được tạo thêm bốn bản nhiễu, nên các model thấy 24 270 mẫu huấn luyện và được kiểm tra trên '
        '1 214 người không trùng phía train. Bốn họ model được so sánh là RidgeCV, Random Forest 200 '
        'cây (`max_depth=14`, `min_samples_leaf=4`), Gradient Boosting và MLP hai tầng 96–48; riêng '
        'BMI dùng MLP 64–32. Seed cố định bằng 17 để có thể tái lập kết quả.')

    r.h3('6.13.2. Công thức hình học, độ bất định và quyết định size')
    r.p('Từ silhouette, các bề ngang được đo ở nhiều lát cắt thay vì một hàng pixel duy nhất. Gọi '
        '`w(y)` là số pixel thuộc người tại cao độ y, `H_px` là chiều cao người trong ảnh và '
        '`H_cm` là chiều cao tham chiếu đủ tin cậy:')
    r.formula([
        'width_region = median{ w(y) | y thuộc vùng ngực / eo / hông }',
        'scale = H_cm / H_px                 width_cm = width_px · scale',
        'ratio_region = width_region_px / H_px',
        'weight_from_BMI = BMI_hat · ( H_cm / 100 )²',
    ], note='Median chống một vài hàng mask lỗi. Khi H_cm không đủ tin cậy, hệ thống ưu tiên đặc trưng '
            'tỉ lệ và trả khoảng bất định, không biến pixel thành số đo chính xác giả.')
    r.p('Gợi ý size dùng khoảng dư của quần áo so với cơ thể. Với mỗi vùng r ∈ {ngực, eo, hông}:')
    r.formula([
        'ease_r = garment_r(size) − body_r',
        'penalty_tight(r) = max(0;  minEase_r − ease_r) / tightScale_r',
        'penalty_loose(r) = max(0;  ease_r − maxEase_r) / looseScale_r',
        'severity = clamp( max_r{penalty_tight(r), penalty_loose(r), severity_delta}; 0; 1 )',
    ], note='Các ngưỡng phụ thuộc loại trang phục. `severity_delta` là tín hiệu dự phòng từ chênh lệch '
            'bậc size khi chưa có đủ ba vòng; nó không được phép ghi đè số đo thủ công của người dùng.')

    r.h3('6.13.3. Tham số suy luận của ảnh và video')
    r.table(
        'Các profile suy luận và đánh đổi tốc độ–chất lượng.',
        ['Đường ống', 'Profile', 'Tham số chính', 'Mục đích'],
        [
            ['FASHN VTON 1.5', 'fast', '16 bước; cạnh dài 1 280 px; CFG 1,5',
             'Xem nhanh trên điện thoại, vẫn upscale và sharpen không sinh thêm chi tiết.'],
            ['FASHN VTON 1.5', 'balanced', '20 bước; cạnh dài 1 536 px; CFG 1,5',
             'Cân bằng độ trễ và độ nét, dành cho luồng thông thường.'],
            ['FASHN VTON 1.5', 'high', '25 bước; cạnh dài 1 536 px; CFG 1,5',
             'Giữ cấu hình nghiệm thu cho ảnh khó.'],
            ['FLUX.2 fit-refine', 'thường / cực đoan', '4 bước; tối thiểu 6 bước khi lệch size lớn; CFG 1,0',
             'Chỉ sửa cách vải ôm/rủ; không đổi cơ thể để ép vừa size.'],
            ['One-to-All', 'quality', '49 frame; 12 fps; 30 bước; image CFG 2,5; pose CFG 1,5',
             'Mốc chất lượng để A/B và xử lý ảnh khó.'],
            ['One-to-All', 'turbo', '49 frame; 12 fps; 12 bước; guidance 1,0/1,0',
             'Mặc định cho đi bộ tự nhiên và pose sway sau khi qua cùng cổng chất lượng.'],
            ['One-to-All', 'turn_fast', '33 frame; 10 fps; 12 bước; guidance 1,5/1,0',
             'Quay người ngắn, giảm thời gian nhưng vẫn kiểm tra chuyển động.'],
        ],
        widths=[Cm(3.1), Cm(2.4), Cm(5.2), Cm(4.8)], font=9.2)
    r.note('Các profile không được chọn chỉ bằng cảm giác. Kết quả ảnh phải qua kiểm tra danh tính, '
           'keypoint, cấu trúc trang phục và độ che phủ; video phải qua optical flow, liên tục thời '
           'gian và khớp hành động. Nếu cổng thất bại, hệ thống trả lý do từ chối thay vì tự hạ ngưỡng.',
           label='Chất lượng là điều kiện phát hành')

    r.h3('6.13.4. Công thức xếp hạng và khởi động nguội')
    r.p('Điểm gợi ý cuối cùng là một mô hình lai. Mỗi nguồn tạo một điểm đã chuẩn hoá, cổng thích ứng '
        'chọn trọng số theo lượng lịch sử, rồi bộ xếp hạng chồng chuyển tổng điểm về xác suất:')
    r.formula([
        'cosine(a,b) = (a · b) / ( ||a||₂ · ||b||₂ )',
        'decay(age)  = 2^(−age_days / 14)',
        'retrieval   = Σ_k α_k(user_state) · score_k(item)',
        'finalScore  = σ( clamp(0,7·logit(p_rank) + 2,2·(retrieval−0,5) − 5·negative; −20; 20) )',
    ], note='Không có lịch sử: 70% trending + 30% ranker. Có sở thích nội dung nhưng chưa có hành vi: '
            '45% trending + 30% content + 25% ranker. Từ ba sản phẩm tương tác trở lên mới bật đủ chín nguồn.')
    r.p('Hệ thống sau đó giới hạn tối đa hai sản phẩm mỗi danh mục và dành một vị trí khám phá khi '
        'danh sách có ít nhất bốn món. Đây là bước hậu xử lý phục vụ trải nghiệm, không phải sửa điểm '
        'để làm đẹp. Mỗi gợi ý mang lý do từ nguồn đóng góp lớn nhất; riêng NDCG@10 và Recall@10 vẫn '
        'là `not-measured`, nên báo cáo không gán cho hệ gợi ý một độ chính xác chưa từng đo.')

    r.h3('6.13.5. Phân biệt huấn luyện, suy luận, hiệu chuẩn và heuristic')
    r.table(
        'Kỷ luật thuật ngữ cho các thành phần kỹ thuật.',
        ['Thành phần', 'Bản chất đúng', 'Có cập nhật trọng số?', 'Bằng chứng / giới hạn'],
        [
            ['YOLOv8n-pose, U2Net, FASHN, Wan2.1/One-to-All', 'Suy luận bằng checkpoint có sẵn', 'Không',
             'Model được tải để chạy; không gọi là model do nhóm huấn luyện.'],
            ['Hồi quy cân nặng, BMI, ba vòng', 'Huấn luyện có giám sát', 'Có',
             'Có dữ liệu, seed, checkpoint, hash và chỉ số test tách theo người.'],
            ['LoRA fit-refine hạng 8', 'Fine-tune dạng adapter', 'Có',
             'Có checkpoint và cổng nghiệm thu; hiện tắt trong đường runtime mặc định.'],
            ['RidgeCV hiệu chuẩn dân số', 'Hiệu chuẩn đầu ra', 'Có hệ số fitted',
             'Không thay đổi model ảnh; kế thừa giới hạn giấy phép/dân số của dữ liệu.'],
            ['K-Means, Holt, OLS, WMA, Apriori', 'Thống kê / học máy cổ điển', 'Tính lại từ dữ liệu',
             'Minh bạch, kiểm tra tay được; không gọi chung là deep learning.'],
            ['RFM churn, DemandScore, moderation rules', 'Heuristic nghiệp vụ', 'Không',
             'Trọng số do thiết kế; không được trình bày như xác suất đã học.'],
            ['Ollama trong Ori/kiểm duyệt', 'Viết lại hoặc kiểm tra ngữ nghĩa tuỳ chọn', 'Không',
             'Không được quyết định giá, tồn kho, số đo hay quyền nghiệp vụ.'],
        ],
        widths=[Cm(4.1), Cm(3.4), Cm(2.7), Cm(5.3)], font=9.2)
    r.p('Như vậy, phần “AI” của JAPANO không phải một model duy nhất. Nó là một hệ nhiều tầng: cảm '
        'nhận hình ảnh → hình học và bất định → hồi quy → quy tắc size → sinh ảnh/video → cổng chất '
        'lượng; song song là hệ gợi ý và phân tích kinh doanh chạy trên dữ liệu giao dịch. Giá trị '
        'kỹ thuật nằm ở cách các tầng kiểm tra lẫn nhau và ở việc hệ thống biết khi nào phải trả '
        '“không đủ bằng chứng”, không nằm ở số lượng tên model được liệt kê.')
