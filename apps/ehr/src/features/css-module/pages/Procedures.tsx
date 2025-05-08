import { ReactElement } from 'react';
import { PageTitle } from 'src/telemed/components/PageTitle';
import { AccordionCard } from 'src/telemed';
import { Box, Stack } from '@mui/system';
import { useNavigate, useParams } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import AddIcon from '@mui/icons-material/Add';
import { ROUTER_PATH } from '../routing/routesCSS';

export default function Procedures(): ReactElement {
  const navigate = useNavigate();
  const { id: appointmentId } = useParams();
  const onNewProcedureClick = (): void => {
    navigate(`/in-person/${appointmentId}/${ROUTER_PATH.PROCEDURES_NEW}`);
  };
  return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <PageTitle label="Procedures" showIntakeNotesButton={false} />
        <RoundedButton variant="contained" onClick={onNewProcedureClick} startIcon={<AddIcon />}>
          Procedure
        </RoundedButton>
      </Box>
      <AccordionCard>
        <Stack spacing={2} style={{ padding: '24px' }}></Stack>
      </AccordionCard>
    </>
  );
}
