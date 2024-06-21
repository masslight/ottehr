import { FC } from 'react';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';

export const EarsCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('ears');

  return (
    <ExamCardContainer
      label="Ears"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      rightComponent={<ExamCommentField name="ears-comment" />}
      grid={[
        {
          'Right ear': <ExamFieldsFactory card="ears" group="rightEar" radio />,
          'Left ear': <ExamFieldsFactory card="ears" group="leftEar" radio />,
        },
      ]}
    />
  );
};
