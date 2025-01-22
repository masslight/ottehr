import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useEffect, useState } from 'react';
import { safelyCaptureException } from 'ottehr-components';
import { createIOSMesssageWAccessToken, sendIOSAppMessage } from './iosCommunicationChannel';

let tokenPassedToIOS = false;
const bodyNode = document.getElementsByTagName('body')[0];
let bodyMutationObserver: MutationObserver | null;
const mutationObserverConfig = { attributes: true, childList: false, subtree: false };

const IOS_ATTRIBUTE = 'is-ios-app';

export function useIOSAppSync(): { isIOSApp: boolean } {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [isIOSApp, setIsIOSApp] = useState(Boolean(bodyNode.getAttribute(IOS_ATTRIBUTE)));

  const bodyMutationCallback: MutationCallback = useCallback(
    (mutations, observer) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === IOS_ATTRIBUTE) {
          setIsIOSApp(true);
          observer.disconnect();
        }
      }
    },
    [setIsIOSApp],
  );

  useEffect(() => {
    let isEffectDisposed = false;

    async function sendIOSMessageWToken(): Promise<void> {
      const token = await getAccessTokenSilently();
      if (!tokenPassedToIOS && !isEffectDisposed) {
        sendIOSAppMessage(createIOSMesssageWAccessToken(token));
        tokenPassedToIOS = true;
      }
    }

    if (!isAuthenticated) return;

    if (isIOSApp && !tokenPassedToIOS) {
      sendIOSMessageWToken().catch((error) => {
        safelyCaptureException(error);
      });
    }

    return () => {
      isEffectDisposed = true;
    };
  }, [getAccessTokenSilently, isAuthenticated, isIOSApp]);

  useEffect(() => {
    let bodyMutationObserverThisRef: MutationObserver;
    if (!bodyMutationObserver && !isIOSApp) {
      bodyMutationObserver = new MutationObserver(bodyMutationCallback);
      bodyMutationObserverThisRef = bodyMutationObserver;
      bodyMutationObserver.observe(bodyNode, mutationObserverConfig);
    }
    return () => {
      if (bodyMutationObserver && bodyMutationObserverThisRef === bodyMutationObserver) {
        bodyMutationObserver.disconnect();
        bodyMutationObserver = null;
      }
    };
  }, [bodyMutationCallback, isIOSApp]);

  return { isIOSApp };
}
