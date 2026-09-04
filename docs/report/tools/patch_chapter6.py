#!/usr/bin/env python3
"""Bổ sung hai thuật toán chưa được ghi vào Chương 6.

Chương 6 đã trình bày đầy đủ phần AI: ước lượng số đo, độ vừa vặn, thử đồ,
video, gợi ý, trợ lý, phân tích quản trị và kiểm duyệt. Hai thuật toán dưới đây
được viết sau khi chương đó hoàn thành nên chưa có chỗ nào nhắc tới, dù cả hai
đều có công thức, hằng số đã chốt và bộ kiểm thử riêng:

  6.8.6  Sổ hiển thị và mệt mỏi hiển thị — chống feed đóng băng.
  6.13   Phạm vi và vòng đời phiếu giảm giá.

Cả hai đều CHÈN THÊM, không xoá và không sửa nội dung sẵn có. Mục "Điều chưa đo
được" của 6.8 bị đẩy số từ 6.8.6 xuống 6.8.7 — đây là thay đổi duy nhất với chữ
đã có.
"""
import re
from copy import deepcopy

from docx import Document
from docx.oxml.ns import qn

DOC = ('/home/nhat/Downloads/japano/'
       'Thầy Nguyễn Ngọc Chấn_Phát triển ứng dụng thương mại điện tử thời trang JAPANO Store (1).docx')

