import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL(
  '../node_modules/@stripe/stripe-react-native/android/src/main/java/com/reactnativestripesdk/CardFormView.kt',
  import.meta.url,
));
const source = readFileSync(target, 'utf8');
const original = 'cardFormViewBinding.cardMultilineWidget.paymentMethodCard?.let { params -> cardParams = params }';
const patched = `// CardFormView has already validated and produced the complete card
          // params above. The nested multiline widget can still report null for
          // valid non-US forms (for example when country is VN), which leaves
          // confirmPayment without card details even though onFormComplete=true.
          cardParams = PaymentMethodCreateParams.Card(
            number = cardParamsMap["number"] as String,
            expiryMonth = cardParamsMap["exp_month"] as Int,
            expiryYear = cardParamsMap["exp_year"] as Int,
            cvc = cardParamsMap["cvc"] as String,
          )`;

if (source.includes(patched)) process.exit(0);
if (!source.includes(original)) {
  throw new Error('Không tìm thấy đoạn Stripe CardForm cần vá; hãy kiểm tra phiên bản @stripe/stripe-react-native.');
}
writeFileSync(target, source.replace(original, patched));
console.log('Applied Stripe Android CardForm confirmation patch.');
