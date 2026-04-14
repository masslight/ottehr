import { Box } from '@mui/material';
import type { ExamItemConfig } from 'config-types';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { collectKnownExamFields, extractObservationsFromExamComponents } from 'utils';
import { useExamObservationsStore } from '../../../stores/appointment/exam-observations.store';
import { ExamReviewGroup } from './ExamReviewGroup';

type ExaminationContainerProps = {
  examConfig: ExamItemConfig;
};

export const ExaminationContainer: FC<ExaminationContainerProps> = (props) => {
  const { examConfig } = props;

  console.log('check me!', examConfig);

  const examObservations = useExamObservationsStore();

  console.log('examObservations', examObservations);

  const knownFields = collectKnownExamFields(examConfig);

  const getSectionObservations = (
    sectionKey: string
  ): {
    normalItems: { field: string; label: string; abnormal: boolean }[];
    abnormalItems: { field: string; label: string; abnormal: boolean }[];
  } => {
    const section = examConfig[sectionKey];
    if (!section) return { normalItems: [], abnormalItems: [] };

    const normalItems = extractObservationsFromExamComponents(section.components.normal, 'normal', examObservations);
    const abnormalItems = extractObservationsFromExamComponents(
      section.components.abnormal,
      'abnormal',
      examObservations
    );

    return { normalItems, abnormalItems };
  };

  // Find unmatched observations that have value=true but aren't in the config
  const unmatchedItems = Object.values(examObservations)
    .filter((obs) => obs.value === true && !knownFields.has(obs.field))
    .map((obs) => ({
      field: obs.field,
      label: obs.label || obs.field,
      abnormal: true,
    }));

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      data-testid={dataTestIds.telemedEhrFlow.reviewTabExaminationsContainer}
    >
      {Object.entries(examConfig)
        .map(([sectionKey, section]) => {
          const { normalItems, abnormalItems } = getSectionObservations(sectionKey);
          const allItems = [...normalItems, ...abnormalItems];
          const comment = Object.keys(section.components.comment)
            .map((key) => examObservations[key]?.note)
            .filter((note) => note !== undefined)
            .join(' ');

          if (allItems.length === 0 && !comment) {
            return null;
          }

          return <ExamReviewGroup key={sectionKey} label={section.label} items={allItems} comment={comment} />;
        })
        .filter(Boolean)}
      {unmatchedItems.length > 0 && <ExamReviewGroup label="Other findings" items={unmatchedItems} />}
    </Box>
  );
};