FEED = [
    ('h3', '6.8.6. Sổ hiển thị: chống hiện tượng feed đóng băng'),
    ('p', 'Chín nguồn ứng viên và cổng trộn ở trên trả lời câu hỏi "món nào hợp với '
          'người này nhất". Chúng không trả lời một câu hỏi khác, và câu hỏi đó mới '
          'quyết định người dùng có mở ứng dụng lần thứ tư hay không: "hôm nay có gì '
          'khác hôm qua". Vì điểm số của một người ổn định gần như tuyệt đối giữa hai '
          'lần mở cách nhau vài giờ, một bộ gợi ý chỉ xếp theo điểm sẽ trả về đúng màn '
          'hình cũ. Đo trên kho hạt giống trước khi sửa: hai lượt mở trang chủ liên '
          'tiếp trùng 7/8 món và trùng y hệt sau nhiều giờ; món khách vừa mua vẫn đứng '
          'hạng hai; và chỉ 11/30 lượt có một món chưa ai từng tương tác.'),
    ('p', 'Cách chữa không phải là xáo ngẫu nhiên — xáo ngẫu nhiên giết luôn phần khớp '
          'đúng. Hệ thống ghi nhớ đã bày món nào cho ai, rồi trừ điểm dần món đã bày '
          'nhiều lần mà người dùng không chạm vào. Sổ này nằm trong bộ nhớ tiến trình, '
          'có phân rã theo thời gian và có trần bốn nghìn người dùng gần nhất; khởi '
          'động lại thì quên sạch, và đó là chủ ý: không món nào bị chôn vĩnh viễn chỉ '
          'vì tuần trước lỡ hiện nhiều lần.'),
    ('p', 'Mỗi lần một món được bày cho một người, số lần bày cũ được phân rã rồi cộng '
          'thêm một, chặn trên ở 24:'),
    ('f', 'n_mới = min( 24;  n_cũ · 2 ^ ( − Δt / 36 giờ )  +  1 )'),
    ('p', 'Hai lần bày cách nhau dưới 90 giây được coi là cùng một phiên xem — kéo để '
          'làm mới không bị tính thành một lần bày mới. Từ số lần bày, mức mệt mỏi rơi '
          'vào khoảng 0..1 theo một đường bão hoà, sau khi đã trừ suất bày đầu tiên '
          'miễn phí:'),
    ('f', 'd       = n · 2 ^ ( − Δt / 36 giờ )  −  1'),
    ('f', 'fatigue = d / (d + 2,5)      nếu d > 0,05;   bằng 0 trong các trường hợp còn lại'),
    ('p', 'Hằng số 2,5 là số lần bày (đã phân rã, đã trừ suất miễn phí) để đạt đúng nửa '
          'mức phạt tối đa. Một điều kiện quan trọng hơn mọi hằng số: nếu người dùng đã '
          'chạm vào món đó — xem, thích, thêm giỏ, thử đồ hay mua — sau lần bày gần '
          'nhất, mức mệt mỏi trở về 0 ngay lập tức. Quan tâm thật luôn thắng mệt mỏi '
          'hiển thị.'),
    ('h4', 'Miễn nhiễm cho mỏ neo'),
    ('p', 'Trừ điểm đều tay lên cả danh sách sẽ đẩy món khớp mạnh nhất ra khỏi trang '
          'chủ sau vài lần mở, và đó là một dạng hỏng khác chứ không phải một cải '
          'tiến. Vì vậy mức phạt được nhân với một hệ số tăng dần theo thứ hạng: món '
          'đứng đầu gần như miễn nhiễm, món xếp sau chịu gần trọn mức phạt.'),
    ('f', 'immunity = e ^ ( − thứ_hạng / 3 )'),
    ('f', 'logit    = logit_gốc  −  3,0 · fatigue · ( 1 − immunity )'),
    ('p', 'Với thứ hạng 0 thì immunity bằng 1 và mức phạt bằng 0; tới thứ hạng 6 thì '
          'immunity chỉ còn khoảng 0,14, tức là món đó chịu 86% mức phạt. Kết quả là '
          'phần đầu danh sách đứng yên còn phần giữa được xáo lại — đúng thứ cần thiết '
          'để feed vừa quen vừa mới.'),
    ('h4', 'Hai cơ chế đi kèm'),
    ('b', 'Chặn món đã mua. Một sản phẩm đã nằm trong đơn hàng hoàn tất bị trừ thẳng '
          'trên thang logit với cường độ 3,0, và mức trừ này phân rã với nửa đời 45 '
          'ngày. Áo khoác mua tháng trước không nên chiếm ô trang chủ tháng này, nhưng '
          'sau một mùa thì lại hợp lý.'),
    ('b', 'Ô khám phá với tới hàng lạnh. Ô cuối danh sách được bốc thăm có trọng số. '
          'Trước đây trọng số chính là điểm thịnh hành, nên hàng chưa ai chạm — điểm '
          'thịnh hành bằng 0 — gần như không bao giờ được bày. Thêm một sàn 0,35 và '
          'nhân với (1 − fatigue) thì mọi món đều có cơ hội khác 0.'),
    ('f', 'trọng_số = max( 0,01;  ( 0,35 + điểm_thịnh_hành ) · ( 1 − fatigue ) )'),
    ('h4', 'Kết quả đo'),
    ('cap-b', 'Độ tươi của trang chủ trước và sau khi có sổ hiển thị.'),
    ('TABLE-FEED', ''),
    ('src', 'Nguồn: backend/test/recsys-retention.test.js, 10 phép kiểm thử, chạy trên '
            'kho hạt giống của dự án. Đo lại bằng node --test '
            'backend/test/recsys-retention.test.js.'),
    ('p', 'Ba dòng cuối của bảng là ba ràng buộc đối nghịch nhau, và giá trị của thiết '
          'kế này nằm ở chỗ nó thoả cả ba cùng lúc: kéo làm mới trong vài giây thì màn '
          'hình phải đứng yên, mở lại sau nửa ngày thì phải khác đi, còn nghỉ vài ngày '
          'rồi quay lại thì món quen phải được bày lại chứ không bị chôn. Một cơ chế '
          'chỉ xáo ngẫu nhiên sẽ hỏng ràng buộc thứ nhất; một cơ chế chỉ xếp theo điểm '
          'sẽ hỏng ràng buộc thứ hai; một cơ chế phạt không phân rã sẽ hỏng ràng buộc '
          'thứ ba.'),
]

FEED_TABLE = [
    ('Phép đo', 'Trước', 'Sau', 'Ý nghĩa'),
    ('Trùng nhau khi kéo làm mới sau 3 giây', '8/8', '7/8', 'Màn hình phải đứng yên; chỉ ô khám phá được đổi.'),
    ('Hạng 1 khi kéo làm mới', 'giữ', 'giữ', 'Mỏ neo khớp mạnh nhất không bị đẩy đi.'),
    ('Trùng nhau sau 9 giờ', '8/8', '3/8', 'Mở lại buổi tối thấy màn hình khác buổi sáng.'),
    ('Trùng nhau sau 24 giờ', '8/8', '3/8', 'Hạng 1 vẫn giữ nguyên nhờ miễn nhiễm mỏ neo.'),
    ('Món quen quay lại sau 4 ngày nghỉ', '—', '7/8', 'Nợ hiển thị phân rã hết, không món nào bị chôn.'),
    ('Lượt chạm tới hàng chưa ai tương tác', '11/30', '30/30', 'Ô khám phá thật sự với tới kho lạnh.'),
    ('Món vừa mua còn xuất hiện', 'có, hạng 2', 'không', 'Kiểm tra ở 4 mốc: ngay sau mua, 3 giờ, 9 giờ, 24 giờ.'),
]

