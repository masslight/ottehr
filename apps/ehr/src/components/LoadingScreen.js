"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoadingScreen = void 0;
var material_1 = require("@mui/material");
var LoadingScreen = function () {
    return (<material_1.Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%,-50%)',
        }}>
      <material_1.CircularProgress />
    </material_1.Box>);
};
exports.LoadingScreen = LoadingScreen;
//# sourceMappingURL=LoadingScreen.js.map