import { FC } from 'react';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { DistressDropdown, ExamCardContainer, ExamFieldsFactory, ExamCommentField } from './components';
import { Box } from '@mui/material';
import { dataTestIds } from '../../../../constants/data-test-ids';

export const GeneralCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('general');

  return (
    <Box>
      <ExamCardContainer
        label="General"
        collapsed={isCollapsed}
        onSwitch={onSwitch}
        dataTestId={dataTestIds.telemedEhrFlow.examTabCards('general')}
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
    </Box>
  );
};
