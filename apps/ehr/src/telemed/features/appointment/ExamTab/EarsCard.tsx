import { FC } from 'react';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';
import { dataTestIds } from '../../../../constants/data-test-ids';

export const EarsCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('ears');

  return (
    <ExamCardContainer
      label="Ears"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('ears')}
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
