import { ReactElement, Fragment } from 'react';
import { Paper, Skeleton, Table, TableBody, TableCell, TableRow, Typography, useTheme, Box } from '@mui/material';
import CopyButton from './CopyButton';

export interface PatientProps {
  [key: string]: string | null | undefined;
}

export interface IconProps {
  [key: string]: ReactElement;
}

export interface LastModProps {
  [key: string]: string | undefined;
}

interface PatientInformationProps {
  patientDetails?: PatientProps;
  title: string;
  loading?: boolean;
  icon?: IconProps;
  editValue?: IconProps;
  width?: string;
  element?: ReactElement;
  lastModifiedBy?: LastModProps;
}

const CopyFields = [
  'Member ID',
  'Street address',
  'Address line 2',
  'Patient email',
  'Patient mobile',
  'Phone',
  'Parent/Guardian email',
  'Parent/Guardian mobile',
  'Patient mobile',
  'PCP phone number',
  'Pharmacy phone number',
];

export default function PatientInformation({
  loading,
  patientDetails,
  title,
  icon,
  width = '100%',
  editValue,
  element,
  lastModifiedBy,
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
            {Object.keys(patientDetails).map((patientDetailsKey) => {
              const lastMod = lastModifiedBy && lastModifiedBy[patientDetailsKey];
              return (
                <Fragment key={patientDetailsKey}>
                  <TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <>
                      <TableCell
                        sx={{
                          width: '50%',
                          color: theme.palette.primary.dark,
                          paddingLeft: 0,
                          borderBottom: lastMod ? 'none' : 'auto',
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
                          {patientDetailsKey}
                          {icon ? icon[patientDetailsKey] : ''}
                        </Box>
                      </TableCell>
                      <TableCell
                        sx={{
                          textAlign: 'right',
                          wordWrap: 'break-word',
                          paddingRight: 0,
                          borderBottom: lastMod ? 'none' : 'auto',
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {loading ? (
                            <Skeleton aria-busy="true" width={200} />
                          ) : (
                            <Box sx={{ display: 'flex', gap: 2 }}>
                              {editValue && patientDetails[patientDetailsKey] && editValue[patientDetailsKey]}
                              {patientDetails[patientDetailsKey] || '-'}
                              {patientDetails[patientDetailsKey] && CopyFields.includes(patientDetailsKey.trim()) && (
                                <CopyButton text={patientDetails[patientDetailsKey] ?? ''} />
                              )}
                            </Box>
                          )}
                        </Box>
                      </TableCell>
                    </>
                  </TableRow>
                  {lastMod && (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        sx={{
                          textAlign: 'right',
                          wordWrap: 'break-word',
                          paddingRight: 0,
                          paddingTop: 0,
                          fontSize: '12px',
                        }}
                      >
                        Last Modified {lastMod}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      )}
      {element}
    </Paper>
  );
}
