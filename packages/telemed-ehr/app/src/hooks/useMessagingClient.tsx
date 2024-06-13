import { useAuth0 } from '@auth0/auth0-react';
import { useCallback, useMemo } from 'react';
import { SendSMSInput, SendSMSOutput } from '@zapehr/sdk';

export interface MessagingClient {
  sendSMS: (input: SendSMSInput) => Promise<SendSMSOutput>;
}

export const useMessagingClient = (): MessagingClient | undefined => {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();

  const sendSMS = useCallback(
    async (input: SendSMSInput): Promise<SendSMSOutput> => {
      const token = await getAccessTokenSilently();
      const headers = {
        accept: 'application/json',
        'content-type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
      const resp = await fetch(`${import.meta.env.VITE_APP_PROJECT_API_URL}/messaging/transactional-sms/send`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(input),
      });
      return resp.json() as Promise<SendSMSOutput>;
    },
    [getAccessTokenSilently],
  );

  return useMemo(() => {
    if (isAuthenticated) {
      return { sendSMS };
    }
    return undefined;
  }, [isAuthenticated, sendSMS]);
};
