import { DateTime } from 'luxon';
import { CoverageCheckWithDetails } from 'utils/lib/types/api/patient-account';
import {
  EligibilityCheckSimpleStatus,
  mapEligibilityCheckResultToSimpleStatus,
} from 'utils/lib/types/data/telemed/eligibility.types';
import { DISPLAY_DATE_AND_TIME_FORMAT } from 'utils/lib/utils/dateUtils';
import { coverageCheckMatches } from '../../patient-coverage-checks';
import { createConfiguredSection, DataComposer } from '../pdf-common';
import { EligibilityDataInput, EligibilityInfo, EligibilityRowGroup, PdfSection } from '../types';
import {
  getDisplayedInsuranceFieldVisibility,
  getDisplayedInsurancePayerAndMemberId,
  isPolicyHolderCityStateZipShown,
  isPolicyHolderNameShown,
} from './insuranceInfo';

const NO_VALUE = '-';

const STATUS_LABELS: Record<EligibilityCheckSimpleStatus, string> = {
  ELIGIBLE: 'Eligible',
  'NOT ELIGIBLE': 'Not eligible',
  UNKNOWN: 'Unknown',
};

const row = (label: string, value: string | undefined): EligibilityRowGroup['rows'][number] => ({
  label,
  value: value?.trim() ? value : NO_VALUE,
});

const formatName = (first?: string, middle?: string, last?: string): string =>
  [last, [first, middle].filter(Boolean).join(' ')].filter(Boolean).join(', ');

const formatCheckedAt = (iso: string, timezone: string): string | undefined => {
  const checkedAt = DateTime.fromISO(iso);
  return checkedAt.isValid ? checkedAt.setZone(timezone).toFormat(DISPLAY_DATE_AND_TIME_FORMAT) : undefined;
};

const eligibilityGroups = (
  check: CoverageCheckWithDetails | undefined,
  timezone: string,
  shows: (baseFieldKey: string) => boolean
): EligibilityRowGroup[] => {
  const details = check?.coverageDetails;
  const { subscriber, patient, insurance, payer } = details ?? {};
  return [
    {
      rows: [
        row('Status', check && STATUS_LABELS[mapEligibilityCheckResultToSimpleStatus(check).status]),
        row('Last checked', check && formatCheckedAt(check.dateISO, timezone)),
      ],
    },
    {
      title: 'Subscriber/Insured',
      rows: [
        row(
          'First name, last name',
          isPolicyHolderNameShown(shows)
            ? formatName(subscriber?.firstName, subscriber?.middleName, subscriber?.lastName)
            : undefined
        ),
        row('Member ID', subscriber?.memberID),
        row('DOB', shows('policy-holder-date-of-birth') ? subscriber?.dateOfBirth : undefined),
        row(
          'Address',
          shows('policy-holder-address') && isPolicyHolderCityStateZipShown(shows) ? subscriber?.address : undefined
        ),
      ],
    },
    {
      title: 'Patient',
      rows: [
        row('First name, last name', formatName(patient?.firstName, patient?.middleName, patient?.lastName)),
        row('DOB', patient?.dateOfBirth),
        row('Relationship to insured', shows('patient-relationship-to-insured') ? check?.relationship : undefined),
      ],
    },
    {
      title: 'Insurance/Plan',
      rows: [
        row('Plan number', insurance?.planNumber),
        row('Policy number', insurance?.policyNumber),
        row('Funding type', undefined),
        row('Insurance type', insurance?.insuranceDescription || insurance?.insuranceCode),
      ],
    },
    {
      title: 'Payer info',
      rows: [
        row('Name of the payer', payer?.name),
        row('Payer ID', payer?.payerID),
        row('Address', payer?.address),
        row('Website', payer?.website),
        row('Phone', payer?.phone),
        row('Fax', payer?.fax),
      ],
    },
  ];
};

export const composeEligibilityData: DataComposer<EligibilityDataInput, EligibilityInfo> = ({
  coverages,
  insurances,
  coverageChecks,
  timezone,
}) => {
  const displayed = getDisplayedInsurancePayerAndMemberId(coverages, insurances);
  const shows = getDisplayedInsuranceFieldVisibility(insurances);
  if (displayed && !coverageChecks) {
    return { groups: eligibilityGroups(undefined, timezone, shows), unavailable: true };
  }
  const check = displayed ? coverageChecks?.find((candidate) => coverageCheckMatches(candidate, displayed)) : undefined;
  return { groups: eligibilityGroups(check, timezone, shows) };
};

export const createEligibilitySection = <TData extends { eligibility?: EligibilityInfo }>(): PdfSection<
  TData,
  EligibilityInfo
> =>
  createConfiguredSection('insurance', () => ({
    title: 'Eligibility Check Details',
    dataSelector: (data) => data.eligibility,
    render: (client, data, styles) => {
      const headingStyle = { ...styles.textStyles.regular, font: styles.textStyles.subHeader.font };
      if (data.unavailable) {
        client.drawText('Eligibility information could not be retrieved.', styles.textStyles.regular);
      }
      for (const [groupIndex, group] of data.groups.entries()) {
        if (group.title) {
          client.newLine(client.getTextDimensions(group.title, headingStyle).height);
          client.drawText(group.title, headingStyle);
        }
        for (const [rowIndex, { label, value }] of group.rows.entries()) {
          const isLastRow = groupIndex === data.groups.length - 1 && rowIndex === group.rows.length - 1;
          client.drawLabelValueRow(
            label,
            value,
            styles.textStyles.regular,
            styles.textStyles.regular,
            isLastRow ? { spacing: 16 } : { drawDivider: true, dividerMargin: 8 }
          );
        }
      }
    },
  }));
