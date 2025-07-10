import { FC } from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';

export const BackCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('back');

  return (
    <ExamCardContainer
      label="Back"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('back')}
      rightComponent={
        <ExamCommentField name="back-comment" dataTestId={dataTestIds.telemedEhrFlow.examTabCardsComments('back')} />
      }
      grid={[
        {
          Normal: <ExamFieldsFactory card="back" group="normal" />,
          Abnormal: <ExamFieldsFactory card="back" group="abnormal" />,
        },
      ]}
    />
  );
};
