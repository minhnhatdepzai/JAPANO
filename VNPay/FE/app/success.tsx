import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
export default function Success() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thanh toán thành công!</Text>
      <Text style={styles.message}>Cảm ơn bạn đã mua hàng.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  message: { fontSize: 18, color: '#333' }
});