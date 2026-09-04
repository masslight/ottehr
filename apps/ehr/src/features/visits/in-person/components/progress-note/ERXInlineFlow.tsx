import { FC } from 'react';
import { ERXBody } from '../erx/ERXBody';
import { useRefreshNoteSummaries } from './useRefreshNoteSummaries';

export const ERXInlineFlow: FC = () => {
  useRefreshNoteSummaries({ fields: ['prescribedMedications'] });

  return <ERXBody />;
};