VOUCHER = [
    ('h2', '6.13. Phạm vi và vòng đời phiếu giảm giá'),
    ('p', 'Mục này không nói về trí tuệ nhân tạo. Nó nằm trong chương thuật toán vì hai '
          'lý do: nó là một máy trạng thái có bất biến tài chính phải giữ đúng trong '
          'mọi thứ tự sự kiện, và cả hai lỗi được trình bày dưới đây đều là lỗi mất '
          'tiền thật chứ không phải lỗi hiển thị.'),
    ('h3', '6.13.1. Lỗi thứ nhất: voucher một sản phẩm giảm trên cả giỏ hàng'),
    ('p', 'Quỹ tiết kiệm mục tiêu thưởng cho khách một phiếu giảm 30% dành riêng cho '
          'đúng sản phẩm khách đã đặt mục tiêu. Trong mã nguồn có sẵn một trường tên '
          '`appliesTo`, nhưng không một đường chạy thật nào đọc tới nó. Hệ quả rất cụ '
          'thể: khách để món mục tiêu giá 100.000₫ cạnh một món khác giá 900.000₫ thì '
          'cửa hàng mất 300.000₫ thay vì 30.000₫ — gấp mười lần quyền lợi đã hứa, và '
          'con số đó nở ra theo kích thước giỏ hàng chứ không có trần.'),
    ('p', 'Cách sửa là làm cho phạm vi trở thành một thuộc tính bắt buộc phải trả lời '
          'được, kể cả với dữ liệu phát hành trước khi có trường này:'),
    ('f', 'nếu voucher.scope ∈ {product, order}  →  dùng đúng giá trị đó'),
    ('f', 'ngược lại, nếu voucher.source = goal-fund  →  product'),
    ('f', 'ngược lại  →  order'),
    ('p', 'Quy tắc thứ hai là quy tắc di trú: voucher goal cũ chỉ có `source` và '
          '`goalProductId`, không có `scope`, vẫn được áp đúng phạm vi sản phẩm ngay '
          'lần validate kế tiếp mà không cần chạy migration nào trên dữ liệu thật. '
          'Quan trọng không kém là hành vi khi thiếu thông tin: nếu một voucher phạm vi '
          'sản phẩm được đem đi kiểm tra mà lời gọi không kèm danh sách dòng hàng, hệ '
          'thống TỪ CHỐI chứ không rơi về giảm toàn đơn. Không biết giỏ có gì thì '
          'không được giảm — đây là lựa chọn fail-closed, và nó chính là thứ ngăn lỗi '
          'cũ tái diễn qua một đường gọi khác.'),
    ('h3', '6.13.2. Phân bổ giảm giá theo từng dòng hàng'),
    ('p', 'Biết được giảm bao nhiêu là chưa đủ. Khi khách trả lại một món trong đơn có '
          'nhiều món, cần biết chính xác phần giảm nào thuộc về món đó, nếu không số '
          'tiền hoàn sẽ sai. Vì vậy mỗi lượt áp voucher đều sinh kèm một bảng phân bổ.'),
    ('p', 'Trước hết là tập đơn vị hợp lệ. Với voucher phạm vi sản phẩm và hạn mức một '
          'đơn vị, hệ thống chọn đơn vị ĐẮT NHẤT trong số các đơn vị hợp lệ — khách '
          'không bị thiệt vì thứ tự sắp xếp giỏ hàng. Số tiền giảm được tính trên tổng '
          'giá trị của riêng tập đó, rồi chặn bởi trần đã hứa lúc phát hành:'),
    ('f', 'eligibleSubtotal = Σ  giá · số_lượng   trên các đơn vị hợp lệ'),
    ('f', 'discount = round( eligibleSubtotal · value / 100 )      (loại phần trăm)'),
    ('f', 'discount = min( discount, maxDiscountAmount, eligibleSubtotal )'),
    ('p', 'Trần `maxDiscountAmount` giữ đúng quyền lợi đã hứa lúc đặt mục tiêu: nếu cửa '
          'hàng tăng giá món đó từ 100.000₫ lên 500.000₫ sau khi voucher đã phát, mức '
          'giảm vẫn là 30.000₫ chứ không nở theo giá mới.'),
    ('p', 'Phần giảm sau đó được chia về từng dòng theo tỉ lệ giá trị dòng, với một chi '
          'tiết bắt buộc ở dòng cuối:'),
    ('f', 'phần_dòng_i = round( discount · giá_trị_dòng_i / eligibleSubtotal )'),
    ('f', 'phần_dòng_cuối = discount  −  Σ các phần đã chia'),
    ('p', 'Dòng cuối nhận phần còn lại thay vì tự làm tròn. Nếu để mọi dòng tự làm tròn '
          'thì tổng các phần không bằng số giảm — với giỏ ba món 33.333₫, 33.333₫ và '
          '33.334₫ thì sai lệch rơi vãi này đủ để một lượt hoàn tiền lệch vài đồng, và '
          'một hệ thống kế toán lệch vài đồng thì không đối soát được. Bất biến "tổng '
          'phân bổ bằng đúng số giảm" được khoá lại bằng kiểm thử.'),
    ('h3', '6.13.3. Lỗi thứ hai: lượt dùng bị tiêu ngay lúc tạo đơn'),
    ('p', 'Trong toàn bộ mã nguồn cũ chỉ có đúng một phép cộng `used + 1`, đặt ngay tại '
          'bước tạo đơn, và không có một phép trừ nào ở bất cứ đâu. Nghĩa là thanh toán '
          'thất bại, khách tự huỷ, cửa hàng huỷ hay hoàn tiền toàn bộ đều làm khách mất '
          'trắng lượt dùng của một voucher chưa từng mang lại doanh thu nào.'),
    ('p', 'Lời giải là tách thời điểm GIỮ CHỖ khỏi thời điểm TIÊU. Mỗi đơn có nhiều nhất '
          'một bản ghi đổi voucher, định danh theo mã đơn:'),
    ('cap-b', 'Máy trạng thái của một lượt đổi phiếu giảm giá.'),
    ('TABLE-VOUCHER', ''),
    ('src', 'Nguồn: backend/lib/voucherLifecycle.js. Kiểm thử: backend/test/voucher-'
            'scope.test.js (11), voucher-redemption.test.js (14) và voucher-migration'
            '.test.js (7).'),
    ('p', 'Sức chứa của voucher không đọc riêng trường `used` mà lấy giá trị lớn hơn '
          'giữa `used` và số bản ghi đang giữ chỗ hoặc đã tiêu. Nhờ vậy hai đơn hàng '
          'gần như đồng thời trên một voucher giới hạn một lượt vẫn bị chặn đúng: đơn '
          'thứ hai nhìn thấy chỗ giữ của đơn thứ nhất dù `used` vẫn đang bằng 0.'),
    ('f', 'usage    = max( số bản ghi reserved + consumed,  voucher.used )'),
    ('f', 'còn chỗ  ⇔  usage  <  limit'),
    ('h3', '6.13.4. Ba thứ tự sự kiện phải xử lý đúng'),
    ('n', 'Callback lặp. Cổng thanh toán gửi lại thông báo "đã trả tiền" nhiều lần là '
          'chuyện bình thường. Chuyển trạng thái được viết idempotent: lần thứ hai trở '
          'đi không cộng thêm lượt dùng nào.'),
    ('n', 'Thất bại đến sau thành công. Nếu thông báo hỏng tới sau khi tiền đã về, bản '
          'ghi ở trạng thái consumed không được nhả ra. Consumed là trạng thái cuối.'),
    ('n', 'Thành công đến sau khi đã nhả chỗ. Đây là thứ tự bất khả thi theo thiết kế, '
          'nên hệ thống KHÔNG tự sửa số liệu. Nó giữ nguyên trạng thái released, đánh '
          'dấu bản ghi cần rà soát kèm lý do, và để một người thật quyết định. Âm thầm '
          'cộng lượt dùng ở đây là cách nhanh nhất để một lỗi tiền bạc biến mất khỏi '
          'tầm nhìn.'),
    ('p', 'Còn một tình huống nhỏ nhưng đúng về mặt quyền lợi: voucher hết hạn trong '
          'lúc đang bị giữ chỗ rồi đơn bị huỷ. Khách không được mất quyền lợi chỉ vì '
          'thời gian chờ xử lý của hệ thống, nên hạn dùng được gia hạn đúng một lần khi '
          'nhả chỗ.'),
    ('h3', '6.13.5. Cấp lại sau khi hoàn tiền toàn bộ'),
    ('p', 'Khi một đơn đã tiêu lượt voucher rồi được hoàn tiền toàn bộ, khách nhận một '
          'phiếu thay thế giữ nguyên loại, giá trị, phạm vi, danh sách sản phẩm hợp lệ '
          'và hạn mức số lượng, với hạn dùng ít nhất 30 ngày kể từ lúc cấp. Mã của '
          'phiếu mới được sinh xác định từ mã gốc cộng với mã yêu cầu hoàn tiền, nên '
          'gọi lại bao nhiêu lần — kể cả khi callback hoàn tiền bị lặp — cũng chỉ ra '
          'đúng một phiếu. Phiếu gốc không bị xoá: lịch sử phải kể đúng chuyện đã xảy '
          'ra. Trả lại một phần đơn thì không cấp phiếu thay thế, vì lượt dùng vẫn đã '
          'mang lại doanh thu.'),
    ('h3', '6.13.6. Đọc dữ liệu cũ theo hướng bảo thủ'),
    ('p', 'Các bản ghi phát sinh trước bản vá không có trường `status`. Chúng được đọc '
          'là ĐÃ TIÊU chứ không phải đang giữ chỗ. Đây là một lựa chọn có hướng rõ '
          'ràng: đoán sai theo hướng "đang giữ chỗ" rồi nhả ra sẽ tặng thêm lượt dùng '
          'cho những voucher đã thực sự được tiêu, tức là mất tiền lần thứ hai trên '
          'cùng một lỗi. Kèm theo đó là một lệnh rà soát chạy ở chế độ chỉ đọc mặc '
          'định, chỉ vá những gì chứng minh được — chỗ giữ còn treo trên đơn đã huỷ '
          'hoặc đã thanh toán thất bại — và không bao giờ tự giảm số lượt dùng của bản '
          'ghi cũ.'),
]

