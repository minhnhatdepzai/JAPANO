import React from 'react';

type StripeProviderProps = {
  children: React.ReactNode;
  publishableKey?: string;
  merchantIdentifier?: string;
  urlScheme?: string;
};

export function StripeProvider({ children }: StripeProviderProps) {
  return <>{children}</>;
}

const unsupportedWebError = {
  code: 'stripe_web_not_supported',
  message: 'Stripe PaymentSheet của @stripe/stripe-react-native chỉ chạy trên Android/iOS. Trên web admin, hãy dùng COD hoặc chạy app bằng Expo Go/dev build để test Stripe.',
};

export function useStripe() {
  return {
    initPaymentSheet: async () => ({ error: unsupportedWebError }),
    presentPaymentSheet: async () => ({ error: unsupportedWebError }),
  };
}
