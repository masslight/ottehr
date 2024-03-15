import { ReactElement } from 'react';
import { Paper, Skeleton, Table, TableBody, TableCell, TableRow, Typography, useTheme, Box } from '@mui/material';

export interface PatientProps {
  [key: string]: string | null | undefined;
}

export interface IconProps {
  [key: string]: ReactElement;
}

interface PatientInformationProps {
  patientDetails?: PatientProps;
  title: string;
  loading?: boolean;
  icon?: IconProps;
  editValue?: IconProps;
  width?: string;
  element?: ReactElement;
}

export default function PatientInformation({
  loading,
  patientDetails,
  title,
  icon,
  width = '100%',
  editValue,
  element,
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
        <Table size="small" style={{ tableLayout: 'fixed', width: width }}>
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
                        paddingRight: 0,
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {loading ? (
                          <Skeleton aria-busy="true" width={200} />
                        ) : (
                          <>
                            {editValue && patientDetails[patientDetail] && editValue[patientDetail]}
                            {patientDetails[patientDetail] || '-'}
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
      {element}
    </Paper>
  );
}
