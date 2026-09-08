export interface SmsMessage {
  /** Numéro E.164, ex. +22670123456 */
  to: string;
  body: string;
}

export interface SmsResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<SmsResult>;
}
