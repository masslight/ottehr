import {
  Autocomplete,
  autocompleteClasses,
  Popper,
  styled,
  TextField,
  TextFieldProps,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  createContext,
  FC,
  forwardRef,
  HTMLAttributes,
  ReactElement,
  ReactNode,
  RefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import { ListChildComponentProps, VariableSizeList } from 'react-window';
import { useWindowResize } from '../../../../hooks';

const LISTBOX_PADDING = 8;

type RowProps = {
  setSize: (index: number, size: number) => void;
  windowWidth: number;
} & ListChildComponentProps;

const Row: FC<RowProps> = (props) => {
  const { data, index, style, setSize, windowWidth } = props;
  const dataSet = data[index];

  const rowRef = useRef<HTMLLIElement>();

  useEffect(() => {
    if (rowRef.current) {
      setSize(index, rowRef.current.getBoundingClientRect().height);
    }
  }, [setSize, index, windowWidth]);

  const { renderRow } = useContext(RowContext);

  const inlineStyle = {
    ...style,
    top: (style.top as number) + LISTBOX_PADDING,
    height: 'auto',
    minHeight: '36px',
  };

  return (
    <Typography component="li" {...dataSet[0]} style={inlineStyle} ref={rowRef}>
      {renderRow(dataSet[1])}
    </Typography>
  );
};

const OuterElementContext = createContext({});

const OuterElementType = forwardRef<HTMLDivElement>((props, ref) => {
  const outerProps = useContext(OuterElementContext);
  return <div ref={ref} {...props} {...outerProps} />;
});

function useResetCache(data: any): RefObject<VariableSizeList> {
  const ref = useRef<VariableSizeList>(null);
  useEffect(() => {
    if (ref.current != null) {
      ref.current.resetAfterIndex(0, true);
    }
  }, [data]);
  return ref;
}

// Adapter for react-window
const ListboxComponent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLElement>>(function ListboxComponent(props, ref) {
  const { children, ...other } = props;
  const itemData: ReactElement[] = [];
  (children as ReactElement[]).forEach((item: ReactElement & { children?: ReactElement[] }) => {
    itemData.push(item);
    itemData.push(...(item.children || []));
  });

  const theme = useTheme();
  const smUp = useMediaQuery(theme.breakpoints.up('sm'), {
    noSsr: true,
  });
  const itemCount = itemData.length;
  const itemSize = smUp ? 36 : 48;

  const getHeight = (): number => {
    if (itemCount > 8) {
      return 8 * itemSize;
    }
    return itemData.length * itemSize;
  };

  const gridRef = useResetCache(itemCount);

  const sizeMap = useRef<Record<number, number>>({});
  const setSize = useCallback(
    (index: number, size: number): void => {
      sizeMap.current = { ...sizeMap.current, [index]: size };
      gridRef.current?.resetAfterIndex(index);
    },
    [gridRef]
  );

  const getSize = (index: number): number => sizeMap.current[index] || itemSize;

  const [windowWidth] = useWindowResize();

  return (
    <div ref={ref}>
      <OuterElementContext.Provider value={other}>
        <VariableSizeList
          itemData={itemData}
          height={getHeight() + 2 * LISTBOX_PADDING}
          width="100%"
          ref={gridRef}
          outerElementType={OuterElementType}
          innerElementType="ul"
          itemSize={getSize}
          overscanCount={5}
          itemCount={itemCount}
        >
          {({ data, style, index }) => (
            <Row style={style} data={data} index={index} setSize={setSize} windowWidth={windowWidth} />
          )}
        </VariableSizeList>
      </OuterElementContext.Provider>
    </div>
  );
});

const StyledPopper = styled(Popper)({
  [`& .${autocompleteClasses.listbox}`]: {
    boxSizing: 'border-box',
    '& ul': {
      padding: 0,
      margin: 0,
    },
  },
});

const RowContext = createContext<{ renderRow: (item: any) => string }>({
  renderRow: () => '',
});

export type VirtualizedAutocompleteProps<T> = {
  options: T[];
  renderRow: (item: T) => string;
  value?: NonNullable<T>;
  onChange: (newValue?: NonNullable<T>) => void;
  clearable?: boolean;
  disabled?: boolean;
} & Pick<TextFieldProps, 'helperText' | 'error' | 'label'>;

export const VirtualizedAutocomplete = <T,>(props: VirtualizedAutocompleteProps<T>): ReactElement => {
  const { options, renderRow, label, value, onChange, error, helperText, clearable, disabled } = props;

  return (
    <RowContext.Provider value={{ renderRow }}>
      <Autocomplete
        fullWidth
        disabled={disabled}
        value={value || (null as unknown as NonNullable<T>)}
        onChange={(_, newValue) => onChange(newValue || undefined)}
        size="small"
        disableListWrap
        disableClearable={!clearable}
        PopperComponent={StyledPopper}
        ListboxComponent={ListboxComponent}
        options={options}
        isOptionEqualToValue={(option, value) => renderRow(option) === renderRow(value)}
        getOptionLabel={(option) => renderRow(option)}
        renderInput={(params) => <TextField {...params} label={label} error={error} helperText={helperText} />}
        renderOption={(props, option, state) => [props, option, state.index] as ReactNode}
      />
    </RowContext.Provider>
  );
};
