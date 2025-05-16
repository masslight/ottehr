import React, { useState } from 'react';
import { Box, Paper, Typography, Button, Collapse } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { LabTest, convertActivityDefinitionToTestItem } from 'utils';
import { History } from './History';
import { ResultEntryRadioButton } from './ResultEntryRadioButton';
import { ActivityDefinition } from 'fhir/r4b';

// temp for testing
const STREP_ACTIVITY_DEFINTION: ActivityDefinition = {
  id: '6302b66e-3f2f-4e36-af42-e0c80eebc608',
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
    versionId: 'a40e5989-b16e-44ca-b2b6-9b17a8d6392b',
    lastUpdated: '2025-05-16T16:07:17.757Z',
  },
};

interface PerformTestViewProps {
  testDetails: LabTest;
  onBack: () => void;
  onSubmit: (data: any) => void;
}

export const PerformTestView: React.FC<PerformTestViewProps> = ({ testDetails, onBack, onSubmit }) => {
  const [result, setResult] = useState<string | null>(testDetails.result || null);
  const [showDetails, setShowDetails] = useState(false);
  const [notes, setNotes] = useState(testDetails.notes || '');

  const testItem = convertActivityDefinitionToTestItem(STREP_ACTIVITY_DEFINTION);
  console.log('testDetails', testDetails);
  console.log('testItem', testItem);

  const handleToggleDetails = (): void => {
    setShowDetails(!showDetails);
  };

  const handleReprintLabel = (): void => {
    console.log('Reprinting label for test:', testDetails.id);
  };

  // todo handleWrites
  const handleSubmit = (): void => {
    onSubmit({
      status: 'FINAL',
      result,
      notes,
    });
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
            return <ResultEntryRadioButton testItemComponent={component} result={result} setResult={setResult} />;
          })}

          {/* todo write this component */}
          {testItem.components.selectComponents.map((component) => {
            return <div>nothing should be here yet but it is??? {component.componentName}</div>;
          })}

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

            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit}
              disabled={!result}
              sx={{ borderRadius: '50px', px: 4 }}
            >
              Submit
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
