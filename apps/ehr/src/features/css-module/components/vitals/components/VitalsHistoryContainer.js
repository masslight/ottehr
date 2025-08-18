"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VitalsHistoryElementSkeleton = void 0;
exports.VitalsHistoryContainer = VitalsHistoryContainer;
var ArrowDropDown_1 = require("@mui/icons-material/ArrowDropDown");
var ArrowDropUp_1 = require("@mui/icons-material/ArrowDropUp");
var material_1 = require("@mui/material");
var react_1 = require("react");
var types_1 = require("../types");
function VitalsHistoryContainer(_a) {
    var currentEncounterObs = _a.currentEncounterObs, historicalObs = _a.historicalObs, isLoading = _a.isLoading, _b = _a.historyElementSkeletonText, historyElementSkeletonText = _b === void 0 ? types_1.HISTORY_ELEMENT_SKELETON_TEXT : _b, historyElement = _a.historyElementCreator;
    var _c = (0, react_1.useState)(false), isMoreEntitiesShown = _c[0], setIsMoreEntitiesShown = _c[1];
    var toggleSeeMore = function () {
        setIsMoreEntitiesShown(function (state) { return !state; });
    };
    var _d = (0, react_1.useMemo)(function () {
        var historyEntries = __spreadArray(__spreadArray([], currentEncounterObs, true), historicalObs, true);
        var mainHistoryEntries = historyEntries.slice(0, Math.min(historyEntries.length, 3));
        var startIndex = Math.min(historyEntries.length, 3);
        var extraHistoryEntries = historyEntries.slice(startIndex, historyEntries.length);
        return { mainHistoryEntries: mainHistoryEntries, extraHistoryEntries: extraHistoryEntries };
    }, [currentEncounterObs, historicalObs]), mainHistoryEntries = _d.mainHistoryEntries, extraHistoryEntries = _d.extraHistoryEntries;
    var hasExtraHistoryEntries = extraHistoryEntries && extraHistoryEntries.length > 0;
    var fullHistoryEntriesList = (0, react_1.useMemo)(function () {
        if (!isMoreEntitiesShown) {
            return mainHistoryEntries;
        }
        return __spreadArray(__spreadArray([], mainHistoryEntries, true), (extraHistoryEntries !== null && extraHistoryEntries !== void 0 ? extraHistoryEntries : []), true);
    }, [isMoreEntitiesShown, mainHistoryEntries, extraHistoryEntries]);
    if (isLoading) {
        return (<material_1.Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {Array(3)
                .fill(0)
                .map(function (_, index) { return (<material_1.Box key={index}>
              <exports.VitalsHistoryElementSkeleton text={historyElementSkeletonText}/>
              {index < mainHistoryEntries.length - 1 && <material_1.Divider orientation="horizontal" sx={{ width: '100%' }}/>}
            </material_1.Box>); })}
        <material_1.Skeleton>
          <material_1.Typography sx={{ fontSize: '16px' }}>See more</material_1.Typography>
        </material_1.Skeleton>
      </material_1.Box>);
    }
    return (<material_1.Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {fullHistoryEntriesList.map(function (entry, index) { return (<material_1.Box key={entry.resourceId}>
          {historyElement(entry)}
          {index < fullHistoryEntriesList.length - 1 && <material_1.Divider orientation="horizontal" sx={{ width: '100%' }}/>}
        </material_1.Box>); })}

      {hasExtraHistoryEntries && (<material_1.Button sx={{
                display: 'flex',
                textTransform: 'none',
                textAlign: 'left',
                justifyContent: 'flex-start',
                color: 'primary.main',
                minWidth: 'auto',
                fontWeight: 'bold',
                '&:hover': { backgroundColor: 'transparent' },
            }} onClick={toggleSeeMore} startIcon={isMoreEntitiesShown ? <ArrowDropUp_1.default /> : <ArrowDropDown_1.default />}>
          {isMoreEntitiesShown ? 'See less' : 'See more'}
        </material_1.Button>)}
    </material_1.Box>);
}
var VitalsHistoryElementSkeleton = function (_a) {
    var text = _a.text;
    return (<material_1.Skeleton>
    <material_1.Typography sx={{ fontSize: '16px' }}>{text}</material_1.Typography>
  </material_1.Skeleton>);
};
exports.VitalsHistoryElementSkeleton = VitalsHistoryElementSkeleton;
exports.default = VitalsHistoryContainer;
//# sourceMappingURL=VitalsHistoryContainer.js.map