import { FC } from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';

export const NoseCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('nose');

  return (
    <ExamCardContainer
      label="Nose"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('nose')}
      rightComponent={
        <ExamCommentField name="nose-comment" dataTestId={dataTestIds.telemedEhrFlow.examTabCardsComments('nose')} />
      }
      grid={[
        {
          Normal: <ExamFieldsFactory card="nose" group="normal" />,
          Abnormal: <ExamFieldsFactory card="nose" group="abnormal" />,
        },
      ]}
    />
  );
};
