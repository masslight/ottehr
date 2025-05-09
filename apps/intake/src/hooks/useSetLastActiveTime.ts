import { DateTime } from 'luxon';
import { useEffect } from 'react';
import { ZambdaClient } from 'ui-components/lib/hooks/useUCZambdaClient';
import { ottehrApi } from '../api';

// Update last active time for paperwork-in-progress flag every minute
export function useSetLastActiveTime(
  appointmentID: string | undefined,
  paperworkPage: boolean,
  zambdaClient: ZambdaClient | null
): void {
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    try {
      if (zambdaClient && appointmentID && paperworkPage) {
        interval = setInterval(async () => {
          await ottehrApi.updatePaperworkInProgress(
            zambdaClient,
            { appointmentID: appointmentID, inProgress: DateTime.now().toISO() },
            false
          );
        }, 60000);
      }
    } catch (err) {
      console.error(err);
    }

    return () => clearInterval(interval);
  }, [appointmentID, paperworkPage, zambdaClient]);
}
