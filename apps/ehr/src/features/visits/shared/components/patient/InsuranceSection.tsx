import { Button } from '@mui/material';
import { Coverage, Patient } from 'fhir/r4b';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { checkCoverageMatchesDetails, CoverageCheckWithDetails, CoverageWithPriority } from 'utils';
import { InsuranceContainer } from './InsuranceContainer';

const getEligibilityCheckDetailsForCoverage = (
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
  onAddInsurance: () => void;
}> = ({ coverages, patient, accountData, removeCoverage, onRemoveCoverage, onAddInsurance }) => (
  <>
    {coverages.map((coverage) => (
      <InsuranceContainer
        key={coverage.resource.id}
        patientId={patient.id ?? ''}
        ordinal={coverage.startingPriority}
        initialEligibilityCheck={getEligibilityCheckDetailsForCoverage(
          coverage.resource,
          accountData?.coverageChecks ?? []
        )}
        removeInProgress={removeCoverage.isLoading}
        handleRemoveClick={
          coverage.resource.id !== undefined ? () => onRemoveCoverage(coverage.resource.id!) : undefined
        }
      />
    ))}
    {coverages.length < 2 && (
      <Button
        data-testid={dataTestIds.patientInformationPage.addInsuranceButton}
        variant="outlined"
        color="primary"
        onClick={onAddInsurance}
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
  </>
);
