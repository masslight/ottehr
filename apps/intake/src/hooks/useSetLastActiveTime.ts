import { useEffect } from 'react';
import { zapehrApi } from '../api';
import { DateTime } from 'luxon';
import { ZambdaClient } from 'ui-components/lib/hooks/useUCZambdaClient';

// Update last active time for paperwork-in-progress flag every minute
export function useSetLastActiveTime(
  appointmentID: string | undefined,
  paperworkPage: boolean,
  zambdaClient: ZambdaClient | null
): void {
  useEffect(() => {
    let interval: NodeJS.Timeout;
    try {
      if (zambdaClient && appointmentID && paperworkPage) {
        interval = setInterval(async () => {
          await zapehrApi.updatePaperworkInProgress(
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
