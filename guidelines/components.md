# Component Catalog

All 44 components live in `src/app/components/ui/`.  
Import pattern: `import { ComponentName } from "@/app/components/ui/<filename>"`.  
All are also available from `src/index.ts`.

Use `cn()` from `utils.ts` to merge Tailwind classes and extend component styling.

---

## Utility

### `cn` — class merger
```ts
import { cn } from "@/app/components/ui/utils";
cn("base classes", conditionalClass && "applied-when-true", className)
```

---

## Layout & Containers

### `Card`
**File:** `card.tsx`  
**Exports:** `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter`

```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Subtitle</CardDescription>
    <CardAction>{/* top-right slot */}</CardAction>
  </CardHeader>
  <CardContent>…</CardContent>
  <CardFooter>…</CardFooter>
</Card>
```

All sub-components use `data-slot` attributes for CSS targeting.

### `Separator`
**File:** `separator.tsx`  
Radix UI separator. Props: `orientation?: "horizontal" | "vertical"`, `decorative?: boolean`.

### `ScrollArea`
**File:** `scroll-area.tsx`  
**Exports:** `ScrollArea`, `ScrollBar`  
Wraps content with custom scrollbars. `ScrollBar orientation="vertical|horizontal"`.

### `ResizablePanelGroup` / `ResizablePanel` / `ResizableHandle`
**File:** `resizable.tsx`  
Built on `react-resizable-panels`. Props: `direction="horizontal|vertical"`.

### `AspectRatio`
**File:** `aspect-ratio.tsx`  
Radix AspectRatio. Prop: `ratio={16/9}`.

---

## Navigation

### `Sidebar` system
**File:** `sidebar.tsx`  
**Exports:** `SidebarProvider`, `Sidebar`, `SidebarContent`, `SidebarHeader`, `SidebarFooter`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton`, `SidebarMenuBadge`, `SidebarMenuSkeleton`, `SidebarMenuAction`, `SidebarGroup`, `SidebarGroupContent`, `SidebarGroupLabel`, `SidebarGroupAction`, `SidebarSeparator`, `SidebarRail`, `SidebarInset`, `SidebarTrigger`, `useSidebar`

Constants: `SIDEBAR_WIDTH = "16rem"`, `SIDEBAR_WIDTH_ICON = "3rem"`, keyboard shortcut `"b"`.

Must wrap with `<SidebarProvider>`. Use `useSidebar()` hook for open/collapse state.

### `NavigationMenu`
**File:** `navigation-menu.tsx`  
**Exports:** `NavigationMenu`, `NavigationMenuList`, `NavigationMenuItem`, `NavigationMenuTrigger`, `NavigationMenuContent`, `NavigationMenuLink`, `NavigationMenuIndicator`, `NavigationMenuViewport`  
Radix NavigationMenu — for top-nav menus with submenus.

### `Breadcrumb`
**File:** `breadcrumb.tsx`  
**Exports:** `Breadcrumb`, `BreadcrumbList`, `BreadcrumbItem`, `BreadcrumbLink`, `BreadcrumbPage`, `BreadcrumbSeparator`, `BreadcrumbEllipsis`

### `Tabs`
**File:** `tabs.tsx`  
**Exports:** `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`

```tsx
<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">…</TabsContent>
</Tabs>
```

`TabsList` height `h-9`, `TabsTrigger` style: `rounded-xl`, muted background, active state: `bg-card`.

### `Pagination`
**File:** `pagination.tsx`  
**Exports:** `Pagination`, `PaginationContent`, `PaginationItem`, `PaginationLink`, `PaginationPrevious`, `PaginationNext`, `PaginationEllipsis`

---

## Overlays & Dialogs

### `Dialog`
**File:** `dialog.tsx`  
**Exports:** `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogClose`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription`

`DialogContent` max-width `sm:max-w-lg`, centered, `bg-background`, `rounded-lg`. Includes close (`XIcon`) button.

