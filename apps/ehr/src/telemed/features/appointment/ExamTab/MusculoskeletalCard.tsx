import { FC } from 'react';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory, MusculoskeletalForm } from './components';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { dataTestIds } from '../../../../constants/data-test-ids';

export const MusculoskeletalCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('musculoskeletal');

  return (
    <ExamCardContainer
      label="Extremities/Musculoskeletal"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('musculoskeletal')}
      rightComponent={<ExamCommentField name="extremities-musculoskeletal-comment" />}
      grid={[
        {
          Normal: <ExamFieldsFactory card="musculoskeletal" group="normal" />,
          Abnormal: <MusculoskeletalForm />,
        },
      ]}
    />
  );
};
