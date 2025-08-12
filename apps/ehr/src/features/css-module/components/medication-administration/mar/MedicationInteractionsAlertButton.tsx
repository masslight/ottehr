import { otherColors } from '@ehrTheme/colors';
import PriorityHighOutlinedIcon from '@mui/icons-material/PriorityHighOutlined';
import { Box, IconButton } from '@mui/material';
import React, { useState } from 'react';
import { GenericToolTip } from 'src/components/GenericToolTip';
import { ExtendedMedicationDataForResponse } from 'utils';
import { InteractionAlertsDialog } from '../InteractionAlertsDialog';
import { interactionsSummary } from '../util';

interface Props {
  medication: ExtendedMedicationDataForResponse;
}

export const MedicationInteractionsAlertButton: React.FC<Props> = ({ medication }) => {
  const [showInteractionAlerts, setShowInteractionAlerts] = useState(false);

  return (
    <Box onClick={(e) => e.stopPropagation()}>
      {medication.interactions &&
      (medication.interactions.allergyInteractions.length > 0 ||
        medication.interactions.drugInteractions.length > 0) ? (
        <GenericToolTip
          title={
            'Interactions: ' + interactionsSummary(medication.interactions) + '. Click on alert icon to see details'
          }
          customWidth="500px"
          placement="top"
        >
          <IconButton onClick={() => setShowInteractionAlerts(true)}>
            <PriorityHighOutlinedIcon
              style={{
                width: '15px',
                height: '15px',
                color: '#FFF',
                background: otherColors.priorityHighIcon,
                borderRadius: '4px',
                padding: '1px 2px 1px 2px',
              }}
            />
          </IconButton>
        </GenericToolTip>
      ) : null}
      {showInteractionAlerts && medication.interactions ? (
        <InteractionAlertsDialog
          medicationName={medication.medicationName}
          interactions={medication.interactions}
          readonly={true}
          onCancel={() => setShowInteractionAlerts(false)}
        />
      ) : null}
    </Box>
  );
};
