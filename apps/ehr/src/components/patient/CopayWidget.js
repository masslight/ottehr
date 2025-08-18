"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CopayWidget = void 0;
var HowToReg_1 = require("@mui/icons-material/HowToReg");
var PersonRemove_1 = require("@mui/icons-material/PersonRemove");
var material_1 = require("@mui/material");
var react_1 = require("react");
// This set contains the service codes that are supported by the CopayWidget.
// Currently, it only includes 'UC' (Urgent Care), but can be overwritten to include any from
// the enumeration defined as BenefitCoverageCodes in packages/utils/lib/types/data/telemed/eligibility.types.ts
var supportedServiceCodes = new Set(['UC']);
var CopayWidget = function (_a) {
    var copay = _a.copay;
    var _b = (0, react_1.useMemo)(function () {
        var filteredByService = copay.filter(function (b) { return supportedServiceCodes.has(b.code); });
        var inNetworkList = filteredByService.filter(function (b) { return b.inNetwork; });
        var outOfNetworkList = filteredByService.filter(function (b) { return !b.inNetwork; });
        return { inNetworkList: inNetworkList, outOfNetworkList: outOfNetworkList };
    }, [copay]), inNetworkList = _b.inNetworkList, outOfNetworkList = _b.outOfNetworkList;
    var theme = (0, material_1.useTheme)();
    return (<material_1.Grid sx={{
            backgroundColor: 'rgba(244, 246, 248, 1)',
            padding: 1,
        }} container spacing={2}>
      <material_1.Grid item>
        <material_1.Typography variant="h5" color={theme.palette.primary.dark} fontWeight={theme.typography.fontWeightBold}>
          Patient payment
        </material_1.Typography>
      </material_1.Grid>
      <BenefitSection title={'Patient is In-Network'} titleIcon={<HowToReg_1.default sx={{ color: theme.palette.success.main, fontSize: 20 }}/>} emptyMessage={'No in-network benefits available.'} benefits={inNetworkList}/>
      <BenefitSection title={'Patient is Out-of-Network'} titleIcon={<PersonRemove_1.default sx={{ color: theme.palette.error.main, fontSize: 20 }}/>} emptyMessage={'No out-of-network benefits available.'} benefits={outOfNetworkList}/>
    </material_1.Grid>);
};
exports.CopayWidget = CopayWidget;
var BenefitSection = function (_a) {
    var title = _a.title, titleIcon = _a.titleIcon, emptyMessage = _a.emptyMessage, benefits = _a.benefits;
    var theme = (0, material_1.useTheme)();
    return (<material_1.Grid container item direction="column" spacing={1}>
      <material_1.Grid item>
        <material_1.Box sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}>
          {titleIcon !== null && titleIcon !== void 0 ? titleIcon : <></>}
          <material_1.Typography variant="h6" color={theme.palette.primary.dark}>
            {title}
          </material_1.Typography>
        </material_1.Box>
      </material_1.Grid>
      {benefits.length > 0 ? (benefits.map(function (benefit) { return (<material_1.Grid container sx={{
                borderTop: '1px solid  rgba(0, 0, 0, 0.12)',
            }} item key={"".concat(JSON.stringify(benefit))} direction="row">
            <material_1.Grid item xs={5}>
              <material_1.Typography variant="body1" color={theme.palette.primary.dark}>
                {benefit.description}
              </material_1.Typography>
            </material_1.Grid>
            <material_1.Grid item xs={5}>
              <material_1.Typography variant="body1" color={theme.palette.primary.dark}>
                {benefit.coverageCode === 'A' ? 'Co-Insurance' : 'Co-Pay'}
              </material_1.Typography>
            </material_1.Grid>
            <material_1.Grid item xs={2}>
              <material_1.Typography variant="body1" fontWeight={theme.typography.fontWeightMedium} color={theme.palette.text.primary} textAlign="right">
                {amountStringForBenefit(benefit)}
              </material_1.Typography>
            </material_1.Grid>
          </material_1.Grid>); })) : (<p>{emptyMessage}</p>)}
    </material_1.Grid>);
};
var amountStringForBenefit = function (benefit) {
    var amountInUSD = benefit.amountInUSD;
    var percentage = benefit.percentage;
    if (benefit.coverageCode === 'A') {
        if (percentage > 0) {
            return "".concat(percentage, "%");
        }
        else if (amountInUSD > 0) {
            return "$".concat(amountInUSD);
        }
        else {
            return '0%';
        }
    }
    else {
        if (amountInUSD > 0) {
            return "$".concat(amountInUSD);
        }
        else if (percentage > 0) {
            return "".concat(percentage, "%");
        }
        else {
            return '$0';
        }
    }
};
//# sourceMappingURL=CopayWidget.js.map