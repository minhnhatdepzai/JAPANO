#!/usr/bin/env python3
"""
JAPANO Emotion/Age Analyzer
- Không dùng object detector bên ngoài.
- Dò khuôn mặt bằng OpenCV Haar Cascade.
- Nhận diện cảm xúc bằng model file đã train: server/models/emotion_fulltrain_best_model.tflite hoặc .h5.
- Ước lượng tuổi bằng DeepFace pretrained age model nếu đã cài.
- Luôn in đúng 1 JSON object để backend Node.js đọc.
"""
import argparse
import json
import os
import sys

# Force UTF-8 on Windows so Vietnamese JSON does not crash with cp1252.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
import tempfile
from pathlib import Path

import numpy as np

IMG_SIZE = 224
SCRIPT_DIR = Path(__file__).resolve().parent
MODELS_DIR = SCRIPT_DIR / "models"
DEFAULT_TFLITE = MODELS_DIR / "emotion_fulltrain_best_model.tflite"
DEFAULT_H5 = MODELS_DIR / "emotion_fulltrain_best_model.h5"

EMOTION_LABELS = {
    0: "angry",
    1: "disgust",
    2: "fear",
    3: "happy",
    4: "sad",
    5: "surprise",
    6: "neutral",
}

_EMOTION_MODEL = None
_EMOTION_MODEL_INFO = None


def safe_float(value, default=0.0):
    try:
        return float(value)
    except Exception:
        return default


def bucket_age(age):
    try:
        age = int(round(float(age)))
    except Exception:
        return "unknown"
    if age <= 12:
        return "child"
    if age <= 19:
        return "teen"
    if age <= 35:
        return "young-adult"
    if age <= 55:
        return "adult"
    return "senior"


def load_emotion_model():
    global _EMOTION_MODEL, _EMOTION_MODEL_INFO
    if _EMOTION_MODEL is not None:
        return _EMOTION_MODEL, _EMOTION_MODEL_INFO

    requested = os.environ.get("EMOTION_MODEL_PATH", "").strip()
    requested_path = Path(requested) if requested else None

    candidates = []
    if requested_path:
        candidates.append(requested_path)
    candidates.extend([DEFAULT_TFLITE, DEFAULT_H5])

    last_error = None
    for model_path in candidates:
        if not model_path.exists():
            continue
        suffix = model_path.suffix.lower()
        try:
            if suffix == ".tflite":
                Interpreter = None
                try:
                    import tensorflow as tf  # type: ignore
                    Interpreter = tf.lite.Interpreter
                except Exception:
                    try:
                        from tflite_runtime.interpreter import Interpreter  # type: ignore
                    except Exception as exc:
                        last_error = exc
                        Interpreter = None
                if Interpreter is None:
                    continue
                interpreter = Interpreter(model_path=str(model_path))
                interpreter.allocate_tensors()
                input_details = interpreter.get_input_details()
                output_details = interpreter.get_output_details()
                _EMOTION_MODEL = {
                    "type": "tflite",
                    "interpreter": interpreter,
                    "input_details": input_details,
                    "output_details": output_details,
                }
                _EMOTION_MODEL_INFO = {
                    "type": "tflite",
                    "path": str(model_path),
                    "name": model_path.name,
                }
                return _EMOTION_MODEL, _EMOTION_MODEL_INFO

            if suffix in {".h5", ".keras"}:
                import tensorflow as tf  # type: ignore
                model = tf.keras.models.load_model(str(model_path), compile=False)
                _EMOTION_MODEL = {"type": "keras", "model": model}
                _EMOTION_MODEL_INFO = {
                    "type": "keras",
                    "path": str(model_path),
                    "name": model_path.name,
                }
                return _EMOTION_MODEL, _EMOTION_MODEL_INFO
        except Exception as exc:
            last_error = exc

    warning = "Không load được emotion model file."
    if last_error:
        warning += f" Lỗi cuối: {last_error}"
    _EMOTION_MODEL = None
    _EMOTION_MODEL_INFO = {"type": "none", "path": "", "name": "none", "warning": warning}
    return None, _EMOTION_MODEL_INFO


