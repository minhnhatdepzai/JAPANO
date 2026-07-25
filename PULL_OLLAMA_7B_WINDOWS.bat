@echo off
chcp 65001 >nul
echo [JAPANO] Pulling Ollama qwen2.5:7b. This may take a while.
ollama pull qwen2.5:7b
if errorlevel 1 (
  echo [JAPANO] Cannot pull qwen2.5:7b. Check Ollama installation and internet.
  pause
  exit /b 1
)
echo [JAPANO] Warming up qwen2.5:7b...
ollama run qwen2.5:7b "Trả lời đúng 1 câu tiếng Việt: JAPANO AI 7B đã sẵn sàng."
echo [JAPANO] Done. Keep Ollama running, then start backend.
pause
