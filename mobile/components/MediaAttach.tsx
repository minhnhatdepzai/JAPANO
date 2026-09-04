import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { C, F } from '../theme/tokens';
import { pickReviewMedia, ReviewMediaPick } from '../lib/media';
import { ReviewMedia } from '../lib/api';

export function MediaAttachPicker({ value, onChange }:{ value:ReviewMediaPick|null; onChange:(pick:ReviewMediaPick|null)=>void }) {
  const [busy, setBusy] = useState(false);
  const pick = async (kind:'video'|'audio') => {
    if (busy) return; setBusy(true);
    try { const result = await pickReviewMedia(kind); if (result) onChange(result); }
    catch (e:any) { Alert.alert('Không đính kèm được', e?.message || 'Vui lòng thử lại.'); }
    finally { setBusy(false); }
  };
  return (
    <View style={mst.wrap}>
      {value ? (
        <View style={mst.chip}>
          <Ionicons name={value.kind === 'video' ? 'videocam' : 'musical-notes'} size={16} color={C.ink} />
          <Text style={mst.chipT} numberOfLines={1}>{value.name}</Text>
          <Pressable hitSlop={8} onPress={() => onChange(null)}><Ionicons name="close-circle" size={18} color={C.muted} /></Pressable>
        </View>
      ) : (
        <View style={{ flexDirection:'row', gap:8 }}>
          <Pressable style={mst.btn} disabled={busy} onPress={() => void pick('video')}>
            <Ionicons name="videocam-outline" size={16} color={C.ink} /><Text style={mst.btnT}>Thêm video</Text>
          </Pressable>
          <Pressable style={mst.btn} disabled={busy} onPress={() => void pick('audio')}>
            <Ionicons name="mic-outline" size={16} color={C.ink} /><Text style={mst.btnT}>Thêm âm thanh</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
const mst = StyleSheet.create({
  wrap:{ marginTop:10, marginBottom:4 },
  btn:{ flexDirection:'row', alignItems:'center', gap:6, paddingVertical:8, paddingHorizontal:12, borderRadius:999, borderWidth:1, borderColor:C.line, backgroundColor:C.card },
  btnT:{ fontFamily:F.bodyM, fontSize:12, color:C.ink },
  chip:{ flexDirection:'row', alignItems:'center', gap:8, paddingVertical:8, paddingHorizontal:12, borderRadius:12, backgroundColor:C.washi2, borderWidth:1, borderColor:C.line },
  chipT:{ flex:1, fontFamily:F.bodyM, fontSize:12, color:C.ink },
});

// Phát lại video/âm thanh đã đính kèm — dùng chung 1 component <Video> vì
// expo-av phát được cả audio-only qua source uri (không có khung hình vẫn ra
// thanh điều khiển phát/tạm dừng).
export function ReviewMediaPlayer({ media }: { media?: ReviewMedia }) {
  if (!media?.url) return null;
  return (
    <View style={pst.wrap}>
      <Video
        source={{ uri: media.url }}
        style={media.kind === 'audio' ? pst.audio : pst.video}
        useNativeControls
        resizeMode={ResizeMode.CONTAIN}
      />
    </View>
  );
}
const pst = StyleSheet.create({
  wrap:{ marginTop:8, borderRadius:12, overflow:'hidden', backgroundColor:'#000' },
  video:{ width:'100%', height:190 },
  audio:{ width:'100%', height:56 },
});
