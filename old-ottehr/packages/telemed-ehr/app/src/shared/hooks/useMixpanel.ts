import mixpanel from 'mixpanel-browser';
import { useContext } from 'react';
import { MixpanelContext } from '../contexts/mixpanel.context';

export const useMixpanel = (): ((mixpanelCall: (mixpanelApi: typeof mixpanel) => void) => void) => {
  const mixpanelContext = useContext(MixpanelContext);
  if (!mixpanelContext.token) {
    console.warn('Mixpanel token is not set');
  }

  return (mixpanelCall: (mixpanelApi: typeof mixpanel) => void) => {
    try {
      mixpanelCall(mixpanel);
    } catch {
      console.warn("Mixpanel couldn't track the event");
    }
  };
};
