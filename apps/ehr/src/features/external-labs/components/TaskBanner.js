"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskBanner = void 0;
var colors_1 = require("@ehrTheme/colors");
var MoreVert_1 = require("@mui/icons-material/MoreVert");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var react_1 = require("react");
var TaskBanner = function (_a) {
    var orderName = _a.orderName, orderingPhysician = _a.orderingPhysician, orderedOnDate = _a.orderedOnDate, taskStatus = _a.taskStatus, labName = _a.labName;
    var _b = (0, react_1.useState)(false), isLoading = _b[0], setIsLoading = _b[1];
    var theme = (0, material_1.useTheme)();
    var verb = taskStatus === 'pending' ? 'Collect sample' : 'Do Something';
    var localDate = orderedOnDate === null || orderedOnDate === void 0 ? void 0 : orderedOnDate.toLocal();
    console.log('This is theme', theme);
    // Note: Alert did not allow for easy justifying of content for nice spacing, so had to re-invent the wheel. Sad MUI
    return (<>
      <material_1.Paper elevation={3} sx={{
            padding: 2,
            backgroundColor: colors_1.otherColors.infoAlert,
            borderRadius: 2,
            gap: 2,
        }}>
        <material_1.Stack direction="row" spacing={4} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <material_1.Stack>
            <material_1.Typography component="div">
              <material_1.Box fontWeight="bold" display="inline">
                {"".concat(verb, " \"").concat(orderName, " / ").concat(labName, "\"")}
              </material_1.Box>
            </material_1.Typography>
            <material_1.Typography variant="body1">{"Ordered by ".concat(orderingPhysician, " on ").concat((localDate === null || localDate === void 0 ? void 0 : localDate.toFormat('MM/dd/yyyy')) || 'Unknown date', " at ").concat((localDate === null || localDate === void 0 ? void 0 : localDate.toFormat('hh:mm a')) || 'Unknown date')}</material_1.Typography>
          </material_1.Stack>
          <material_1.Stack direction="row" sx={{ alignItems: 'center' }}>
            <lab_1.LoadingButton loading={isLoading} variant="outlined" sx={{ borderRadius: '50px', textTransform: 'none', fontWeight: 600 }} onClick={function () {
            console.log('Attempting assign');
            setIsLoading(true);
        }}>
              Assign Myself
            </lab_1.LoadingButton>
            <material_1.IconButton color="info">
              <MoreVert_1.default fontSize="medium"/>
            </material_1.IconButton>
          </material_1.Stack>
        </material_1.Stack>
      </material_1.Paper>
    </>);
};
exports.TaskBanner = TaskBanner;
//# sourceMappingURL=TaskBanner.js.map