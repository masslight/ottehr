import { otherColors } from '@ehrTheme/colors';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { Box, Button, Stack, TableCell, TableRow, Tooltip, Typography, useTheme } from '@mui/material';
import { ReactElement } from 'react';
import { categoricalRangeFormat, OBSERVATION_CODES, quantityRangeFormat } from 'utils';
import { InHouseOrderListPageItemDTO } from 'utils/lib/types/data/in-house/in-house.types';
import { formatDateForLabs } from 'utils/lib/utils/dateUtils';
import { configInHouseLabDeleteButtonTestId, configInHouseLabTableRowTestId } from '../../utils/test-ids';
import { InHouseLabsStatusChip } from '../InHouseLabsStatusChip';
import { InHouseLabsTableColumn } from './InHouseLabsTable';

interface InHouseLabsTableRowProps {
  columns: InHouseLabsTableColumn[];
  labOrderData: InHouseOrderListPageItemDTO;
  onRowClick?: () => void;
  allowDelete?: boolean;
  onDeleteOrder?: () => void;
}

export const InHouseLabsTableRow = ({
  labOrderData,
  columns,
  onRowClick,
  allowDelete,
  onDeleteOrder,
}: InHouseLabsTableRowProps): ReactElement => {
  const theme = useTheme();

  const renderCellContent = (column: InHouseLabsTableColumn): React.ReactNode => {
    switch (column) {
      case 'testType':
        return (
          <Box>
            <Box sx={{ fontWeight: 'bold' }}>{labOrderData.testItemName}</Box>
          </Box>
        );
      case 'visit':
        return <Box>{formatDateForLabs(labOrderData.visitDate, labOrderData.timezone)}</Box>;
      case 'orderAdded':
        return <Box>{formatDateForLabs(labOrderData.orderAddedDate, labOrderData.timezone)}</Box>;
      case 'provider':
        return labOrderData.orderingPhysicianFullName || '';
      case 'dx': {
        const firstDx = labOrderData.diagnosesDTO[0]?.display || '';
        const firstDxCode = labOrderData.diagnosesDTO[0]?.code || '';
        const firstDxText = `${firstDxCode} ${firstDx}`;
        const fullDxText = labOrderData.diagnosesDTO.map((dx) => `${dx.code} ${dx.display}`).join('; ');
        const dxCount = labOrderData.diagnosesDTO.length;

        if (dxCount > 1) {
          return (
            <Tooltip title={fullDxText} arrow placement="top">
              <Typography variant="body2">
                {firstDxText}; <span style={{ color: theme.palette.text.secondary }}>+ {dxCount - 1} more</span>
              </Typography>
            </Tooltip>
          );
        }
        return <Typography variant="body2">{firstDxText}</Typography>;
      }
      case 'resultsReceived':
        return <Box>{formatDateForLabs(labOrderData.resultReceivedDate || '-', labOrderData.timezone)}</Box>;
      case 'status':
        return <InHouseLabsStatusChip status={labOrderData.status} />;
      case 'actions':
        if (allowDelete) {
          return (
            <Button
              data-testid={configInHouseLabDeleteButtonTestId(labOrderData.serviceRequestId)}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteOrder?.();
              }}
              sx={{
                textTransform: 'none',
                borderRadius: 28,
                fontWeight: 'bold',
              }}
            >
              <DeleteIcon sx={{ color: otherColors.priorityHighText }} />
            </Button>
          );
        }
        return null;
      case 'results':
        return <InHouseLabResultCell labOrderData={labOrderData} />;
      default:
        return null;
    }
  };

  return (
    <TableRow
      data-testid={configInHouseLabTableRowTestId(labOrderData.serviceRequestId)}
      sx={{
        '&:hover': { backgroundColor: '#f5f5f5' },
        cursor: 'pointer',
      }}
      onClick={onRowClick}
    >
      {columns.map((column) => (
        <TableCell key={column}>{renderCellContent(column)}</TableCell>
      ))}
    </TableRow>
  );
};

interface InHouseLabResultCellProps {
  labOrderData: InHouseOrderListPageItemDTO;
}

const InHouseLabResultCell = ({ labOrderData }: InHouseLabResultCellProps): ReactElement => {
  const componentType = labOrderData.labDetails.components.type;
  if (
    componentType === 'empty' ||
    labOrderData.labDetails.components.components.every((comp) => comp.result === undefined)
  )
    return <></>;

  // this primarily covers grouped component types, particularly with multiple components
  // if there are multiple in the group, we need to count abnormals, e.g. CBC or UA
  if (labOrderData.labDetails.components.components.length > 1) {
    const abnormalResults = labOrderData.labDetails.components.components.filter(
      (comp) => comp.result !== undefined && comp.result.interpretationCode === OBSERVATION_CODES.ABNORMAL
    );

    return (
      <ResultCell
        resultString={
          abnormalResults.length
            ? `${abnormalResults.length} abnormal result${abnormalResults.length > 1 ? 's' : ''}`
            : `No abnormal results`
        }
        isAbnormal={abnormalResults.length > 0}
        referenceRangeString={undefined}
      />
    );
  }

  // we have a singleton grouped, which can also include radio.
  // singleton grouped types can be quantity, codeableconcepts, or free text.
  // These might or might not have a unit and reference ranges
  const component = labOrderData.labDetails.components.components[0];
  const { result, dataType } = component;
  if (result === undefined) return <></>;

  let units = '';
  let referenceRange = '';

  // segment by component.datatype: quantity, codeableconept and freetext
  if (dataType === 'Quantity') {
    units = component.unit ?? '';
    referenceRange = quantityRangeFormat(component);
  } else if (dataType === 'CodeableConcept') {
    referenceRange = categoricalRangeFormat(component.referenceRangeValues);

    // note that for neutral tests like pregnancy, we should display "N/A" instead
    if (component.abnormalValues.length === 0) referenceRange = 'N/A';
  }

  return (
    <ResultCell
      isAbnormal={result.interpretationCode === OBSERVATION_CODES.ABNORMAL}
      resultString={units ? `${result.entry} ${units}` : result.entry}
      referenceRangeString={units ? `${referenceRange} ${units}` : referenceRange}
    />
  );
};

interface ResultCellProps {
  isAbnormal: boolean;
  resultString: string;
  referenceRangeString: string | undefined;
}
const ResultCell = ({ isAbnormal, resultString, referenceRangeString }: ResultCellProps): ReactElement => {
  const theme = useTheme();
  return (
    <Box>
      <Stack spacing={0.5}>
        <Typography
          style={{
            ...theme.typography.body2,
            fontWeight: isAbnormal ? theme.typography.fontWeightBold : theme.typography.fontWeightRegular,
          }}
          color={isAbnormal ? theme.palette.error.main : theme.palette.text.primary}
        >
          {resultString}
        </Typography>
        {referenceRangeString && <Typography style={theme.typography.caption}>{referenceRangeString}</Typography>}
      </Stack>
    </Box>
  );
};
