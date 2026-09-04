/**
 * components/ui
 * ---------------------------------------------------------------------------
 * The small set of shapes every screen is built from.
 *
 * A screen composes these and adds nothing of its own beyond layout. When a
 * screen needs something none of them do, the answer is a new primitive here,
 * not a TouchableOpacity with seven classes on it — that is how the app ended
 * up with eleven radii and seventy-six colours from outside its palette.
 * ---------------------------------------------------------------------------
 */

export { ScreenHeader } from "./ScreenHeader";
export { Input } from "./Input";
export { Card } from "./Card";
export { Pill, type PillTone } from "./Pill";
export { SectionTitle } from "./SectionTitle";
export { Sheet } from "./Sheet";
export { Button, type ButtonTone } from "../Button";
export { SettingsRow } from "../SettingsRow";
export { Text } from "../Typography";
export { Icon } from "../Icon";
