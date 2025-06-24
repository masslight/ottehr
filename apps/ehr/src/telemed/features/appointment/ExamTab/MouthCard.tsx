import { FC } from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';

export const MouthCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('mouth');

  return (
    <ExamCardContainer
      label="Mouth"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('mouth')}
      rightComponent={
        <ExamCommentField name="mouth-comment" dataTestId={dataTestIds.telemedEhrFlow.examTabCardsComments('mouth')} />
      }
      grid={[
        {
          Normal: <ExamFieldsFactory card="mouth" group="normal" />,
          Abnormal: <ExamFieldsFactory card="mouth" group="abnormal" />,
        },
      ]}
    />
  );
};
