import { FC } from 'react';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';

export const NoseCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('nose');

  return (
    <ExamCardContainer
      label="Nose"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      rightComponent={<ExamCommentField name="nose-comment" />}
      grid={[
        {
          Normal: <ExamFieldsFactory card="nose" group="normal" />,
          Abnormal: <ExamFieldsFactory card="nose" group="abnormal" />,
        },
      ]}
    />
  );
};
