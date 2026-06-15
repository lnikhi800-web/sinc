import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import type { LanguageModelV1 } from 'ai';

export default class NvidiaProvider extends BaseProvider {
  name = 'NVIDIA';
  getApiKeyLink = 'https://build.nvidia.com/';

  config = {
    baseUrlKey: 'NVIDIA_API_BASE_URL',
    apiTokenKey: 'NVIDIA_API_KEY',
  };

  staticModels: ModelInfo[] = [
    {
      name: 'meta/llama-3.3-70b-instruct',
      label: 'Llama 3.3 70B Instruct (NVIDIA)',
      provider: 'NVIDIA',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 4096,
    },
    {
      name: 'nvidia/llama-3.1-nemotron-70b-instruct',
      label: 'Llama 3.1 Nemotron 70B Instruct (NVIDIA)',
      provider: 'NVIDIA',
      maxTokenAllowed: 128000,
      maxCompletionTokens: 4096,
    },
    {
      name: 'nvidia/nemotron-4-340b-instruct',
      label: 'Nemotron 4 340B Instruct (NVIDIA)',
      provider: 'NVIDIA',
      maxTokenAllowed: 4096,
      maxCompletionTokens: 4096,
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv: Record<string, string> = {},
  ): Promise<ModelInfo[]> {
    const { baseUrl: fetchBaseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv,
      defaultBaseUrlKey: 'NVIDIA_API_BASE_URL',
      defaultApiTokenKey: 'NVIDIA_API_KEY',
    });
    const baseUrl = fetchBaseUrl || 'https://integrate.api.nvidia.com/v1';

    if (!baseUrl || !apiKey) {
      return [];
    }

    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: this.createTimeoutSignal(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const res = (await response.json()) as any;
      const data = (res.data || []).filter((model: any) => 
        model.id.toLowerCase().includes('llama') || 
        model.id.toLowerCase().includes('coder') || 
        model.id.toLowerCase().includes('nemotron') || 
        model.id.toLowerCase().includes('mixtral')
      );

      const staticModelNames = this.staticModels.map((m) => m.name);
      const filtered = data.filter((m: any) => !staticModelNames.includes(m.id));

      return filtered.map((m: any) => {
        let contextWindow = 128000;
        if (m.id.includes('8b')) {
          contextWindow = 8000;
        } else if (m.id.includes('3b') || m.id.includes('1b')) {
          contextWindow = 4000;
        }
        return {
          name: m.id,
          label: `${m.id.split('/').pop() || m.id} (NVIDIA)`,
          provider: this.name,
          maxTokenAllowed: contextWindow,
          maxCompletionTokens: 4096,
        };
      });
    } catch (error) {
      return [];
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;
    const envRecord = this.convertEnvToRecord(serverEnv);

    const { baseUrl: fetchBaseUrl, apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: envRecord,
      defaultBaseUrlKey: 'NVIDIA_API_BASE_URL',
      defaultApiTokenKey: 'NVIDIA_API_KEY',
    });
    const baseUrl = fetchBaseUrl || 'https://integrate.api.nvidia.com/v1';

    if (!baseUrl || !apiKey) {
      throw new Error(`Missing configuration for ${this.name} provider`);
    }

    return getOpenAILikeModel(baseUrl, apiKey, model);
  }
}
