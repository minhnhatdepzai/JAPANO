JAPANO V41 AI Fashion Studio Pack

Cach dung nhanh:
1) Giai nen zip vao C:\jp\v37
2) Mo PowerShell tai C:\jp\v37
3) Chay:
   .\JAPANO_V41_ONECLICK.bat

Full model nang hon:
   .\JAPANO_V41_ONECLICK_FULL.bat

Sau khi chay xong:
- AI Gateway: http://127.0.0.1:8001/health
- Backend route: http://localhost:4000/api/v41/ai/health
- Android emulator goi backend: http://10.0.2.2:4000

Luu y:
- Goi nay tao gateway, patch backend route, keo model theo manifest.
- CatVTON/BiRefNet/SAM2 co the can repo/checkpoint dung voi ban ban dang dung. Neu HF repo doi/gated, sua japano_v41/model_manifest_v41.json roi chay lai.
- Bikini/swimwear/crop-top nguoi lon duoc ho tro theo huong fashion try-on, khong tu che them. Khong ho tro khoa than/explicit/minors.
