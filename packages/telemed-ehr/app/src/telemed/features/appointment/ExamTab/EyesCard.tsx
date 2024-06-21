import { FC } from 'react';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { ExamCardContainer, ExamFieldsFactory, ExamCommentField } from './components';

export const EyesCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('eyes');

  return (
    <ExamCardContainer
      label="Eyes"
      collapsed={isCollapsed}
      onSwitch={onSwitch}
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
