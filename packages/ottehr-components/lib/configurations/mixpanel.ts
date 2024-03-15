import mixpanel, { Config, Dict } from 'mixpanel-browser';

let mixpanelWasInited = false;

export interface MixpanelContextProps {
  token: string;
  config?: Partial<Config>;
  registerProps?: Dict;
}

export function setupMixpanel({ token, config, registerProps }: MixpanelContextProps): void {
  if (!token) {
    console.error('Mixpanel token is not set');
  } else if (!mixpanelWasInited) {
    mixpanel.init(token, config);
    if (registerProps) {
      mixpanel.register(registerProps);
    }

    mixpanelWasInited = true;
  }
}
