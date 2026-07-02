@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo  JAPANO - Dọn MongoDB chỉ giữ ERD
echo ========================================
echo.
echo Script này sẽ XOÁ các collection không nằm trong ERD.
echo Giữ lại: categories, products, productvariants, images, colors, sizes, users, aichats, wishlists, notifications, forgotpasswords, reviews, orders, orderitems, payments, discountcodes, carts
echo.
set /p CONFIRM=Gõ DELETE để xác nhận xoá collection thừa: 
if /I not "%CONFIRM%"=="DELETE" (
  echo Đã huỷ, chưa xoá gì cả.
  pause
  exit /b 0
)

echo.
echo Đang chạy npm run mongo:clean-erd ...
npm run mongo:clean-erd
pause
