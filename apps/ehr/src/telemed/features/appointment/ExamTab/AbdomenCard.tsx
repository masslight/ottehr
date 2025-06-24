import { FC } from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory, TenderDropdown } from './components';

export const AbdomenCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('abdomen');

  return (
    <ExamCardContainer
      label="Abdomen"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('abdomen')}
      rightComponent={
        <ExamCommentField
          name="abdomen-comment"
          dataTestId={dataTestIds.telemedEhrFlow.examTabCardsComments('abdomen')}
        />
      }
      grid={[
        {
          Normal: <ExamFieldsFactory card="abdomen" group="normal" />,
          Abnormal: (
            <>
              <TenderDropdown />
              <ExamFieldsFactory card="abdomen" group="abnormal" />
            </>
          ),
        },
      ]}
    />
  );
};
