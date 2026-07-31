import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { router } from 'expo-router';



export default function Index() {
  const [paymentUrl, setPaymentUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Số tiền demo đơn hàng
  const orderTotal = 150000;

  const handlePayment = async () => {
    setIsLoading(true);
    try {
      // Gọi API lên NodeJS để lấy URL thanh toán
      // Sinh viên đổi IP localhost thành IP mạng LAN thực tế
      const response = await fetch('http://192.168.20.46:3000/api/create-payment-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: orderTotal })
      });

      const data = await response.json();
      if (data.paymentUrl) {
        setPaymentUrl(data.paymentUrl); // Bắt đầu mở webview
      }
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể kết nối đến server');
    } finally {
      setIsLoading(false);
    }
  };

  const onNavigationStateChange = async (navState) => {
    const { url } = navState;
    console.log('>>>>Navigated to URL:', url);

    // Kiểm tra xem URL có chứa link return mình đã cấu hình không
    if (url.includes('yourdomain.com/vnpay_return')) {

      // Tắt webview ngay lập tức để người dùng không thao tác bậy bạ thêm
      setPaymentUrl(null);

      // Bóc tách URL để kiểm tra mã phản hồi từ VNPay
      if (url.includes('vnp_ResponseCode=00')) {

        // Khúc này là thanh toán thành công rồi, bắt đầu gọi API lưu đơn hàng
        try {
          // Tách lấy mã đơn hàng từ URL VNPay trả về (vnp_TxnRef)
          const urlParams = new URLSearchParams(url.split('?')[1]);
          const txnRef = urlParams.get('vnp_TxnRef');

          // Gọi API lưu vào DB
          await fetch('http://192.168.20.46:3000/api/save-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: txnRef,
              amount: orderTotal,
              status: 'PAID'
            })
          });

          // Lưu xong thì dùng expo-router chuyển qua màn hình thông báo thành công
          // Thầy nhớ tạo file success.tsx trong thư mục app nhé
          router.push('/success');

        } catch (error) {
          Alert.alert('Lỗi', 'Thanh toán thành công nhưng không thể lưu đơn hàng.');
        }

      } else {
        // VNPay trả về mã khác 00 (hủy giao dịch, không đủ tiền, v.v.)
        Alert.alert('Thất bại', 'Giao dịch chưa hoàn tất hoặc bị hủy.');
      }
    }
  };

  // Nếu đã có payment URL thì render WebView che toàn màn hình
  if (paymentUrl) {
    return (
      <View style={{ flex: 1, marginTop: 40 }}>
        <WebView
          source={{ uri: paymentUrl }}
          onNavigationStateChange={onNavigationStateChange}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
        />
        <Button title="Hủy thanh toán" onPress={() => setPaymentUrl(null)} color="red" />
      </View>
    );
  }

  // Giao diện chính của màn hình
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tổng tiền đơn hàng</Text>
      <Text style={styles.price}>{orderTotal.toLocaleString()} VNĐ</Text>

      {isLoading ? (
        <ActivityIndicator size="large" color="#0000ff" />
      ) : (
        <Button title="Thanh toán qua VNPay" onPress={handlePayment} />
      )}
    </View>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 18, color: '#333' },
  price: { fontSize: 28, fontWeight: 'bold', marginVertical: 20, color: 'green' }
});
