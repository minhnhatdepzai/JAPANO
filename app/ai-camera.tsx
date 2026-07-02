import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Header } from '../components/Header';
import { useApp } from '../context/AppContext';
import { analyzeOutfitImage } from '../lib/api';
import { fontFamily, radius, scaleFont, shadow } from '../lib/styles';

type CameraFacing = 'front' | 'back';

type VisionResult = {
  analysis?: {
    detector?: {
      available?: boolean;
      model?: string;
      faceCount?: number;
      personCount?: number;
      boxes?: Array<{ x: number; y: number; w: number; h: number }>;
      warning?: string | null;
    };
    face?: {
      available?: boolean;
      primaryEmotion?: string;
      emotionConfidence?: number | null;
      emotionScores?: Record<string, number>;
      ageEstimate?: number | null;
      ageGroup?: string;
      faces?: Array<{
        age?: number | null;
        ageGroup?: string;
        emotion?: string;
        emotionConfidence?: number;
        source?: string;
      }>;
      warning?: string | null;
    };
    visualTags?: string[];
    engine?: string;
    warning?: string;
  };
  message?: string;
};

const emotionMap: Record<string, string> = {
  angry: 'tức giận',
  disgust: 'khó chịu',
  fear: 'lo lắng',
  happy: 'vui vẻ',
  sad: 'buồn',
  surprise: 'ngạc nhiên',
  neutral: 'bình thường',
};

const ageGroupMap: Record<string, string> = {
  child: 'trẻ em',
  teen: 'thiếu niên',
  'young-adult': 'người trẻ',
  adult: 'người lớn',
  senior: 'lớn tuổi',
  unknown: 'chưa rõ',
};

function compactVisionError(value?: string) {
  const text = String(value || 'Không phân tích được camera.').replace(/\s+/g, ' ').trim();
  if (/UnicodeEncodeError|charmap|cp1252/i.test(text)) {
    return 'Camera AI chưa phân tích được do lỗi mã hóa Python trên Windows. Hãy restart backend rồi quét lại.';
  }
  if (/timeout|quá/i.test(text)) return 'Model xử lý quá lâu. Hãy giảm tần suất quét hoặc chụp ảnh rõ hơn rồi thử lại.';
  return text.length > 220 ? `${text.slice(0, 220)}...` : text;
}

