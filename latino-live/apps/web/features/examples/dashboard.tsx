"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  Bell,
  Calendar,
  ChartLine,
  ChevronsUpDown,
  Download,
  EllipsisVertical,
  Folder,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  Package,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { NoticeButton, OrderStatusBadge, exampleNotice, stackedCardAction, stackedCardDescription } from "./shared";
import {
  formatDate,
  formatMoney,
  initials,
  orders,
  visitorRanges,
  visitorsByDay,
  type VisitorRangeId,
} from "./sample-data";

/* -------------------------------------------------------------------------- */
/* Sidebar                                                                    */
/* -------------------------------------------------------------------------- */

interface NavEntry {
  label: string;
  icon: LucideIcon;
  /** Entries without a page in this example explain that when pressed. */
  href?: string;
  badge?: string;
  current?: boolean;
}

const platformNav: NavEntry[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/examples/dashboard", current: true },
  { label: "Analytics", icon: ChartLine },
  { label: "Orders", icon: ShoppingBag, href: "/examples/table", badge: "12" },
  { label: "Customers", icon: Users },
  { label: "Products", icon: Package },
];

const workspaceNav: NavEntry[] = [
  { label: "Documents", icon: Folder },
  { label: "Inbox", icon: Inbox },
  { label: "Settings", icon: Settings, href: "/examples/settings" },
];

function NavItem({ item }: { item: NavEntry }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      {item.href ? (
        <SidebarMenuButton asChild isActive={item.current}>
          <Link href={item.href} aria-current={item.current ? "page" : undefined}>
            <Icon />
            {item.label}
          </Link>
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton type="button" onClick={() => exampleNotice(`${item.label} page`)}>
          <Icon />
          {item.label}
        </SidebarMenuButton>
      )}
      {item.badge && <SidebarMenuBadge className="bg-sidebar-accent">{item.badge}</SidebarMenuBadge>}
    </SidebarMenuItem>
  );
}

function NavGroup({ label, items }: { label: string; items: NavEntry[] }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <NavItem key={item.label} item={item} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function DashboardSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" type="button" className="gap-2.5" onClick={() => exampleNotice("Switching workspaces")}>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Sparkles />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold">Northwind</span>
                <span className="truncate text-xs text-muted-foreground">Pro plan</span>
              </span>
              <ChevronsUpDown className="text-muted-foreground" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent role="navigation" aria-label="Dashboard">
        <NavGroup label="Platform" items={platformNav} />
        <NavGroup label="Workspace" items={workspaceNav} />
      </SidebarContent>
      <SidebarFooter className="gap-0 p-0">
        <div className="m-3 flex flex-col gap-2 rounded-2xl border bg-background p-4">
          <span className="text-sm font-medium">Storage almost full</span>
          <span className="text-xs text-muted-foreground">8.4 of 10 GB used</span>
          <Progress value={84} className="h-1.5" aria-label="Storage used" />
        </div>
        <div className="border-t p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="gap-2.5">
                    <Avatar>
                      <AvatarFallback>JL</AvatarFallback>
                    </Avatar>
                    <span className="grid flex-1 text-left leading-tight">
                      <span className="truncate text-sm font-medium">Jordan Lee</span>
                      <span className="truncate text-xs text-muted-foreground">jordan@northwind.co</span>
                    </span>
                    <EllipsisVertical className="text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/examples/settings">
                      <Settings />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/examples">
                      <LayoutTemplate />
                      All examples
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

/** Search is a placeholder, but the ⌘K / Ctrl+K hint next to it works. */
function HeaderSearch() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <form
      role="search"
      className="hidden lg:block"
      onSubmit={(event) => {
        event.preventDefault();
        exampleNotice("Search");
      }}
    >
      <InputGroup className="w-64">
        <InputGroupInput ref={inputRef} placeholder="Search" aria-label="Search" enterKeyHint="search" />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          <Kbd>⌘K</Kbd>
        </InputGroupAddon>
      </InputGroup>
    </form>
  );
}

function DashboardHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b px-6">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-4 data-vertical:self-center" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>Northwind</BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Overview</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        <HeaderSearch />
        <Button variant="ghost" size="icon" aria-label="Notifications" onClick={() => exampleNotice("The notifications panel")}>
          <Bell />
        </Button>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