VOUCHER_TABLE = [
    ('Trạng thái', 'Vào lúc nào', 'Tác động lên voucher.used', 'Đi tiếp được tới đâu'),
    ('reserved', 'Ngay khi đơn được tạo và voucher hợp lệ.', 'Không đổi.',
     'consumed hoặc released.'),
    ('consumed', 'Khi tiền thực sự về: đơn hoàn tất hoặc thanh toán thành công.', 'Cộng đúng 1.',
     'Trạng thái cuối. Chỉ có thể cấp lại phiếu thay thế.'),
    ('released', 'Huỷ đơn, thanh toán thất bại, hết hạn giữ chỗ.', 'Không đổi — chưa từng cộng nên không cần trừ.',
     'Trạng thái cuối. Voucher dùng lại được ngay.'),
    ('cần rà soát', 'Nhận callback "đã trả tiền" sau khi chỗ đã bị nhả.', 'Không đổi.',
     'Chờ người vận hành quyết định; hệ thống không tự sửa.'),
]


TEMPLATES = {           # đoạn mẫu để sao chép định dạng, theo chỉ số trong bản hiện tại
    'h2': 1615, 'h3': 1491, 'h4': 1446, 'p': 1492,
    'f': 1487, 'cap-b': 1483, 'src': 1253, 'b': 1493, 'n': 1503,
}
TABLE_TEMPLATE = 54     # bảng 16x4, dùng làm khuôn cho hai bảng mới


