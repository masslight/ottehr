import { FC } from 'react';
import { ERXBody } from '../erx/ERXBody';
import { useRefreshNoteSummaries } from './useRefreshNoteSummaries';

// The eRX widget prescribes through an external service, so the Prescriptions summary
// doesn't refresh on its own. Refresh the note when the inline section collapses so new
// prescriptions show up.
export const ERXInlineFlow: FC = () => {
  useRefreshNoteSummaries();

  return <ERXBody />;
};
