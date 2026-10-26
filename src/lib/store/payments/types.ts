import type { Order } from '../../../types/store';

export type PaymentProviderId = 'sumup';

export type RemotePaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

export interface PaymentSession {
  providerId: PaymentProviderId;
  checkoutId: string;
  paymentUrl: string;
}

export interface CreatePaymentSessionInput {
  order: Order;
  origin: string;
  /** When regenerating, force a new SumUp checkout even if one exists. */
  forceNew?: boolean;
}

export interface PaymentProvider {
  id: PaymentProviderId;
  isConfigured(): Promise<boolean>;
  createPaymentSession(input: CreatePaymentSessionInput): Promise<PaymentSession>;
  getRemoteStatus(checkoutId: string): Promise<RemotePaymentStatus>;
  testConnection(): Promise<{ ok: boolean; merchantCode?: string; message: string }>;
}

export interface SumUpProviderConfig {
  enabled: boolean;
  merchantCode: string;
  apiKey: string;
  updatedAt: string;
}

export interface PaymentSettings {
  activeProviderId: PaymentProviderId;
  providers: {
    sumup: SumUpProviderConfig;
  };
  updatedAt: string;
}

export interface SumUpProviderPublicConfig {
  enabled: boolean;
  merchantCode: string;
  apiKeyConfigured: boolean;
  apiKeyHint: string;
  updatedAt: string;
}

export interface PaymentSettingsPublic {
  activeProviderId: PaymentProviderId;
  providers: {
    sumup: SumUpProviderPublicConfig;
  };
  updatedAt: string;
}