def set_text(para, text):
    """Ghi chữ vào đoạn đã sao chép, giữ nguyên run đầu để không mất định dạng."""
    runs = para.runs
    if not runs:
        para.add_run(text)
        return
    runs[0].text = text
    for extra in runs[1:]:
        extra.text = ''


def set_caption(para, number, title):
    """Caption có hai run: số bảng in đậm, tiêu đề in nghiêng."""
    runs = para.runs
    runs[0].text = f'Bảng {number}. '
    if len(runs) > 1:
        runs[1].text = title
        for extra in runs[2:]:
            extra.text = ''
    else:
        para.add_run(title)


def set_cell(cell, text, bold=False):
    para = cell.paragraphs[0]
    if para.runs:
        para.runs[0].text = text
        for extra in para.runs[1:]:
            extra.text = ''
        para.runs[0].bold = bold
    else:
        para.add_run(text).bold = bold
    for extra in cell.paragraphs[1:]:
        extra._p.getparent().remove(extra._p)


def resize_rows(table, wanted):
    while len(table.rows) > wanted:
        row = table.rows[-1]._tr
        row.getparent().remove(row)
    while len(table.rows) < wanted:
        clone = deepcopy(table.rows[-1]._tr)
        table.rows[-1]._tr.addnext(clone)


