export type ContextParams = {
  n_ctx: number;
  n_threads: number;
};

export type TokenData = {
  token?: string;
};

export type CompletionOptions = {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  n_predict: number;
  temperature: number;
  stop?: string[];
};

export type CompletionResult = {
  text?: string;
  content?: string;
};

export interface LlamaContext {
  completion(options: CompletionOptions, onToken?: (token: TokenData) => void): Promise<CompletionResult>;
  stopCompletion(): Promise<void>;
  release(): Promise<void>;
}
