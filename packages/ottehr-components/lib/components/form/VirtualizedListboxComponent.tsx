import * as React from 'react';
import { FC, useCallback, useEffect, useRef } from 'react';
import { ListChildComponentProps, VariableSizeList } from 'react-window';
import { Typography, useTheme } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useWindowResize } from '../../hooks';

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

  const inlineStyle = {
    ...style,
    top: (style.top as number) + LISTBOX_PADDING,
    height: 'auto',
    minHeight: '36px',
  };

  return (
    <Typography component="li" {...dataSet[0]} style={inlineStyle} ref={rowRef}>
      {dataSet[1].label}
    </Typography>
  );
};

const OuterElementContext = React.createContext({});

const OuterElementType = React.forwardRef<HTMLDivElement>((props, ref) => {
  const outerProps = React.useContext(OuterElementContext);
  return <div ref={ref} {...props} {...outerProps} />;
});

OuterElementType.displayName = 'OuterElementType';

function useResetCache(data: any): React.RefObject<VariableSizeList> {
  const ref = React.useRef<VariableSizeList>(null);
  React.useEffect(() => {
    if (ref.current != null) {
      ref.current.resetAfterIndex(0, true);
    }
  }, [data]);
  return ref;
}

export const VirtualizedListboxComponent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLElement>>(
  function VirtualizedListboxComponent(props, ref) {
    const { children, ...other } = props;
    const itemData: React.ReactElement[] = [];
    (children as React.ReactElement[]).forEach((item: React.ReactElement & { children?: React.ReactElement[] }) => {
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
      [gridRef],
    );

    const getSize = (index: number): number => sizeMap.current[index] || itemSize;

    const [windowWidth] = useWindowResize();

    return (
      <div ref={ref}>
        <OuterElementContext.Provider value={other}>
          <VariableSizeList
            itemData={itemData}
            height={getHeight()}
            width="100%"
            style={{ overflowX: 'hidden' }}
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
  },
);
