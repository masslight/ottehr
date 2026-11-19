import { Close } from '@mui/icons-material';
import { Box, IconButton } from '@mui/material';
import { Fragment, ReactElement, ReactNode } from 'react';
import { PopoverBlank, Sentence } from './InlineBlanks';

interface ListSentenceProps<T extends { code: string; resourceId?: string }> {
  label: string;
  items: readonly T[];
  itemText: (item: T) => string;
  onRemove: (index: number) => void;
  readOnly: boolean;
  blankLabel: string;
  title: string;
  need?: boolean;
  children: (close: () => void) => ReactNode;
  testIds?: { sentence?: string; add?: string; item?: string; text?: string; remove?: string };
}

export const ListSentence = <T extends { code: string; resourceId?: string }>({
  label,
  items,
  itemText,
  onRemove,
  readOnly,
  blankLabel,
  title,
  need,
  children,
  testIds,
}: ListSentenceProps<T>): ReactElement => (
  <Sentence dataTestId={testIds?.sentence}>
    {label}:{' '}
    {items.map((item, index) => (
      <Fragment key={item.resourceId ?? `${item.code}-${index}`}>
        {index > 0 && '; '}
        <Box component="span" data-testid={testIds?.item}>
          <Box component="span" sx={{ color: 'primary.main', fontWeight: 500 }} data-testid={testIds?.text}>
            {itemText(item)}
          </Box>
          {!readOnly && (
            <IconButton
              size="small"
              aria-label={`Remove ${item.code}`}
              data-testid={testIds?.remove}
              onClick={() => onRemove(index)}
              sx={{ p: '2px', ml: '2px' }}
            >
              <Close sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
      </Fragment>
    ))}{' '}
    {(!readOnly || items.length === 0) && (
      <PopoverBlank
        label={items.length ? '+ another' : blankLabel}
        title={title}
        ghost={items.length > 0}
        need={need && items.length === 0}
        readOnly={readOnly}
        dataTestId={testIds?.add}
      >
        {children}
      </PopoverBlank>
    )}
  </Sentence>
);
