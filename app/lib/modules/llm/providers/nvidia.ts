import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

export default class NvidiaProvider extends BaseProvider {
  name = 'Nvidia';
  getApiKeyLink = 'https://build.nvidia.com/';

  config = {
    baseUrlKey: 'NVIDIA_API_BASE_URL',
    apiTokenKey: 'NVIDIA_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'meta/llama-3.3-70b-instruct',
      label: 'Llama 3.3 70B Instruct',
      provider: 'Nvidia',
      maxTokenAllowed: 32768,
      maxCompletionTokens: 8192,
    },
    {
      name: 'meta/llama-3.1-70b-instruct',
      label: 'Llama 3.1 70B Instruct',
      provider: 'Nvidia',
      maxTokenAllowed: 32768,
      maxCompletionTokens: 8192,
    },
    {
      name: 'meta/llama-3.1-8b-instruct',
      label: 'Llama 3.1 8B Instruct',
      provider: 'Nvidia',
      maxTokenAllowed: 32768,
      maxCompletionTokens: 8192,
    }
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    return [];
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;
    const envRecord = this.convertEnvToRecord(serverEnv);

    // Default configuration to connect to Nvidia NIM out-of-the-box
    const defaultBaseUrl = 'https://integrate.api.nvidia.com/v1';
    const defaultApiKey = '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';

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: envRecord,
      defaultBaseUrlKey: 'NVIDIA_API_BASE_URL',
      defaultApiTokenKey: 'NVIDIA_API_KEY',
    });

    const activeBaseUrl = baseUrl || defaultBaseUrl;
    const activeApiKey = apiKey || defaultApiKey;

    if (!activeApiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    return getOpenAILikeModel(activeBaseUrl, activeApiKey, model);
  }
}
