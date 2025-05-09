import { FC } from 'react';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { dataTestIds } from '../../../../constants/data-test-ids';

export const BackCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('back');

  return (
    <ExamCardContainer
      label="Back"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('back')}
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
