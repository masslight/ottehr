import React, { useState } from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { ResultEntryInput, formatDateForLabs, InHouseOrderDetailPageDTO } from 'utils';
import { ResultEntryRadioButton } from './ResultEntryRadioButton';
import { ResultEntryTable } from './ResultsEntryTable';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { useForm, FormProvider } from 'react-hook-form';
import { InHouseLabOrderHistory } from './InHouseLabOrderHistory';
import { BiotechOutlined } from '@mui/icons-material';
import { InHouseLabsStatusChip } from '../InHouseLabsStatusChip';

interface FinalResultCardProps {
  testDetails: InHouseOrderDetailPageDTO;
}

export const FinalResultCard: React.FC<FinalResultCardProps> = ({ testDetails }) => {
  const openPdf = (): void => {
    if (testDetails.resultsPDFUrl) {
      window.open(testDetails.resultsPDFUrl, '_blank');
    }
  };
  const [showDetails, setShowDetails] = useState(false);

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
    <Paper sx={{ mb: 2 }}>
      <Box sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5" color="primary.dark" fontWeight="bold">
            {testDetails.testItemName}
          </Typography>
          <Box display="flex" alignItems="center" gap="8px">
            <Typography variant="body2">
              {formatDateForLabs(testDetails.orderAddedDate, testDetails.timezone)}
            </Typography>
            <InHouseLabsStatusChip status={testDetails.status} additionalStyling={{ height: '24px' }} />
          </Box>
        </Box>
        <FormProvider {...methods}>
          {testDetails.labDetails.components.radioComponents.map((component) => {
            return <ResultEntryRadioButton testItemComponent={component} disabled={true} />;
          })}

          {testDetails.labDetails.components.groupedComponents.length > 0 && (
            <ResultEntryTable
              testItemComponents={testDetails.labDetails.components.groupedComponents}
              disabled={true}
            />
          )}
        </FormProvider>

        <Box display="flex" justifyContent="space-between" mt={2} mb={3}>
          <Button
            variant="outlined"
            color="primary"
            sx={{ borderRadius: '50px', textTransform: 'none' }}
            onClick={() => openPdf()}
            startIcon={<BiotechOutlined />}
            disabled={!testDetails.resultsPDFUrl}
          >
            Results PDF
          </Button>
          <Button
            variant="text"
            color="primary"
            onClick={() => setShowDetails(!showDetails)}
            endIcon={showDetails ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          >
            Details
          </Button>
        </Box>
        <InHouseLabOrderHistory showDetails={showDetails} testDetails={testDetails} />
      </Box>
    </Paper>
  );
};
