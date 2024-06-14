import { FC } from 'react';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';

export const BackCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('back');

  return (
    <ExamCardContainer
      label="Back"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      rightComponent={<ExamCommentField name="back-comment" />}
      grid={[
        {
          Normal: <ExamFieldsFactory card="back" group="normal" />,
          Abnormal: <ExamFieldsFactory card="back" group="abnormal" />,
        },
      ]}
    />
  );
};
