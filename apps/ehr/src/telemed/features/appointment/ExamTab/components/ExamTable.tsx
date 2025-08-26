import {
  alpha,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import {
  ControlledCheckboxSelect,
  ControlledExamCheckbox,
  ControlledExamCheckboxDropdown,
  ExamCommentField,
  ExamForm,
} from 'src/telemed/features/appointment';
import { ExamCardComponent, ExamItemConfig } from 'utils';

type ExamTableProps = {
  examConfig: ExamItemConfig;
};

export const ExamTable: FC<ExamTableProps> = ({ examConfig }) => {
  const theme = useTheme();

  const border = '1px solid rgba(224, 224, 224, 1)';
  const cards: (keyof typeof examConfig)[] = Object.keys(examConfig) as (keyof typeof examConfig)[];

  return (
    <TableContainer
      component={Paper}
      elevation={0}
      sx={{ border }}
      data-testid={dataTestIds.telemedEhrFlow.examTabTable}
    >
      <Table
        size="small"
        sx={{
          tableLayout: 'fixed',
          '& .MuiTableCell-root': {
            borderRight: border,
            borderBottom: border,
          },
          '& .MuiTableBody-root .MuiTableRow-root:last-child .MuiTableCell-root': {
            borderBottom: 'none',
          },
          '& .MuiTableCell-root:last-child': {
            borderRight: 'none',
          },
          '& .MuiTableHead-root .MuiTableCell-root': {
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
          },
          '& .MuiTableBody-root .MuiTableCell-root:first-of-type': {
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
            fontWeight: 500,
            color: theme.palette.primary.dark,
          },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: '110px' }}></TableCell>
            <TableCell sx={{ color: theme.palette.success.main, width: 'calc((100% - 370px) / 2)' }}>Normal</TableCell>
            <TableCell sx={{ color: theme.palette.error.main, width: 'calc((100% - 370px) / 2)' }}>Abnormal</TableCell>
            <TableCell sx={{ color: theme.palette.primary.dark, width: '260px' }}>Provider Comment</TableCell>
          </TableRow>
        </TableHead>
        <TableBody sx={{ '& .MuiTableCell-root': { verticalAlign: 'top' } }}>
          {cards.map((card) => (
            <TableRow key={card}>
              <TableCell>{examConfig[card].label}</TableCell>
              <TableCell>
                <ExamTableCellComponent elements={examConfig[card].components.normal} />
              </TableCell>
              <TableCell>
                <ExamTableCellComponent elements={examConfig[card].components.abnormal} abnormal />
              </TableCell>
              <TableCell>
                <ExamTableCellComponent elements={examConfig[card].components.comment} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const ExamTableCellComponent: FC<{
  elements: Record<string, ExamCardComponent>;
  abnormal?: boolean;
}> = ({ elements, abnormal }) => {
  const theme = useTheme();

  const elementKeys = Object.keys(elements);

  const renderElements = (): React.ReactNode[] => {
    const result = [];
    let i = 0;

    while (i < elementKeys.length) {
      const currentKey = elementKeys[i];
      const currentElement = elements[currentKey];

      if (currentElement.type === 'column') {
        let columnCount = 1;
        let j = i + 1;
        while (j < elementKeys.length && elements[elementKeys[j]].type === 'column') {
          columnCount++;
          j++;
        }

        if (columnCount >= 2) {
          const columnGroup = elementKeys.slice(i, i + columnCount);
          result.push(
            <Box key={`group-${i}`} sx={{ display: 'flex', gap: 2, mb: 1 }}>
              {columnGroup.map((component) => {
                const element = elements[component];
                if (element.type === 'column' && 'components' in element) {
                  return (
                    <Box key={component} sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" fontSize={16} color={theme.palette.primary.dark}>
                        {element.label}
                      </Typography>
                      <ExamTableCellComponent elements={element.components} abnormal={abnormal} />
                    </Box>
                  );
                }
                return null;
              })}
            </Box>
          );
          i = j;
        } else {
          result.push(renderSingleElement(currentKey, currentElement));
          i++;
        }
      } else {
        result.push(renderSingleElement(currentKey, currentElement));
        i++;
      }
    }

    return result;
  };

  const renderSingleElement = (key: string, element: ExamCardComponent): React.ReactNode => {
    if (element.type === 'checkbox') {
      return <ControlledExamCheckbox key={key} name={key} label={element.label} abnormal={abnormal} />;
    } else if (element.type === 'text') {
      return <ExamCommentField key={key} name={key} />;
    } else if (element.type === 'column') {
      if ('components' in element) {
        return (
          <Box key={key} sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" fontSize={16} color={theme.palette.primary.dark}>
              {element.label}
            </Typography>
            <ExamTableCellComponent elements={element.components} abnormal={abnormal} />
          </Box>
        );
      }
    } else if (element.type === 'dropdown') {
      return (
        <ControlledExamCheckboxDropdown
          key={key}
          abnormal={abnormal}
          checkboxLabel={element.label}
          dropdownLabel={element.placeholder}
          options={Object.keys('components' in element ? element.components : {}).map((option) => ({
            label: 'components' in element ? element.components[option].label : '',
            name: option,
          }))}
        />
      );
    } else if (element.type === 'multi-select') {
      return (
        <ControlledCheckboxSelect
          key={key}
          label={element.label}
          options={Object.keys(element.options).map((option) => ({
            label: element.options[option].label,
            name: option,
            description: element.options[option].description,
          }))}
        />
      );
    } else if (element.type === 'form') {
      return <ExamForm key={key} form={element} abnormal={abnormal} />;
    }
    return null;
  };

  return <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{renderElements()}</Box>;
};
