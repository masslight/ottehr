import { ReactElement } from 'react';

export const TestErrorPage = (): ReactElement => {
  throw new Error('EHR app UI test error');
};
