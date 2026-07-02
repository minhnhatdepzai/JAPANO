# Fix npm install quay hoài

Bản này đã sửa `package-lock.json` để không còn link registry nội bộ như `applied-caas` / `internal.api.openai` / `artifactory`.

Chạy nhanh trên Windows:

1. Double click `START_HERE_WINDOWS.bat`
2. Nếu chỉ muốn cài Node packages: double click `INSTALL_NODE_FAST_WINDOWS.bat`
3. Nếu đã cài xong rồi, chạy riêng:
   - `RUN_OLLAMA_ONLY_WINDOWS.bat`
   - `RUN_BACKEND_ONLY_WINDOWS.bat`
   - `RUN_EXPO_GO_ONLY_WINDOWS.bat`

Nếu npm vẫn chậm, xóa `node_modules`, chạy `INSTALL_NODE_FAST_WINDOWS.bat` lại.
