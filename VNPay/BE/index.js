const express = require('express');
const crypto = require('crypto');
const querystring = require('qs');
const moment = require('moment');

const app = express();
app.use(express.json());

// Thông tin lấy từ VNPay Sandbox
const tmnCode = 'TD3422D1';
const secretKey = 'SMKTJ11T9JQDIZQPCF7E8ZIJ6DXV969Z';
const vnpUrl = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const returnUrl = 'https://yourdomain.com/vnpay_return'; // Link này thực tế không cần tồn tại thật nếu làm trên app, chỉ để app bắt URL

app.post('/api/create-payment-url', (req, res) => {
    process.env.TZ = 'Asia/Ho_Chi_Minh';

    let date = new Date();
    let createDate = moment(date).format('YYYYMMDDHHmmss');

    let ipAddr = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';

    // Nhận số tiền từ app (VNPay yêu cầu nhân 100)
    let amount = req.body.amount;
    let bankCode = req.body.bankCode; // có thể để trống

    let orderId = moment(date).format('DDHHmmss'); // Mã đơn hàng (demo)

    let vnp_Params = {};
    vnp_Params['vnp_Version'] = '2.1.0';
    vnp_Params['vnp_Command'] = 'pay';
    vnp_Params['vnp_TmnCode'] = tmnCode;
    vnp_Params['vnp_Locale'] = 'vn';
    vnp_Params['vnp_CurrCode'] = 'VND';
    vnp_Params['vnp_TxnRef'] = orderId;
    vnp_Params['vnp_OrderInfo'] = 'Thanh toan cho ma GD:' + orderId;
    vnp_Params['vnp_OrderType'] = 'other';
    vnp_Params['vnp_Amount'] = amount * 100;
    vnp_Params['vnp_ReturnUrl'] = returnUrl;
    vnp_Params['vnp_IpAddr'] = ipAddr;
    vnp_Params['vnp_CreateDate'] = createDate;

    // Sắp xếp dữ liệu để tạo chữ ký
    vnp_Params = sortObject(vnp_Params);

    let signData = querystring.stringify(vnp_Params, { encode: false });
    let hmac = crypto.createHmac("sha512", secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
    vnp_Params['vnp_SecureHash'] = signed;
    // Tạo một biến cục bộ để nối chuỗi, giữ nguyên vnpUrl gốc
    let finalRedirectUrl = vnpUrl + '?' + querystring.stringify(vnp_Params, { encode: false });
    console.log('Redirect URL:', finalRedirectUrl);

    // Trả URL về cho React Native
    res.status(200).json({ paymentUrl: finalRedirectUrl });
});

// Hàm sort chuẩn theo yêu cầu của VNPay
function sortObject(obj) {
    let sorted = {};
    let str = [];
    let key;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) {
            str.push(encodeURIComponent(key));
        }
    }
    str.sort();
    for (key = 0; key < str.length; key++) {
        sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
    }
    return sorted;
}


// Khai báo một mảng làm database giả lập
const mockDatabase = [];

// API lưu đơn hàng sau khi thanh toán thành công
app.post('/api/save-order', (req, res) => {
    const { orderId, amount, status } = req.body;
    
    // Tạo object đơn hàng
    const newOrder = {
        orderId: orderId,
        amount: amount,
        status: status,
        createdAt: new Date()
    };
    
    // Lưu vào database giả lập
    mockDatabase.push(newOrder);
    console.log('Đã lưu đơn hàng mới vào DB:', newOrder);
    
    return res.status(200).json({ 
        message: 'Lưu đơn hàng thành công', 
        data: newOrder 
    });
});

app.listen(3000, () => console.log('Server chạy port 3000'));