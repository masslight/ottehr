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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshableStatusChip = void 0;
var icons_material_1 = require("@mui/icons-material");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var styled_components_1 = require("styled-components");
var StyledChip = (0, styled_components_1.default)(material_1.Chip)(function () { return ({
    borderRadius: '8px',
    padding: '0 9px',
    margin: 0,
    height: '24px',
}); });
var RefreshableStatusChip = function (_a) {
    var _b;
    var status = _a.status, styleMap = _a.styleMap, lastRefreshISO = _a.lastRefreshISO, _c = _a.isRefreshing, isRefreshing = _c === void 0 ? false : _c, _d = _a.flexDirection, flexDirection = _d === void 0 ? 'column' : _d, handleRefresh = _a.handleRefresh;
    var chipColors = styleMap[status];
    var lastRefreshDateString = (function () {
        var dt = luxon_1.DateTime.fromISO(lastRefreshISO);
        if (dt.isValid) {
            return "Last checked: ".concat(luxon_1.DateTime.fromISO(lastRefreshISO).toFormat('MM/dd/yyyy'));
        }
        return '';
    })();
    return (<material_1.Box sx={{
            display: 'flex',
            flexDirection: flexDirection,
            justifyContent: 'space-between',
            alignItems: flexDirection === 'column' ? 'flex-end' : 'center',
        }}>
      <StyledChip label={status} sx={{
            backgroundColor: chipColors.bgColor,
            color: chipColors.textColor,
            '& .MuiChip-label': __assign({ padding: 0, fontWeight: 'bold', fontSize: '0.7rem' }, ((_b = chipColors.textSX) !== null && _b !== void 0 ? _b : {})),
        }}/>
      {Boolean(handleRefresh) && (<material_1.Box sx={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
          <material_1.Typography sx={{
                fontFamily: 'Rubik',
                color: 'rgba(0, 0, 0, 0.6)',
                fontSize: '12px',
                lineHeight: '15px',
                fontWeight: '400',
            }}>
            {lastRefreshDateString}
          </material_1.Typography>
          <material_1.IconButton onClick={handleRefresh} size="small">
            {isRefreshing ? <material_1.CircularProgress size="24px"/> : <icons_material_1.RefreshRounded color="primary"/>}
          </material_1.IconButton>
        </material_1.Box>)}
    </material_1.Box>);
};
exports.RefreshableStatusChip = RefreshableStatusChip;
//# sourceMappingURL=RefreshableStatusWidget.js.map