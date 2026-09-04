// Bảng địa điểm dùng cho ghép ảnh phong cảnh.
//
// Vì sao backend giữ bảng riêng thay vì nhận URL từ app: nếu client gửi lên
// "ảnh nền ở địa chỉ này", máy chủ trở thành một proxy tải bất kỳ URL nào —
// tức là một lỗ SSRF. Ở đây client chỉ gửi TÊN địa điểm; địa chỉ ảnh do máy chủ
// tự tra trong bảng này.
//
// Bảng phải khớp với mobile/lib/japanSpots.ts. test/japan-scene.test.js đọc
// thẳng file TypeScript đó và so từng dòng, nên hai bên không thể lệch nhau mà
// không làm đỏ bài kiểm tra.
const SCENE_BACKGROUNDS = Object.freeze([
  { place: "Rừng tre Arashiyama", prefecture: "Kyoto", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Bamboo_Grove%2C_Arashiyama%2C_Kyoto%2C_Japan.jpg/960px-Bamboo_Grove%2C_Arashiyama%2C_Kyoto%2C_Japan.jpg", sourceLabel: "Kyoto City Official Travel Guide", sourceUrl: "https://kyoto.travel/en/other_attractions/119.html" },
  { place: "Đền Fushimi Inari", prefecture: "Kyoto", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine%2C_Kyoto%2C_Japan.jpg/960px-Torii_path_with_lantern_at_Fushimi_Inari_Taisha_Shrine%2C_Kyoto%2C_Japan.jpg", sourceLabel: "Kyoto City Official Travel Guide", sourceUrl: "https://kyoto.travel/en/destinations/fushimi-inaritaisha-shrine/" },
  { place: "Phố cổ Gion", prefecture: "Kyoto", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/150124_Gion_Kyoto_Japan01s3.jpg/960px-150124_Gion_Kyoto_Japan01s3.jpg", sourceLabel: "Kyoto City Official Travel Guide", sourceUrl: "https://kyoto.travel/en/see-and-do/gion.html" },
  { place: "Hồ Kawaguchi", prefecture: "Yamanashi", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/KawaguchiKo.jpg/960px-KawaguchiKo.jpg", sourceLabel: "Fujikawaguchiko Tourism", sourceUrl: "https://fujisan.ne.jp/en/" },
  { place: "Công viên Nara", prefecture: "Nara", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Nara_Park_-_panoramio_%282%29.jpg/960px-Nara_Park_-_panoramio_%282%29.jpg", sourceLabel: "Nara Park official guide", sourceUrl: "https://www3.pref.nara.jp/park/" },
  { place: "Đài quan sát Shibuya", prefecture: "Tokyo", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/SHIBUYA_SCRAMBLE_SQUARE_East_Tower.jpg/960px-SHIBUYA_SCRAMBLE_SQUARE_East_Tower.jpg", sourceLabel: "SHIBUYA SKY official", sourceUrl: "https://www.shibuya-scramble-square.com/sky/" },
  { place: "Omoide Yokocho", prefecture: "Tokyo", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Entrance_to_Omoide_Yokocho.jpg/960px-Entrance_to_Omoide_Yokocho.jpg", sourceLabel: "GO TOKYO official guide", sourceUrl: "https://www.gotokyo.org/en/spot/73/index.html" },
  { place: "Kênh Otaru", prefecture: "Hokkaido", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Otaru_Canal_HDR1.jpg/960px-Otaru_Canal_HDR1.jpg", sourceLabel: "Otaru Tourism Association", sourceUrl: "https://www.visit-otaru-en.info/" },
  { place: "Làng Shirakawa-go", prefecture: "Gifu", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Ogi_Shirakawa-g%C5%8D%2C_Gifu%2C_Japan.jpg/960px-Ogi_Shirakawa-g%C5%8D%2C_Gifu%2C_Japan.jpg", sourceLabel: "UNESCO & Hiệp hội Du lịch Shirakawa-go", sourceUrl: "https://shirakawa-go.gr.jp/en/highlights/" },
  { place: "Công viên Hitachi Seaside", prefecture: "Ibaraki", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/2025_Hitachi_Seaside_Park_2.jpg/960px-2025_Hitachi_Seaside_Park_2.jpg", sourceLabel: "Hitachi Seaside Park official", sourceUrl: "https://hitachikaihin.jp/en/" },
  { place: "Lâu đài Osaka", prefecture: "Osaka", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Osaka_Castle_03bs3200.jpg/960px-Osaka_Castle_03bs3200.jpg", sourceLabel: "Osaka Castle official", sourceUrl: "https://www.osakacastle.net/foreign/english/" },
  { place: "Đền Itsukushima · Miyajima", prefecture: "Hiroshima", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Itsukushima_Shrine_Torii_Gate_%2813890465459%29.jpg/960px-Itsukushima_Shrine_Torii_Gate_%2813890465459%29.jpg", sourceLabel: "Miyajima Tourist Association", sourceUrl: "https://www.miyajima.or.jp/english/" },
  { place: "Vườn Kenrokuen", prefecture: "Ishikawa", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Stone_lantern_Kenrokuen.jpg/960px-Stone_lantern_Kenrokuen.jpg", sourceLabel: "Ishikawa Prefecture official", sourceUrl: "https://www.pref.ishikawa.jp/siro-niwa/kenrokuen/e/" },
  { place: "Công viên khỉ tuyết Jigokudani", prefecture: "Nagano", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Jigokudani_Hotspring_Gorakuen.JPG/960px-Jigokudani_Hotspring_Gorakuen.JPG", sourceLabel: "Jigokudani Yaen-koen official", sourceUrl: "https://jigokudani-yaenkoen.co.jp/" },
  { place: "Tượng Đại Phật Kamakura", prefecture: "Kanagawa", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/230128_Kamakura_Daibutsu_Japan04s3.jpg/960px-230128_Kamakura_Daibutsu_Japan04s3.jpg", sourceLabel: "Kōtoku-in official", sourceUrl: "https://www.kotoku-in.jp/en/" },
  { place: "Công viên Ōdōri", prefecture: "Hokkaido", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0d/Hokkaido_Sapporo_Odori_Park.jpg/960px-Hokkaido_Sapporo_Odori_Park.jpg", sourceLabel: "Odori Park official", sourceUrl: "https://odori-park.jp/en/" },
  { place: "Lâu đài Hirosaki", prefecture: "Aomori", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Hirosaki-castle_Aomori_with_Sakura_blossoms.jpg/960px-Hirosaki-castle_Aomori_with_Sakura_blossoms.jpg", sourceLabel: "Hirosaki Park official", sourceUrl: "https://www.hirosakipark.jp/" },
  { place: "Suối nước nóng Dōgo Onsen", prefecture: "Ehime", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Dogo_onsen_honkan_long_exposure.jpg/960px-Dogo_onsen_honkan_long_exposure.jpg", sourceLabel: "Dogo Onsen official", sourceUrl: "https://www.dogo.jp/en/" },
  { place: "Thuỷ cung Churaumi", prefecture: "Okinawa", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Okinawa_Aquarium.jpg/960px-Okinawa_Aquarium.jpg", sourceLabel: "Okinawa Churaumi Aquarium official", sourceUrl: "https://churaumi.okinawa/en/" },
  { place: "Suối nước nóng Beppu", prefecture: "Oita", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Umi_Jigoku_October_2011_02.jpg/960px-Umi_Jigoku_October_2011_02.jpg", sourceLabel: "Beppu City official", sourceUrl: "https://www.city.beppu.oita.jp/" },
  { place: "Đảo nghệ thuật Naoshima", prefecture: "Kagawa", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Naoshima_%287046724589%29.jpg/960px-Naoshima_%287046724589%29.jpg", sourceLabel: "JNTO & Benesse Art Site Naoshima", sourceUrl: "https://www.japan.travel/en/spot/220/" },
  { place: "Núi thiêng Koyasan", prefecture: "Wakayama", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Danj%C3%B4-garan_%28Wakayama_K%C5%8Dyasan%29_Temple_hdsr_S5_tr02.jpg/960px-Danj%C3%B4-garan_%28Wakayama_K%C5%8Dyasan%29_Temple_hdsr_S5_tr02.jpg", sourceLabel: "Visit Wakayama (trang du lịch chính thức của tỉnh)", sourceUrl: "https://visitwakayama.jp/en/attractions/detail_481.html" },
  { place: "Hẻm núi Takachiho", prefecture: "Miyazaki", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Takachiho_Gorge_%2852132194587%29.jpg/960px-Takachiho_Gorge_%2852132194587%29.jpg", sourceLabel: "Visit Miyazaki (trang du lịch chính thức của tỉnh)", sourceUrl: "https://www.kanko-miyazaki.jp/en/sightseeing/1001" },
  { place: "Phố cổ Kurashiki Bikan", prefecture: "Okayama", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Kurashiki_Bikan_historical_quarter_20190324.jpg/960px-Kurashiki_Bikan_historical_quarter_20190324.jpg", sourceLabel: "Okayama Prefecture Official Tourism Guide", sourceUrl: "https://www.okayama-japan.jp/en/spot/10736" },
  { place: "Suối nước nóng Ginzan", prefecture: "Yamagata", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/Night_in_Ginzan_Onsen_town_January_2022_A.jpg/960px-Night_in_Ginzan_Onsen_town_January_2022_A.jpg", sourceLabel: "JNTO & Tohoku official tourism", sourceUrl: "https://www.japan.travel/en/spot/1798/" },
  { place: "Lâu đài Himeji", prefecture: "Hyogo", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Tenshu_of_Himeji_Castle_from_Sannomaru_Square_4.jpg/960px-Tenshu_of_Himeji_Castle_from_Sannomaru_Square_4.jpg", sourceLabel: "Himeji City official tourism", sourceUrl: "https://visit-himeji.com/en/sightseeing/himeji-castle/" },
  { place: "Chùa Sensō-ji · Asakusa", prefecture: "Tokyo", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Hozomon_%28main_gate%29%2C_Sensoji_Temple%2C_Asakusa%2C_Tokyo.jpg/960px-Hozomon_%28main_gate%29%2C_Sensoji_Temple%2C_Asakusa%2C_Tokyo.jpg", sourceLabel: "Sensō-ji official", sourceUrl: "https://www.senso-ji.jp/english/" },
  { place: "Vườn Okayama Kōrakuen", prefecture: "Okayama", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Okayama_Korakuen_01.jpg/960px-Okayama_Korakuen_01.jpg", sourceLabel: "Okayama Kōrakuen official", sourceUrl: "https://okayama-korakuen.jp/section/english/index.html" },
  { place: "Vườn Sengan-en", prefecture: "Kagoshima", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Sengan-en_%284549028031%29.jpg/960px-Sengan-en_%284549028031%29.jpg", sourceLabel: "Kagoshima City official tourism", sourceUrl: "https://www.kagoshima-yokanavi.jp/en/spot/10006" },
  { place: "Phố samurai Kakunodate", prefecture: "Akita", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Bukeyashiki_Street_in_Kakunodate_20161106b.jpg/960px-Bukeyashiki_Street_in_Kakunodate_20161106b.jpg", sourceLabel: "Tazawako Kakunodate official tourism", sourceUrl: "https://tazawako-kakunodate.com/en/spots/5996/" },
  { place: "Cánh đồng hoa Farm Tomita", prefecture: "Hokkaido", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Farm_Tomita_20140812-7.jpg/960px-Farm_Tomita_20140812-7.jpg", sourceLabel: "Farm Tomita official", sourceUrl: "https://www.farm-tomita.co.jp/en/" },
  { place: "Phố trà Higashi Chaya", prefecture: "Ishikawa", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Higashi_Chaya_district%2C_Kanazawa_%283810704024%29.jpg/960px-Higashi_Chaya_district%2C_Kanazawa_%283810704024%29.jpg", sourceLabel: "Kanazawa City official tourism", sourceUrl: "https://visitkanazawa.jp/en/attractions/detail_10212.html" },
  { place: "Công viên Moerenuma", prefecture: "Hokkaido", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Avenue_in_Moerenuma_Park.jpg/960px-Avenue_in_Moerenuma_Park.jpg", sourceLabel: "Moerenuma Park official", sourceUrl: "https://moerenumapark.jp/english/" },
  { place: "Công viên hoa Ashikaga", prefecture: "Tochigi", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Japanese_wisteria%2C_Ashikaga_Flower_Park_14.jpg/960px-Japanese_wisteria%2C_Ashikaga_Flower_Park_14.jpg", sourceLabel: "Ashikaga Flower Park official", sourceUrl: "https://www.ashikaga.co.jp/english/" },
  { place: "Vườn Shinjuku Gyoen", prefecture: "Tokyo", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Shinjuku_Gyoen_National_Garden_and_NTT_DoCoMo_Yoyogi_Building%2C_Tokyo%2C_Japan.jpg/960px-Shinjuku_Gyoen_National_Garden_and_NTT_DoCoMo_Yoyogi_Building%2C_Tokyo%2C_Japan.jpg", sourceLabel: "Ministry of the Environment, Japan", sourceUrl: "https://www.env.go.jp/garden/shinjukugyoen/english/" },
  { place: "Đền Meiji Jingu", prefecture: "Tokyo", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Meiji-jingu_Torii_2.jpg/960px-Meiji-jingu_Torii_2.jpg", sourceLabel: "Meiji Jingu official", sourceUrl: "https://www.meijijingu.or.jp/en/" },
  { place: "Cầu Kintai-kyō", prefecture: "Yamaguchi", photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Iwakuni%2C_ponte_kintai-kyo%2C_00.jpg/960px-Iwakuni%2C_ponte_kintai-kyo%2C_00.jpg", sourceLabel: "Iwakuni City Tourism", sourceUrl: "https://kintaikyo.iwakuni-city.net/" },
]);

const KEY = (place, prefecture) => `${String(place || '').trim()}::${String(prefecture || '').trim()}`;
const BY_KEY = new Map(SCENE_BACKGROUNDS.map((row) => [KEY(row.place, row.prefecture), row]));

/** Tra địa điểm theo tên. Trả null nếu không có — KHÔNG đoán gần đúng. */
function findSceneBackground(place, prefecture) {
  return BY_KEY.get(KEY(place, prefecture)) || null;
}

function listSceneBackgrounds() {
  return SCENE_BACKGROUNDS.map(({ place, prefecture, sourceLabel, sourceUrl }) => ({
    place, prefecture, sourceLabel, sourceUrl,
  }));
}

module.exports = { SCENE_BACKGROUNDS, findSceneBackground, listSceneBackgrounds };
