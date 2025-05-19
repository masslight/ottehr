import React, { useState } from 'react';
import { Box, Paper, Typography, Button, Collapse } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { LabTest, convertActivityDefinitionToTestItem } from 'utils';
import { History } from './History';
import { ResultEntryRadioButton } from './ResultEntryRadioButton';
import { ResultEntryTable } from './ResultsEntrySelectTable';
import { ActivityDefinition } from 'fhir/r4b';

// temp for testing
const GLUCOSE_TEST: ActivityDefinition = {
  resourceType: 'ActivityDefinition',
  status: 'active',
  kind: 'ServiceRequest',
  code: {
    coding: [
      {
        system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-test-code',
        code: 'Glucose Finger/Heel Stick',
      },
      {
        system: 'http://www.ama-assn.org/go/cpt',
        code: '82962',
      },
    ],
  },
  title: 'Glucose Finger/Heel Stick',
  name: 'Glucose Finger/Heel Stick',
  participant: [
    {
      type: 'device',
      role: {
        coding: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-test-participant-role',
            code: 'manual',
            display: 'Stick & glucometer',
          },
        ],
      },
    },
  ],
  observationRequirement: [
    {
      type: 'ObservationDefinition',
      reference: '#contained-GlucoseFingerHeelStick-quantity-observationDef-id',
    },
  ],
  contained: [
    {
      id: 'contained-GlucoseFingerHeelStick-quantity-observationDef-id',
      resourceType: 'ObservationDefinition',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '32016-8',
          },
        ],
        text: 'Glucose Finger/Heel Stick',
      },
      permittedDataType: ['Quantity'],
      quantitativeDetails: {
        unit: {
          coding: [
            {
              system: 'http://unitsofmeasure.org/',
              code: 'mg/dL',
            },
          ],
        },
      },
      qualifiedInterval: [
        {
          category: 'reference',
          range: {
            low: {
              value: 70,
            },
            high: {
              value: 140,
            },
          },
        },
      ],
      extension: [
        {
          url: 'http://ottehr.org/fhir/StructureDefinition/valueset-display',
          valueString: 'Numeric',
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
    versionId: '5666dfab-70e0-4db0-9e07-cb2d53b01cb9',
    lastUpdated: '2025-05-14T20:28:16.472Z',
  },
  id: 'bbdd7dbe-2359-4a77-be85-e3280683285f',
};

interface PerformTestViewProps {
  testDetails: LabTest;
  onBack: () => void;
  onSubmit: (data: any) => void;
}

// interface ResultEntry {
//   enteredValue: string;

// }

export const PerformTestView: React.FC<PerformTestViewProps> = ({ testDetails, onBack, onSubmit }) => {
  const [result, setResult] = useState<string | null>(testDetails.result || null);
  const [showDetails, setShowDetails] = useState(false);
  const [notes, setNotes] = useState(testDetails.notes || '');

  // temp for testing
  const testItem = convertActivityDefinitionToTestItem(GLUCOSE_TEST);
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

          {testItem.components.groupedComponents.length && (
            <ResultEntryTable
              selectComponents={testItem.components.groupedComponents}
              result={result}
              setResult={setResult}
            />
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
