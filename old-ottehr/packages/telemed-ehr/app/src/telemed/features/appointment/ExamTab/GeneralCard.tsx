import { FC } from 'react';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { DistressDropdown, ExamCardContainer, ExamFieldsFactory, ExamCommentField } from './components';

export const GeneralCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('general');

  return (
    <ExamCardContainer
      label="General"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      rightComponent={<ExamCommentField name="general-comment" />}
      grid={[
        {
          Normal: <ExamFieldsFactory card="general" group="normal" />,
          Abnormal: (
            <>
              <ExamFieldsFactory card="general" group="abnormal" />
              <DistressDropdown />
            </>
          ),
        },
      ]}
    />
  );
};
