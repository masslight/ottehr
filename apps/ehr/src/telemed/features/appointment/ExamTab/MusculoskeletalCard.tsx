import { FC } from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory, MusculoskeletalForm } from './components';

export const MusculoskeletalCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('musculoskeletal');

  return (
    <ExamCardContainer
      label="Extremities/Musculoskeletal"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('musculoskeletal')}
      rightComponent={
        <ExamCommentField
          name="extremities-musculoskeletal-comment"
          dataTestId={dataTestIds.telemedEhrFlow.examTabCardsComments('musculoskeletal')}
        />
      }
      grid={[
        {
          Normal: <ExamFieldsFactory card="musculoskeletal" group="normal" />,
          Abnormal: <MusculoskeletalForm />,
        },
      ]}
    />
  );
};
