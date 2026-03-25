import { dataTestIds } from 'src/constants/data-test-ids';
import { EntryMode } from 'utils';

export const configInHouseLabDeleteButtonTestId = (serviceRequestId: string): string => {
  return `${dataTestIds.inHouseLabsPage.deleteButtonPrefix}-${serviceRequestId}`;
};

export const configInHouseLabTableRowTestId = (serviceRequestId: string): string => {
  return `${dataTestIds.inHouseLabsPage.tableRowPrefix}-${serviceRequestId}`;
};

export const configRunAsRepeatBtnTestId = (testName: string): string => {
  const sanitizedTestName = testName.replace(/[^a-zA-Z0-9]/g, '');
  return `${dataTestIds.orderInHouseLabPage.runAsRepeatBtnPrefix}${sanitizedTestName}`;
};

export const configCptCodeTestId = (testName: string): string => {
  const sanitizedTestName = testName.replace(/[^a-zA-Z0-9]/g, '');
  return `${dataTestIds.orderInHouseLabPage.CPTCodeFieldPrefix}${sanitizedTestName}`;
};

export const configResultPageContainerTestId = (entryMode: EntryMode): string => {
  return `${dataTestIds.resultPage.resultPageContainerPrefix}${entryMode}`;
};
