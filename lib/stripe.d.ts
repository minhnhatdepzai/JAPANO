import React from 'react';

export declare const StripeProvider: React.FC<{
  publishableKey: string;
  merchantIdentifier?: string;
  urlScheme?: string;
  children: React.ReactNode;
}>;

export declare function useStripe(): any;
