import { FC } from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';

export const EarsCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('ears');

  return (
    <ExamCardContainer
      label="Ears"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('ears')}
      rightComponent={
        <ExamCommentField name="ears-comment" dataTestId={dataTestIds.telemedEhrFlow.examTabCardsComments('ears')} />
      }
      grid={[
        {
          'Right ear': <ExamFieldsFactory card="ears" group="rightEar" radio />,
          'Left ear': <ExamFieldsFactory card="ears" group="leftEar" radio />,
        },
      ]}
    />
  );
};