def preprocess_face(face_rgb):
    import cv2  # type: ignore
    face = cv2.resize(face_rgb, (IMG_SIZE, IMG_SIZE))
    x = face.astype("float32") / 255.0
    return np.expand_dims(x, axis=0)


def predict_emotion(face_rgb):
    model_bundle, info = load_emotion_model()
    if not model_bundle:
        return {
            "emotion": "neutral",
            "confidence": 0.0,
            "scores": {},
            "model": info,
            "warning": info.get("warning") or "Emotion model chưa sẵn sàng.",
        }

    x = preprocess_face(face_rgb)
    x_flip = x[:, :, ::-1, :]

    try:
        if model_bundle["type"] == "tflite":
            interpreter = model_bundle["interpreter"]
            input_details = model_bundle["input_details"]
            output_details = model_bundle["output_details"]
            input_index = input_details[0]["index"]
            output_index = output_details[0]["index"]

            def infer(arr):
                dtype = input_details[0].get("dtype", np.float32)
                arr = arr.astype(dtype)
                interpreter.set_tensor(input_index, arr)
                interpreter.invoke()
                return interpreter.get_tensor(output_index)[0]

            p1 = infer(x)
            p2 = infer(x_flip)
        else:
            model = model_bundle["model"]
            p1 = model.predict(x, verbose=0)[0]
            p2 = model.predict(x_flip, verbose=0)[0]

        pred = (np.asarray(p1, dtype="float32") + np.asarray(p2, dtype="float32")) / 2.0
        if pred.ndim > 1:
            pred = pred.reshape(-1)
        if pred.sum() > 1.5 or pred.min() < 0:
            # logits fallback
            e = np.exp(pred - np.max(pred))
            pred = e / max(float(e.sum()), 1e-8)
        idx = int(np.argmax(pred))
        scores = {EMOTION_LABELS[i]: round(float(v) * 100.0, 2) for i, v in enumerate(pred[: len(EMOTION_LABELS)])}
        return {
            "emotion": EMOTION_LABELS.get(idx, "neutral"),
            "confidence": round(float(pred[idx]) * 100.0, 2),
            "scores": scores,
            "model": info,
            "warning": None,
        }
    except Exception as exc:
        return {
            "emotion": "neutral",
            "confidence": 0.0,
            "scores": {},
            "model": info,
            "warning": f"Không dự đoán được cảm xúc: {exc}",
        }


def detect_faces(image_path: str):
    import cv2  # type: ignore
    img = cv2.imread(image_path)
    if img is None:
        return None, []
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    detector = cv2.CascadeClassifier(cascade_path)
    faces = detector.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(54, 54))
    faces = sorted(faces, key=lambda b: int(b[2]) * int(b[3]), reverse=True)
    return img, faces


