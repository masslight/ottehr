import { FC, useEffect, useRef } from 'react';
import { useChartData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { ERXBody } from '../erx/ERXBody';

// The eRX widget prescribes through an external service, so the Prescriptions summary's
// chart-fields query doesn't refresh on its own. Refetch chart data when the inline
// section collapses so new prescriptions show up in the note.
export const ERXInlineFlow: FC = () => {
  const { refetch } = useChartData();
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    return () => {
      void refetchRef.current();
    };
  }, []);

  return <ERXBody />;
};
