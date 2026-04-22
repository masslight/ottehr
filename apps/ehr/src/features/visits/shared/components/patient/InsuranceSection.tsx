import { Button } from '@mui/material';
import { Coverage, Patient } from 'fhir/r4b';
import { FC } from 'react';
import { Section } from 'src/components/layout';
import { dataTestIds } from 'src/constants/data-test-ids';
import { checkCoverageMatchesDetails, CoverageCheckWithDetails, CoverageWithPriority } from 'utils';
import { InsuranceContainer } from './InsuranceContainer';

export const getEligibilityCheckDetailsForCoverage = (
  coverage: Coverage,
  coverageChecks: CoverageCheckWithDetails[]
): CoverageCheckWithDetails | undefined => {
  return coverageChecks.find((check) => checkCoverageMatchesDetails(coverage, check));
};

export const InsuranceSection: FC<{
  coverages: CoverageWithPriority[];
  patient: Patient;
  accountData: any;
  removeCoverage: any;
  onRemoveCoverage: (coverageId: string) => void;
  isAddingInsurance: boolean;
  onStartAddInsurance: () => void;
  onCancelAddInsurance: () => void;
  newInsuranceOrdinal: number;
  encounterId?: string;
}> = ({
  coverages,
  patient,
  accountData,
  removeCoverage,
  onRemoveCoverage,
  isAddingInsurance,
  onStartAddInsurance,
  onCancelAddInsurance,
  newInsuranceOrdinal,
  encounterId,
}) => (
  <Section title="Insurance information">
    {coverages.map((coverage) => (
      <InsuranceContainer
        key={coverage.resource.id}
        patientId={patient.id ?? ''}
        ordinal={coverage.startingPriority}
        initialEligibilityCheck={getEligibilityCheckDetailsForCoverage(
          coverage.resource,
          accountData?.coverageChecks ?? []
        )}
        removeInProgress={removeCoverage.isPending}
        handleRemoveClick={
          coverage.resource.id !== undefined ? () => onRemoveCoverage(coverage.resource.id!) : undefined
        }
        renderWithoutSection
        encounterId={encounterId}
      />
    ))}
    {isAddingInsurance && (
      <InsuranceContainer
        patientId={patient.id ?? ''}
        ordinal={newInsuranceOrdinal}
        isNew
        onCancelAdd={onCancelAddInsurance}
        renderWithoutSection
        encounterId={encounterId}
      />
    )}
    {coverages.length < 2 && !isAddingInsurance && (
      <Button
        data-testid={dataTestIds.patientInformationPage.addInsuranceButton}
        variant="outlined"
        color="primary"
        onClick={onStartAddInsurance}
        sx={{
          borderRadius: 25,
          textTransform: 'none',
          fontWeight: 'bold',
          width: 'fit-content',
        }}
      >
        + Add Insurance
      </Button>
    )}
  </Section>
);
