import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { Box, Collapse, IconButton, Typography } from '@mui/material';
import { InHouseOrderDetailPageItemDTO, PageName } from 'utils';
import { InHouseLabOrderHistory } from './InHouseLabOrderHistory';
import { InHouseLabsNotesCard } from './InHouseLabsNotesCard';

interface InHouseLabsDetailsCardProps {
  testDetails: InHouseOrderDetailPageItemDTO;
  page: PageName;
  showDetails: boolean;
  setShowDetails: (bool: boolean) => void;
}

export const InHouseLabsDetailsCard: React.FC<InHouseLabsDetailsCardProps> = ({
  testDetails,
  page,
  showDetails,
  setShowDetails,
}) => {
  const showNotesCardAbove = testDetails.notes && page === PageName.collectSample;
  const showNotesCardBelowDetails = testDetails.notes && page !== PageName.collectSample;
  const finalView = page === PageName.final;
  const notesLabel = 'Provider notes';
  return (
    <>
      {showNotesCardAbove && (
        <InHouseLabsNotesCard
          notes={testDetails.notes}
          notesLabel={notesLabel}
          readOnly={true}
          additionalBoxSxProps={{ my: 3 }}
        />
      )}
      <Box display="flex" justifyContent={finalView ? 'space-between' : 'flex-end'} mt={2}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setShowDetails(!showDetails)}
        >
          <Typography
            sx={{
              fontWeight: 500,
              color: '#1A73E8',
              fontSize: '0.875rem',
              mr: 0.5,
            }}
          >
            Details
          </Typography>
          <IconButton size="small" sx={{ color: '#1A73E8', p: 0 }}>
            {showDetails ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </Box>
      </Box>
      <Collapse in={showDetails}>
        {showNotesCardBelowDetails && (
          <InHouseLabsNotesCard
            notes={testDetails.notes}
            notesLabel={notesLabel}
            readOnly={true}
            additionalBoxSxProps={{ my: 3 }}
          />
        )}
        <InHouseLabOrderHistory showDetails={showDetails} testDetails={testDetails} />
      </Collapse>
    </>
  );
};