def crop_face_rgb(img_bgr, box):
    import cv2  # type: ignore
    x, y, w, h = [int(v) for v in box]
    margin = int(0.18 * max(w, h))
    h_img, w_img = img_bgr.shape[:2]
    x1 = max(0, x - margin)
    y1 = max(0, y - margin)
    x2 = min(w_img, x + w + margin)
    y2 = min(h_img, y + h + margin)
    face_bgr = img_bgr[y1:y2, x1:x2]
    if face_bgr.size == 0:
        return None, {"x": x, "y": y, "w": w, "h": h}
    face_rgb = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
    return face_rgb, {"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1}


def predict_age(face_rgb):
    try:
        from deepface import DeepFace  # type: ignore
        result = DeepFace.analyze(
            img_path=face_rgb,
            actions=["age"],
            enforce_detection=False,
            detector_backend="skip",
            silent=True,
        )
        if isinstance(result, list):
            result = result[0] if result else {}
        age = result.get("age")
        if age is None:
            return None, "DeepFace không trả về age."
        return round(float(age), 1), None
    except Exception as exc:
        return None, f"Age model chưa chạy được: {exc}"


def analyze_face_image(image_path: str):
    img, boxes = detect_faces(image_path)
    model_bundle, model_info = load_emotion_model()
    if img is None:
        return {
            "detector": {
                "available": False,
                "model": "opencv-haar-face + emotion-age-file",
                "faceCount": 0,
                "personCount": 0,
                "boxes": [],
                "warning": "Không đọc được ảnh.",
            },
            "face": {
                "available": False,
                "faces": [],
                "primaryEmotion": "neutral",
                "ageEstimate": None,
                "ageGroup": "unknown",
                "emotionModel": model_info,
                "warning": "Không đọc được ảnh.",
            },
        }

    face_items = []
    warnings = []
    for idx, box in enumerate(boxes[:5]):
        face_rgb, region = crop_face_rgb(img, box)
        if face_rgb is None:
            continue
        emotion = predict_emotion(face_rgb)
        age, age_warning = predict_age(face_rgb) if idx == 0 else (None, None)
        if emotion.get("warning"):
            warnings.append(str(emotion.get("warning")))
        if age_warning:
            warnings.append(str(age_warning))
        face_items.append({
            "age": age,
            "ageGroup": bucket_age(age),
            "emotion": emotion.get("emotion", "neutral"),
            "emotionConfidence": emotion.get("confidence", 0.0),
            "emotionScores": emotion.get("scores", {}),
            "region": region,
            "source": "opencv-face + file-emotion + deepface-age",
        })

    if not face_items:
        return {
            "detector": {
                "available": False,
                "model": "opencv-haar-face + emotion-age-file",
                "faceCount": 0,
                "personCount": 0,
                "boxes": [],
                "warning": "Không tìm thấy khuôn mặt rõ trong frame.",
            },
            "face": {
                "available": False,
                "faces": [],
                "primaryEmotion": "neutral",
                "ageEstimate": None,
                "ageGroup": "unknown",
                "emotionModel": model_info,
                "warning": "Không tìm thấy khuôn mặt rõ trong frame.",
            },
        }

    primary = face_items[0]
    return {
        "detector": {
            "available": True,
            "model": "opencv-haar-face + emotion-age-file",
            "faceCount": len(face_items),
            "personCount": len(face_items),
            "boxes": [item.get("region") for item in face_items],
            "warning": None,
        },
        "face": {
            "available": True,
            "faces": face_items,
            "primaryEmotion": primary.get("emotion", "neutral"),
            "emotionConfidence": primary.get("emotionConfidence", 0.0),
            "emotionScores": primary.get("emotionScores", {}),
            "ageEstimate": primary.get("age"),
            "ageGroup": primary.get("ageGroup", "unknown"),
            "emotionModel": model_info,
            "warning": None if not warnings else " | ".join(dict.fromkeys(warnings))[:800],
        },
    }


def tags_from_face(face):
    tags = []
    if face.get("available"):
        tags.extend(["face-detected", "try-on-ready"])
    emotion = face.get("primaryEmotion")
    if emotion in ["happy", "surprise"]:
        tags.append("playful-bright")
    if emotion in ["sad", "fear"]:
        tags.append("cozy-soft")
    if emotion in ["angry", "disgust"]:
        tags.append("calm-minimal")
    age_group = face.get("ageGroup")
    if age_group and age_group != "unknown":
        tags.append(f"age-{age_group}")
    return sorted(set(tags))


def analyze_single_image(image_path: str):
    payload = analyze_face_image(image_path)
    face = payload["face"]
    return {
        "ok": True,
        "detector": payload["detector"],
        "face": face,
        "visualTags": tags_from_face(face),
        "engine": "emotion-age-file",
    }


def merge_detector_results(results):
    boxes = []
    warnings = []
    available = False
    face_count = 0
    for item in results:
        detector = item.get("detector", {})
        available = available or bool(detector.get("available"))
        face_count = max(face_count, int(detector.get("faceCount") or detector.get("personCount") or 0))
        boxes.extend(detector.get("boxes") or [])
        if detector.get("warning"):
            warnings.append(str(detector.get("warning")))
    return {
        "available": available,
        "model": "opencv-haar-face + emotion-age-file",
        "faceCount": face_count,
        "personCount": face_count,
        "boxes": boxes[:10],
        "warning": None if available else (warnings[0] if warnings else "Không tìm thấy khuôn mặt rõ trong video."),
    }


def pick_best_face(results):
    warnings = []
    best = None
    for item in results:
        face = item.get("face", {})
        if face.get("warning"):
            warnings.append(str(face.get("warning")))
        if face.get("available"):
            if best is None:
                best = face
            else:
                best_conf = safe_float(best.get("emotionConfidence"))
                face_conf = safe_float(face.get("emotionConfidence"))
                if face_conf > best_conf:
                    best = face
    if best:
        return best
    return {
        "available": False,
        "faces": [],
        "primaryEmotion": "neutral",
        "ageEstimate": None,
        "ageGroup": "unknown",
        "warning": warnings[0] if warnings else "Không tìm được mặt rõ trong video.",
    }


def analyze_video(video_path: str, max_frames: int = 6):
    import cv2  # type: ignore
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {
            "ok": False,
            "error": "Cannot open video file",
            "mediaType": "video",
            "detector": {"available": False, "faceCount": 0, "personCount": 0, "warning": "Cannot open video"},
            "face": {"available": False, "faces": [], "primaryEmotion": "neutral", "ageGroup": "unknown", "warning": "Cannot open video"},
            "video": {"framesAnalyzed": 0},
            "visualTags": [],
            "engine": "emotion-age-file",
        }

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 0)
    if total <= 0:
        total = max_frames
    if fps <= 0:
        fps = 25.0
    indices = list(range(total)) if total <= max_frames else [int(i * (total - 1) / max(max_frames - 1, 1)) for i in range(max_frames)]

    results = []
    with tempfile.TemporaryDirectory(prefix="japano-face-video-") as tmp:
        tmp_path = Path(tmp)
        for idx in indices:
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ok, frame = cap.read()
            if not ok or frame is None:
                continue
            frame_path = tmp_path / f"frame_{idx}.jpg"
            cv2.imwrite(str(frame_path), frame)
            try:
                results.append(analyze_single_image(str(frame_path)))
            except Exception as exc:
                results.append({
                    "ok": False,
                    "detector": {"available": False, "faceCount": 0, "personCount": 0, "warning": str(exc)},
                    "face": {"available": False, "faces": [], "primaryEmotion": "neutral", "ageGroup": "unknown", "warning": str(exc)},
                    "visualTags": [],
                })
    cap.release()

    detector = merge_detector_results(results)
    face = pick_best_face(results)
    tags = sorted(set(tag for item in results for tag in (item.get("visualTags") or [])))
    if detector.get("faceCount", 0) > 0 and "try-on-ready" not in tags:
        tags.append("try-on-ready")
    return {
        "ok": True,
        "mediaType": "video",
        "detector": detector,
        "face": face,
        "visualTags": tags,
        "engine": "emotion-age-file",
        "video": {
            "framesAnalyzed": len(results),
            "totalFrames": total,
            "fps": round(fps, 2),
            "sampledFrameIndexes": indices,
        },
    }


def main():
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--image")
    group.add_argument("--video")
    parser.add_argument("--max_frames", type=int, default=int(os.environ.get("VIDEO_MAX_FRAMES", "6")))
    args = parser.parse_args()

    if args.image:
        image = Path(args.image)
        if not image.exists():
            print(json.dumps({"ok": False, "error": "image not found"}, ensure_ascii=True))
            sys.exit(2)
        result = analyze_single_image(str(image))
        result["mediaType"] = "image"
        print(json.dumps(result, ensure_ascii=True))
        return

    video = Path(args.video)
    if not video.exists():
        print(json.dumps({"ok": False, "error": "video not found"}, ensure_ascii=True))
        sys.exit(2)
    result = analyze_video(str(video), max_frames=args.max_frames)
    print(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__":
    main()
