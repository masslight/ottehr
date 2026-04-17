import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Checkbox,
  FormControlLabel,
  Grid,
  Typography,
} from '@mui/material';
import { FC, useCallback } from 'react';
import { ExamObservationDTO, RosCard, RosItemConfig } from 'utils';
import { useRosObservations } from '../../hooks/useRosObservations';

interface RosTableProps {
  config: RosItemConfig;
}

export const RosTable: FC<RosTableProps> = ({ config }) => {
  const { value: allObservations, update } = useRosObservations();
  const observationMap = (allObservations as ExamObservationDTO[]).reduce(
    (map, obs) => {
      map[obs.field] = obs;
      return map;
    },
    {} as Record<string, ExamObservationDTO>
  );

  const handleToggle = useCallback(
    (field: string, label: string, currentValue: boolean, resourceId?: string) => {
      update([
        {
          field,
          label,
          value: !currentValue,
          resourceId,
        },
      ]);
    },
    [update]
  );

  return (
    <Box>
      {Object.entries(config).map(([systemKey, system]: [string, RosCard]) => (
        <Accordion key={systemKey} defaultExpanded disableGutters sx={{ '&:before': { display: 'none' }, mb: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#F5F5F5', borderRadius: '4px' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              {system.label}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 1, pb: 2 }}>
            <Grid container spacing={0}>
              {Object.entries(system.items).map(([fieldKey, item]) => {
                const obs = observationMap[fieldKey];
                const isChecked = obs?.value === true;
                return (
                  <Grid item xs={6} sm={4} md={3} key={fieldKey}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={isChecked}
                          onChange={() => handleToggle(fieldKey, item.label, isChecked, obs?.resourceId)}
                          size="small"
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ fontSize: 13 }}>
                          {item.label}
                        </Typography>
                      }
                    />
                  </Grid>
                );
              })}
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};
