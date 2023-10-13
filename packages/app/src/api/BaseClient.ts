export interface ClientConfig {
  readonly accessToken?: string;
  readonly apiUrl?: string;
  readonly projectId?: string;
}

export abstract class BaseClient {
  readonly accessToken?: string;
  readonly apiUrl: string;
  readonly projectId?: string;

  constructor(config: ClientConfig) {
    if (!config.apiUrl) {
      throw new Error('apiUrl is required');
    }
    this.accessToken = config.accessToken;
    this.apiUrl = config.apiUrl;
    this.projectId = config.projectId;
  }
}
