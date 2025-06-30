import { FC } from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';

export const NeckCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('neck');

  return (
    <ExamCardContainer
      label="Neck"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('neck')}
      rightComponent={
        <ExamCommentField name="neck-comment" dataTestId={dataTestIds.telemedEhrFlow.examTabCardsComments('neck')} />
      }
      grid={[
        {
          Normal: <ExamFieldsFactory card="neck" group="normal" />,
        },
      ]}
    />
  );
};
