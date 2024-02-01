import { ReactElement } from 'react';
import { Paper, Skeleton, Table, TableBody, TableCell, TableRow, Typography, useTheme, Box } from '@mui/material';

export interface PatientProps {
  [key: string]: string | null | undefined;
}

export enum PatientCheckTitles {
  'Provider Terms & Conditions and Privacy Policy.' = 'Provider Terms & Conditions and Privacy Policy.',
  'HIPAA Acknowledgement' = 'HIPAA Acknowledgement',
  'Consent to Treat and Guarantee of Payment' = 'Consent to Treat and Guarantee of Payment',
  'Financial Agreement' = 'Financial Agreement',
}

interface IconProps {
  [key: string]: ReactElement;
}

interface PatientInformationProps {
  patientDetails?: PatientProps;
  title: string;
  loading?: boolean;
  icon?: IconProps;
  editValue?: IconProps;
}

export default function PatientInformation({
  loading,
  patientDetails,
  title,
  icon,
  editValue,
}: PatientInformationProps): ReactElement {
  const theme = useTheme();

  return (
    <Paper
      sx={{
        marginTop: 2,
        padding: 3,
      }}
    >
      <Typography variant="h4" color="primary.dark">
        {title}
      </Typography>
      {patientDetails && (
        <Table size="small" style={{ tableLayout: 'fixed', width: '100%' }}>
          <TableBody>
            {Object.keys(patientDetails).map((patientDetail) => {
              return (
                <TableRow key={patientDetail} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  <>
                    <TableCell
                      sx={{
                        width: '50%',
                        color: theme.palette.primary.dark,
                        paddingLeft: 0,
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                        {patientDetail}
                        {icon ? icon[patientDetail] : ''}
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{
                        textAlign: 'right',
                        wordWrap: 'break-word',
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        {loading ? <Skeleton aria-busy="true" width={200} /> : patientDetails[patientDetail] || '-'}
                        {editValue ? editValue[patientDetail] : ''}
                      </Box>
                    </TableCell>
                  </>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}
