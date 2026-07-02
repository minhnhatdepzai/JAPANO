import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  GestureResponderEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StableTextInput } from "../../components/StableTextInput";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Header } from "../../components/Header";
import { useApp } from "../../context/AppContext";
import { FontFamilyChoice, JapanoTheme, defaultTheme } from "../../data/themes";
import { animationPacks } from "../../data/animations";
import { fontFamily, radius, shadow } from "../../lib/styles";

const swatches = [
  "#2B211B",
  "#4A3A30",
  "#847267",
  "#A33A2F",
  "#B54862",
  "#566D4F",
  "#2F4A73",
  "#9D7844",
  "#111827",
];

const softSwatches = [
  "#F7EFE3",
  "#FFFDF7",
  "#FFF1F4",
  "#F2F4E8",
  "#EFECE4",
  "#F8EEDC",
  "#E7D6C4",
  "#D9C58B",
];

const primarySwatches = [
  "#A33A2F",
  "#B54862",
  "#566D4F",
  "#2F4A73",
  "#9D7844",
  "#4E6F75",
  "#D8A85A",
  "#263B5E",
];

const fontChoices: Array<{ id: FontFamilyChoice; label: string; sample: string }> = [
  { id: "system", label: "System", sample: "Aa" },
  { id: "serif", label: "Serif", sample: "Aa" },
  { id: "mono", label: "Mono", sample: "Aa" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function SliderControl({
  label,
  value,
  min = 0.75,
  max = 1.7,
  onChange,
  sample,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  sample: string;
}) {
  const { theme } = useApp();
  const [trackWidth, setTrackWidth] = useState(1);
  const safeValue = clamp(Number(value || 1), min, max);
  const progress = (safeValue - min) / (max - min);

  const updateFromX = (x: number) => {
    const nextProgress = clamp(x / Math.max(trackWidth, 1), 0, 1);
    const next = min + nextProgress * (max - min);
    onChange(Number(next.toFixed(2)));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event: GestureResponderEvent) => updateFromX(event.nativeEvent.locationX),
      onPanResponderMove: (event: GestureResponderEvent) => updateFromX(event.nativeEvent.locationX),
    }),
  ).current;

  return (
    <View style={[styles.sliderBox, { backgroundColor: theme.background, borderColor: theme.border }]}> 
      <View style={styles.sliderHead}>
        <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
        <Text style={[styles.sliderValue, { color: theme.primary }]}>{Math.round(safeValue * 100)}%</Text>
      </View>
      <View
        {...pan.panHandlers}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        style={[styles.sliderTrack, { backgroundColor: theme.border }]}
      >
        <View style={[styles.sliderFill, { width: `${progress * 100}%`, backgroundColor: theme.primary }]} />
        <View style={[styles.sliderThumb, { left: `${progress * 100}%`, backgroundColor: theme.card, borderColor: theme.primary }]} />
      </View>
      <View style={styles.sliderScaleRow}>
        <Text style={[styles.sliderScale, { color: theme.muted }]}>Nhỏ</Text>
        <Text style={[styles.sliderScale, { color: theme.muted }]}>Vừa</Text>
        <Text style={[styles.sliderScale, { color: theme.muted }]}>To</Text>
      </View>
      <Text style={[styles.sampleText, { color: theme.text, fontSize: 15 * safeValue }]}>{sample}</Text>
    </View>
  );
}

function FontChoiceControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: FontFamilyChoice;
  onChange: (value: FontFamilyChoice) => void;
}) {
  const { theme } = useApp();
  const activeValue = value || theme.fontFamily || "system";

  return (
    <View style={styles.fontChoiceBox}>
      <Text style={[styles.label, { color: theme.muted }]}>{label}</Text>
      <View style={styles.optionRow}>
        {fontChoices.map((font) => {
          const active = activeValue === font.id;
          return (
            <Pressable
              key={`${label}-${font.id}`}
              onPress={() => onChange(font.id)}
              style={[
                styles.option,
                {
                  backgroundColor: active ? theme.primary : theme.background,
                  borderColor: active ? theme.primary : theme.border,
                },
              ]}
            >
              <Text
                style={{
                  color: active ? theme.background : theme.text,
                  fontFamily: fontFamily({ ...theme, fontFamily: font.id }),
                  fontWeight: "900",
                }}
              >
                {font.label} · {font.sample}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const { theme, themes, setTheme, updateTheme, importTheme, user } = useApp();
  const [themeUrl, setThemeUrl] = useState("");
  const previewTheme = useMemo(
    () => ({
      ...defaultTheme,
      ...theme,
      smallFontScale: theme.smallFontScale || theme.fontScale || 1,
      largeFontScale: theme.largeFontScale || theme.fontScale || 1,
      smallTextColor: theme.smallTextColor || theme.muted,
      largeTextColor: theme.largeTextColor || theme.heading,
      smallFontFamily: theme.smallFontFamily || theme.fontFamily,
      largeFontFamily: theme.largeFontFamily || theme.fontFamily,
    }),
    [theme],
  );

  const importThemeFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets[0]) return;
      const text = await FileSystem.readAsStringAsync(result.assets[0].uri);
      importTheme(JSON.parse(text));
      Alert.alert("Đã nhập giao diện", "Theme JSON đã được áp dụng.");
    } catch (e: any) {
      Alert.alert(
        "Không đọc được theme",
        e?.message || "File JSON không hợp lệ.",
      );
    }
  };

  const importThemeFromUrl = async () => {
    try {
      if (!themeUrl.trim()) return;
      const res = await fetch(themeUrl.trim());
      const json = await res.json();
      importTheme(json);
      setThemeUrl("");
      Alert.alert("Đã tải giao diện", "Theme từ link đã được áp dụng.");
    } catch (e: any) {
      Alert.alert(
        "Không tải được theme",
        e?.message || "Link JSON không hợp lệ hoặc bị chặn CORS.",
      );
    }
  };

  const ThemePreview = ({ item }: { item: JapanoTheme }) => (
    <Pressable
      onPress={() => setTheme({ ...defaultTheme, ...item })}
      style={[
        styles.themeCard,
        {
          backgroundColor: item.card,
          borderColor: theme.id === item.id ? item.primary : item.border,
        },
      ]}
    >
      <View style={styles.paletteRow}>
        {[item.primary, item.secondary, item.accent, item.background].map(
          (c) => (
            <View key={c} style={[styles.dot, { backgroundColor: c }]} />
          ),
        )}
      </View>
      <Text
        style={[
          styles.themeName,
          { color: item.heading, fontFamily: fontFamily(item) },
        ]}
      >
        {item.name}
      </Text>
      <Text style={{ color: item.muted, fontSize: 12 }}>
        {item.style} · {item.fontFamily}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Header
        title="Cài đặt giao diện"
        subtitle="Kéo thanh chữ nhỏ/chữ lớn để phóng to thu nhỏ tự do, không còn set cứng theo nút %."
      />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="handled"
      >
        {user?.role === "admin" || user?.isAdmin ? (
          <Pressable
            onPress={() => router.push("/admin")}
            style={[
              styles.adminShortcut,
              { backgroundColor: theme.primary, borderColor: theme.primary },
              shadow(theme),
            ]}
          >
            <Feather name="shield" size={20} color={theme.background} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.adminShortcutTitle, { color: theme.background }]}>Trang Admin</Text>
              <Text style={[styles.adminShortcutText, { color: theme.background }]}>Mở quản trị user, quyền admin và database ERD</Text>
            </View>
            <Feather name="chevron-right" size={22} color={theme.background} />
          </Pressable>
        ) : null}

        <Text
          style={[
            styles.sectionTitle,
            { color: theme.heading, fontFamily: fontFamily(theme) },
          ]}
        >
          Giao diện có sẵn
        </Text>
        <Pressable
          onPress={() => setTheme(defaultTheme)}
          style={[
            styles.resetDefault,
            { backgroundColor: theme.card, borderColor: theme.primary },
            shadow(theme),
          ]}
        >
          <Feather name="sun" size={18} color={theme.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.resetTitle, { color: theme.heading }]}>Đặt về giao diện mặc định</Text>
            <Text style={[styles.resetText, { color: theme.muted }]}>Washi Edo Sáng · sáng, cổ điển Nhật Bản, dễ đọc trên mobile.</Text>
          </View>
        </Pressable>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          contentContainerStyle={{ gap: 12 }}
        >
          {themes.map((item) => (
            <ThemePreview key={item.id} item={item} />
          ))}
        </ScrollView>

        <View
          style={[
            styles.panel,
            { backgroundColor: theme.card, borderColor: theme.border },
            shadow(theme),
          ]}
        >
          <View style={styles.panelHeader}>
            <Feather name="type" size={20} color={theme.primary} />
            <Text
              style={[
                styles.panelTitle,
                { color: theme.heading, fontFamily: fontFamily(theme) },
              ]}
            >
              Chữ hiển thị
            </Text>
          </View>
          <Text style={[styles.label, { color: theme.muted }]}>Màu chữ thường</Text>
          <View style={styles.swatches}>
            {swatches.map((c) => (
              <Pressable
                key={`text-${c}`}
                onPress={() => updateTheme({ text: c })}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: c,
                    borderColor: theme.text === c ? theme.primary : theme.border,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.label, { color: theme.muted }]}>Màu chữ lớn / tiêu đề toàn app</Text>
          <View style={styles.swatches}>
            {swatches.map((c) => (
              <Pressable
                key={`heading-${c}`}
                onPress={() => updateTheme({ heading: c, largeTextColor: c })}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: c,
                    borderColor: (previewTheme.largeTextColor || theme.heading) === c ? theme.primary : theme.border,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.label, { color: theme.muted }]}>Màu chữ nhỏ / nhãn phụ toàn app</Text>
          <View style={styles.swatches}>
            {swatches.map((c) => (
              <Pressable
                key={`muted-${c}`}
                onPress={() => updateTheme({ muted: c, smallTextColor: c })}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: c,
                    borderColor: (previewTheme.smallTextColor || theme.muted) === c ? theme.primary : theme.border,
                  },
                ]}
              />
            ))}
          </View>

          <Text style={[styles.label, { color: theme.muted }]}>Màu thương hiệu / nút chính</Text>
          <View style={styles.swatches}>
            {primarySwatches.map((c) => (
              <Pressable
                key={`primary-${c}`}
                onPress={() => updateTheme({ primary: c })}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: c,
                    borderColor: theme.primary === c ? theme.heading : theme.border,
                  },
                ]}
              />
            ))}
          </View>

          <Text style={[styles.label, { color: theme.muted }]}>Màu nền</Text>
          <View style={styles.swatches}>
            {softSwatches.map((c) => (
              <Pressable
                key={`background-${c}`}
                onPress={() => updateTheme({ background: c })}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: c,
                    borderColor: theme.background === c ? theme.primary : theme.border,
                  },
                ]}
              />
            ))}
          </View>

          <Text style={[styles.label, { color: theme.muted }]}>Màu thẻ / panel</Text>
          <View style={styles.swatches}>
            {softSwatches.map((c) => (
              <Pressable
                key={`card-${c}`}
                onPress={() => updateTheme({ card: c })}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: c,
                    borderColor: theme.card === c ? theme.primary : theme.border,
                  },
                ]}
              />
            ))}
          </View>

          <SliderControl
            label="Kéo cỡ chữ nhỏ"
            value={previewTheme.smallFontScale}
            onChange={(smallFontScale) => updateTheme({ smallFontScale, fontScale: 1 })}
            sample="Chữ nhỏ, mô tả, nhãn phụ sẽ đổi theo thanh này."
          />
          <SliderControl
            label="Kéo cỡ chữ lớn"
            value={previewTheme.largeFontScale}
            onChange={(largeFontScale) => updateTheme({ largeFontScale, fontScale: 1 })}
            sample="Tiêu đề lớn sẽ phóng to hoặc thu nhỏ theo thanh này."
          />

          <FontChoiceControl
            label="Kiểu chữ thường toàn app"
            value={previewTheme.fontFamily}
            onChange={(fontFamily) => updateTheme({ fontFamily })}
          />
          <FontChoiceControl
            label="Kiểu chữ nhỏ toàn app"
            value={previewTheme.smallFontFamily}
            onChange={(smallFontFamily) => updateTheme({ smallFontFamily })}
          />
          <FontChoiceControl
            label="Kiểu chữ lớn toàn app"
            value={previewTheme.largeFontFamily}
            onChange={(largeFontFamily) => updateTheme({ largeFontFamily })}
          />
          <View style={[styles.typePreview, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.previewSmall, { color: previewTheme.smallTextColor, fontFamily: fontFamily({ ...theme, fontFamily: previewTheme.smallFontFamily }) }]}>Mẫu chữ nhỏ: mô tả, nhãn, ghi chú sẽ đổi trên toàn app.</Text>
            <Text style={[styles.previewNormal, { color: theme.text, fontFamily: fontFamily(theme) }]}>Mẫu chữ thường: nội dung sản phẩm, thông tin tài khoản, thanh toán.</Text>
            <Text style={[styles.previewLarge, { color: previewTheme.largeTextColor, fontFamily: fontFamily({ ...theme, fontFamily: previewTheme.largeFontFamily }) }]}>Mẫu chữ lớn: tiêu đề và heading.</Text>
          </View>
        </View>

        <View
          style={[
            styles.panel,
            { backgroundColor: theme.card, borderColor: theme.border },
            shadow(theme),
          ]}
        >
          <Text
            style={[
              styles.panelTitle,
              { color: theme.heading, fontFamily: fontFamily(theme) },
            ]}
          >
            Phong cách giao diện
          </Text>
          <View style={styles.optionRow}>
            {(["classic", "editorial", "minimal", "glass"] as const).map(
              (style) => (
                <Pressable
                  key={style}
                  onPress={() => updateTheme({ style })}
                  style={[
                    styles.option,
                    {
                      backgroundColor: theme.style === style ? theme.primary : theme.background,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: theme.style === style ? theme.background : theme.text,
                      fontWeight: "900",
                    }}
                  >
                    {style}
                  </Text>
                </Pressable>
              ),
            )}
          </View>
        </View>

        <View
          style={[
            styles.panel,
            { backgroundColor: theme.card, borderColor: theme.border },
            shadow(theme),
          ]}
        >
          <View style={styles.panelHeader}>
            <Feather name="zap" size={20} color={theme.primary} />
            <Text
              style={[
                styles.panelTitle,
                { color: theme.heading, fontFamily: fontFamily(theme) },
              ]}
            >
              Animation dịp lễ
            </Text>
          </View>
          <Text style={[styles.hint, { color: theme.muted }]}>Chọn hiệu ứng bay trên toàn app. Mặc định Auto sẽ tự đổi: 30/4, 2/9 là cờ bay; tháng 1-2/Tết là lì xì; Noel là tuyết; 1/6 là bong bóng.</Text>
          <View style={styles.animationGrid}>
            {animationPacks.map((pack) => {
              const active = (theme.animationPack || "auto") === pack.id;
              return (
                <Pressable
                  key={pack.id}
                  onPress={() => updateTheme({ animationPack: pack.id })}
                  style={[
                    styles.animationCard,
                    {
                      backgroundColor: active ? theme.primary : theme.background,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <Text style={styles.animationGlyphs}>{pack.glyphs.slice(0, 4).join(" ")}</Text>
                  <Text numberOfLines={1} style={[styles.animationName, { color: active ? theme.background : theme.heading }]}>{pack.name}</Text>
                  <Text numberOfLines={2} style={[styles.animationDesc, { color: active ? theme.background : theme.muted }]}>{pack.description}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.panel,
            { backgroundColor: theme.card, borderColor: theme.border },
            shadow(theme),
          ]}
        >
          <View style={styles.panelHeader}>
            <Feather name="file-text" size={20} color={theme.primary} />
            <Text
              style={[
                styles.panelTitle,
                { color: theme.heading, fontFamily: fontFamily(theme) },
              ]}
            >
              Nhập giao diện
            </Text>
          </View>
          <Pressable onPress={importThemeFile} style={[styles.importBtn, { borderColor: theme.primary }]}> 
            <Feather name="file-text" size={18} color={theme.primary} />
            <Text style={[styles.importText, { color: theme.primary }]}>Upload theme JSON từ máy</Text>
          </Pressable>
          <StableTextInput
            value={themeUrl}
            blurOnSubmit={false}
            autoCorrect={false}
            onChangeText={setThemeUrl}
            placeholder="Dán link theme JSON..."
            placeholderTextColor={theme.muted}
            style={[
              styles.urlInput,
              {
                color: theme.text,
                borderColor: theme.border,
                backgroundColor: theme.background,
              },
            ]}
          />
          <Pressable onPress={importThemeFromUrl} style={[styles.importBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]}> 
            <Feather name="download" size={18} color={theme.background} />
            <Text style={[styles.importText, { color: theme.background }]}>Tải giao diện từ link</Text>
          </Pressable>
          <Text style={[styles.hint, { color: theme.muted }]}>Format JSON: name, background, card, primary, secondary, accent, text, muted, border, heading, fontScale, smallFontScale, largeFontScale, smallTextColor, largeTextColor, fontFamily, smallFontFamily, largeFontFamily, style.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 120, gap: 16 },
  adminShortcut: { borderWidth: 1, borderRadius: 0, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  adminShortcutTitle: { fontSize: 16, fontWeight: "900" },
  adminShortcutText: { marginTop: 2, fontSize: 12, fontWeight: "700", opacity: 0.88 },
  resetDefault: {
    borderWidth: 1,
    borderRadius: 0,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  resetTitle: { fontWeight: "900" },
  resetText: { marginTop: 3, lineHeight: 18, fontWeight: "700" },
  sectionTitle: { fontSize: 23, fontWeight: "900" },
  themeCard: {
    width: 190,
    borderWidth: 2,
    borderRadius: 0,
    padding: 14,
    gap: 8,
  },
  paletteRow: { flexDirection: "row", gap: 6 },
  dot: { width: 24, height: 24, borderRadius: 0},
  themeName: { fontSize: 17, fontWeight: "900" },
  panel: { borderWidth: 1, borderRadius: 0, padding: 16, gap: 12 },
  panelHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  panelTitle: { fontSize: 20, fontWeight: "900" },
  label: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  swatch: { width: 42, height: 42, borderRadius: 0, borderWidth: 3 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fontChoiceBox: { gap: 8 },
  typePreview: { borderWidth: 1, borderRadius: 0, padding: 14, gap: 8 },
  previewSmall: { fontSize: 12, lineHeight: 18, fontWeight: "800" },
  previewNormal: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  previewLarge: { fontSize: 26, lineHeight: 32, fontWeight: "900" },
  sliderBox: { borderWidth: 1, borderRadius: 0, padding: 14, gap: 10 },
  sliderHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  sliderValue: { fontWeight: "900", fontSize: 13 },
  sliderTrack: { height: 12, borderRadius: 0, position: "relative", justifyContent: "center" },
  sliderFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 0},
  sliderThumb: { position: "absolute", top: -8, width: 28, height: 28, marginLeft: -14, borderRadius: 0, borderWidth: 3 },
  sliderScaleRow: { flexDirection: "row", justifyContent: "space-between" },
  sliderScale: { fontSize: 11, fontWeight: "800" },
  sampleText: { lineHeight: 24, fontWeight: "800" },
  importBtn: {
    minHeight: 48,
    borderRadius: 0,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  importText: { fontWeight: "900" },
  urlInput: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 0,
    paddingHorizontal: 14,
  },
  hint: { fontSize: 12, lineHeight: 18 },
  animationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  animationCard: {
    width: "48%",
    minHeight: 126,
    borderWidth: 1,
    borderRadius: 0,
    padding: 10,
    gap: 6,
  },
  animationGlyphs: { fontSize: 22 },
  animationName: { fontSize: 13, fontWeight: "900" },
  animationDesc: { fontSize: 11, lineHeight: 15 },
});
