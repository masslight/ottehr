import { getFullName, PATIENT_RECORD_CONFIG, PRACTICE_NAME_URL, standardizePhoneNumber } from 'utils';
import { createConfiguredSection, DataComposer } from '../pdf-common';
import { PdfSection, PrimaryCarePhysician, PrimaryCarePhysicianInput } from '../types';

// Keep the line in sync with the EHR checkbox label by reading it from the
// same config the EHR uses (`PrimaryCareContainer` → `PatientRecordFormField`).
// Items in PATIENT_RECORD_CONFIG are typed as a union (input | display | group);
// `active` is a boolean input that has `label`, but the union doesn't, so we
// narrow with `'label' in item` — same guard pattern used elsewhere in the
// project (e.g. `apps/ehr/tests/e2e/specs/patientRecordPage.spec.ts`).
const pcpActiveItem = PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.active;
const NO_PCP_LABEL = ('label' in pcpActiveItem && pcpActiveItem.label) || '';

export const composePrimaryCarePhysicianData: DataComposer<PrimaryCarePhysicianInput, PrimaryCarePhysician> = ({
  physician,
}) => {
  // Same rule as EHR's `prePopulation` for `pcp-active`: a contained Practitioner
  // with `active === true` means the patient has a PCP; absent or `active === false`
  // means they explicitly indicated they don't.
  const hasPcp = !!physician && physician.active !== false;
  const pcpName = physician ? getFullName(physician) : '';
  const pcpPracticeName =
    physician?.extension?.find((e: { url: string }) => e.url === PRACTICE_NAME_URL)?.valueString ?? '';
  const pcpAddress = physician?.address?.[0]?.text ?? '';
  const pcpPhone =
    standardizePhoneNumber(
      physician?.telecom?.find((c) => c.system === 'phone' && c.period?.end === undefined)?.value
    ) ?? '';

  return {
    hasPcp,
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
      // No-PCP state: skip the empty field rows and print the same explanatory
      // line the EHR's `pcp-active` checkbox uses. Gated by `shouldShow('pcp-active')`
      // so customer overrides via `hiddenFields` are honored (just like the EHR
      // hides the checkbox when its key is in hiddenFields).
      if (!details.hasPcp) {
        if (shouldShow('pcp-active') && NO_PCP_LABEL) {
          client.drawText(NO_PCP_LABEL, styles.textStyles.regular);
        }
        return;
      }
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
