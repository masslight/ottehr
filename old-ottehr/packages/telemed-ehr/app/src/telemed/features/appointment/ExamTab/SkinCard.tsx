import { FC } from 'react';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory, RashesForm } from './components';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';

export const SkinCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('skin');

  return (
    <ExamCardContainer
      label="Skin"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      rightComponent={<ExamCommentField name="skin-comment" />}
      grid={[
        {
          Normal: <ExamFieldsFactory card="skin" group="normal" />,
          Abnormal: (
            <>
              <RashesForm />
            </>
          ),
        },
      ]}
    />
  );
};
