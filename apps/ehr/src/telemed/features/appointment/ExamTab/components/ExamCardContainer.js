"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExamCardContainer = void 0;
var material_1 = require("@mui/material");
var components_1 = require("../../../../components");
var ExamCardContainer = function (props) {
    var collapsed = props.collapsed, onSwitch = props.onSwitch, label = props.label, rightComponent = props.rightComponent, grid = props.grid, dataTestId = props.dataTestId;
    var renderGrid = function () {
        var nodes = [];
        for (var _i = 0, grid_1 = grid; _i < grid_1.length; _i++) {
            var row = grid_1[_i];
            var subNodes = [];
            for (var cellName in row) {
                var cell = row[cellName];
                subNodes.push(<ExamCell key={cellName} label={cellName}>
            {cell}
          </ExamCell>);
            }
            nodes.push(subNodes.reduce(function (prev, curr, index) { return [prev, <material_1.Divider key={index} orientation="vertical" flexItem/>, curr]; }));
        }
        return nodes
            .map(function (node, index) { return <ExamRow key={index}>{node}</ExamRow>; })
            .reduce(function (prev, curr, index) { return [prev, <material_1.Divider key={index + 100} flexItem/>, curr]; });
    };
    return (<components_1.AccordionCard label={label} collapsed={collapsed} onSwitch={onSwitch} dataTestId={dataTestId}>
      <material_1.Box sx={{ p: 2, display: 'flex', gap: 4 }}>
        <material_1.Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>{renderGrid()}</material_1.Box>
        {rightComponent && <material_1.Box sx={{ width: '260px' }}>{rightComponent}</material_1.Box>}
      </material_1.Box>
    </components_1.AccordionCard>);
};
exports.ExamCardContainer = ExamCardContainer;
var ExamRow = function (props) {
    var children = props.children;
    return <material_1.Box sx={{ display: 'flex', gap: 2 }}>{children}</material_1.Box>;
};
var ExamCell = function (props) {
    var children = props.children, label = props.label;
    var theme = (0, material_1.useTheme)();
    return (<material_1.Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <material_1.Typography variant="subtitle2" fontSize={16} color={theme.palette.primary.dark}>
        {label}
      </material_1.Typography>
      {children}
    </material_1.Box>);
};
//# sourceMappingURL=ExamCardContainer.js.map