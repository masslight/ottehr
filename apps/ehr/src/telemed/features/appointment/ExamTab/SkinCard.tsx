import { FC } from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory, RashesForm } from './components';

export const SkinCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('skin');

  return (
    <ExamCardContainer
      label="Skin"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('skin')}
      rightComponent={
        <ExamCommentField name="skin-comment" dataTestId={dataTestIds.telemedEhrFlow.examTabCardsComments('skin')} />
      }
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
