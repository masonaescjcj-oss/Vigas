/**
 * frontend/src/components/Icon.tsx
 * ---------------------------------------------------------------------------
 * Real vector icons (lucide + react-native-svg, both already dependencies).
 *
 * The app previously rendered emoji as icons, which is why the UI looked like a
 * mockup: emoji are full-colour, inconsistent between platforms (Apple vs
 * Segoe vs Noto), ignore the `color` prop, and can't be sized precisely. These
 * are monochrome strokes that inherit colour and size, so the whole interface
 * reads as one system.
 *
 * The `name` values are the same strings the screens already pass, so this is a
 * drop-in replacement for the old inline VectorIcon.
 * ---------------------------------------------------------------------------
 */

import React from "react";
import { Text, type StyleProp, type TextStyle, View } from "react-native";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  Box,
  Briefcase,
  Calendar,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  Code2,
  Cpu,
  CreditCard,
  Eye,
  FileText,
  Folder,
  GitBranch,
  Ghost,
  Globe,
  HardDrive,
  Image as ImageIcon,
  Inbox,
  Info,
  Layers,
  LineChart,
  Lock,
  Mail,
  MapPin,
  Mic,
  Moon,
  Pencil,
  Plus,
  Puzzle,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Smartphone,
  Sparkles,
  Sun,
  Terminal,
  Trash2,
  Type,
  User,
  Video,
  Wrench,
  X,
  Zap,
} from "lucide-react-native";

const ICONS = {
  user: User,
  search: Search,
  code: Code2,
  ghost: Ghost,
  plus: Plus,
  "arrow-up": ArrowUp,
  "arrow-right": ArrowRight,
  "arrow-left": ArrowLeft,
  camera: Camera,
  image: ImageIcon,
  "file-text": FileText,
  globe: Globe,
  puzzle: Puzzle,
  folder: Folder,
  branch: GitBranch,
  trash: Trash2,
  eye: Eye,
  "rotate-ccw": RotateCcw,
  terminal: Terminal,
  tool: Wrench,
  zap: Zap,
  sparkles: Sparkles,
  cpu: Cpu,
  layers: Layers,
  check: Check,
  x: X,
  "chevron-down": ChevronDown,
  "chevron-right": ChevronRight,
  cloud: Cloud,
  edit: Pencil,
  info: Info,
  settings: Settings,
  shield: Shield,
  card: CreditCard,
  moon: Moon,
  sun: Sun,
  type: Type,
  mobile: Smartphone,
  pin: MapPin,
  calendar: Calendar,
  chart: LineChart,
  video: Video,
  mic: Mic,
  box: Box,
  drive: HardDrive,
  mail: Mail,
  briefcase: Briefcase,
  inbox: Inbox,
  lock: Lock,
  bell: Bell,
  alert: AlertCircle,
} as const;

export type IconName = keyof typeof ICONS;

export const Icon = ({
  name,
  size = 16,
  color = "#A1A1AA",
  style,
  strokeWidth = 2,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
  strokeWidth?: number;
}) => {
  const Glyph = ICONS[name as IconName];

  // Unknown name: render a neutral placeholder box rather than a stray bullet,
  // so a typo is visible in development instead of silently blending in.
  if (!Glyph) {
    if (__DEV__) console.warn(`Icon: unknown name "${name}"`);
    return (
      <View
        style={[
          { width: size, height: size, borderRadius: 3, borderWidth: 1, borderColor: color, opacity: 0.4 },
          style as never,
        ]}
      />
    );
  }

  return (
    <View style={style as never}>
      <Glyph size={size} color={color} strokeWidth={strokeWidth} />
    </View>
  );
};

/** Kept for screens that still render a text glyph inline. */
export const IconText = Text;
