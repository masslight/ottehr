// The pure URL-building logic lives in utils (packages/utils/lib/helpers/tracking-board.ts) so the
// ad-hoc reporting zambdas can emit the same tracking-board links this report renders. Re-exported
// here so existing report imports keep working unchanged.
export { buildTrackingBoardPath } from 'utils/lib/helpers/tracking-board';
