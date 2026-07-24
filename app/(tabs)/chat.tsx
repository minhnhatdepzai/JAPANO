import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { Header } from "../../components/Header";
import { SafeImage } from "../../components/SafeImage";
import { StableTextInput } from "../../components/StableTextInput";
import { useApp } from "../../context/AppContext";
import { getOccasionProducts, getSpecialRecommendation } from "../../data/occasions";
import { products } from "../../data/catalog";
import {
  API_URL,
  analyzeOutfitMedia,
  createChatImage,
  sendChatMessage,
  uploadChatFile,
} from "../../lib/api";
import { fontFamily, radius, shadow } from "../../lib/styles";

type Attachment = {
  uri: string;
  name: string;
  type: string;
  kind: "image" | "video" | "file";
};

type Message = {
  id: string;
  role: "user" | "bot";
  text: string;
  attachments?: Attachment[];
  images?: string[];
  productIds?: string[];
};

const MAX_CHAT_MEMORY_MESSAGES = 21;

const quick = [
  "Dựa trên quiz hằng ngày và số đo của tôi, hôm nay nên mặc gì?",
  "Tôi gửi ảnh rồi, tư vấn tôi mặc gì hợp",
  "Tạo cho tôi một set đi học/đi làm và gợi ý size",
  "Lưu ý bộ sưu tập outfit của tôi rồi phối đồ đi chơi",
  "Tạo ảnh concept quà tặng cho dịp đặc biệt",
];

function isImageRequest(text: string) {
  return /(tạo ảnh|tao anh|vẽ ảnh|ve anh|generate image|create image|image generation|concept|poster|lookbook)/i.test(text);
}

function isOutfitRequest(text: string) {
  return /(mặc gì|phối|hợp|outfit|đồ gì|style|look|tư vấn)/i.test(text);
}

function emotionVi(value?: string) {
  const key = String(value || "neutral").toLowerCase();
  const map: Record<string, string> = {
    happy: "vui vẻ",
    sad: "buồn",
    angry: "cá tính/mạnh",
    surprise: "bất ngờ/năng động",
    fear: "lo lắng/cần an toàn",
    disgust: "khó chịu",
    neutral: "trung tính",
  };
  return map[key] || key;
}

function ageVi(value?: string) {
  const key = String(value || "unknown");
  const map: Record<string, string> = {
    child: "trẻ em",
    teen: "thiếu niên",
    "young-adult": "người trẻ",
    adult: "người lớn",
    senior: "trung niên/cao tuổi",
    unknown: "chưa rõ",
  };
  return map[key] || key;
}

function toLocalProductIds(items: any[] = []) {
  const ids = new Set(products.map((p) => String(p.id)));
  return items
    .map((p) => String(p?.id || p?._id || ""))
    .filter((id) => id && ids.has(id))
    .filter((id, index, arr) => arr.indexOf(id) === index)
    .slice(0, 8);
}

function productIdsFromVision(result: any) {
  return toLocalProductIds(result?.recommendation?.products || []);
}

function visionSummary(result: any) {
  const analysis = result?.analysis || {};
  const face = analysis.face || {};
  const detector = analysis.detector || {};
  const frames = analysis?.video?.framesAnalyzed;
  const confidence = face.emotionConfidence ? ` (${Math.round(Number(face.emotionConfidence))}%)` : "";
  return [
    `Emotion/Age model đã chạy: phát hiện ${Number(detector.faceCount || detector.personCount || 0)} khuôn mặt.`,
    `Age/Emotion: ${ageVi(face.ageGroup)}${face.ageEstimate ? ` (~${face.ageEstimate} tuổi)` : ""}, cảm xúc ${emotionVi(face.primaryEmotion)}${confidence}.`,
    frames ? `Video đã phân tích ${frames} frame.` : "",
    result?.recommendation?.reason ? `Lý do gợi ý: ${result.recommendation.reason}` : "",
  ].filter(Boolean).join("\n");
}

function trimChatMemory(next: Message[]) {
  return next.slice(-MAX_CHAT_MEMORY_MESSAGES);
}

