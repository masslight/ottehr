import { FC } from 'react';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory, TenderDropdown } from './components';

export const AbdomenCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('abdomen');

  return (
    <ExamCardContainer
      label="Abdomen"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      rightComponent={<ExamCommentField name="abdomen-comment" />}
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
