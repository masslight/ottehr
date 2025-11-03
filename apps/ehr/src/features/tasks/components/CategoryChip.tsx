import { Box, Typography } from '@mui/material';
import React from 'react';
import { IN_HOUSE_LAB_TASK, LAB_ORDER_TASK, MANUAL_TASK } from 'utils';

export const TASK_CATEGORY_LABEL: Record<string, string> = {};
TASK_CATEGORY_LABEL[LAB_ORDER_TASK.category] = 'External Lab';
TASK_CATEGORY_LABEL[IN_HOUSE_LAB_TASK.category] = 'In-house Lab';
TASK_CATEGORY_LABEL[MANUAL_TASK.category.externalLab] = 'External Lab';
TASK_CATEGORY_LABEL[MANUAL_TASK.category.inHouseLab] = 'In-house Lab';
TASK_CATEGORY_LABEL[MANUAL_TASK.category.inHouseMedications] = 'In-House Medications';
TASK_CATEGORY_LABEL[MANUAL_TASK.category.nursingOrders] = 'Nursing Orders';
TASK_CATEGORY_LABEL[MANUAL_TASK.category.patientFollowUp] = 'Patient Follow-up';
TASK_CATEGORY_LABEL[MANUAL_TASK.category.procedures] = 'Procedures';
TASK_CATEGORY_LABEL[MANUAL_TASK.category.radiology] = 'Radiology';
TASK_CATEGORY_LABEL[MANUAL_TASK.category.erx] = 'eRX';
TASK_CATEGORY_LABEL[MANUAL_TASK.category.charting] = 'Charting';
TASK_CATEGORY_LABEL[MANUAL_TASK.category.coding] = 'Coding';
TASK_CATEGORY_LABEL[MANUAL_TASK.category.other] = 'Other';

interface Props {
  category: string;
}

export const CategoryChip: React.FC<Props> = ({ category }) => {
  return (
    <Box
      style={{
        background: '#2169F51F',
        borderRadius: '16px',
        height: '24px',
        padding: '0 12px 0 12px',
      }}
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
    >
      <Typography variant="body2" display="inline" style={{ color: '#2169F5', fontSize: '13px' }}>
        {TASK_CATEGORY_LABEL[category] ?? 'Unknown'}
      </Typography>
    </Box>
  );
};
