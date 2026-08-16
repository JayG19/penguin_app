import {
  Bot, Calculator, Calendar, FileText, HardDrive, Link as LinkIcon, Mail, NotebookPen,
  Palette, PenTool, Presentation, Quote, Ruler, Table, Timer,
} from "lucide-react";

export const TOOL_ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  "file-text": FileText,
  table: Table,
  presentation: Presentation,
  "hard-drive": HardDrive,
  mail: Mail,
  calendar: Calendar,
  "pen-tool": PenTool,
  palette: Palette,
  notebook: NotebookPen,
  bot: Bot,
  calculator: Calculator,
  quote: Quote,
  ruler: Ruler,
  timer: Timer,
  link: LinkIcon,
};
