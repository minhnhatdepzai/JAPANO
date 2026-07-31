import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

const ALBUM_NAME = 'JAPANO';
const cache: Record<string, string> = {};

function extFor(kind: 'photo' | 'video', url: string) {
  const fromUrl = url.split('?')[0].split('.').pop();
  if (fromUrl && fromUrl.length <= 4 && /^[a-z0-9]+$/i.test(fromUrl)) return fromUrl;
  return kind === 'video' ? 'mp4' : 'jpg';
}

async function ensureLocalCopy(url: string, kind: 'photo' | 'video'): Promise<string> {
  if (url.startsWith('file://')) return url;
  if (cache[url]) {
    const info = await FileSystem.getInfoAsync(cache[url]);
    if (info.exists) return cache[url];
  }
  const dest = `${FileSystem.cacheDirectory}japano-${Date.now()}.${extFor(kind, url)}`;
  const { uri } = await FileSystem.downloadAsync(url, dest);
  cache[url] = uri;
  return uri;
}

export async function saveMediaToLibrary(url: string, kind: 'photo' | 'video'): Promise<void> {
  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) throw new Error('Cần quyền truy cập thư viện ảnh để lưu.');
  const localUri = await ensureLocalCopy(url, kind);
  const asset = await MediaLibrary.createAssetAsync(localUri);
  const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
  if (album) await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
  else await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
}

export async function shareMedia(url: string, kind: 'photo' | 'video'): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Thiết bị không hỗ trợ chia sẻ.');
  const localUri = await ensureLocalCopy(url, kind);
  await Sharing.shareAsync(localUri, {
    mimeType: kind === 'video' ? 'video/mp4' : 'image/jpeg',
    dialogTitle: kind === 'video' ? 'Chia sẻ video JAPANO' : 'Chia sẻ ảnh JAPANO',
  });
}

// Đính kèm video/âm thanh khi đăng đánh giá hay bất kỳ nội dung nào khác —
// đọc file đã chọn thành base64 rồi gói thành data URI để gửi thẳng lên
// backend (backend tải lên Cloudinary qua resource_type "video", vốn cũng
// nhận luôn audio).
export type ReviewMediaKind = 'video' | 'audio';
export type ReviewMediaPick = { dataUri: string; kind: ReviewMediaKind; name: string; sizeBytes: number };

const REVIEW_MEDIA_MAX_BYTES = 25 * 1024 * 1024;

export async function pickReviewMedia(kind: ReviewMediaKind): Promise<ReviewMediaPick | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: kind === 'video' ? 'video/*' : 'audio/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  const info = await FileSystem.getInfoAsync(asset.uri, { size: true });
  const sizeBytes = (info.exists && 'size' in info ? info.size : asset.size) || 0;
  if (sizeBytes > REVIEW_MEDIA_MAX_BYTES) {
    throw new Error(kind === 'video' ? 'Video quá lớn (tối đa 25MB).' : 'File âm thanh quá lớn (tối đa 25MB).');
  }
  const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
  const mime = asset.mimeType || (kind === 'video' ? 'video/mp4' : 'audio/mpeg');
  return { dataUri: `data:${mime};base64,${base64}`, kind, name: asset.name || (kind === 'video' ? 'video.mp4' : 'audio.m4a'), sizeBytes };
}

// Ảnh minh chứng đính kèm yêu cầu huỷ/trả hàng — admin cần thấy ảnh thật của
// hàng/sản phẩm trước khi duyệt hoàn tiền.
const RETURN_PHOTO_MAX_COUNT = 6;

export async function pickReturnPhotos(existingCount = 0): Promise<string[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) throw new Error('Cần quyền truy cập thư viện ảnh để đính kèm.');
  const remaining = RETURN_PHOTO_MAX_COUNT - existingCount;
  if (remaining <= 0) throw new Error(`Chỉ đính kèm tối đa ${RETURN_PHOTO_MAX_COUNT} ảnh.`);
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: remaining,
    quality: 0.7,
    base64: true,
  });
  if (result.canceled || !result.assets?.length) return [];
  return result.assets
    .filter((asset) => asset.base64)
    .map((asset) => `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`);
}

