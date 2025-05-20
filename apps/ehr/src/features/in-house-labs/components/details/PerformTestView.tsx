import React, { useState } from 'react';
import { Box, Paper, Typography, Button, Collapse } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { LabTest, convertActivityDefinitionToTestItem, ResultEntryInput } from 'utils';
import { History } from './History';
import { ResultEntryRadioButton } from './ResultEntryRadioButton';
import { ResultEntryTable } from './ResultsEntryTable';
import { ActivityDefinition } from 'fhir/r4b';
import { useForm, FormProvider, SubmitHandler } from 'react-hook-form';
import { handleInHouseLabResults } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { LoadingButton } from '@mui/lab';

// temp for testing
const STREP_ACTIVITY_DEFINTION: ActivityDefinition = {
  resourceType: 'ActivityDefinition',
  status: 'active',
  kind: 'ServiceRequest',
  code: {
    coding: [
      {
        system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-test-code',
        code: 'Rapid Strep A',
      },
      {
        system: 'http://www.ama-assn.org/go/cpt',
        code: '87880',
      },
    ],
  },
  title: 'Rapid Strep A',
  name: 'Rapid Strep A',
  participant: [
    {
      type: 'device',
      role: {
        coding: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-test-participant-role',
            code: 'manual',
            display: 'Strip Test (reagent strip)',
          },
        ],
      },
    },
  ],
  observationRequirement: [
    {
      type: 'ObservationDefinition',
      reference: '#contained-RapidStrepA-codeableConcept-observationDef-id',
    },
  ],
  contained: [
    {
      id: 'contained-RapidStrepA-normal-valueSet',
      resourceType: 'ValueSet',
      status: 'active',
      compose: {
        include: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-result-valueSet',
            concept: [
              {
                code: 'Positive',
              },
              {
                code: 'Negative',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'contained-RapidStrepA-abnormal-valueSet',
      resourceType: 'ValueSet',
      status: 'active',
      compose: {
        include: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-result-valueSet',
            concept: [
              {
                code: 'Positive',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'contained-RapidStrepA-codeableConcept-observationDef-id',
      resourceType: 'ObservationDefinition',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '78012-2',
          },
        ],
        text: 'Rapid Strep A',
      },
      permittedDataType: ['CodeableConcept'],
      validCodedValueSet: {
        type: 'ValueSet',
        reference: '#contained-RapidStrepA-normal-valueSet',
      },
      abnormalCodedValueSet: {
        type: 'ValueSet',
        reference: '#contained-RapidStrepA-abnormal-valueSet',
      },
      extension: [
        {
          url: 'http://ottehr.org/fhir/StructureDefinition/valueset-display',
          valueString: 'Radio',
        },
        {
          url: 'http://ottehr.org/fhir/StructureDefinition/allow-null-value',
          valueCode: 'Unknown',
          valueString: 'Indeterminate / inconclusive / error',
        },
      ],
    },
  ],
  meta: {
    tag: [
      {
        system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-codes',
        code: 'in-house-lab-test-definition',
      },
    ],
    versionId: '37d2d986-7908-4cf5-84af-8067aa1e1744',
    lastUpdated: '2025-05-20T15:12:24.491Z',
  },
  id: '4f3df780-a0aa-41eb-aa6e-a69009afa812',
  url: 'https://ottehr.com/FHIR/InHouseLab/ActivityDefinition/RapidStrepA',
};

interface PerformTestViewProps {
  testDetails: LabTest;
  onBack: () => void;
  onSubmit: (data: any) => void;
}

export const PerformTestView: React.FC<PerformTestViewProps> = ({ testDetails, onBack }) => {
  const methods = useForm<ResultEntryInput>({ mode: 'onChange' });
  const {
    handleSubmit,
    formState: { isValid },
  } = methods;
  const [showDetails, setShowDetails] = useState(false);
  const [notes, setNotes] = useState(testDetails.notes || '');
  const [submittingResults, setSubmittingResults] = useState<boolean>(false);
  const { oystehrZambda: oystehr } = useApiClients();

  // temp testItem for testing
  // const testItem = convertActivityDefinitionToTestItem(URINALYSIS_AD);
  const testItem = convertActivityDefinitionToTestItem(STREP_ACTIVITY_DEFINTION);

  const handleToggleDetails = (): void => {
    setShowDetails(!showDetails);
  };

  const handleReprintLabel = (): void => {
    console.log('Reprinting label for test:', testDetails.id);
  };

  const handleResultEntrySubmit: SubmitHandler<ResultEntryInput> = async (data): Promise<void> => {
    setSubmittingResults(true);
    if (!oystehr) {
      console.log('no oystehr client! :o'); // todo add error handling
      return;
    }
    console.log('data being submitted', data);
    await handleInHouseLabResults(oystehr, {
      // serviceRequestId: 'e3c2b690-c97a-4fb0-b883-7675f61859df', // corresponds to URINALYSIS_AD
      serviceRequestId: 'c4c58a2e-b2e3-4730-b5d1-c4a4273a40f8', // corresponds to STREP_ACTIVITY_DEFINTION
      data: data,
    });
    setSubmittingResults(false);
  };

  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 2, fontWeight: 'medium' }}>
        {testDetails.diagnosis}
      </Typography>

      <Typography variant="h4" color="primary.dark" sx={{ mb: 3, fontWeight: 'bold' }}>
        Perform Test & Enter Results
      </Typography>

      <Paper sx={{ mb: 2 }}>
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(handleResultEntrySubmit)}>
            <Box sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" color="primary.dark" fontWeight="bold">
                  {testDetails.name}
                </Typography>
                <Box
                  sx={{
                    bgcolor: '#E8DEFF',
                    color: '#5E35B1',
                    fontWeight: 'bold',
                    px: 2,
                    py: 0.5,
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                  }}
                >
                  COLLECTED
                </Box>
              </Box>

              {testItem.components.radioComponents.map((component) => {
                return <ResultEntryRadioButton testItemComponent={component} />;
              })}

              {testItem.components.groupedComponents.length > 0 && (
                <ResultEntryTable testItemComponents={testItem.components.groupedComponents} />
              )}

              <Box display="flex" justifyContent="flex-end" mt={2} mb={3}>
                <Button
                  variant="text"
                  color="primary"
                  onClick={handleToggleDetails}
                  endIcon={showDetails ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                >
                  Details
                </Button>
              </Box>

              <Collapse in={showDetails}>
                <History
                  testDetails={testDetails}
                  setNotes={setNotes}
                  notes={notes}
                  handleReprintLabel={handleReprintLabel}
                />
              </Collapse>

              <Box display="flex" justifyContent="space-between">
                <Button variant="outlined" onClick={onBack} sx={{ borderRadius: '50px', px: 4 }}>
                  Back
                </Button>

                <LoadingButton
                  variant="contained"
                  color="primary"
                  loading={submittingResults}
                  disabled={!isValid}
                  type="submit"
                  sx={{ borderRadius: '50px', px: 4 }}
                >
                  Submit
                </LoadingButton>
              </Box>
            </Box>
          </form>
        </FormProvider>
      </Paper>
    </Box>
  );
};
