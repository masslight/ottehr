import { FC } from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';

export const PsychCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('psych');

  return (
    <ExamCardContainer
      label="Psych"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('psych')}
      rightComponent={
        <ExamCommentField name="psych-comment" dataTestId={dataTestIds.telemedEhrFlow.examTabCardsComments('psych')} />
      }
      grid={[
        {
          Normal: <ExamFieldsFactory card="psych" group="normal" />,
          Abnormal: <ExamFieldsFactory card="psych" group="abnormal" />,
        },
      ]}
    />
  );
};
