import { FC } from 'react';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { dataTestIds } from '../../../../constants/data-test-ids';

export const PsychCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('psych');

  return (
    <ExamCardContainer
      label="Psych"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('psych')}
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
