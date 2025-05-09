import { FC } from 'react';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { dataTestIds } from '../../../../constants/data-test-ids';

export const NeurologicalCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('neurological');

  return (
    <ExamCardContainer
      label="Neurological"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('neurological')}
      rightComponent={<ExamCommentField name="neurological-comment" />}
      grid={[
        {
          Normal: <ExamFieldsFactory card="neurological" group="normal" />,
        },
      ]}
    />
  );
};
