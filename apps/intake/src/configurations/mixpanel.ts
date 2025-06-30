import mixpanel, { Config, Dict } from 'mixpanel-browser';

let mixpanelWasInitiated = false;

export interface MixpanelContextProps {
  token: string;
  config?: Partial<Config>;
  registerProps?: Dict;
}

export function setupMixpanel({ token, config, registerProps }: MixpanelContextProps): void {
  if (!token) {
    console.error('Mixpanel token is not set');
  } else if (!mixpanelWasInitiated) {
    mixpanel.init(token, config);
    if (registerProps) {
      mixpanel.register(registerProps);
    }

    mixpanelWasInitiated = true;
  }
}