### `AlertDialog`
**File:** `alert-dialog.tsx`  
**Exports:** `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogFooter`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogAction`, `AlertDialogCancel`  
For destructive confirmations. `AlertDialogAction` uses the `buttonVariants()` styling.

### `Sheet`
**File:** `sheet.tsx`  
**Exports:** `Sheet`, `SheetTrigger`, `SheetClose`, `SheetContent`, `SheetHeader`, `SheetFooter`, `SheetTitle`, `SheetDescription`  
Slide-in panel. `SheetContent` prop: `side?: "top" | "right" | "bottom" | "left"` (default `"right"`).

### `Drawer`
**File:** `drawer.tsx`  
Built on `vaul` drawer library. **Exports:** `Drawer`, `DrawerTrigger`, `DrawerPortal`, `DrawerClose`, `DrawerOverlay`, `DrawerContent`, `DrawerHeader`, `DrawerFooter`, `DrawerTitle`, `DrawerDescription`.

### `Popover`
**File:** `popover.tsx`  
**Exports:** `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor`  
`PopoverContent` default `align="center"`, `sideOffset={4}`.

### `HoverCard`
**File:** `hover-card.tsx`  
**Exports:** `HoverCard`, `HoverCardTrigger`, `HoverCardContent`  
Opens on hover. `HoverCardContent` default `align="center"`, `sideOffset={4}`.

### `Tooltip`
**File:** `tooltip.tsx`  
**Exports:** `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent`  
Wrap the app (or section) with `<TooltipProvider>`.

### `ContextMenu`
**File:** `context-menu.tsx`  
**Exports:** `ContextMenu`, `ContextMenuTrigger`, `ContextMenuContent`, `ContextMenuItem`, `ContextMenuCheckboxItem`, `ContextMenuRadioItem`, `ContextMenuLabel`, `ContextMenuSeparator`, `ContextMenuShortcut`, `ContextMenuGroup`, `ContextMenuSub`, `ContextMenuSubContent`, `ContextMenuSubTrigger`, `ContextMenuRadioGroup`

---

## Menus & Dropdowns

### `DropdownMenu`
**File:** `dropdown-menu.tsx`  
**Exports:** `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuGroup`, `DropdownMenuSub`, `DropdownMenuSubContent`, `DropdownMenuSubTrigger`, `DropdownMenuRadioGroup`

### `Menubar`
**File:** `menubar.tsx`  
Full menu bar (File / Edit / View style). **Exports:** `Menubar`, `MenubarMenu`, `MenubarTrigger`, `MenubarContent`, `MenubarItem`, `MenubarSeparator`, `MenubarLabel`, `MenubarCheckboxItem`, `MenubarRadioGroup`, `MenubarRadioItem`, `MenubarPortal`, `MenubarSubContent`, `MenubarSubTrigger`, `MenubarGroup`, `MenubarSub`, `MenubarShortcut`

### `Command`
**File:** `command.tsx`  
**Exports:** `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`, `CommandShortcut`, `CommandSeparator`  
`cmdk` powered command palette. Use inside `CommandDialog` for a modal launcher.

---

## Form Controls

### `Button`
**File:** `button.tsx`  
**Exports:** `Button`, `buttonVariants`

```tsx
<Button variant="default" size="default">Click</Button>
```

| Prop | Values |
|---|---|
| `variant` | `"default"` `"destructive"` `"outline"` `"secondary"` `"ghost"` `"link"` |
| `size` | `"default"` (h-9) `"sm"` (h-8) `"lg"` (h-10) `"icon"` (size-9 square) |
| `asChild` | `true` — renders as Radix Slot |

### `Input`
**File:** `input.tsx`  
Standard text input. `h-9`, `rounded-md`, `bg-input-background`. Accepts all `<input>` props including `type`.

### `Textarea`
**File:** `textarea.tsx`  
Multi-line text area. Same token styling as Input. `min-h-16`.

### `Label`
**File:** `label.tsx`  
Radix Label with `data-slot="label"`. Associates with inputs via `htmlFor`.

### `Select`
**File:** `select.tsx`  
**Exports:** `Select`, `SelectGroup`, `SelectValue`, `SelectTrigger`, `SelectContent`, `SelectLabel`, `SelectItem`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton`

```tsx
<Select>
  <SelectTrigger size="default">
    <SelectValue placeholder="Choose…" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="a">Option A</SelectItem>
  </SelectContent>
</Select>
```

`SelectTrigger` sizes: `"default"` (h-9) `"sm"` (h-8).

### `Checkbox`
**File:** `checkbox.tsx`  
Radix Checkbox. `size-4`, `rounded-sm`. Accepts standard `checked`/`onCheckedChange`.

