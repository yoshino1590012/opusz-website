#!/bin/bash
# OPUS.Z 一鍵啟動

cd "$(dirname "$0")"

echo "🎵 正在啟動 OPUS.Z 編輯器..."

# 關掉佔用 8080 port 的程式
lsof -ti :8080 | xargs kill -9 2>/dev/null
sleep 1

# 啟動正確的 server.py
python3 server.py 8080 &
sleep 2

# 開啟瀏覽器
open "http://localhost:8080/musician-platform.html"

echo "✅ 伺服器已啟動！瀏覽器即將開啟。"
echo "   網址：http://localhost:8080/musician-platform.html"
echo ""
echo "   關閉此視窗即停止伺服器。"

# 保持 Terminal 開著（讓 server 繼續跑）
wait
