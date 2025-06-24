import { FC } from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';

export const ChestCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('chest');

  return (
    <ExamCardContainer
      label="Chest"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('chest')}
      rightComponent={
        <ExamCommentField name="chest-comment" dataTestId={dataTestIds.telemedEhrFlow.examTabCardsComments('chest')} />
      }
      grid={[
        {
          Normal: <ExamFieldsFactory card="chest" group="normal" />,
          Abnormal: <ExamFieldsFactory card="chest" group="abnormal" />,
        },
      ]}
    />
  );
};
