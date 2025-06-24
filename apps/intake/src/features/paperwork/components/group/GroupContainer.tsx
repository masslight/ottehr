import { Grid } from '@mui/material';
import { FC, ReactNode } from 'react';
import { IntakeQuestionnaireItem, QuestionnaireItemGroupType } from 'utils';
import { otherColors } from '../../../../IntakeThemeProvider';
import { RenderItemsProps } from '../../PagedQuestionnaire';
import MultiAnswerHeader from './MultiAnswerHeader';

interface GroupContainerProps extends Omit<RenderItemsProps, 'items'> {
  item: IntakeQuestionnaireItem;
  RenderItems: FC<RenderItemsProps>;
}

const baseSX = {
  padding: '8px',
  width: '100%',
  maxWidth: '100%',
  backgroundColor: 'rgba(1,1,1,0)',
  borderRadius: '8px',
};

interface ContentWrapperProps {
  type: 'default' | 'gray-container-widget';
  children: ReactNode;
}

const ContentWrapper: FC<ContentWrapperProps> = ({ type, children }) => {
  const sx = (() => {
    let { backgroundColor, padding } = baseSX;
    if (type === 'gray-container-widget') {
      backgroundColor = otherColors.cardBackground;
      padding = '24px';
    }
    return {
      ...baseSX,
      backgroundColor,
      padding,
    };
  })();
  return (
    <Grid id={`group-wrapper-${type}`} container item sx={sx}>
      {children}
    </Grid>
  );
};

const GroupContainer: FC<GroupContainerProps> = ({ item, fieldId, parentItem, RenderItems }) => {
  return (
    <ContentWrapper type="default">
      {item.groupType == QuestionnaireItemGroupType.ListWithForm && (
        <>
          <MultiAnswerHeader item={item} parentItem={parentItem} />
          <ContentWrapper type="gray-container-widget">
            <RenderItems items={item.item ?? []} fieldId={item.linkId} parentItem={item} />
          </ContentWrapper>
        </>
      )}
      {item.groupType != QuestionnaireItemGroupType.ListWithForm && (
        <RenderItems parentItem={item} items={item.item ?? []} fieldId={fieldId ?? item.linkId} />
      )}
    </ContentWrapper>
  );
};

export default GroupContainer;
