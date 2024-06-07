import { FC } from 'react';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';

export const HeadCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('head');

  return (
    <ExamCardContainer
      label="Head"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      rightComponent={<ExamCommentField name="head-comment" />}
      grid={[
        {
          Normal: <ExamFieldsFactory card="head" group="normal" />,
        },
      ]}
    />
  );
};
