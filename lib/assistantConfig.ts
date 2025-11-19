export type AssistantProvider = 'executorch' | 'openai';

const RAW_PROVIDER = (process.env.EXPO_PUBLIC_ASSISTANT_PROVIDER ?? 'executorch').toLowerCase();

export const ASSISTANT_PROVIDER: AssistantProvider =
  RAW_PROVIDER === 'openai' ? 'openai' : 'executorch';

export const IS_EXECUTORCH_ASSISTANT = ASSISTANT_PROVIDER === 'executorch';
