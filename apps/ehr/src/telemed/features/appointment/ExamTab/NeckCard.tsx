import { FC } from 'react';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { dataTestIds } from '../../../../constants/data-test-ids';

export const NeckCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('neck');

  return (
    <ExamCardContainer
      label="Neck"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('neck')}
      rightComponent={<ExamCommentField name="neck-comment" />}
      grid={[
        {
          Normal: <ExamFieldsFactory card="neck" group="normal" />,
        },
      ]}
    />
  );
};
