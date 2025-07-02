import { FC } from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';

export const HeadCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('head');

  return (
    <ExamCardContainer
      label="Head"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('head')}
      rightComponent={
        <ExamCommentField name="head-comment" dataTestId={dataTestIds.telemedEhrFlow.examTabCardsComments('head')} />
      }
      grid={[
        {
          Normal: <ExamFieldsFactory card="head" group="normal" />,
        },
      ]}
    />
  );
};
