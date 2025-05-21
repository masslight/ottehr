import React, { useState } from 'react';
import { Box, Paper, Typography, Button, Collapse } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { InHouseLabDTO } from 'utils';
import { History } from './History';
import { ResultEntryRadioButton } from './ResultEntryRadioButton';
import { ResultEntryTable } from './ResultsEntryTable';
import { useForm, FormProvider } from 'react-hook-form';

interface PerformTestViewProps {
  testDetails: InHouseLabDTO;
  onBack: () => void;
  onSubmit: (data: any) => void;
}

export const PerformTestView: React.FC<PerformTestViewProps> = ({ testDetails, onBack }) => {
  const methods = useForm<{ [key: string]: any }>();
  const [showDetails, setShowDetails] = useState(false);
  const [notes, setNotes] = useState(testDetails.notes || '');

  // // temp for testing
  // const testItem = convertActivityDefinitionToTestItem(URINALYSIS_AD);
  // console.log('testDetails', testDetails);
  // console.log('testItem', testItem);

  const handleToggleDetails = (): void => {
    setShowDetails(!showDetails);
  };

  const handleReprintLabel = (): void => {
    console.log('Reprinting label for test:', testDetails.serviceRequestId);
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

              {testDetails.labDetails.components.radioComponents.map((component) => {
                return <ResultEntryRadioButton testItemComponent={component} />;
              })}

              {testDetails.labDetails.components.groupedComponents.length > 0 && (
                <ResultEntryTable testItemComponents={testDetails.labDetails.components.groupedComponents} />
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
