/**
 * The Metro kit.
 *
 * Every corner in here comes from `Radius` (0 for planes and controls, 999 for
 * circles only), hierarchy comes from type, and there is one accent colour.
 * Add new primitives in their own module and re-export them here.
 */

export { useMetro } from './use-metro';

export { Tile, fitTileText, type TileProps } from './tile';
export { MetroStat, MetroStatRow, type MetroStatProps } from './stat';
export { MetroButton, type MetroButtonProps } from './button';
export { MetroRule, MetroLabel, MetroHeading, type MetroHeadingProps } from './primitives';
export { MetroFigures, type MetroFigure, type MetroFiguresProps } from './figures';
export { MetroScreen, type MetroScreenProps } from './screen';
export { MetroSection, type MetroSectionProps } from './section';

export {
  MetroList,
  MetroListRow,
  MetroBadge,
  type MetroBadgeTone,
  type MetroListProps,
  type MetroListRowProps,
} from './list';

export { MetroField, MetroTextArea, type MetroFieldProps, type MetroTextAreaProps } from './field';
export {
  MetroCheckbox,
  MetroToggle,
  MetroRadioGroup,
  type MetroCheckboxProps,
  type MetroRadioGroupProps,
  type MetroRadioOption,
  type MetroToggleProps,
} from './controls';
export { MetroSelect, type MetroSelectOption, type MetroSelectProps } from './select';
export { MetroSwatches, type MetroSwatchOption, type MetroSwatchesProps } from './swatches';

export {
  MetroSheet,
  MetroDialog,
  MetroPanel,
  type MetroDialogAction,
  type MetroDialogProps,
  type MetroPanelProps,
  type MetroSheetProps,
} from './overlay';

export {
  MetroBanner,
  MetroEmpty,
  MetroError,
  MetroLoading,
  type MetroBannerTone,
} from './feedback';
export { MetroFileField, type MetroFileFieldProps, type PickedFile } from './upload';
export { MetroPivot, type MetroPivotTab } from './pivot';
