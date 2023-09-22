export interface ClientConfig {
  readonly apiUrl?: string;
  readonly projectId?: string;
  readonly accessToken?: string;
}

export abstract class BaseClient {
  readonly apiUrl: string;
  readonly projectId?: string;
  readonly accessToken?: string;

  constructor(config: ClientConfig) {
    if (!config.apiUrl) {
      throw new Error('apiUrl is required');
    }
    this.apiUrl = config.apiUrl;
    this.projectId = config.projectId;
    this.accessToken = config.accessToken;
  }
}
