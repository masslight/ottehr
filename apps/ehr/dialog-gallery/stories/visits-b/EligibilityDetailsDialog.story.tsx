import { EligibilityDetailsDialog } from 'src/features/visits/shared/components/patient/EligibilityDetailsDialog';
import { CoverageCheckWithDetails } from 'utils/lib/types/api/patient-account';
import { InsuranceEligibilityCheckStatus } from 'utils/lib/types/data/paperwork/paperwork.types';
import { defineStory } from '../../harness/story';

const eligibilityCheck = {
  status: InsuranceEligibilityCheckStatus.eligibilityConfirmed,
  dateISO: '2026-11-10T15:24:00.000Z',
  copay: [
    {
      code: 'UC',
      description: 'Urgent Care',
      coverageCode: 'B',
      coverageDescription: 'Co-Payment',
      inPlanNetworkCode: 'Y',
      amountInUSD: 40,
      percentage: 0,
      periodDescription: 'Visit',
      benefitNotes: 'Per visit, in-network facility',
    },
    {
      code: '98',
      description: 'Professional (Physician) Visit - Office',
      coverageCode: 'B',
      coverageDescription: 'Co-Payment',
      inPlanNetworkCode: 'Y',
      amountInUSD: 25,
      percentage: 0,
      periodDescription: 'Visit',
    },
    {
      code: 'UC',
      description: 'Urgent Care',
      coverageCode: 'B',
      coverageDescription: 'Co-Payment',
      inPlanNetworkCode: 'N',
      amountInUSD: 75,
      percentage: 0,
      periodDescription: 'Visit',
    },
    {
      code: '30',
      description: 'Health Benefit Plan Coverage',
      coverageCode: 'A',
      coverageDescription: 'Co-Insurance',
      inPlanNetworkCode: 'Y',
      amountInUSD: 0,
      percentage: 20,
      periodDescription: 'Calendar Year',
    },
  ],
  deductible: [],
  coverageDetails: {
    subscriber: {
      firstName: 'Maria',
      lastName: 'Alvarez',
      memberID: 'XJK482915077',
      dateOfBirth: '03/14/1986',
      address: '418 Linden Ave, Brooklyn, NY 11215',
    },
    patient: { firstName: 'Lucas', lastName: 'Alvarez', dateOfBirth: '07/22/2017' },
    insurance: {
      planNumber: 'PPO-20418',
      policyNumber: 'GRP-7731002',
      insuranceCode: 'PR',
      insuranceDescription: 'Preferred Provider Organization (PPO)',
    },
    payer: {
      name: 'Aetna',
      payerID: '60054',
      phone: '(800) 872-3862',
      address: 'PO Box 981106, El Paso, TX 79998',
    },
    plans: [],
    additionalPayers: [],
  },
} as unknown as CoverageCheckWithDetails;

export default defineStory({
  title: 'Insurance eligibility check details',
  source: 'apps/ehr/src/features/visits/shared/components/patient/EligibilityDetailsDialog.tsx',
  base: 'MUI Dialog',
  kind: 'viewer',
  where: 'Patient record / visit details → insurance card → eligibility status chip',
  notes: 'Mock eligibility response (confirmed, no error section). Taller than the viewport, so the paper scrolls.',
  render: () => (
    <EligibilityDetailsDialog
      open
      onClose={() => undefined}
      eligibilityCheck={eligibilityCheck}
      simpleStatus="ELIGIBLE"
    />
  ),
});
