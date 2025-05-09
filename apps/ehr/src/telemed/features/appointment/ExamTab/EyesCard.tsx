import { FC } from 'react';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamFieldsFactory, ExamCommentField } from './components';
import { dataTestIds } from '../../../../constants/data-test-ids';

export const EyesCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('eyes');

  return (
    <ExamCardContainer
      label="Eyes"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
      dataTestId={dataTestIds.telemedEhrFlow.examTabCards('eyes')}
      rightComponent={<ExamCommentField name="eyes-comment" />}
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
