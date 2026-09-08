import type { BankCode } from '@/app/models/dtos';

export type BankIntegrationMode = 'inbound' | 'outbound';
export type BankDispatchStrategy = 'agent-pull' | 'portal-push';

export type BankIntegrationConfig = {
  bankCode: BankCode;
  displayName: string;
  mode: BankIntegrationMode;
  dispatchStrategy: BankDispatchStrategy;
  queueName: string;
  agentBaseUrl?: string;
};

function dispatchStrategyFor(bankCode: BankCode, fallback: BankDispatchStrategy): BankDispatchStrategy {
  const raw = process.env[`${bankCode}_DISPATCH_STRATEGY`];
  return raw === 'agent-pull' || raw === 'portal-push' ? raw : fallback;
}

export const bankIntegrations: Record<BankCode, BankIntegrationConfig> = {
  IZB: {
    bankCode: 'IZB',
    displayName: 'Indo Zambia Bank',
    mode: 'inbound',
    dispatchStrategy: dispatchStrategyFor('IZB', 'agent-pull'),
    queueName: process.env.IZB_QUEUE_NAME || 'izb_payments',
    agentBaseUrl: process.env.IZB_AGENT_URL,
  },
  ZICB: {
    bankCode: 'ZICB',
    displayName: 'Zambia Industrial Commercial Bank',
    mode: 'outbound',
    dispatchStrategy: dispatchStrategyFor('ZICB', 'portal-push'),
    queueName: process.env.ZICB_QUEUE_NAME || 'zicb-payments',
    agentBaseUrl: process.env.ZICB_AGENT_URL,
  },
  ZANACO: {
    bankCode: 'ZANACO',
    displayName: 'Zanaco',
    mode: 'outbound',
    dispatchStrategy: dispatchStrategyFor('ZANACO', 'portal-push'),
    queueName: process.env.ZANACO_QUEUE_NAME || 'zanaco-payments',
    agentBaseUrl: process.env.ZANACO_AGENT_URL,
  },
};

export function getBankIntegration(bankCode: BankCode) {
  return bankIntegrations[bankCode];
}
