import { Box } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from '../../../../constants/data-test-ids';
import { useExamCardCollapsed } from '../../../hooks/useExamCardCollapsed';
import { DistressDropdown, ExamCardContainer, ExamCommentField, ExamFieldsFactory } from './components';

export const GeneralCard: FC = () => {
  const [isCollapsed, onSwitch] = useExamCardCollapsed('general');

  return (
    <Box>
      <ExamCardContainer
        label="General"
        collapsed={isCollapsed}
        onSwitch={onSwitch}
        dataTestId={dataTestIds.telemedEhrFlow.examTabCards('general')}
        rightComponent={
          <ExamCommentField
            name="general-comment"
            dataTestId={dataTestIds.telemedEhrFlow.examTabCardsComments('general')}
          />
        }
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
