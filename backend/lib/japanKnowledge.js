// Kho tri thức nhỏ, có kiểm soát cho Ori. Nội dung cố định giúp bot trả lời nhanh,
// không bịa dữ kiện và vẫn hoạt động khi mô hình ngôn ngữ cục bộ đang tắt.
const TOPICS = [
  {
    test: /(kimono)/i,
    answer: 'Kimono là trang phục truyền thống dáng chữ T, quấn thân trái phủ lên phải và cố định bằng obi. Kimono thường dùng trong lễ cưới, trà đạo, lễ trưởng thành và dịp trang trọng; chỉ mặc vạt phải phủ trái cho người đã mất. Khi phối hiện đại, bạn có thể khoác kimono hoặc haori ngoài áo trơn, giữ phụ kiện tối giản để họa tiết nổi bật.',
  },
  {
    test: /(yukata)/i,
    answer: 'Yukata là áo choàng cotton nhẹ, ít lớp và giản dị hơn kimono. Người Nhật thường mặc yukata vào mùa hè, lễ hội matsuri, xem pháo hoa hoặc ở ryokan. Cách mặc cơ bản: vạt trái phủ vạt phải, buộc obi; nữ thường thắt obi cao ở eo, nam thấp hơn một chút. Geta và túi kinchaku là phụ kiện dễ phối.',
  },
  {
    test: /(haori)/i,
    answer: 'Haori là áo khoác truyền thống mặc ngoài kimono, hiện cũng rất hợp phong cách hằng ngày. Bạn có thể phối haori với áo thun trơn, quần ống rộng hoặc váy đơn sắc; nên lấy một màu từ họa tiết haori làm màu nhấn và tránh dùng quá nhiều họa tiết cùng lúc.',
  },
  {
    test: /(hakama)/i,
    answer: 'Hakama là trang phục dạng quần hoặc váy xếp ly, buộc ở eo và mặc ngoài kimono. Ngày nay hakama thường xuất hiện trong lễ tốt nghiệp, nghi lễ Thần đạo và võ đạo như kendo, aikido. Khi chọn hakama, chiều dài nên vừa chạm mắt cá để đi lại an toàn.',
  },
  {
    test: /(obi|guốc geta|geta|zori|tabi)/i,
    answer: 'Obi là đai buộc bên ngoài kimono/yukata; geta là guốc gỗ, zori là dép đế phẳng trang trọng hơn và tabi là tất tách ngón. Với yukata mùa hè, geta đi chân trần là lựa chọn phổ biến; với kimono trang trọng, người ta thường dùng tabi trắng và zori.',
  },
  {
    test: /(lolita|harajuku|visual kei|gyaru|streetwear|thời trang đường phố)/i,
    answer: 'Thời trang đường phố Nhật có nhiều nhánh riêng: Lolita lấy cảm hứng Victoria/Rococo với phom kín đáo; Harajuku nổi bật ở cách phối tự do và nhiều lớp; gyaru thiên về vẻ rực rỡ; visual kei dùng phom sân khấu, trang điểm và màu tối. Bạn nên chọn một nhánh làm chủ đạo, rồi tiết chế màu và phụ kiện để bộ đồ vẫn dễ mặc.',
  },
  {
    test: /(cosplay|anime|nhân vật)/i,
    answer: 'Cosplay chú trọng độ giống nhân vật nhưng vẫn cần vừa vặn và dễ vận động. Hãy ưu tiên đúng ba yếu tố dễ nhận diện nhất: bảng màu, phom tóc/phụ kiện và chi tiết biểu tượng; sau đó chọn chất liệu thoáng, kiểm tra tầm nhìn và giày trước khi đi sự kiện.',
  },
  {
    test: /(tokyo|tôkyô|đông kinh)/i,
    answer: 'Tokyo hợp cho chuyến đi kết hợp hiện đại và truyền thống: Asakusa–Sensō-ji, Ueno, Meiji Jingū, Shibuya, Shinjuku và các khu mua sắm như Ginza hoặc Harajuku. Nên gom điểm theo khu vì thành phố rất rộng; dùng thẻ IC cho tàu nội đô và tránh giờ cao điểm nếu mang hành lý lớn.',
  },
  {
    test: /(kyoto|kyōto|kioto)/i,
    answer: 'Kyoto nổi tiếng với Fushimi Inari, Kiyomizu-dera, Arashiyama, Kinkaku-ji và khu Gion. Hãy đi sớm để bớt đông, chia lịch theo phía đông/tây thành phố và giữ yên lặng tại đền chùa. Nếu thuê kimono, nên chọn dép dễ đi vì nhiều đường dốc và lát đá.',
  },
  {
    test: /(osaka|ōsaka)/i,
    answer: 'Osaka phù hợp với ẩm thực và không khí sôi động: Dōtonbori, thành Osaka, Shinsekai, Umeda và khu vịnh. Takoyaki, okonomiyaki là hai món đặc trưng dễ thử. Osaka cũng là điểm đặt chân thuận tiện để đi Kyoto, Nara hoặc Kobe trong ngày.',
  },
  {
    test: /(núi phú sĩ|phú sĩ|fuji|kawaguchiko|hakone)/i,
    answer: 'Muốn ngắm núi Phú Sĩ, Kawaguchiko thường có góc nhìn hồ đẹp, còn Hakone kết hợp onsen và giao thông thuận tiện từ Tokyo. Khả năng nhìn rõ phụ thuộc thời tiết; sáng sớm thường thuận lợi hơn. Mùa leo núi chính thức chỉ kéo dài một phần mùa hè, vì vậy cần kiểm tra thông báo tuyến trước chuyến đi.',
  },
  {
    test: /(nara|hiroshima|hokkaido|okinawa)/i,
    answer: 'Nara nổi bật với Tōdai-ji và công viên hươu; Hiroshima có Công viên Tưởng niệm Hòa bình và Miyajima; Hokkaido hợp thiên nhiên, tuyết và ẩm thực; Okinawa có biển và văn hóa Ryukyu riêng. Mỗi vùng có khí hậu khác nhau rõ rệt, nên lịch trình và quần áo cần dựa theo vùng chứ không chỉ theo mùa chung của Nhật.',
  },
  {
    test: /(du lịch|đi nhật|địa điểm|tham quan|chơi ở đâu|lịch trình)/i,
    answer: 'Nếu lần đầu đến Nhật, lịch 7–10 ngày Tokyo–Kyoto–Osaka là dễ đi nhất; thêm Nara hoặc Hakone như chuyến trong ngày. Mùa xuân có hoa anh đào nhưng đông, mùa thu mát và lá đỏ, mùa hè có matsuri nhưng nóng ẩm, mùa đông hợp onsen và tuyết. Hãy gom điểm theo khu, chừa thời gian di chuyển và kiểm tra lịch nghỉ của từng nơi.',
  },
  {
    test: /(jr pass|shinkansen|tàu điện|di chuyển|suica|pasmo|ic card)/i,
    answer: 'Trong thành phố, thẻ IC như Suica/PASMO giúp đi tàu và xe buýt thuận tiện. Shinkansen phù hợp giữa các đô thị lớn; JR Pass toàn quốc không phải lúc nào cũng tiết kiệm, nên cộng giá từng chặng trước khi mua. Google Maps hữu ích, nhưng hãy chú ý đúng nhà ga, cửa ra và tên tuyến vì các ga lớn có nhiều khu.',
  },
  {
    test: /(sakura|hoa anh đào|lá đỏ|mùa nào|thời tiết)/i,
    answer: 'Hoa anh đào thường nở theo hướng nam lên bắc và ngày cụ thể thay đổi mỗi năm; lá đỏ thường đi theo chiều ngược lại. Nhật trải dài nên thời tiết Hokkaido, Tokyo và Okinawa rất khác nhau. Trước khi đi, hãy xem dự báo theo đúng thành phố và mang đồ nhiều lớp để dễ điều chỉnh.',
  },
  {
    test: /(onsen|suối nước nóng|ryokan)/i,
    answer: 'Ở onsen, hãy tắm sạch trước khi xuống bể, không để khăn chạm nước và giữ yên lặng. Nhiều nơi có quy định riêng với hình xăm, nên kiểm tra trước hoặc tìm phòng tắm riêng. Tại ryokan, thường cởi giày ở lối vào và mặc yukata theo vạt trái phủ phải.',
  },
  {
    test: /(sushi|ramen|ẩm thực|món ăn|takoyaki|okonomiyaki)/i,
    answer: 'Ẩm thực Nhật thay đổi theo vùng: Tokyo có sushi kiểu Edomae, Osaka nổi tiếng takoyaki và okonomiyaki, Hokkaido mạnh về hải sản và sữa, Kyoto có kaiseki và món đậu phụ. Khi ăn, không cắm đũa thẳng đứng vào cơm và không chuyền thức ăn từ đũa sang đũa.',
  },
  {
    test: /(văn hóa|phép lịch sự|cúi chào|tip|tiền boa|đền|chùa)/i,
    answer: 'Ở Nhật, xếp hàng, nói nhỏ trên phương tiện công cộng và mang rác theo đến nơi có thùng là những phép lịch sự quan trọng. Tiền boa thường không cần thiết. Tại đền/chùa, làm theo biển hướng dẫn, không chụp ở khu cấm và tránh chắn lối khi chụp ảnh.',
  },
  {
    test: /(matsuri|lễ hội|trà đạo|shinto|thần đạo|samurai)/i,
    answer: 'Matsuri là lễ hội địa phương, thường gắn với đền Thần đạo và có kiệu, biểu diễn, quầy đồ ăn. Trà đạo đề cao sự chú tâm, tôn trọng và tính mùa. Văn hóa samurai có ảnh hưởng lịch sử lớn, nhưng Nhật Bản hiện đại rất đa dạng; nên xem các khái niệm này trong đúng bối cảnh thay vì coi là toàn bộ văn hóa Nhật.',
  },
  {
    test: /(bạn là ai|ori là ai|chatbot|làm được gì|giúp gì)/i,
    answer: 'Mình là Ori, chatbot của JAPANO. Mình có thể tư vấn sản phẩm thật trong shop, giá, size, phối đồ, thử đồ, ưu đãi và đơn hàng; ngoài ra còn giải đáp về trang phục truyền thống, thời trang đường phố, văn hóa, ẩm thực, di chuyển và địa điểm du lịch Nhật Bản. Bạn cứ hỏi tự nhiên, ví dụ “đi Kyoto 3 ngày nên mặc gì?”.',
  },
  {
    test: /(cảm ơn|thank|ok rồi|hiểu rồi)/i,
    answer: 'Không có gì, Ori luôn ở đây nhé. Bạn muốn hỏi tiếp về sản phẩm, phối đồ hay lên ý tưởng cho một chuyến đi Nhật đều được.',
  },
];

function japanKnowledgeAnswer(message) {
  const text = String(message || '').trim();
  if (!text) return null;
  const topic = TOPICS.find((item) => item.test.test(text));
  return topic ? topic.answer : null;
}

module.exports = { japanKnowledgeAnswer };
