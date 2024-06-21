import { FC } from 'react';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';

export const PsychCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('psych');

  return (
    <ExamCardContainer
      label="Psych"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      rightComponent={<ExamCommentField name="psych-comment" />}
      grid={[
        {
          Normal: <ExamFieldsFactory card="psych" group="normal" />,
          Abnormal: <ExamFieldsFactory card="psych" group="abnormal" />,
        },
      ]}
    />
  );
};
