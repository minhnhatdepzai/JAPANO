// Cloudinary — lưu ảnh/video/âm thanh (logo cửa hàng, media đính kèm đánh giá)
// thay vì nhúng base64 vào db.json. CLOUDINARY_URL do SDK tự đọc từ
// process.env, không cần cấu hình tay.
const cloudinary = require('cloudinary').v2;
const { httpError } = require('./httpError');

const CLOUDINARY_CONFIGURED = Boolean(String(process.env.CLOUDINARY_URL || '').trim());
if (CLOUDINARY_CONFIGURED) cloudinary.config({ secure: true });

function cloudinaryEnabled() {
  return CLOUDINARY_CONFIGURED;
}

async function cloudinaryHealth() {
  if (!CLOUDINARY_CONFIGURED) return { configured: false, online: false };
  try {
    const result = await cloudinary.api.ping();
    return { configured: true, online: result?.status === 'ok' };
  } catch (error) {
    return { configured: true, online: false, error: error.message || String(error) };
  }
}

const REVIEW_MEDIA_MAX_BYTES = 40 * 1024 * 1024;
// Video/âm thanh đính kèm đánh giá — Cloudinary xử lý cả hai qua resource_type
// "video" (audio là một loại "video không hình" theo API Cloudinary).
async function uploadReviewMedia(dataUri, kind) {
  if (!cloudinaryEnabled()) throw httpError(503, 'Chưa cấu hình lưu trữ media; không đính kèm được video/âm thanh.');
  if (!/^data:(video|audio)\/[a-z0-9.+-]+;base64,/i.test(String(dataUri || ''))) throw httpError(400, 'Media đính kèm phải là video hoặc audio hợp lệ.');
  if (String(dataUri).length > REVIEW_MEDIA_MAX_BYTES) throw httpError(413, 'File đính kèm vượt quá dung lượng cho phép (tối đa ~30MB).');
  try {
    const uploaded = await cloudinary.uploader.upload(dataUri, { folder: 'japano/reviews', resource_type: 'video' });
    return { url: uploaded.secure_url, kind: kind === 'audio' ? 'audio' : 'video', publicId: uploaded.public_id };
  } catch (error) {
    throw httpError(502, 'Không tải được media lên Cloudinary: ' + (error.message || 'lỗi không xác định'));
  }
}

const RETURN_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
const RETURN_PHOTO_MAX_COUNT = 6;
// Ảnh chụp hàng/sản phẩm đính kèm yêu cầu huỷ/trả hàng — admin cần thấy ảnh
// thật trước khi duyệt, không nhận mô tả suông.
async function uploadReturnPhotos(dataUris) {
  const list = (Array.isArray(dataUris) ? dataUris : [dataUris]).filter(Boolean).slice(0, RETURN_PHOTO_MAX_COUNT);
  if (!list.length) return [];
  if (!cloudinaryEnabled()) throw httpError(503, 'Chưa cấu hình lưu trữ ảnh; không đính kèm được ảnh minh chứng.');
  const uploads = list.map(async (dataUri) => {
    if (!/^data:image\/[a-z0-9.+-]+;base64,/i.test(String(dataUri || ''))) throw httpError(400, 'Ảnh đính kèm không hợp lệ.');
    if (String(dataUri).length > RETURN_PHOTO_MAX_BYTES) throw httpError(413, 'Một ảnh vượt quá dung lượng cho phép (tối đa ~11MB).');
    try {
      const uploaded = await cloudinary.uploader.upload(dataUri, { folder: 'japano/returns', resource_type: 'image' });
      return uploaded.secure_url;
    } catch (error) {
      throw httpError(502, 'Không tải được ảnh lên Cloudinary: ' + (error.message || 'lỗi không xác định'));
    }
  });
  return Promise.all(uploads);
}

module.exports = { cloudinary, cloudinaryEnabled, cloudinaryHealth, uploadReviewMedia, uploadReturnPhotos };
