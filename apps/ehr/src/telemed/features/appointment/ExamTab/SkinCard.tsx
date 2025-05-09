import { FC } from 'react';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory, RashesForm } from './components';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { dataTestIds } from '../../../../constants/data-test-ids';

export const SkinCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('skin');

  return (
    <ExamCardContainer
      label="Skin"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('skin')}
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
