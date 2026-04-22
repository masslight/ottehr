import { Button } from '@mui/material';
import { Coverage, Patient } from 'fhir/r4b';
import { FC, useMemo } from 'react';
import { Section } from 'src/components/layout';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  checkCoverageMatchesDetails,
  CoverageCheckWithDetails,
  CoverageWithPriority,
  PATIENT_RECORD_CONFIG,
} from 'utils';
import { InsuranceContainer } from './InsuranceContainer';
import { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';

const insuranceSection = PATIENT_RECORD_CONFIG.FormFields.insurance;

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
}) => {
  const primary = usePatientRecordFormSection({ formSection: insuranceSection, index: 0 });
  const secondary = usePatientRecordFormSection({ formSection: insuranceSection, index: 1 });

  const { fieldKeys, requiredFieldKeys } = useMemo(() => {
    const renderedOrdinals = new Set<number>();
    coverages.forEach((c) => renderedOrdinals.add(c.startingPriority - 1));
    if (isAddingInsurance) renderedOrdinals.add(newInsuranceOrdinal - 1);

    const collected: string[] = [];
    const collectedRequired: string[] = [];
    [primary, secondary].forEach((section, index) => {
      if (!renderedOrdinals.has(index)) return;
      const keys = Object.values(section.items).map((item) => item.key);
      collected.push(...keys);
      collectedRequired.push(...section.requiredFields.filter((key) => keys.includes(key)));
    });
    return { fieldKeys: collected, requiredFieldKeys: collectedRequired };
  }, [coverages, isAddingInsurance, newInsuranceOrdinal, primary, secondary]);

  return (
    <Section
      title="Insurance information"
      titleWidget={
        <SectionSaveButton
          fieldKeys={fieldKeys}
          requiredFieldKeys={requiredFieldKeys}
          patientId={patient.id}
          encounterId={encounterId}
        />
      }
    >
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
        />
      ))}
      {isAddingInsurance && (
        <InsuranceContainer
          patientId={patient.id ?? ''}
          ordinal={newInsuranceOrdinal}
          isNew
          onCancelAdd={onCancelAddInsurance}
          renderWithoutSection
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
};
