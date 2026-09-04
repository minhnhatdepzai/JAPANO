"""Đường dẫn tới các tài sản hình ảnh dùng trong báo cáo."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
REPORT = ROOT / 'docs' / 'report'
DIAG = REPORT / 'assets' / 'diagrams'
SCREEN = REPORT / 'assets' / 'screens'
DEVICE = ROOT / 'test-results' / 'device'
REDMI = ROOT / 'test-results' / 'redmi-note8'
QA = ROOT / 'test-results' / 'qa-matrix'
SIZEM = ROOT / 'test-results' / 'size-matrix'
SCENES = ROOT / 'test-results' / 'japan-scenes'
ERD_PNG = ROOT / 'docs' / 'architecture' / 'erd' / 'preview' / 'JAPANO_ERD.png'
ERD_MODULES = ROOT / 'docs' / 'erd-defense' / 'diagrams'