function buildChatHistory(messages: Message[], currentText?: string) {
  const base = currentText ? [...messages, { id: `current-${Date.now()}`, role: "user" as const, text: currentText }] : messages;
  return base.slice(-20).map((m) => ({ role: m.role === "bot" ? "assistant" : "user", text: m.text })).filter((m) => m.text);
}

function localOutfitFallback(hasImage: boolean, vision?: any) {
  if (vision?.analysis) {
    const face = vision.analysis.face || {};
    const detector = vision.analysis.detector || {};
    const confidence = face.emotionConfidence ? ` (${Math.round(Number(face.emotionConfidence))}%)` : "";
    return `Dựa trên phân tích emotion/age model gần nhất: phát hiện ${Number(detector.faceCount || detector.personCount || 0)} khuôn mặt, nhóm tuổi ${ageVi(face.ageGroup)}, cảm xúc ${emotionVi(face.primaryEmotion)}${confidence}. Tôi gợi ý outfit an toàn và dễ đẹp: áo tông kem/navy hoặc haori nhẹ, quần suông tối màu, giày trắng/nâu, thêm túi canvas hoặc phụ kiện đỏ Suoh để có điểm nhấn. Nếu bạn muốn nổi bật hơn, chọn một món màu đỏ/mận và giữ các món còn lại trung tính.`;
  }
  return hasImage
    ? "Dựa trên ảnh bạn gửi, tôi gợi ý bạn chọn outfit theo hướng gọn và cân bằng: áo khoác haori/áo sơ mi màu kem hoặc navy, quần suông tối màu, thêm túi canvas nhỏ. Nếu đi chơi hoặc chụp ảnh, có thể thêm phụ kiện đỏ Suoh để nổi bật nhưng không bị lòe loẹt."
    : "Bạn có thể gửi ảnh toàn thân hoặc ảnh trang phục hiện tại. Tôi sẽ tư vấn màu, form áo/quần và phụ kiện phù hợp hơn.";
}


