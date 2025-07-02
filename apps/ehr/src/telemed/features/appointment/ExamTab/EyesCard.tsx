import { FC } from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';

export const EyesCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('eyes');

  return (
    <ExamCardContainer
      label="Eyes"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('eyes')}
      rightComponent={
        <ExamCommentField name="eyes-comment" dataTestId={dataTestIds.telemedEhrFlow.examTabCardsComments('eyes')} />
      }
      grid={[
        {
          Normal: <ExamFieldsFactory card="eyes" group="normal" />,
          Abnormal: <ExamFieldsFactory card="eyes" group="abnormal" />,
        },
        {
          'Right eye': <ExamFieldsFactory card="eyes" group="rightEye" radio />,
          'Left eye': <ExamFieldsFactory card="eyes" group="leftEye" radio />,
        },
      ]}
    />
  );
};
