"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadingSpinner = void 0;
var colors_1 = require("@ehrTheme/colors");
var material_1 = require("@mui/material");
var CircularProgress_1 = require("@mui/material/CircularProgress");
var data_test_ids_1 = require("../../constants/data-test-ids");
var LoadingSpinner = function (_a) {
    var transparent = _a.transparent;
    var theme = (0, material_1.useTheme)();
    return (<material_1.Box data-testid={data_test_ids_1.dataTestIds.loadingSpinner} sx={{
            alignItems: 'center',
            backgroundColor: transparent ? colors_1.otherColors.blackTransparent : theme.palette.background.default,
            display: 'flex',
            height: '100vh',
            justifyContent: 'center',
            left: 0,
            position: 'fixed',
            top: 0,
            width: '100vw',
            zIndex: 9999,
        }}>
      <CircularProgress_1.default />
    </material_1.Box>);
};
exports.LoadingSpinner = LoadingSpinner;
//# sourceMappingURL=LoadingSpinner.js.map