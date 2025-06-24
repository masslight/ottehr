import { Box, Paper, Typography } from '@mui/material';
import React, { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { formatDateForLabs, InHouseOrderDetailPageItemDTO, PageName, ResultEntryInput } from 'utils';
import { InHouseLabsStatusChip } from '../InHouseLabsStatusChip';
import { InHouseLabsDetailsCard } from './InHouseLabsDetailsCard';
import { ResultEntryRadioButton } from './ResultEntryRadioButton';
import { ResultEntryTable } from './ResultsEntryTable';

interface FinalResultCardProps {
  testDetails: InHouseOrderDetailPageItemDTO;
}

export const FinalResultCard: React.FC<FinalResultCardProps> = ({ testDetails }) => {
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
          {testDetails.labDetails.components.radioComponents.map((component, idx) => {
            return (
              <ResultEntryRadioButton
                key={`radio-btn-result-${idx}-${component.componentName}`}
                testItemComponent={component}
                disabled={true}
              />
            );
          })}

          {testDetails.labDetails.components.groupedComponents.length > 0 && (
            <ResultEntryTable
              testItemComponents={testDetails.labDetails.components.groupedComponents}
              disabled={true}
            />
          )}
        </FormProvider>
        <InHouseLabsDetailsCard
          testDetails={testDetails}
          page={PageName.final}
          showDetails={showDetails}
          setShowDetails={setShowDetails}
        />
      </Box>
    </Paper>
  );
};
