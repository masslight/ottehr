import { FC } from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';

export const NeurologicalCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('neurological');

  return (
    <ExamCardContainer
      label="Neurological"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('neurological')}
      rightComponent={
        <ExamCommentField
          name="neurological-comment"
          dataTestId={dataTestIds.telemedEhrFlow.examTabCardsComments('neurological')}
        />
      }
      grid={[
        {
          Normal: <ExamFieldsFactory card="neurological" group="normal" />,
        },
      ]}
    />
  );
};
