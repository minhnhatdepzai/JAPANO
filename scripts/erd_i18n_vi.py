"""Nhãn tiếng Việt dùng chung cho hai bộ sinh ERD JAPANO.

Tên kỹ thuật được giữ trong thuộc tính XML ẩn ``data-collection`` và
``data-field`` để validator vẫn đối chiếu được Atlas mà giao diện Draw.io chỉ
hiển thị tiếng Việt.
"""

COLLECTION_LABELS = {
    'interactions': 'Tương tác người dùng',
    'product_variants': 'Biến thể sản phẩm',
    'order_items': 'Chi tiết đơn hàng',
    'product_media': 'Hình ảnh sản phẩm',
    'orders': 'Đơn hàng',
    'payments': 'Thanh toán',
    'review_reactions': 'Tương tác đánh giá',
    'products': 'Sản phẩm',
    'chats': 'Tin nhắn trợ lý',
    'notifications': 'Thông báo',
    'users': 'Người dùng',
    'reviews': 'Đánh giá sản phẩm',
    'wishlist_items': 'Danh sách yêu thích',
    'search_logs': 'Lịch sử tìm kiếm',
    'profiles': 'Hồ sơ người dùng',
    'addresses': 'Địa chỉ',
    'return_requests': 'Yêu cầu trả hàng',
    'goals': 'Mục tiêu sức khỏe',
    'flagcards': 'Thẻ địa danh Nhật Bản',
    'settings': 'Cấu hình cửa hàng',
    'moderation_samples': 'Mẫu kiểm duyệt',
    'japan_spot_suggestions': 'Đề xuất địa điểm Nhật Bản',
    'japan_spot_reviews': 'Đánh giá địa điểm Nhật Bản',
    'japan_spots': 'Địa điểm Nhật Bản',
    'categories': 'Danh mục sản phẩm',
    'voucher_redemptions': 'Lượt sử dụng phiếu giảm giá',
    'cart_items': 'Chi tiết giỏ hàng',
    'push_tokens': 'Thiết bị nhận thông báo',
    'flagcard_collections': 'Bộ sưu tập thẻ địa danh',
    'vouchers': 'Phiếu giảm giá',
}