export default function AICameraScreen() {
  const { theme, user } = useApp();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraFacing>('front');
  const [scanning, setScanning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<VisionResult | null>(null);
  const [lastScanAt, setLastScanAt] = useState('');
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const cameraRef = useRef<CameraView | null>(null);
  const busyRef = useRef(false);

  const detector = result?.analysis?.detector;
  const face = result?.analysis?.face;
  const faceCount = detector?.faceCount ?? detector?.personCount ?? 0;
  const primaryEmotion = face?.primaryEmotion || 'neutral';
  const emotionLabel = emotionMap[primaryEmotion] || primaryEmotion;
  const emotionConfidence = face?.emotionConfidence ? `${Math.round(Number(face.emotionConfidence))}%` : '';
  const ageGroup = face?.ageGroup || 'unknown';
  const ageLabel = face?.ageEstimate ? `${face.ageEstimate} tuổi` : ageGroupMap[ageGroup] || ageGroup;
  const topScores = Object.entries(face?.emotionScores || {})
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, 4);

  const ensurePermission = async () => {
    if (permission?.granted) return true;
    const next = await requestPermission();
    if (!next?.granted) {
      Alert.alert('Cần quyền camera', 'Hãy cho phép camera để JAPANO nhận diện tuổi và cảm xúc bằng model file.');
      return false;
    }
    return true;
  };

  const analyzeFrame = async () => {
    if (busyRef.current || !cameraEnabled || !cameraRef.current) return;
    busyRef.current = true;
    setAnalyzing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.35, skipProcessing: true });
      if (!photo?.uri) return;
      const data = await analyzeOutfitImage(
        { uri: photo.uri, name: `ai-camera-${Date.now()}.jpg`, type: 'image/jpeg' },
        user?.id || 'guest',
      );
      setResult(data);
      setLastScanAt(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e: any) {
      const message = compactVisionError(e?.message);
      setResult({
        analysis: {
          detector: { available: false, faceCount: 0, personCount: 0, warning: message },
          face: { available: false, primaryEmotion: 'neutral', ageGroup: 'unknown', faces: [], warning: message },
          warning: message,
        },
      });
    } finally {
      setAnalyzing(false);
      busyRef.current = false;
    }
  };

  const turnCameraOn = async () => {
    const ok = await ensurePermission();
    if (!ok) return;
    setCameraEnabled(true);
  };

  const turnCameraOff = () => {
    setScanning(false);
    setAnalyzing(false);
    busyRef.current = false;
    cameraRef.current = null;
    setCameraEnabled(false);
  };

  const toggleScan = async () => {
    const ok = await ensurePermission();
    if (!ok) return;
    setCameraEnabled(true);
    setScanning((v) => !v);
  };

  useEffect(() => () => turnCameraOff(), []);

  useEffect(() => {
    if (!scanning || !cameraEnabled) return;
    const timer = setInterval(() => analyzeFrame(), 1200);
    analyzeFrame();
    return () => clearInterval(timer);
  }, [scanning, cameraEnabled, facing, user?.id]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <Header title="Camera AI" subtitle="Bật camera khi cần quét. Kết quả chỉ là ước lượng, không hiển thị log kỹ thuật." backFallback="/(tabs)" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <View style={[styles.cameraCard, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
          {permission?.granted && cameraEnabled ? (
            <>
              <CameraView key={`camera-${facing}`} ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} />
              <View style={[styles.cameraOverlay, { pointerEvents: 'box-none' as any }]}>
                <View style={[styles.liveBadge, { backgroundColor: scanning ? theme.primary : theme.card, borderColor: theme.border }]}> 
                  <Feather name={scanning ? 'radio' : 'camera'} size={14} color={scanning ? theme.background : theme.primary} />
                  <Text style={[styles.liveBadgeText, { color: scanning ? theme.background : theme.primary }]}>{scanning ? 'REAL-TIME' : 'READY'}</Text>
                </View>
                <Pressable onPress={turnCameraOff} style={[styles.cameraOffBtn, { backgroundColor: theme.card, borderColor: theme.border }]}> 
                  <Feather name="power" size={18} color={theme.primary} />
                  <Text style={[styles.cameraOffText, { color: theme.primary }]}>Tắt camera</Text>
                </Pressable>
                {analyzing ? (
                  <View style={[styles.loadingPill, { backgroundColor: theme.card }]}> 
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={[styles.loadingText, { color: theme.text }]}>Đang nhận diện...</Text>
                  </View>
                ) : null}
              </View>
            </>
          ) : permission?.granted ? (
            <View style={styles.permissionBox}>
              <Feather name="camera-off" size={42} color={theme.primary} />
              <Text style={[styles.permissionTitle, { color: theme.heading, fontFamily: fontFamily(theme) }]}>Camera đang tắt</Text>
              <Text style={[styles.permissionText, { color: theme.muted }]}>Bấm bật camera khi cần quét. Khi tắt, CameraView bị gỡ khỏi màn hình nên đèn camera sẽ tắt.</Text>
              <Pressable onPress={turnCameraOn} style={[styles.primaryBtn, { backgroundColor: theme.primary }]}> 
                <Text style={[styles.primaryBtnText, { color: theme.background }]}>Bật camera</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.permissionBox}>
              <Feather name="camera" size={42} color={theme.primary} />
              <Text style={[styles.permissionTitle, { color: theme.heading, fontFamily: fontFamily(theme) }]}>Bật quyền camera</Text>
              <Text style={[styles.permissionText, { color: theme.muted }]}>Camera riêng của JAPANO cần quyền camera để gửi frame về backend emotion/age model.</Text>
              <Pressable onPress={ensurePermission} style={[styles.primaryBtn, { backgroundColor: theme.primary }]}> 
                <Text style={[styles.primaryBtnText, { color: theme.background }]}>Cho phép camera</Text>
              </Pressable>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Pressable onPress={toggleScan} style={[styles.actionBtn, { backgroundColor: scanning ? theme.border : theme.primary }]}> 
            <Feather name={scanning ? 'pause' : 'play'} size={18} color={scanning ? theme.text : theme.background} />
            <Text style={[styles.actionText, { color: scanning ? theme.text : theme.background }]}>{scanning ? 'Dừng real-time' : 'Quét real-time'}</Text>
          </Pressable>
          <Pressable onPress={() => analyzeFrame()} disabled={analyzing || !permission?.granted || !cameraEnabled} style={[styles.secondaryBtn, { borderColor: theme.primary, opacity: analyzing || !permission?.granted || !cameraEnabled ? 0.55 : 1 }]}> 
            <Feather name="search" size={18} color={theme.primary} />
            <Text style={[styles.secondaryText, { color: theme.primary }]}>Quét 1 lần</Text>
          </Pressable>
          <Pressable onPress={() => setFacing((v) => (v === 'front' ? 'back' : 'front'))} style={[styles.iconBtn, { backgroundColor: theme.card, borderColor: theme.border }]}> 
            <Feather name="refresh-cw" size={19} color={theme.primary} />
          </Pressable>
          <Pressable onPress={turnCameraOff} style={[styles.iconBtn, { backgroundColor: theme.card, borderColor: theme.border }]}> 
            <Feather name="power" size={19} color={theme.primary} />
          </Pressable>
        </View>

        <View style={[styles.resultCard, { backgroundColor: theme.card, borderColor: theme.border }, shadow(theme)]}>
          <View style={styles.resultHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.kicker, { color: theme.primary }]}>EMOTION / AGE MODEL FILE</Text>
              <Text style={[styles.resultTitle, { color: theme.heading, fontFamily: fontFamily(theme), fontSize: scaleFont(theme, 24) }]}>Kết quả nhận diện</Text>
            </View>
            {lastScanAt ? <Text style={[styles.timeText, { color: theme.muted }]}>{lastScanAt}</Text> : null}
          </View>

          <View style={styles.metricsGrid}>
            <View style={[styles.metric, { backgroundColor: theme.background, borderColor: theme.border }]}> 
              <Feather name="user" size={18} color={theme.primary} />
              <Text style={[styles.metricLabel, { color: theme.muted }]}>Khuôn mặt</Text>
              <Text style={[styles.metricValue, { color: theme.heading }]}>{faceCount}</Text>
            </View>
            <View style={[styles.metric, { backgroundColor: theme.background, borderColor: theme.border }]}> 
              <Feather name="smile" size={18} color={theme.primary} />
              <Text style={[styles.metricLabel, { color: theme.muted }]}>Cảm xúc</Text>
              <Text style={[styles.metricValue, { color: theme.heading }]}>{emotionLabel}{emotionConfidence ? ` ${emotionConfidence}` : ''}</Text>
            </View>
            <View style={[styles.metric, { backgroundColor: theme.background, borderColor: theme.border }]}> 
              <Feather name="clock" size={18} color={theme.primary} />
              <Text style={[styles.metricLabel, { color: theme.muted }]}>Độ tuổi</Text>
              <Text style={[styles.metricValue, { color: theme.heading }]}>{ageLabel}</Text>
            </View>
          </View>

          {topScores.length ? (
            <View style={styles.objectList}>
              {topScores.map(([name, score]) => (
                <View key={name} style={[styles.objectChip, { backgroundColor: theme.background, borderColor: theme.border }]}> 
                  <Text style={[styles.objectName, { color: theme.text }]}>{emotionMap[name] || name}</Text>
                  <Text style={[styles.objectConf, { color: theme.primary }]}>{Math.round(Number(score))}%</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: theme.muted }]}>Bấm “Quét real-time” hoặc “Quét 1 lần” để xem độ tuổi và cảm xúc từ model file.</Text>
          )}

          {detector?.warning || face?.warning || result?.analysis?.warning ? (
            <View style={[styles.warning, { borderColor: theme.border, backgroundColor: theme.background }]}> 
              <Feather name="alert-circle" size={16} color={theme.primary} />
              <Text style={[styles.warningText, { color: theme.muted }]}>{detector?.warning || face?.warning || result?.analysis?.warning}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 120, gap: 16 },
  cameraCard: { height: 360, borderRadius: 0, borderWidth: 1, overflow: 'hidden' },
  cameraOverlay: { ...StyleSheet.absoluteFillObject, padding: 14, justifyContent: 'space-between' },
  liveBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  cameraOffBtn: { alignSelf: 'flex-end', borderWidth: 1, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6 },
  cameraOffText: { fontSize: 12, fontWeight: '900' },
  loadingPill: { alignSelf: 'center', borderRadius: 0, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { fontSize: 12, fontWeight: '900' },
  permissionBox: { flex: 1, padding: 18, alignItems: 'center', justifyContent: 'center', gap: 12 },
  permissionTitle: { fontSize: 24, fontWeight: '900', textAlign: 'center' },
  permissionText: { fontSize: 13, lineHeight: 20, textAlign: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryBtn: { borderRadius: 0, paddingHorizontal: 16, paddingVertical: 12 },
  primaryBtnText: { fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  actionBtn: { flex: 1, minHeight: 52, borderRadius: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionText: { fontWeight: '900' },
  secondaryBtn: { flex: 1, minHeight: 52, borderRadius: 0, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryText: { fontWeight: '900' },
  iconBtn: { width: 52, height: 52, borderRadius: 0, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  resultCard: { borderWidth: 1, borderRadius: 0, padding: 16, gap: 14 },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  resultTitle: { fontWeight: '900', marginTop: 4 },
  timeText: { fontSize: 11, fontWeight: '800' },
  metricsGrid: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, borderWidth: 1, borderRadius: 0, padding: 10, gap: 4 },
  metricLabel: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  metricValue: { fontSize: 14, fontWeight: '900' },
  objectList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  objectChip: { borderWidth: 1, borderRadius: 0, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  objectName: { fontWeight: '900' },
  objectConf: { fontSize: 11, fontWeight: '900' },
  emptyText: { fontSize: 13, lineHeight: 20 },
  warning: { borderWidth: 1, borderRadius: 0, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  warningText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '700' },
});