### `RadioGroup` / `RadioGroupItem`
**File:** `radio-group.tsx`  
Radix RadioGroup. `RadioGroupItem` is `size-4` circle.

### `Switch`
**File:** `switch.tsx`  
Radix Switch. Toggle uses `--switch-background` when unchecked, `--primary` when checked.

### `Slider`
**File:** `slider.tsx`  
Radix Slider. Track: `bg-muted`, range: `bg-primary`, thumb: `bg-background border-2 border-primary`.

### `Toggle` / `ToggleGroup`
**File:** `toggle.tsx`, `toggle-group.tsx`  
**Exports:** `Toggle`, `toggleVariants` / `ToggleGroup`, `ToggleGroupItem`  
`Toggle` variants: `"default"` `"outline"`. Sizes: `"default"` `"sm"` `"lg"`.

### `InputOTP`
**File:** `input-otp.tsx`  
**Exports:** `InputOTP`, `InputOTPGroup`, `InputOTPSlot`, `InputOTPSeparator`  
Built on `input-otp` library.

### `Form`
**File:** `form.tsx`  
**Exports:** `Form`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`, `FormField`, `useFormField`  
React Hook Form + Zod integration layer.

### `Calendar`
**File:** `calendar.tsx`  
`react-day-picker` v9 based calendar. `mode`, `selected`, `onSelect` props. Uses `ChevronLeft`, `ChevronRight` from lucide.

---

## Data Display

### `Table`
**File:** `table.tsx`  
**Exports:** `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption`

```tsx
<Table>
  <TableHeader>
    <TableRow><TableHead>Name</TableHead></TableRow>
  </TableHeader>
  <TableBody>
    <TableRow><TableCell>Value</TableCell></TableRow>
  </TableBody>
</Table>
```

`TableRow` has `hover:bg-muted/50`, `border-b border-border`.

### `Badge`
**File:** `badge.tsx`  
**Exports:** `Badge`, `badgeVariants`

```tsx
<Badge variant="default">Label</Badge>
```

| `variant` | Appearance |
|---|---|
| `"default"` | `bg-primary text-primary-foreground` |
| `"secondary"` | `bg-secondary text-secondary-foreground` |
| `"destructive"` | `bg-destructive text-destructive-foreground` |
| `"outline"` | transparent + border |

Accepts `asChild`.

### `Avatar`
**File:** `avatar.tsx`  
**Exports:** `Avatar`, `AvatarImage`, `AvatarFallback`

```tsx
<Avatar>
  <AvatarImage src="…" alt="Name" />
  <AvatarFallback>AB</AvatarFallback>
</Avatar>
```

Default size: `size-10` (40 px), `rounded-full`.

### `Progress`
**File:** `progress.tsx`  
Radix Progress. `value={0-100}`. Track: `bg-muted`, indicator: `bg-primary`.

### `Skeleton`
**File:** `skeleton.tsx`  
Loading placeholder. `animate-pulse bg-muted rounded-md`. Pass `className` for dimensions.

### `Chart`
**File:** `chart.tsx`  
**Exports:** `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartStyle`  
Recharts wrapper with theming. Uses `--chart-1` through `--chart-5` tokens.

### `Carousel`
**File:** `carousel.tsx`  
**Exports:** `Carousel`, `CarouselContent`, `CarouselItem`, `CarouselPrevious`, `CarouselNext`  
Built on `embla-carousel-react`.

---

## Feedback & Status

### `Alert`
**File:** `alert.tsx`  
**Exports:** `Alert`, `AlertTitle`, `AlertDescription`  
Props: `variant?: "default" | "destructive"`.

### `Sonner` (Toast)
**File:** `sonner.tsx`  
Re-exports `Toaster` from `sonner` library. Place `<Toaster />` once in the app root.  
Trigger with `import { toast } from "sonner"; toast("Message")`.

---

## Disclosure

### `Accordion`
**File:** `accordion.tsx`  
**Exports:** `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`  
Radix Accordion. `type="single" | "multiple"`.

### `Collapsible`
**File:** `collapsible.tsx`  
**Exports:** `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`  
Radix Collapsible — simpler than Accordion, single controlled section.

---

## Utility hooks

### `use-mobile`
**File:** `use-mobile.ts`  
**Exports:** `useIsMobile()`  
Returns `true` when viewport width ≤ 768 px. Used internally by Sidebar.
