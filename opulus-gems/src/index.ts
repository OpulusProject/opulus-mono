// ============================================================================
// UI Components
// ============================================================================

// Avatar component
export { Avatar, AvatarImage, AvatarFallback } from './components/ui/avatar';

// Breadcrumb components
export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from './components/ui/breadcrumb';

// Button component
export { Button, buttonVariants } from './components/ui/button';

// Card components
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
} from './components/ui/card';

// Collapsible components
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from './components/ui/collapsible';

// Dropdown Menu components
export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './components/ui/dropdown-menu';

// Input component
export { Input } from './components/ui/input';

// Label component
export { Label } from './components/ui/label';

// Separator component
export { Separator } from './components/ui/separator';

// Sheet components
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from './components/ui/sheet';

// Sidebar components
export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from './components/ui/sidebar';

// Skeleton component
export { Skeleton } from './components/ui/skeleton';

// Tooltip components
export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './components/ui/tooltip';

// Badge component
export { Badge, badgeVariants } from './components/ui/badge';

// Chart components
export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  type ChartConfig,
} from './components/ui/chart';

// Checkbox component
export { Checkbox } from './components/ui/checkbox';

// Select components
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';

// Table components
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './components/ui/table';

// Tabs components
export { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';

// Toggle components
export { Toggle, toggleVariants } from './components/ui/toggle';

// Toggle Group components
export { ToggleGroup, ToggleGroupItem } from './components/ui/toggle-group';

// Drawer components
export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from './components/ui/drawer';

// ============================================================================
// Hooks
// ============================================================================

// Mobile detection hook
export { useIsMobile } from './hooks/use-mobile';

// ============================================================================
// Utilities
// ============================================================================

// Class name utility
export { cn } from './lib/utils';
