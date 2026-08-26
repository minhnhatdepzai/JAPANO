#!/usr/bin/env bash
# Bật lại toàn bộ stack JAPANO sau khi tạm tắt để nhường GPU.
# Chạy:  bash /home/nhat/Downloads/japano/.pause/bat-lai-japano.sh
set -u

echo "==> Bật lại systemd user services"
systemctl --user daemon-reload
systemctl --user enable --now japano-backend japano-fashn japano-motion

echo "==> Chờ backend lên cổng 4100"
for i in $(seq 1 60); do
  ss -tln 2>/dev/null | grep -q ':4100 ' && break
  sleep 1
done

echo
echo "==> Trạng thái"
systemctl --user is-active japano-backend japano-fashn japano-motion
ss -tln 2>/dev/null | grep -E ':(4100|7862|7864) ' || echo "(cổng chưa lên hết, xem log: journalctl --user -u japano-fashn -n 50)"
tailscale serve status

# --- CHỈ CẦN NẾU BẠN ĐÃ CHẠY `sudo tailscale serve reset` ---
# Cấu hình gốc đã lưu ở tailscale-serve-backup.json. Khôi phục bằng:
# sudo tailscale serve --bg --yes --https 4101 http://127.0.0.1:4100
# sudo tailscale serve --bg --yes --https 4102 /home/nhat/Downloads/japano/mobile/android/app/build/outputs/apk/release/app-release.apk
# sudo tailscale serve --bg --yes --https 8443 http://127.0.0.1:4100
# sudo tailscale funnel --bg --yes --https 443 https+insecure://127.0.0.1:8443