const periods = [
  { value: "this-month", label: "Oct 1 – Oct 15" },
  { value: "last-month", label: "Sep 1 – Sep 30" },
  { value: "last-quarter", label: "Jul 1 – Sep 30" },
];

/** Only the current period has sample data, so choosing another one explains that. */
function PeriodSelect() {
  const current = periods[0];
  return (
    <Select value={current.value} onValueChange={() => exampleNotice("Changing the date range")}>
      <SelectTrigger aria-label="Date range">
        <Calendar className="text-muted-foreground" />
        <SelectValue>{current.label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {periods.map((period) => (
          <SelectItem key={period.value} value={period.value}>
            {period.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const stats = [
  { label: "Revenue", value: "$48,210", change: "12.5%", trend: "up", note: "Up from $42,850", detail: "Compared with September" },
  { label: "Subscribers", value: "2,318", change: "8.2%", trend: "up", note: "176 new this month", detail: "Most from the referral program" },
  { label: "Active users", value: "12,940", change: "2.1%", trend: "down", note: "Dip over the weekend", detail: "Weekdays steady" },
  { label: "Churn", value: "1.8%", change: "0.4%", trend: "down", note: "Lowest this year", detail: "Target is under 2%" },
] as const;

function StatCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const TrendIcon = stat.trend === "up" ? TrendingUp : TrendingDown;
        return (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">{stat.value}</CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <TrendIcon data-icon="inline-start" />
                  <span className="sr-only">{stat.trend === "up" ? "Up " : "Down "}</span>
                  {stat.change}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-0.5 text-sm">
              <span className="font-medium">{stat.note}</span>
              <span className="text-muted-foreground">{stat.detail}</span>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

const chartConfig = {
  visitors: { label: "Visitors", color: "var(--chart-2)" },
  returning: { label: "Returning", color: "var(--chart-1)" },
} satisfies ChartConfig;

function VisitorsChart() {
  const [rangeId, setRangeId] = useState<VisitorRangeId>("30d");
  const range = visitorRanges.find((item) => item.id === rangeId) ?? visitorRanges[1];
  const data = visitorsByDay.slice(-range.days);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Visitors</CardTitle>
        <CardDescription className={stackedCardDescription}>{range.description}</CardDescription>
        <CardAction className={stackedCardAction}>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={rangeId}
            // Pressing the selected item again would clear the value; keep the range.
            onValueChange={(value) => {
              if (value) setRangeId(value as VisitorRangeId);
            }}
            aria-label="Time range"
          >
            {visitorRanges.map((item) => (
              <ToggleGroupItem key={item.id} value={item.id}>
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-60 w-full">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="fill-visitors" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-visitors)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-visitors)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fill-returning" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-returning)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="var(--color-returning)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={56}
              interval="preserveStartEnd"
              tickFormatter={(value: string) => formatDate(value)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" labelFormatter={(label) => formatDate(String(label))} />}
            />
            <Area dataKey="visitors" type="monotone" fill="url(#fill-visitors)" stroke="var(--color-visitors)" strokeWidth={2} />
            <Area dataKey="returning" type="monotone" fill="url(#fill-returning)" stroke="var(--color-returning)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

const recentOrders = orders.slice(0, 4);

function RecentOrders() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent orders</CardTitle>
        <CardDescription>12 new since yesterday</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" asChild>
            <Link href="/examples/table">View all</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Table aria-label="Recent orders">
          <TableHeader>
            <TableRow>
              <TableHead className="pl-0">Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="pr-0 text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="pl-0">
                  <div className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback>{initials(order.customer)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="font-medium">{order.customer}</span>
                      <span className="text-muted-foreground">{order.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <OrderStatusBadge status={order.status} />
                </TableCell>
                <TableCell>{order.plan}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(order.date)}</TableCell>
                <TableCell className="pr-0 text-right tabular-nums">{formatMoney(order.amount)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset className="min-w-0">
        <DashboardHeader />
        <div className="flex flex-col gap-6 p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
              <p className="text-sm text-muted-foreground">How Northwind is doing this month.</p>
            </div>
            <div className="flex items-center gap-2">
              <PeriodSelect />
              <NoticeButton notice="Export">
                <Download data-icon="inline-start" />
                Export
              </NoticeButton>
            </div>
          </div>
          <StatCards />
          <VisitorsChart />
          <RecentOrders />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
