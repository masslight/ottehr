import { getFullName, PRACTICE_NAME_URL, standardizePhoneNumber } from 'utils';
import { createConfiguredSection, DataComposer } from '../pdf-common';
import { PdfSection, PrimaryCarePhysician, PrimaryCarePhysicianInput } from '../types';

export const composePrimaryCarePhysicianData: DataComposer<PrimaryCarePhysicianInput, PrimaryCarePhysician> = ({
  physician,
}) => {
  const pcpName = physician ? getFullName(physician) : '';
  const pcpPracticeName =
    physician?.extension?.find((e: { url: string }) => e.url === PRACTICE_NAME_URL)?.valueString ?? '';
  const pcpAddress = physician?.address?.[0]?.text ?? '';
  const pcpPhone =
    standardizePhoneNumber(
      physician?.telecom?.find((c) => c.system === 'phone' && c.period?.end === undefined)?.value
    ) ?? '';

  return {
    pcpName,
    pcpPracticeName,
    pcpAddress,
    pcpPhone,
  };
};

export const createPrimaryCarePhysicianSection = <TData extends { pcp?: PrimaryCarePhysician }>(): PdfSection<
  TData,
  PrimaryCarePhysician
> => {
  return createConfiguredSection('primaryCarePhysician', (shouldShow) => ({
    title: 'Primary care physician',
    dataSelector: (data) => data.pcp,
    render: (client, details, styles) => {
      if (shouldShow('pcp-first') || shouldShow('pcp-last')) {
        client.drawLabelValueRow(
          'PCP first and last name',
          details.pcpName,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('pcp-practice')) {
        client.drawLabelValueRow(
          'PCP practice name',
          details.pcpPracticeName,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('pcp-address')) {
        client.drawLabelValueRow(
          'PCP address',
          details.pcpAddress,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('pcp-number')) {
        client.drawLabelValueRow(
          'PCP phone number',
          details.pcpPhone,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            spacing: 16,
          }
        );
      }
    },
  }));
};
