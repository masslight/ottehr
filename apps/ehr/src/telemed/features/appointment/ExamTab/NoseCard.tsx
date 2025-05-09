import { FC } from 'react';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { dataTestIds } from '../../../../constants/data-test-ids';

export const NoseCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('nose');

  return (
    <ExamCardContainer
      label="Nose"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('nose')}
      rightComponent={<ExamCommentField name="nose-comment" />}
      grid={[
        {
          Normal: <ExamFieldsFactory card="nose" group="normal" />,
          Abnormal: <ExamFieldsFactory card="nose" group="abnormal" />,
        },
      ]}
    />
  );
};
