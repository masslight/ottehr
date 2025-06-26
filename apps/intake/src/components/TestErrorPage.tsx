import { ReactElement } from 'react';

export const TestErrorPage = (): ReactElement => {
  throw new Error('Patient app UI test error');
};
