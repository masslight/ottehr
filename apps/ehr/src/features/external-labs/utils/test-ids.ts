import { dataTestIds } from 'src/constants/data-test-ids';

export const configBundleTableTestId = (title: string): string => {
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '');
  return `${dataTestIds.externalLabs.labsTable.bundleContainerPrefix}${sanitizedTitle}`;
};

export const configBundleHeaderRowTitleTestId = (title: string): string => {
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '');
  return `${dataTestIds.externalLabs.labsTable.bundleHeaderRowTitlePrefix}${sanitizedTitle}`;
};

export const configBundleRowTestId = (title: string): string => {
  const sanitizedTitle = title.replace(/[^a-zA-Z0-9]/g, '');
  return `${dataTestIds.externalLabs.labsTable.bundleRowPrefix}${sanitizedTitle}`;
};

export const configAoeTextEntryTestId = (linkId: string): string => {
  return `${dataTestIds.externalLabs.detailsPg.aoeTextEntryPrefix}${linkId}`;
};

export const configAoeRadioEntryTestId = (linkId: string): string => {
  return `${dataTestIds.externalLabs.detailsPg.aoeRadioEntryPrefix}${linkId}`;
};

export const configAoeSingleChoiceEntryTestId = (linkId: string): string => {
  return `${dataTestIds.externalLabs.detailsPg.aoeSingleChoicePrefix}${linkId}`;
};

export const configAoeChoiceEntryOptionTestId = (value: string): string => {
  const sanitizedValue = value.replace(/[^a-zA-Z0-9]/g, '');
  return `${dataTestIds.externalLabs.detailsPg.aoeChoiceOptionPrefix}${sanitizedValue}`;
};

export const configAoeDecimalEntryTestId = (linkId: string): string => {
  return `${dataTestIds.externalLabs.detailsPg.aoeDecimalEntryPrefix}${linkId}`;
};
