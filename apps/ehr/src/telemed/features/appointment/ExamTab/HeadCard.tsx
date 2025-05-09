import { FC } from 'react';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { dataTestIds } from '../../../../constants/data-test-ids';

export const HeadCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('head');

  return (
    <ExamCardContainer
      label="Head"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('head')}
      rightComponent={<ExamCommentField name="head-comment" />}
      grid={[
        {
          Normal: <ExamFieldsFactory card="head" group="normal" />,
        },
      ]}
    />
  );
};
