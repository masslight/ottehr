import { FC } from 'react';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { dataTestIds } from '../../../../constants/data-test-ids';

export const ChestCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('chest');

  return (
    <ExamCardContainer
      label="Chest"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('chest')}
      rightComponent={<ExamCommentField name="chest-comment" />}
      grid={[
        {
          Normal: <ExamFieldsFactory card="chest" group="normal" />,
          Abnormal: <ExamFieldsFactory card="chest" group="abnormal" />,
        },
      ]}
    />
  );
};
