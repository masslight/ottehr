import mixpanel, { Config, Dict } from 'mixpanel-browser';
import { createContext, Provider, ProviderExoticComponent, ReactElement, useRef } from 'react';
import { PropsWithChildren } from '../types';

export interface MixpanelContextProps {
  token: string;
  config?: Partial<Config>;
  registerProps?: Dict;
}

export const MixpanelContext = createContext<MixpanelContextProps>({ token: '' });

export const MixpanelContextProvider = (
  props: PropsWithChildren<MixpanelContextProps>
): ReactElement<ProviderExoticComponent<Provider<MixpanelContextProps>>> => {
  const isMixpanelInitiated = useRef(false);
  const { token, config, registerProps } = props;

  if (!token) {
    console.error('Mixpanel token is not set');
  } else if (!isMixpanelInitiated.current) {
    mixpanel.init(token, config);
    if (registerProps) {
      mixpanel.register(registerProps);
    }

    isMixpanelInitiated.current = true;
  }

  return <MixpanelContext.Provider value={props}>{props.children}</MixpanelContext.Provider>;
};
