# JAPANO database schema theo ERD mới

Bản này đã dọn lại database để gần ERD bạn gửi, không còn lưu dữ liệu kiểu mảng object lung tung cho giỏ hàng, wishlist và đơn hàng.

## Bảng / collection chính

### Categories
- `_id` = CategoryID
- `categoryName`
- `description`
- `slug`

### Products
- `_id` = ProductID MongoDB
- `id` = mã sản phẩm app đang dùng
- `productName` / `name`
- `status`
- `description`
- `categoryId` -> Categories
- `category`, `subcategory`
- `price`, `image`, `story`, `badge`, `visualTags`, `styleUseCase`

### ProductVariants
- `_id` = VariantID
- `productId` -> Products.id
- `productRef` -> Products._id
- `colorId` -> Colors
- `sizeId` -> Sizes
- `price`
- `stockQuantity`
- `sku`
- `status`

### ProductImages
- `_id` = ImageID
- `url`
- `productVariantId` -> ProductVariants
- `productId`
- `alt`
- `sortOrder`

### Colors
- `_id` = ColorID
- `colorName`
- `colorCode`

### Sizes
- `_id` = SizeID
- `sizeName`

### Users
- `_id` = UserID
- `fullName`, `name`
- `email`
- `passwordHash`
- `phone`
- `address`
- `role`
- `status`
- `createdAt`, `updatedAt`

### Cart
- `_id` = CartID
- `userId` -> Users
- `variantId` -> ProductVariants
- `productId` -> Products.id
- `quantity`
- `unitPrice`
- `productSnapshot` chỉ là bản chụp để app hiển thị nhanh, không phải nguồn dữ liệu chính

### Wishlist
- `_id` = WishlistID
- `userId` -> Users
- `variantId` -> ProductVariants
- `productId` -> Products.id
- `productSnapshot` chỉ để hiển thị nhanh

### Orders
- `_id` = OrderID
- `userId` -> Users
- `orderDate`
- `totalAmount` / `total`
- `shippingAddress`
- `orderStatus` / `status`
- `phoneNumber`
- `discountCodeId` -> DiscountCodes
- `paymentStatus`
- `transactionId`
- `paymentId` -> Payments
- `paymentMethod`
- `stripePaymentIntentId`

### OrderItems
- `_id` = OrderItemID
- `orderId` -> Orders
- `variantId` -> ProductVariants
- `productId` -> Products.id
- `quantity`
- `unitPrice`
- `productSnapshot`

### Payments
- `_id` = PaymentID
- `paymentMethod`
- `status`
- `transactionId`
- `amount`
- `currency`
- `userId`

### DiscountCodes
- `_id` = DiscountID
- `code`
- `discountValue`
- `expiryDate`
- `active`

### Reviews
- `_id` = ReviewID
- `rating`
- `comment`
- `reviewDate`
- `orderItemId` -> OrderItems
- `userId` -> Users

### Notifications
- `_id` = NotificationID
- `title`
- `content`
- `isRead`
- `userId` -> Users

### ForgotPassword
- `_id` = ID
- `email`
- `token`
- `isUsed`
- `createdAt`, `updatedAt`

### AIChat
- `_id` = ChatID
- `content`
- `userId`
- `isChatSaved`
- `createdAt`, `updatedAt`

## Ghi chú tương thích app hiện tại

Frontend hiện tại vẫn đang đọc `cart.items`, `wishlist.items`, `order.items`. Backend mới vẫn trả về các field này cho app không bị vỡ, nhưng trong MongoDB dữ liệu được lưu chuẩn hoá theo `Cart`, `Wishlist`, `Orders`, `OrderItems`, `ProductVariants`.

Khi seed sản phẩm từ `data/catalog.ts`, backend tự tạo thêm:
- Category mặc định theo `category`
- Color mặc định: `Mặc định`
- Size mặc định: `Freesize`
- Variant mặc định: `{PRODUCT_ID}-DEFAULT`
- ProductImage theo ảnh sản phẩm