export default function ChatScreen() {
  const { theme, user, generatedImages, addGeneratedImage, formatCurrency, addToCart } = useApp();
  const userId = user?.id || "guest";
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "hello",
      role: "bot",
      text: "Xin chào! Tôi là JAPANO Assistant. Gửi ảnh/video hoặc hỏi trực tiếp, tôi sẽ tư vấn phối đồ, size và sản phẩm phù hợp. Chat chỉ giữ ngữ cảnh gần nhất trong phiên.",
    },
  ]);
  const [draftText, setDraftText] = useState("");
  const [draftNonce, setDraftNonce] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [recentImage, setRecentImage] = useState<Attachment | null>(null);
  const [recentVision, setRecentVision] = useState<any | null>(null);
  const [lastQuestion, setLastQuestion] = useState("");
  const [composerNonce, setComposerNonce] = useState(0);


  const scrollRef = useRef<ScrollView>(null);
  const occasionShownRef = useRef<string | null>(null);

  const occasion = useMemo(
    () => getSpecialRecommendation(new Date(), user || undefined),
    [user?.birthday, JSON.stringify(user?.specialDates || [])],
  );
  const occasionProducts = getOccasionProducts(occasion);

  const append = (msg: Message) => setMessages((prev) => trimChatMemory([...prev, msg]));

  useEffect(() => {
    if (occasion && occasionShownRef.current !== occasion.key) {
      occasionShownRef.current = occasion.key;
      append({
        id: `occasion-${occasion.key}-${Date.now()}`,
        role: "bot",
        text: `${occasion.name} đang được ưu tiên. ${occasion.intro}\nLý do chọn: ${occasion.reason}`,
        productIds: occasion.productIds,
      });
    }
  }, [occasion?.key]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
  }, [messages.length, uploading]);


  const askAIFromVisionResult = async (vision: any, att: Attachment) => {
    const autoQuestion = att.kind === "video"
      ? "Tôi vừa gửi video. Hãy dùng kết quả emotion/age model để phân tích biểu cảm, độ tuổi và gợi ý outfit/sản phẩm phù hợp ngay."
      : "Tôi vừa gửi ảnh. Hãy dùng kết quả emotion/age model để phân tích biểu cảm, độ tuổi và gợi ý outfit/sản phẩm phù hợp ngay.";
    try {
      const data = await sendChatMessage({
        userId,
        message: autoQuestion,
        language: "Vietnamese",
        hasRecentImage: true,
        occasionKey: occasion?.key,
        visionAnalysis: vision?.analysis || null,
        visionRecommendation: vision?.recommendation || null,
        history: buildChatHistory(messages, autoQuestion),
      });
      const visionIds = productIdsFromVision(vision);
      append({
        id: `vision-ai-${Date.now()}`,
        role: "bot",
        text: data.message || localOutfitFallback(true, vision),
        productIds: (Array.isArray(data.productIds) && data.productIds.length ? data.productIds : visionIds.length ? visionIds : occasionProducts.map((p) => p.id)),
      });
    } catch (error: any) {
      const visionIds = productIdsFromVision(vision);
      append({
        id: `vision-ai-fallback-${Date.now()}`,
        role: "bot",
        text: localOutfitFallback(true, vision),
        productIds: visionIds.length ? visionIds : occasionProducts.map((p) => p.id),
      });
    }
  };

  const runVisionForAttachment = async (att: Attachment) => {
    if (att.kind !== "image" && att.kind !== "video") return null;
    append({
      id: `vision-start-${Date.now()}`,
      role: "bot",
      text: `${att.kind === "video" ? "Video" : "Ảnh"} đã nhận. Tôi đang phân tích tuổi/cảm xúc và chuẩn bị gợi ý outfit...`,
    });

    const result = await analyzeOutfitMedia(
      { uri: att.uri, name: att.name, type: att.type, kind: att.kind },
      userId,
      "",
    );
    setRecentVision(result);
    const ids = productIdsFromVision(result);
    append({
      id: `vision-done-${Date.now()}`,
      role: "bot",
      text: `Đã phân tích bằng emotion/age model:
${visionSummary(result)}

Tôi sẽ dùng kết quả này để gợi ý outfit ngay bên dưới.`,
      productIds: ids.length ? ids : occasionProducts.map((p) => p.id),
    });
    await askAIFromVisionResult(result, att);
    return result;
  };

  const addAttachmentMessage = async (att: Attachment) => {
    append({
      id: `u-file-${Date.now()}`,
      role: "user",
      text: `Đã gửi ${att.kind === "image" ? "ảnh" : att.kind === "video" ? "video" : "file"}: ${att.name}`,
      attachments: [att],
    });
    if (att.kind === "image" || att.kind === "video") setRecentImage(att);

    setUploading(true);
    try {
      // File được lưu lên Cloudinary qua backend; chatbot không lưu lịch sử hội thoại vào MongoDB.
      await uploadChatFile({ uri: att.uri, name: att.name, type: att.type }, userId).catch(() => null);

      if (att.kind === "image" || att.kind === "video") {
        await runVisionForAttachment(att);
      } else {
        append({
          id: `b-file-${Date.now()}`,
          role: "bot",
          text: "Tôi đã nhận file. Nếu bạn cần tư vấn phối đồ chính xác hơn, hãy gửi thêm ảnh hoặc video toàn thân.",
        });
      }
    } catch (error: any) {
      append({
        id: `b-file-error-${Date.now()}`,
        role: "bot",
        text: "File đã nhận nhưng Camera/Vision AI chưa phân tích được. Hãy kiểm tra backend, Python UTF-8 và model trong server/models rồi thử lại.",
      });
    } finally {
      setUploading(false);
      setComposerNonce((n) => n + 1);
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Cần quyền truy cập ảnh", "Hãy cho phép truy cập thư viện ảnh để gửi ảnh vào chatbot.");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.82, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await addAttachmentMessage({ uri: asset.uri, name: asset.fileName || `japano-image-${Date.now()}.jpg`, type: asset.mimeType || "image/jpeg", kind: "image" });
  };

  const takeCameraPhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return Alert.alert("Cần quyền camera", "Hãy cho phép camera để chụp ảnh đưa lên AI thử đồ / phối đồ.");
    const result = await ImagePicker.launchCameraAsync({ quality: 0.86, allowsEditing: false });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await addAttachmentMessage({ uri: asset.uri, name: asset.fileName || `camera-tryon-${Date.now()}.jpg`, type: asset.mimeType || "image/jpeg", kind: "image" });
  };

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
    if (result.canceled || !result.assets[0]) return;
    const file = result.assets[0];
    const isImage = file.mimeType?.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(file.name);
    const isVideo = file.mimeType?.startsWith("video/") || /\.(mp4|mov|m4v|webm)$/i.test(file.name);
    await addAttachmentMessage({
      uri: file.uri,
      name: file.name,
      type: file.mimeType || (isVideo ? "video/mp4" : isImage ? "image/jpeg" : "application/octet-stream"),
      kind: isVideo ? "video" : isImage ? "image" : "file",
    });
  };

  const pasteImage = async () => {
    try {
      const getImageAsync = (Clipboard as any).getImageAsync;
      if (typeof getImageAsync !== "function") {
        Alert.alert("Expo không hỗ trợ paste ảnh trực tiếp trên thiết bị này", "Bạn hãy dùng nút Ảnh hoặc Camera.");
        return;
      }
      const img = await getImageAsync({ format: "png" });
      if (!img?.data) return Alert.alert("Không thấy ảnh trong clipboard", "Hãy copy ảnh rồi bấm Dán ảnh, hoặc dùng nút Ảnh.");
      const uri = `${FileSystem.cacheDirectory}clipboard-${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(uri, img.data, { encoding: FileSystem.EncodingType.Base64 });
      await addAttachmentMessage({ uri, name: `clipboard-${Date.now()}.png`, type: "image/png", kind: "image" });
    } catch (error: any) {
      Alert.alert("Không thể dán ảnh", error?.message || "Trên mobile, paste ảnh phụ thuộc hệ điều hành. Hãy dùng nút Ảnh để ổn định hơn.");
    }
  };


  const send = async (override?: string) => {
    const text = String(override || "").trim();
    if (!text) return;
    setLastQuestion(text);
    append({ id: `u-${Date.now()}`, role: "user", text });
    setUploading(true);
    try {
      if (isImageRequest(text)) {
        const data = await createChatImage({ userId, prompt: text, language: "Vietnamese", hasRecentImage: Boolean(recentImage), occasionKey: occasion?.key, history: buildChatHistory(messages, text) });
        const urls = (data.images || []).map((img: any) => img.url).filter(Boolean);
        urls.forEach((url: string) => addGeneratedImage({ id: `${Date.now()}-${url}`, url, prompt: text, createdAt: Date.now() }));
        append({ id: `b-img-${Date.now()}`, role: "bot", text: data.message || "Tôi đã tạo ảnh concept cho bạn.", images: urls, productIds: occasion?.productIds });
      } else {
        const data = await sendChatMessage({
          userId,
          message: text,
          language: "Vietnamese",
          hasRecentImage: Boolean(recentImage || recentVision),
          occasionKey: occasion?.key,
          visionAnalysis: recentVision?.analysis || null,
          visionRecommendation: recentVision?.recommendation || null,
          history: buildChatHistory(messages, text),
        });
        let answer = data.message || "Tôi chưa trả lời được lúc này.";
        if (/chỉ hỗ trợ|ngoài.*bán hàng/i.test(answer) && isOutfitRequest(text)) {
          answer = localOutfitFallback(Boolean(recentImage), recentVision);
        }
        const visionIds = productIdsFromVision(recentVision);
        append({
          id: `b-${Date.now()}`,
          role: "bot",
          text: answer,
          productIds: (Array.isArray(data.productIds) && data.productIds.length ? data.productIds : visionIds.length ? visionIds : isOutfitRequest(text) ? occasionProducts.map((p) => p.id) : undefined),
        });
      }
    } catch (error: any) {
      const visionIds = productIdsFromVision(recentVision);
      const fallback = isOutfitRequest(text)
        ? localOutfitFallback(Boolean(recentImage), recentVision)
        : `Backend AI chưa phản hồi. JAPANO đang dùng chế độ tư vấn nhanh. Hãy kiểm tra npm run start-server, Ollama qwen2.5:7b và API URL hiện tại của app: ${API_URL}.`;
      append({ id: `b-error-${Date.now()}`, role: "bot", text: fallback, productIds: visionIds.length ? visionIds : isOutfitRequest(text) ? occasionProducts.map((p) => p.id) : undefined });
    } finally {
      setUploading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Header title="JAPANO Assistant" subtitle="Gửi ảnh/video hoặc hỏi JAPANO. Bot nhớ 10 tin gần nhất." />
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
      >
        {generatedImages.length ? (
          <View style={[styles.gallery, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.galleryTitle, { color: theme.heading, fontFamily: fontFamily(theme) }]}>Ảnh AI đã tạo</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 10 }}>
              {generatedImages.map((img, index) => (
                <SafeImage key={`generated-${String(img.id || img.url)}-${index}`} source={{ uri: img.url }} style={styles.galleryImage} resizeMode="contain" />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {messages.map((m) => {
          const mine = m.role === "user";
          const safeProductIds = Array.isArray(m.productIds) ? m.productIds.filter(Boolean).slice(0, 8) : [];
          return (
            <View key={m.id} style={[styles.bubbleRow, mine ? styles.mineRow : styles.botRow]}>
              <View style={[styles.bubble, mine ? { backgroundColor: theme.primary } : { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1 }, shadow(theme)]}>
                <Text style={[styles.bubbleText, { color: mine ? theme.background : theme.text }]}>{m.text}</Text>
                {m.attachments?.map((att, index) => (
                  <View key={`${att.uri}-${index}`} style={[styles.attachment, { backgroundColor: mine ? "rgba(255,255,255,0.22)" : theme.background, borderColor: theme.border }]}>
                    {att.kind === "image" ? <SafeImage source={{ uri: att.uri }} style={styles.attachmentImage} resizeMode="contain" /> : <Feather name={att.kind === "video" ? "film" : "file"} size={18} color={mine ? theme.background : theme.primary} />}
                    <Text numberOfLines={1} style={{ flex: 1, color: mine ? theme.background : theme.text, fontWeight: "700" }}>{att.name}</Text>
                  </View>
                ))}
                {m.images?.map((uri, index) => <SafeImage key={`message-image-${m.id}-${index}-${uri}`} source={{ uri }} style={styles.generatedImage} resizeMode="contain" />)}
                {safeProductIds.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ gap: 10, paddingTop: 10 }} keyboardShouldPersistTaps="always">
                    {safeProductIds.map((id, productIndex) => {
                      const p = products.find((item) => String(item.id) === String(id));
                      return p ? (
                        <ChatProductSuggestion
                          key={`chat-product-${m.id}-${String(id)}-${productIndex}`}
                          product={p}
                          theme={theme}
                          formatCurrency={formatCurrency}
                          onOpen={() => router.push(`/product/${p.id}`)}
                          onAdd={() => addToCart(p)}
                        />
                      ) : null;
                    })}
                  </ScrollView>
                ) : null}
              </View>
              {!mine ? (
                <View style={styles.askNextHint}>
                  <Text style={[styles.askNextHintText, { color: theme.muted }]}>Bạn có thể hỏi tiếp ngay bên dưới.</Text>
                </View>
              ) : null}
            </View>
          );
        })}
        {uploading ? <Text style={[styles.typing, { color: theme.primary }]}>JAPANO đang xử lý Vision/chat...</Text> : null}
      </ScrollView>

      <View style={[styles.quickWrap, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.quickList} keyboardShouldPersistTaps="always" keyboardDismissMode="none">
          {quick.map((q) => (
            <Pressable key={q} onPress={() => send(q)} style={[styles.quickChip, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text numberOfLines={1} style={{ color: theme.text, fontWeight: "800" }}>{q}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ChatComposer
          theme={theme}
          draftText={draftText}
          draftNonce={draftNonce}
          focusNonce={composerNonce}
          busy={uploading}
          canReload={Boolean(lastQuestion)}
          onReload={() => lastQuestion && send(lastQuestion)}
          onCamera={takeCameraPhoto}
          onImage={pickImage}
          onPasteImage={pasteImage}
          onFile={pickFile}
          onCreateImage={() => send("Tạo ảnh concept outfit JAPANO dựa trên phong cách tôi đang xem")}
          onSend={(text) => send(text)}
        />
        <Text style={[styles.notice, { color: theme.muted }]}>Ảnh/video lưu Cloudinary. Chat chỉ giữ ngữ cảnh gần nhất trong phiên.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

function ChatComposer({
  theme,
  draftText,
  draftNonce,
  focusNonce,
  busy,
  canReload,
  onReload,
  onCamera,
  onImage,
  onPasteImage,
  onFile,
  onCreateImage,
  onSend,
}: {
  theme: any;
  draftText: string;
  draftNonce: number;
  focusNonce: number;
  busy: boolean;
  canReload: boolean;
  onReload: () => void;
  onCamera: () => void;
  onImage: () => void;
  onPasteImage: () => void;
  onFile: () => void;
  onCreateImage: () => void;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    if (draftText) {
      setText(draftText);
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [draftText, draftNonce]);

  useEffect(() => {
    if (focusNonce > 0) {
      setTimeout(() => inputRef.current?.focus(), 180);
    }
  }, [focusNonce]);

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    setText("");
    setToolsOpen(false);
    onSend(value);
  };

  const runTool = (fn: () => void) => {
    setToolsOpen(false);
    fn();
  };

  return (
    <View style={[styles.inputCard, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
      <View style={styles.inputRow}>
        <Pressable onPress={() => setToolsOpen((v) => !v)} style={[styles.plusBtn, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Feather name={toolsOpen ? "x" : "plus"} size={22} color={theme.primary} />
        </Pressable>
        <StableTextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          multiline
          blurOnSubmit={false}
          autoCorrect={false}
          autoCapitalize="sentences"
          returnKeyType="default"
          textAlignVertical="top"
          placeholder={busy ? "AI đang xử lý... bạn vẫn có thể nhập tiếp" : "Hỏi phối đồ, size, sản phẩm..."}
          placeholderTextColor={theme.muted}
          style={[styles.input, { color: theme.text }]}
        />
        <Pressable onPress={submit} style={[styles.sendBtn, { backgroundColor: theme.primary, opacity: text.trim() ? 1 : 0.72 }]}>
          <Feather name="send" size={20} color={theme.background} />
        </Pressable>
      </View>

      {toolsOpen ? (
        <View style={styles.toolMenu}>
          <Pressable onPress={() => runTool(onCamera)} style={[styles.toolChip, { backgroundColor: theme.background, borderColor: theme.border }]}><Feather name="camera" size={17} color={theme.primary} /><Text style={[styles.toolText, { color: theme.primary }]}>Camera</Text></Pressable>
          <Pressable onPress={() => runTool(onImage)} style={[styles.toolChip, { backgroundColor: theme.background, borderColor: theme.border }]}><Feather name="image" size={17} color={theme.primary} /><Text style={[styles.toolText, { color: theme.primary }]}>Ảnh</Text></Pressable>
          <Pressable onPress={() => runTool(onPasteImage)} style={[styles.toolChip, { backgroundColor: theme.background, borderColor: theme.border }]}><Feather name="clipboard" size={17} color={theme.primary} /><Text style={[styles.toolText, { color: theme.primary }]}>Dán</Text></Pressable>
          <Pressable onPress={() => runTool(onFile)} style={[styles.toolChip, { backgroundColor: theme.background, borderColor: theme.border }]}><Feather name="file" size={17} color={theme.primary} /><Text style={[styles.toolText, { color: theme.primary }]}>File</Text></Pressable>
          <Pressable onPress={() => runTool(onCreateImage)} style={[styles.toolChip, { backgroundColor: theme.background, borderColor: theme.border }]}><Feather name="edit-3" size={17} color={theme.primary} /><Text style={[styles.toolText, { color: theme.primary }]}>Tạo ảnh</Text></Pressable>
          <Pressable onPress={() => runTool(onReload)} disabled={!canReload} style={[styles.toolChip, { backgroundColor: theme.background, borderColor: theme.border, opacity: canReload ? 1 : 0.35 }]}><Feather name="refresh-cw" size={17} color={theme.primary} /><Text style={[styles.toolText, { color: theme.primary }]}>Gửi lại</Text></Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ChatProductSuggestion({
  product,
  theme,
  formatCurrency,
  onOpen,
  onAdd,
}: {
  product: any;
  theme: any;
  formatCurrency: (value: number) => string;
  onOpen: () => void;
  onAdd: () => void;
}) {
  return (
    <Pressable onPress={onOpen} style={[styles.suggestionCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <SafeImage source={{ uri: product.image }} style={styles.suggestionImage} resizeMode="contain" />
      <View style={styles.suggestionInfo}>
        <Text numberOfLines={2} style={[styles.suggestionName, { color: theme.heading }]}>{product.name}</Text>
        <Text numberOfLines={1} style={[styles.suggestionPrice, { color: theme.primary }]}>{formatCurrency(product.price)}</Text>
      </View>
      <Pressable
        onPress={(event: any) => {
          event?.stopPropagation?.();
          onAdd();
        }}
        style={[styles.suggestionAdd, { backgroundColor: theme.primary }]}
      >
        <Feather name="plus" size={16} color={theme.background} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  messages: { flex: 1 },
  messageContent: { padding: 12, paddingBottom: 14, gap: 9, flexGrow: 1 },
  gallery: { borderWidth: 1, borderRadius: 0, padding: 10, gap: 8 },
  galleryTitle: { fontSize: 16, fontWeight: "900" },
  galleryImage: { width: 96, height: 96, borderRadius: 0},
  bubbleRow: { width: "100%" },
  mineRow: { alignItems: "flex-end" },
  botRow: { alignItems: "flex-start" },
  bubble: { maxWidth: "92%", borderRadius: 0, padding: 11, gap: 7 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  askNextHint: { paddingTop: 4, paddingLeft: 10, paddingBottom: 2 },
  askNextHintText: { fontSize: 11, fontWeight: "700" },
  suggestionCard: { width: 178, minHeight: 72, borderWidth: 1, borderRadius: 0, padding: 7, flexDirection: "row", alignItems: "center", gap: 8 },
  suggestionImage: { width: 48, height: 48, borderRadius: 0},
  suggestionInfo: { flex: 1, minWidth: 0 },
  suggestionName: { fontSize: 12, lineHeight: 16, fontWeight: "900" },
  suggestionPrice: { marginTop: 3, fontSize: 11, fontWeight: "900" },
  suggestionAdd: { width: 30, height: 30, borderRadius: 0, alignItems: "center", justifyContent: "center" },
  attachment: { borderWidth: 1, borderRadius: 0, padding: 7, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 190, maxWidth: 270 },
  attachmentImage: { width: 68, height: 68, borderRadius: 0},
  generatedImage: { marginTop: 8, width: 230, height: 230, borderRadius: 0},
  typing: { paddingHorizontal: 12, fontWeight: "900", fontSize: 12 },
  quickWrap: { borderTopWidth: 1, paddingHorizontal: 10, paddingTop: 7, paddingBottom: Platform.select({ ios: 16, default: 8 }) },
  quickList: { gap: 7, paddingBottom: 7 },
  quickChip: { borderWidth: 1, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 8, maxWidth: 245 },
  inputCard: { borderWidth: 1, borderRadius: 0, padding: 8, gap: 8 },
  toolMenu: { flexDirection: "row", flexWrap: "wrap", gap: 7, paddingTop: 2 },
  toolChip: { borderWidth: 1, borderRadius: 0, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 8 },
  toolText: { fontSize: 11, fontWeight: "900" },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 7 },
  input: { flex: 1, minHeight: 38, maxHeight: 96, fontSize: 14, lineHeight: 20, paddingHorizontal: 6, paddingTop: 8, paddingBottom: 8 },
  plusBtn: { width: 44, height: 44, borderRadius: 0, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sendBtn: { width: 46, height: 46, borderRadius: 0, alignItems: "center", justifyContent: "center" },
  notice: { textAlign: "center", fontSize: 10, letterSpacing: 0.8, paddingTop: 5 },
});
