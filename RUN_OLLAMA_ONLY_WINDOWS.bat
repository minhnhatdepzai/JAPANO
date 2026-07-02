@echo off
chcp 65001 >nul
ollama pull qwen2.5:1.5b
ollama serve
pause
