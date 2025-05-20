import React, { useState } from 'react';
import { Box, Paper, Typography, Button, Collapse } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { LabTest, convertActivityDefinitionToTestItem } from 'utils';
import { History } from './History';
import { ResultEntryRadioButton } from './ResultEntryRadioButton';
import { ResultEntryTable } from './ResultsEntryTable';
import { ActivityDefinition } from 'fhir/r4b';
import { useForm, FormProvider } from 'react-hook-form';

// temp for testing
const URINALYSIS_AD: ActivityDefinition = {
  resourceType: 'ActivityDefinition',
  status: 'active',
  kind: 'ServiceRequest',
  code: {
    coding: [
      {
        system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-test-code',
        code: 'Urinalysis (UA)',
      },
      {
        system: 'http://www.ama-assn.org/go/cpt',
        code: '81003',
      },
    ],
  },
  title: 'Urinalysis (UA)',
  name: 'Urinalysis (UA)',
  participant: [
    {
      type: 'device',
      role: {
        coding: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-test-participant-role',
            code: 'analyzer',
            display: 'Clinitek / Multitsix',
          },
        ],
      },
    },
  ],
  observationRequirement: [
    {
      type: 'ObservationDefinition',
      reference: '#contained-glucose-component-codeableconcept-observationDef-id',
    },
    {
      type: 'ObservationDefinition',
      reference: '#contained-bilirubin-component-codeableconcept-observationDef-id',
    },
    {
      type: 'ObservationDefinition',
      reference: '#contained-ketone-component-codeableconcept-observationDef-id',
    },
    {
      type: 'ObservationDefinition',
      reference: '#contained-specificgravity-component-quantity-observationDef-id',
    },
    {
      type: 'ObservationDefinition',
      reference: '#contained-blood-component-codeableconcept-observationDef-id',
    },
    {
      type: 'ObservationDefinition',
      reference: '#contained-ph-component-quantity-observationDef-id',
    },
    {
      type: 'ObservationDefinition',
      reference: '#contained-protein-component-codeableconcept-observationDef-id',
    },
    {
      type: 'ObservationDefinition',
      reference: '#contained-urobilinogen-component-quantity-observationDef-id',
    },
    {
      type: 'ObservationDefinition',
      reference: '#contained-nitrite-component-codeableconcept-observationDef-id',
    },
    {
      type: 'ObservationDefinition',
      reference: '#contained-leukocytes-component-codeableconcept-observationDef-id',
    },
  ],
  contained: [
    {
      id: 'contained-Glucose-normal-valueSet',
      resourceType: 'ValueSet',
      status: 'active',
      compose: {
        include: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-result-valueSet',
            concept: [
              {
                code: 'Negative',
              },
              {
                code: 'Trace',
              },
              {
                code: '1+',
              },
              {
                code: '2+',
              },
              {
                code: '3+',
              },
              {
                code: '4+',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'contained-Glucose-abnormal-valueSet',
      resourceType: 'ValueSet',
      status: 'active',
      compose: {
        include: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-result-valueSet',
            concept: [
              {
                code: 'Trace',
              },
              {
                code: '1+',
              },
              {
                code: '2+',
              },
              {
                code: '3+',
              },
              {
                code: '4+',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'contained-glucose-component-codeableconcept-observationDef-id',
      resourceType: 'ObservationDefinition',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '2350-7',
          },
        ],
        text: 'Glucose',
      },
      permittedDataType: ['CodeableConcept'],
      validCodedValueSet: {
        type: 'ValueSet',
        reference: '#contained-Glucose-normal-valueSet',
      },
      abnormalCodedValueSet: {
        type: 'ValueSet',
        reference: '#contained-Glucose-abnormal-valueSet',
      },
      extension: [
        {
          url: 'http://ottehr.org/fhir/StructureDefinition/valueset-display',
          valueString: 'Select',
        },
      ],
    },
    {
      id: 'contained-Bilirubin-normal-valueSet',
      resourceType: 'ValueSet',
      status: 'active',
      compose: {
        include: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-result-valueSet',
            concept: [
              {
                code: 'Negative',
              },
              {
                code: '1+',
              },
              {
                code: '2+',
              },
              {
                code: '3+',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'contained-Bilirubin-abnormal-valueSet',
      resourceType: 'ValueSet',
      status: 'active',
      compose: {
        include: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-result-valueSet',
            concept: [
              {
                code: '1+',
              },
              {
                code: '2+',
              },
              {
                code: '3+',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'contained-bilirubin-component-codeableconcept-observationDef-id',
      resourceType: 'ObservationDefinition',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '1977-8',
          },
        ],
        text: 'Bilirubin',
      },
      permittedDataType: ['CodeableConcept'],
      validCodedValueSet: {
        type: 'ValueSet',
        reference: '#contained-Bilirubin-normal-valueSet',
      },
      abnormalCodedValueSet: {
        type: 'ValueSet',
        reference: '#contained-Bilirubin-abnormal-valueSet',
      },
      extension: [
        {
          url: 'http://ottehr.org/fhir/StructureDefinition/valueset-display',
          valueString: 'Select',
        },
      ],
    },
    {
      id: 'contained-Ketone-normal-valueSet',
      resourceType: 'ValueSet',
      status: 'active',
      compose: {
        include: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-result-valueSet',
            concept: [
              {
                code: 'Negative',
              },
              {
                code: 'Trace',
              },
              {
                code: 'Small',
              },
              {
                code: 'Moderate',
              },
              {
                code: 'Large',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'contained-Ketone-abnormal-valueSet',
      resourceType: 'ValueSet',
      status: 'active',
      compose: {
        include: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-result-valueSet',
            concept: [
              {
                code: 'Trace',
              },
              {
                code: 'Small',
              },
              {
                code: 'Moderate',
              },
              {
                code: 'Large',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'contained-ketone-component-codeableconcept-observationDef-id',
      resourceType: 'ObservationDefinition',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '49779-2',
          },
        ],
        text: 'Ketone',
      },
      permittedDataType: ['CodeableConcept'],
      validCodedValueSet: {
        type: 'ValueSet',
        reference: '#contained-Ketone-normal-valueSet',
      },
      abnormalCodedValueSet: {
        type: 'ValueSet',
        reference: '#contained-Ketone-abnormal-valueSet',
      },
      extension: [
        {
          url: 'http://ottehr.org/fhir/StructureDefinition/valueset-display',
          valueString: 'Select',
        },
      ],
    },
    {
      id: 'contained-specificgravity-component-quantity-observationDef-id',
      resourceType: 'ObservationDefinition',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '2965-2',
          },
        ],
        text: 'Specific gravity',
      },
      permittedDataType: ['Quantity'],
      quantitativeDetails: {
        decimalPrecision: 3,
      },
      qualifiedInterval: [
        {
          category: 'reference',
          range: {
            low: {
              value: 1.005,
            },
            high: {
              value: 1.03,
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
    {
      id: 'contained-Blood-normal-valueSet',
      resourceType: 'ValueSet',
      status: 'active',
      compose: {
        include: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-result-valueSet',
            concept: [
              {
                code: 'Negative',
              },
              {
                code: 'Trace',
              },
              {
                code: 'Small',
              },
              {
                code: 'Moderate',
              },
              {
                code: 'Large',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'contained-Blood-abnormal-valueSet',
      resourceType: 'ValueSet',
      status: 'active',
      compose: {
        include: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-result-valueSet',
            concept: [
              {
                code: 'Trace',
              },
              {
                code: 'Small',
              },
              {
                code: 'Moderate',
              },
              {
                code: 'Large',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'contained-blood-component-codeableconcept-observationDef-id',
      resourceType: 'ObservationDefinition',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '105906-2',
          },
        ],
        text: 'Blood',
      },
      permittedDataType: ['CodeableConcept'],
      validCodedValueSet: {
        type: 'ValueSet',
        reference: '#contained-Blood-normal-valueSet',
      },
      abnormalCodedValueSet: {
        type: 'ValueSet',
        reference: '#contained-Blood-abnormal-valueSet',
      },
      extension: [
        {
          url: 'http://ottehr.org/fhir/StructureDefinition/valueset-display',
          valueString: 'Select',
        },
      ],
    },
    {
      id: 'contained-ph-component-quantity-observationDef-id',
      resourceType: 'ObservationDefinition',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '2756-5',
          },
        ],
        text: 'pH',
      },
      permittedDataType: ['Quantity'],
      quantitativeDetails: {
        decimalPrecision: 1,
      },
      qualifiedInterval: [
        {
          category: 'reference',
          range: {
            low: {
              value: 5,
            },
            high: {
              value: 8,
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
    {
      id: 'contained-Protein-normal-valueSet',
      resourceType: 'ValueSet',
      status: 'active',
      compose: {
        include: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-result-valueSet',
            concept: [
              {
                code: 'Negative',
              },
              {
                code: 'Trace',
              },
              {
                code: '1+',
              },
              {
                code: '2+',
              },
              {
                code: '3+',
              },
              {
                code: '4+',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'contained-Protein-abnormal-valueSet',
      resourceType: 'ValueSet',
      status: 'active',
      compose: {
        include: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-result-valueSet',
            concept: [
              {
                code: 'Trace',
              },
              {
                code: '1+',
              },
              {
                code: '2+',
              },
              {
                code: '3+',
              },
              {
                code: '4+',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'contained-protein-component-codeableconcept-observationDef-id',
      resourceType: 'ObservationDefinition',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '2888-6',
          },
        ],
        text: 'Protein',
      },
      permittedDataType: ['CodeableConcept'],
      validCodedValueSet: {
        type: 'ValueSet',
        reference: '#contained-Protein-normal-valueSet',
      },
      abnormalCodedValueSet: {
        type: 'ValueSet',
        reference: '#contained-Protein-abnormal-valueSet',
      },
      extension: [
        {
          url: 'http://ottehr.org/fhir/StructureDefinition/valueset-display',
          valueString: 'Select',
        },
      ],
    },
    {
      id: 'contained-urobilinogen-component-quantity-observationDef-id',
      resourceType: 'ObservationDefinition',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '32727-0',
          },
        ],
        text: 'Urobilinogen',
      },
      permittedDataType: ['Quantity'],
      quantitativeDetails: {
        decimalPrecision: 1,
        unit: {
          coding: [
            {
              system: 'http://unitsofmeasure.org/',
              code: 'EU/dL',
            },
          ],
        },
      },
      qualifiedInterval: [
        {
          category: 'reference',
          range: {
            low: {
              value: 0.2,
            },
            high: {
              value: 1,
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
    {
      id: 'contained-Nitrite-normal-valueSet',
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
      id: 'contained-Nitrite-abnormal-valueSet',
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
      id: 'contained-nitrite-component-codeableconcept-observationDef-id',
      resourceType: 'ObservationDefinition',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '32710-6',
          },
        ],
        text: 'Nitrite',
      },
      permittedDataType: ['CodeableConcept'],
      validCodedValueSet: {
        type: 'ValueSet',
        reference: '#contained-Nitrite-normal-valueSet',
      },
      abnormalCodedValueSet: {
        type: 'ValueSet',
        reference: '#contained-Nitrite-abnormal-valueSet',
      },
      extension: [
        {
          url: 'http://ottehr.org/fhir/StructureDefinition/valueset-display',
          valueString: 'Select',
        },
      ],
    },
    {
      id: 'contained-Leukocytes-normal-valueSet',
      resourceType: 'ValueSet',
      status: 'active',
      compose: {
        include: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-result-valueSet',
            concept: [
              {
                code: 'Negative',
              },
              {
                code: 'Trace',
              },
              {
                code: 'Small',
              },
              {
                code: 'Moderate',
              },
              {
                code: 'Large',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'contained-Leukocytes-abnormal-valueSet',
      resourceType: 'ValueSet',
      status: 'active',
      compose: {
        include: [
          {
            system: 'http://ottehr.org/fhir/StructureDefinition/in-house-lab-result-valueSet',
            concept: [
              {
                code: 'Trace',
              },
              {
                code: 'Small',
              },
              {
                code: 'Moderate',
              },
              {
                code: 'Large',
              },
            ],
          },
        ],
      },
    },
    {
      id: 'contained-leukocytes-component-codeableconcept-observationDef-id',
      resourceType: 'ObservationDefinition',
      code: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '105105-1',
          },
        ],
        text: 'Leukocytes',
      },
      permittedDataType: ['CodeableConcept'],
      validCodedValueSet: {
        type: 'ValueSet',
        reference: '#contained-Leukocytes-normal-valueSet',
      },
      abnormalCodedValueSet: {
        type: 'ValueSet',
        reference: '#contained-Leukocytes-abnormal-valueSet',
      },
      extension: [
        {
          url: 'http://ottehr.org/fhir/StructureDefinition/valueset-display',
          valueString: 'Select',
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
    versionId: '60af563b-8144-49a0-bcae-d8e5afaa8781',
    lastUpdated: '2025-05-14T20:28:17.889Z',
  },
  id: 'a69430e2-ba6f-43c7-a9ed-8844f121e84e',
};

interface PerformTestViewProps {
  testDetails: LabTest;
  onBack: () => void;
  onSubmit: (data: any) => void;
}

export const PerformTestView: React.FC<PerformTestViewProps> = ({ testDetails, onBack }) => {
  const methods = useForm<{ [key: string]: any }>();
  const [showDetails, setShowDetails] = useState(false);
  const [notes, setNotes] = useState(testDetails.notes || '');

  // temp for testing
  const testItem = convertActivityDefinitionToTestItem(URINALYSIS_AD);
  console.log('testDetails', testDetails);
  console.log('testItem', testItem);

  const handleToggleDetails = (): void => {
    setShowDetails(!showDetails);
  };

  const handleReprintLabel = (): void => {
    console.log('Reprinting label for test:', testDetails.id);
  };

  // // todo handleWrites
  // const handleSubmit = (): void => {
  //   onSubmit({
  //     status: 'FINAL',
  //     result,
  //     notes,
  //   });
  // };

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
          <form onSubmit={methods.handleSubmit((data) => console.log('testing submit', data))}>
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

                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => console.log('ugh')}
                  // disabled={!result}
                  type="submit"
                  sx={{ borderRadius: '50px', px: 4 }}
                >
                  Submit
                </Button>
              </Box>
            </Box>
          </form>
        </FormProvider>
      </Paper>
    </Box>
  );
};
