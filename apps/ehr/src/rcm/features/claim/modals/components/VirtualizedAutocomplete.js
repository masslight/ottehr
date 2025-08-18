"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirtualizedAutocomplete = void 0;
var material_1 = require("@mui/material");
var react_1 = require("react");
var react_window_1 = require("react-window");
var hooks_1 = require("../../../../hooks");
var LISTBOX_PADDING = 8;
var Row = function (props) {
    var data = props.data, index = props.index, style = props.style, setSize = props.setSize, windowWidth = props.windowWidth;
    var dataSet = data[index];
    var rowRef = (0, react_1.useRef)();
    (0, react_1.useEffect)(function () {
        if (rowRef.current) {
            setSize(index, rowRef.current.getBoundingClientRect().height);
        }
    }, [setSize, index, windowWidth]);
    var renderRow = (0, react_1.useContext)(RowContext).renderRow;
    var inlineStyle = __assign(__assign({}, style), { top: style.top + LISTBOX_PADDING, height: 'auto', minHeight: '36px' });
    return (<material_1.Typography component="li" {...dataSet[0]} style={inlineStyle} ref={rowRef}>
      {renderRow(dataSet[1])}
    </material_1.Typography>);
};
var OuterElementContext = (0, react_1.createContext)({});
var OuterElementType = (0, react_1.forwardRef)(function (props, ref) {
    var outerProps = (0, react_1.useContext)(OuterElementContext);
    return <div ref={ref} {...props} {...outerProps}/>;
});
function useResetCache(data) {
    var ref = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(function () {
        if (ref.current != null) {
            ref.current.resetAfterIndex(0, true);
        }
    }, [data]);
    return ref;
}
// Adapter for react-window
var ListboxComponent = (0, react_1.forwardRef)(function ListboxComponent(props, ref) {
    var children = props.children, other = __rest(props, ["children"]);
    var itemData = [];
    children.forEach(function (item) {
        itemData.push(item);
        itemData.push.apply(itemData, (item.children || []));
    });
    var theme = (0, material_1.useTheme)();
    var smUp = (0, material_1.useMediaQuery)(theme.breakpoints.up('sm'), {
        noSsr: true,
    });
    var itemCount = itemData.length;
    var itemSize = smUp ? 36 : 48;
    var getHeight = function () {
        if (itemCount > 8) {
            return 8 * itemSize;
        }
        return itemData.length * itemSize;
    };
    var gridRef = useResetCache(itemCount);
    var sizeMap = (0, react_1.useRef)({});
    var setSize = (0, react_1.useCallback)(function (index, size) {
        var _a;
        var _b;
        sizeMap.current = __assign(__assign({}, sizeMap.current), (_a = {}, _a[index] = size, _a));
        (_b = gridRef.current) === null || _b === void 0 ? void 0 : _b.resetAfterIndex(index);
    }, [gridRef]);
    var getSize = function (index) { return sizeMap.current[index] || itemSize; };
    var windowWidth = (0, hooks_1.useWindowResize)()[0];
    return (<div ref={ref}>
      <OuterElementContext.Provider value={other}>
        <react_window_1.VariableSizeList itemData={itemData} height={getHeight() + 2 * LISTBOX_PADDING} width="100%" ref={gridRef} outerElementType={OuterElementType} innerElementType="ul" itemSize={getSize} overscanCount={5} itemCount={itemCount}>
          {function (_a) {
            var data = _a.data, style = _a.style, index = _a.index;
            return (<Row style={style} data={data} index={index} setSize={setSize} windowWidth={windowWidth}/>);
        }}
        </react_window_1.VariableSizeList>
      </OuterElementContext.Provider>
    </div>);
});
var StyledPopper = (0, material_1.styled)(material_1.Popper)((_a = {},
    _a["& .".concat(material_1.autocompleteClasses.listbox)] = {
        boxSizing: 'border-box',
        '& ul': {
            padding: 0,
            margin: 0,
        },
    },
    _a));
var RowContext = (0, react_1.createContext)({
    renderRow: function () { return ''; },
});
var VirtualizedAutocomplete = function (props) {
    var options = props.options, renderRow = props.renderRow, label = props.label, value = props.value, onChange = props.onChange, error = props.error, helperText = props.helperText, clearable = props.clearable, disabled = props.disabled;
    return (<RowContext.Provider value={{ renderRow: renderRow }}>
      <material_1.Autocomplete fullWidth disabled={disabled} value={value || null} onChange={function (_, newValue) { return onChange(newValue || undefined); }} size="small" disableListWrap disableClearable={!clearable} PopperComponent={StyledPopper} ListboxComponent={ListboxComponent} options={options} isOptionEqualToValue={function (option, value) { return renderRow(option) === renderRow(value); }} getOptionLabel={function (option) { return renderRow(option); }} renderInput={function (params) { return <material_1.TextField {...params} label={label} error={error} helperText={helperText}/>; }} renderOption={function (props, option, state) { return [props, option, state.index]; }}/>
    </RowContext.Provider>);
};
exports.VirtualizedAutocomplete = VirtualizedAutocomplete;
//# sourceMappingURL=VirtualizedAutocomplete.js.map