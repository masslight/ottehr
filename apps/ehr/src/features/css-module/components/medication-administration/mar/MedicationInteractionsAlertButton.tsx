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
  const hasInteractionItems =
    medication.interactions &&
    (medication.interactions.allergyInteractions.length > 0 || medication.interactions.drugInteractions.length > 0);
  const interactionsCheckFailed = !medication.interactions;
  return (
    <Box onClick={(e) => e.stopPropagation()}>
      {hasInteractionItems || interactionsCheckFailed ? (
        <GenericToolTip
          title={
            medication.interactions
              ? 'Interactions: ' + interactionsSummary(medication.interactions) + '. Click on alert icon to see details'
              : 'Drug-to-Drug and Drug-Allergy interaction check failed. Please review manually.'
          }
          customWidth="500px"
          placement="top"
        >
          <IconButton
            onClick={() => {
              if (hasInteractionItems) {
                setShowInteractionAlerts(true);
              }
            }}
          >
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