FIELD_LABELS = {
    '_id': 'Khóa chính MongoDB',
    'accent': 'Màu nhấn', 'access': 'Hướng dẫn di chuyển',
    'action': 'Hành động', 'active': 'Đang hoạt động',
    'address': 'Địa chỉ', 'addressDetails': 'Chi tiết địa chỉ',
    'adminNote': 'Ghi chú quản trị', 'adultOnlyTryOn': 'Chỉ thử đồ người lớn',
    'ai': 'Cấu hình AI', 'amount': 'Số tiền', 'amountSubtotal': 'Tiền tạm tính',
    'appliesTo': 'Phạm vi áp dụng', 'at': 'Thời điểm',
    'authProviders': 'Nhà cung cấp đăng nhập', 'autoCompleted': 'Tự động hoàn tất',
    'avatar': 'Ảnh đại diện', 'awards': 'Phần thưởng', 'body': 'Nội dung',
    'bestTime': 'Thời gian chụp đẹp', 'brand': 'Thương hiệu', 'budget': 'Ngân sách', 'card': 'Thẻ thanh toán',
    'cardIds': 'Danh sách mã thẻ', 'categoryId': 'Mã danh mục',
    'chargeId': 'Mã khoản thu', 'checkins': 'Lượt khám phá',
    'checkoutSessionId': 'Mã phiên thanh toán', 'clientRequestId': 'Mã yêu cầu khách',
    'cloudinary': 'Cấu hình Cloudinary', 'cod': 'Thanh toán khi nhận hàng',
    'codManualRefund': 'Hoàn tiền khi nhận hàng thủ công', 'code': 'Mã',
    'color': 'Màu sắc', 'colorHex': 'Mã màu HEX', 'colorName': 'Tên màu',
    'comment': 'Bình luận', 'compareAtPrice': 'Giá so sánh',
    'completedAt': 'Thời điểm hoàn tất', 'confidence': 'Độ tin cậy',
    'coversWholeOrder': 'Áp dụng toàn đơn', 'createdAt': 'Ngày tạo',
    'currency': 'Đơn vị tiền tệ', 'customer': 'Khách hàng',
    'deliveredAt': 'Ngày giao hàng', 'demoBatch': 'Lô dữ liệu mẫu',
    'description': 'Mô tả', 'discount': 'Tiền giảm',
    'discountCode': 'Mã giảm giá', 'email': 'Thư điện tử', 'engine': 'Bộ máy xử lý',
    'expiry': 'Ngày hết hạn', 'failureReason': 'Lý do thất bại',
    'fallbackReason': 'Lý do dùng phương án dự phòng',
    'flagcardAward': 'Phần thưởng thẻ địa danh',
    'formationHistory': 'Lịch sử hình thành', 'funFacts': 'Thông tin thú vị',
    'fund': 'Quỹ tiết kiệm', 'garmentType': 'Loại trang phục',
    'gender': 'Giới tính', 'generationModel': 'Mô hình sinh', 'glyph': 'Ký hiệu',
    'googleId': 'Mã tài khoản Google', 'heightCm': 'Chiều cao (cm)',
    'highlights': 'Điểm nổi bật', 'history': 'Lịch sử',
    'hotline': 'Số điện thoại hỗ trợ', 'id': 'Mã nội bộ',
    'imageSource': 'Nguồn hình ảnh', 'informationSources': 'Nguồn thông tin',
    'input': 'Dữ liệu đầu vào', 'intent': 'Ý định',
    'intentStatus': 'Trạng thái yêu cầu', 'isDefault': 'Địa chỉ mặc định',
    'isPrimary': 'Hình ảnh chính', 'issuedAt': 'Ngày phát hành',
    'issuedBy': 'Người phát hành', 'items': 'Danh sách mục',
    'japanese': 'Tên tiếng Nhật', 'joinedAt': 'Ngày tham gia',
    'kanji': 'Tên chữ Kanji', 'kind': 'Loại yêu cầu', 'label': 'Nhãn',
    'latencyMs': 'Độ trễ (ms)', 'learnedPhrases': 'Cụm từ đã học',
    'legend': 'Truyền thuyết', 'limit': 'Giới hạn sử dụng', 'logo': 'Biểu trưng',
    'mapQuery': 'Từ khóa bản đồ', 'media': 'Hình ảnh và video', 'message': 'Tin nhắn',
    'metadata': 'Dữ liệu bổ sung', 'method': 'Phương thức',
    'min': 'Giá trị đơn tối thiểu', 'modelTrace': 'Dấu vết mô hình',
    'moderatedAt': 'Ngày kiểm duyệt', 'moderation': 'Thông tin kiểm duyệt',
    'mongo': 'Cấu hình MongoDB', 'name': 'Tên',
    'nativeAttempt': 'Lần thử thanh toán gốc', 'normalizedText': 'Văn bản chuẩn hóa',
    'note': 'Ghi chú', 'occasion': 'Dịp sử dụng', 'order': 'Thứ tự',
    'orderCode': 'Mã đơn hàng', 'orderId': 'Mã đơn hàng',
    'originalAmount': 'Số tiền ban đầu', 'outfit': 'Gợi ý trang phục',
    'ownerUserId': 'Mã người sở hữu', 'paidAt': 'Ngày thanh toán',
    'passwordHash': 'Mật khẩu đã băm', 'paymentCode': 'Mã thanh toán',
    'paymentDiscount': 'Giảm giá thanh toán', 'paymentId': 'Mã thanh toán',
    'paymentIntentId': 'Mã yêu cầu thanh toán',
    'paymentMethodType': 'Loại phương thức thanh toán',
    'paymentPromotion': 'Khuyến mãi thanh toán',
    'pendingRefundAmount': 'Số tiền chờ hoàn', 'phone': 'Số điện thoại',
    'photoSpots': 'Các góc chụp đẹp', 'photoTip': 'Gợi ý chụp ảnh',
    'photoUrl': 'Đường dẫn ảnh địa điểm', 'photos': 'Hình ảnh minh chứng',
    'place': 'Địa điểm', 'plan': 'Kế hoạch',
    'platform': 'Nền tảng', 'position': 'Vị trí sắp xếp',
    'prefecture': 'Tỉnh hoặc phủ', 'prefectureVideoId': 'Mã video giới thiệu',
    'preferredStyles': 'Phong cách yêu thích',
    'price': 'Giá bán', 'product': 'Thông tin sản phẩm',
    'productId': 'Mã sản phẩm', 'productIds': 'Danh sách mã sản phẩm',
    'productName': 'Tên sản phẩm', 'productSlug': 'Đường dẫn sản phẩm',
    'promotionCode': 'Mã khuyến mãi', 'provider': 'Nhà cung cấp',
    'province': 'Tỉnh hoặc thành phố', 'provinceCode': 'Mã tỉnh hoặc thành phố',
    'qty': 'Số lượng', 'qualifyingOrderMin': 'Giá trị đơn đủ điều kiện',
    'quantity': 'Số lượng', 'query': 'Từ khóa tìm kiếm',
    'rating': 'Điểm đánh giá', 'reach': 'Lượt tiếp cận', 'reason': 'Lý do',
    'receiptUrl': 'Đường dẫn biên lai',
    'recommendedProductIds': 'Danh sách sản phẩm gợi ý',
    'redeemedAt': 'Ngày sử dụng', 'refundId': 'Mã hoàn tiền',
    'refundStatus': 'Trạng thái hoàn tiền', 'refundable': 'Có thể hoàn tiền',
    'refundedAmount': 'Số tiền đã hoàn', 'refundedAt': 'Ngày hoàn tiền',
    'refunds': 'Lịch sử hoàn tiền', 'region': 'Vùng',
    'requiredCards': 'Số thẻ yêu cầu', 'resetCodeExpiresAt': 'Hạn mã đặt lại',
    'resetCodeHash': 'Mã đặt lại đã băm', 'resultCount': 'Số kết quả',
    'returnStatus': 'Trạng thái trả hàng', 'reviewId': 'Mã đánh giá',
    'reward': 'Phần thưởng', 'rewardPercent': 'Tỷ lệ phần thưởng',
    'rewardValidityDays': 'Số ngày hiệu lực phần thưởng',
    'rewardVoucherMinOrder': 'Đơn tối thiểu dùng phiếu thưởng', 'role': 'Vai trò',
    'schemaVersion': 'Phiên bản cấu trúc', 'ship': 'Thông tin giao hàng',
    'shipFee': 'Phí vận chuyển', 'size': 'Kích cỡ', 'sizes': 'Danh sách kích cỡ',
    'skinTone': 'Tông da', 'sku': 'Mã hàng', 'slug': 'Đường dẫn định danh',
    'sold': 'Số lượng đã bán', 'source': 'Nguồn', 'sourceLabel': 'Tên nguồn tham khảo',
    'sourceUrl': 'Đường dẫn nguồn',
    'status': 'Trạng thái', 'stock': 'Số lượng tồn kho',
    'stockRestoredAt': 'Ngày hoàn kho', 'stockRestoredReason': 'Lý do hoàn kho',
    'story': 'Câu chuyện sản phẩm', 'street': 'Địa chỉ chi tiết',
    'stripe': 'Cấu hình Stripe', 'stripeCustomerId': 'Mã khách hàng Stripe',
    'subtotal': 'Tiền tạm tính', 'suggestion': 'Nội dung đề xuất',
    'summary': 'Tóm tắt', 'tags': 'Thẻ phân loại',
    'tearAllowed': 'Cho phép mô phỏng rách', 'timeline': 'Dòng thời gian',
    'title': 'Tiêu đề', 'token': 'Mã thiết bị', 'total': 'Tổng tiền',
    'transactionCode': 'Mã giao dịch', 'tryonFlat': 'Hình ảnh phẳng thử đồ',
    'tryons': 'Số lượt thử đồ', 'type': 'Loại', 'updatedAt': 'Ngày cập nhật',
    'url': 'Đường dẫn', 'used': 'Số lượt đã dùng', 'userId': 'Mã người dùng',
    'userName': 'Tên người dùng', 'usualSize': 'Kích cỡ thường mặc',
    'value': 'Giá trị', 'version': 'Phiên bản', 'vipDiscount': 'Giảm giá VIP',
    'vipPromotion': 'Khuyến mãi VIP', 'visualTags': 'Thẻ hình ảnh',
    'vnpBankCode': 'Mã ngân hàng VNPay', 'vnpCardType': 'Loại thẻ VNPay',
    'vnpCreateDate': 'Ngày tạo giao dịch VNPay', 'vnpPayDate': 'Ngày thanh toán VNPay',
    'vnpTransactionNo': 'Mã giao dịch VNPay', 'vnpay': 'Cấu hình VNPay',
    'voucherDiscount': 'Giảm giá bằng phiếu', 'voucherId': 'Mã phiếu giảm giá',
    'ward': 'Phường hoặc xã', 'wardCode': 'Mã phường hoặc xã', 'where': 'Vị trí cụ thể',
    'weightKg': 'Cân nặng (kg)',
}


def collection_label(name):
    return COLLECTION_LABELS[name]


def field_label(name):
    return FIELD_LABELS[name]


def assert_complete(snapshot):
    missing_collections = sorted(
        collection['name'] for collection in snapshot['collections']
        if collection['name'] not in COLLECTION_LABELS
    )
    missing_fields = sorted({
        field['field']
        for collection in snapshot['collections']
        for field in collection['fields']
        if field['field'] not in FIELD_LABELS
    })
    if missing_collections or missing_fields:
        raise ValueError(
            f'Thiếu nhãn tiếng Việt: collection={missing_collections}, field={missing_fields}'
        )