def main():
    doc = Document(DOC)
    tpl = {k: doc.paragraphs[i]._p for k, i in TEMPLATES.items()}
    tbl_tpl = doc.tables[TABLE_TEMPLATE]._tbl

    def find(prefix, start=0):
        for i, para in enumerate(doc.paragraphs):
            if i >= start and para.text.strip().startswith(prefix):
                return i
        raise SystemExit(f'không tìm thấy {prefix!r}')

    def emit(block, anchor_el, table_specs):
        """Chèn cả khối vào TRƯỚC anchor_el, giữ đúng thứ tự đã viết."""
        for kind, text in block:
            if kind.startswith('TABLE-'):
                new = deepcopy(tbl_tpl)
                anchor_el.addprevious(new)
                rows = table_specs[kind]
                from docx.table import Table
                table = Table(new, doc)
                resize_rows(table, len(rows))
                for r_index, row in enumerate(rows):
                    for c_index, value in enumerate(row):
                        set_cell(table.rows[r_index].cells[c_index], value, bold=(r_index == 0))
                continue
            new = deepcopy(tpl[kind])
            anchor_el.addprevious(new)
            from docx.text.paragraph import Paragraph
            para = Paragraph(new, doc)
            if kind == 'cap-b':
                set_caption(para, table_specs['numbers'].pop(0), text)
            else:
                set_text(para, text)

    # --- A. Mục 6.8.6 mới, chèn trước "6.8.6. Điều chưa đo được" ---------------
    anchor = doc.paragraphs[find('6.8.6. Điều chưa đo được')]._p
    emit(FEED, anchor, {'TABLE-FEED': FEED_TABLE, 'numbers': ['6.22']})

    # Mục cũ bị đẩy xuống một bậc.
    old = doc.paragraphs[find('6.8.6. Điều chưa đo được')]
    set_text(old, '6.8.7. Điều chưa đo được')

    # Bảng mới chen vào giữa dãy nên bốn caption sau nó phải dịch số.
    for old_no, new_no in ((6.25, 6.26), (6.24, 6.25), (6.23, 6.24), (6.22, 6.23)):
        target = f'Bảng {old_no:.2f}'.replace('.00', '.0')
        for para in doc.paragraphs:
            text = para.text.strip()
            if text.startswith(f'Bảng {old_no}.') and para.style.name == 'Normal':
                runs = para.runs
                if runs and runs[0].text.startswith(f'Bảng {old_no}.'):
                    runs[0].text = runs[0].text.replace(f'Bảng {old_no}.', f'Bảng {new_no}.', 1)
                break

    # --- B. Mục 6.13 mới, chèn trước CHƯƠNG 7 ---------------------------------
    anchor = doc.paragraphs[find('CHƯƠNG 7')]._p
    emit(VOUCHER, anchor, {'TABLE-VOUCHER': VOUCHER_TABLE, 'numbers': ['6.27']})

    doc.save(DOC)
    check = Document(DOC)
    print('đoạn :', len(check.paragraphs), '· bảng:', len(check.tables))
    for para in check.paragraphs:
        text = para.text.strip()
        if re.match(r'^(6\.8\.[67]|6\.13)', text) and para.style.name.startswith('Heading'):
            print('  ', para.style.name, text[:70])
    print('caption Chương 6:')
    for para in check.paragraphs:
        text = para.text.strip()
        if re.match(r'^Bảng 6\.2[0-9]\.', text):
            print('  ', text[:75])


if __name__ == '__main__':
    main()
