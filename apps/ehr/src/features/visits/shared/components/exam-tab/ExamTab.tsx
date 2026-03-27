import { Alert, CircularProgress, Stack } from '@mui/material';
import type { ExamCardComponent, ExamItemConfig } from 'config-types';
import { FC, useMemo } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { examConfig } from 'utils';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import {
  useExamObservationsInitializationStore,
  useExamObservationsStore,
} from '../../stores/appointment/exam-observations.store';
import { useAppFlags } from '../../stores/contexts/useAppFlags';
import { ExaminationContainer } from '../review-tab/components/ExaminationContainer';
import { ExamTable } from './ExamTable';

function collectKnownFields(config: ExamItemConfig): Set<string> {
  const fields = new Set<string>();

  const extractFromComponents = (components: Record<string, ExamCardComponent>): void => {
    Object.entries(components).forEach(([key, component]) => {
      if (component.type === 'checkbox' || component.type === 'modal-exam') {
        fields.add(key);
      } else if (component.type === 'text') {
        fields.add(key);
      } else if (component.type === 'dropdown') {
        fields.add(key);
        Object.keys(component.components).forEach((optKey) => fields.add(optKey));
      } else if (component.type === 'column') {
        extractFromComponents(component.components);
      } else if (component.type === 'multi-select') {
        fields.add(key);
        Object.keys(component.options).forEach((optKey) => fields.add(optKey));
      } else if (component.type === 'form') {
        Object.keys(component.components).forEach((elemKey) => fields.add(elemKey));
      }
    });
  };

  Object.values(config).forEach((section) => {
    extractFromComponents(section.components.normal);
    extractFromComponents(section.components.abnormal);
    Object.keys(section.components.comment).forEach((key) => fields.add(key));
  });

  return fields;
}

export const ExamTab: FC = () => {
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const { isInPerson } = useAppFlags();
  const hasInitialData = useExamObservationsInitializationStore((state) => state.hasInitialData);
  const examObservations = useExamObservationsStore();

  const config = examConfig[isInPerson ? 'inPerson' : 'telemed'].default.components;

  const unmatchedFields = useMemo(() => {
    if (!hasInitialData) return [];
    const knownFields = collectKnownFields(config);
    return Object.keys(examObservations).filter(
      (field) => examObservations[field]?.value === true && !knownFields.has(field)
    );
  }, [hasInitialData, config, examObservations]);

  return (
    <Stack direction="column" gap={1}>
      {!hasInitialData ? (
        <Stack direction="row" justifyContent="center">
          <CircularProgress />
        </Stack>
      ) : (
        <>
          {unmatchedFields.length > 0 && (
            <Alert severity="warning">
              This exam contains {unmatchedFields.length} finding{unmatchedFields.length > 1 ? 's' : ''} from a template
              that {unmatchedFields.length > 1 ? 'do' : 'does'} not match the current exam configuration:{' '}
              {unmatchedFields.join(', ')}. These findings are saved but not displayed. Be sure to review the exam
              details carefully and update the template when possible.
            </Alert>
          )}
          {isReadOnly ? (
            <AccordionCard>
              <Stack p={2}>
                <ExaminationContainer examConfig={config} />
              </Stack>
            </AccordionCard>
          ) : (
            <ExamTable examConfig={config} />
          )}
        </>
      )}
    </Stack>
  );
};
