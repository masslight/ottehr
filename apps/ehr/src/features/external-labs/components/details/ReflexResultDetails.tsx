import { FC } from 'react';
import DetailPageContainer from 'src/features/common/DetailPageContainer';
import { ReflexLabDTO } from 'utils';
import { LabBreadcrumbs } from '../labs-orders/LabBreadcrumbs';
import { DetailsWithResults } from './DetailsWithResults';

interface ReflexResultDetailsProps {
  reflexResult: ReflexLabDTO;
}

export const ReflexResultDetails: FC<ReflexResultDetailsProps> = ({ reflexResult }) => {
  return (
    <DetailPageContainer>
      <LabBreadcrumbs sectionName={reflexResult.testItem}>
        <DetailsWithResults
          labOrder={reflexResult}
          markTaskAsReviewed={async () => console.log('ugh')}
          loading={false}
        />
      </LabBreadcrumbs>
    </DetailPageContainer>
  );
};
