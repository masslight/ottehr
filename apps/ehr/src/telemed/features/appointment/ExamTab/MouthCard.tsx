import { FC } from 'react';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { dataTestIds } from '../../../../constants/data-test-ids';

export const MouthCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('mouth');

  return (
    <ExamCardContainer
      label="Mouth"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('mouth')}
      rightComponent={<ExamCommentField name="mouth-comment" />}
      grid={[
        {
          Normal: <ExamFieldsFactory card="mouth" group="normal" />,
          Abnormal: <ExamFieldsFactory card="mouth" group="abnormal" />,
        },
      ]}
    />
  );
};
