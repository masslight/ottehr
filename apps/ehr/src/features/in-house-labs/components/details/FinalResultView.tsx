import React from 'react';
import { Box, Paper, Typography, Button, Chip } from '@mui/material';
// import { LabTest } from 'utils';
import { InHouseLabDTO, ResultEntryInput } from 'utils';
import { ResultEntryRadioButton } from './ResultEntryRadioButton';
// import { ResultEntryTable } from './ResultsEntryTable';
import { useForm, FormProvider } from 'react-hook-form';

interface FinalResultViewProps {
  testDetails: InHouseLabDTO;
  onBack: () => void;
}

export const FinalResultView: React.FC<FinalResultViewProps> = ({ testDetails, onBack }) => {
  const radioResultMap = testDetails.labDetails.components.radioComponents.reduce((acc: any, item) => {
    if (item.result?.entry) acc[item.observationDefinitionId] = item.result.entry;
    return acc;
  }, {});
  const tableResultMap = testDetails.labDetails.components.groupedComponents.reduce((acc: any, item) => {
    if (item.result?.entry) acc[item.observationDefinitionId] = item.result.entry;
    return acc;
  }, {});
  const methods = useForm<ResultEntryInput>({
    defaultValues: { ...radioResultMap, ...tableResultMap },
  });

  return (
    <FormProvider {...methods}>
      <Box>
        <Typography variant="body1" sx={{ mb: 2, fontWeight: 'medium' }}>
          {testDetails.diagnosis}
        </Typography>

        <Paper sx={{ mb: 2 }}>
          <Box sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
              <Typography variant="h5" color="primary.dark" fontWeight="bold">
                {testDetails.name}
              </Typography>
              <Chip
                label="FINAL"
                sx={{
                  color: '#1976D2',
                  bgcolor: '#E6F4FF',
                  fontWeight: 'bold',
                  borderRadius: '4px',
                  height: '24px',
                }}
              />
            </Box>
            {testDetails.labDetails.components.radioComponents.map((component) => {
              return <ResultEntryRadioButton testItemComponent={component} disabled={true} />;
            })}

            {/* {testDetails.labDetails.components.groupedComponents.length > 0 && (
            <ResultEntryTable testItemComponents={testDetails.labDetails.components.groupedComponents} />
          )} */}
          </Box>
        </Paper>
        <Box display="flex" justifyContent="space-between" alignItems="center" mt={3}>
          <Button variant="outlined" onClick={onBack} sx={{ borderRadius: '50px', px: 4 }}>
            Back
          </Button>
        </Box>
      </Box>
    </FormProvider>
  );
};
