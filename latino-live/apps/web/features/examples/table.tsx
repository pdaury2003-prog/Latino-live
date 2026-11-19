"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight, CirclePlus, Ellipsis, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  formatDate,
  formatMoney,
  orderNumber,
  orderPlans,
  orderStatuses,
  orders,
  type Order,
  type OrderPlan,
  type OrderStatus,
} from "./sample-data";
import { ExampleHeader, NoticeButton, OrderStatusBadge, exampleNotice } from "./shared";

type OptionalColumn = "status" | "plan" | "date" | "amount";

const optionalColumns: { id: OptionalColumn; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "plan", label: "Plan" },
  { id: "date", label: "Date" },
  { id: "amount", label: "Amount" },
];

const pageSizes = [10, 20, 50];

/** Adds `value` to the list, or removes it. */
function toggle<T>(list: readonly T[], value: T, on: boolean): T[] {
  const rest = list.filter((item) => item !== value);
  return on ? [...rest, value] : rest;
}

async function copyOrderNumber(id: number) {
  const label = orderNumber(id);
  try {
    await navigator.clipboard.writeText(label);
    toast.success(`Copied ${label}`);
  } catch {
    toast.error("Couldn’t copy the order number", { description: "This browser blocked access to the clipboard." });
  }
}

/** A dashed filter button that lists the chosen values next to its name. */
function FacetedFilter<T extends string>({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: readonly T[];
  selected: readonly T[];
  onChange: (next: T[]) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="border-dashed">
          <CirclePlus data-icon="inline-start" />
          {title}
          {selected.length > 0 && (
            <>
              <Separator orientation="vertical" className="mx-1 h-4 data-vertical:self-center" />
              {selected.length > 2 ? (
                <Badge variant="secondary">{selected.length} selected</Badge>
              ) : (
                selected.map((value) => (
                  <Badge key={value} variant="secondary">
                    {value}
                  </Badge>
                ))
              )}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Filter by {title.toLowerCase()}</DropdownMenuLabel>
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option}
            checked={selected.includes(option)}
            // Keep the menu open so several values can be chosen in one go.
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) => {
              const next = toggle(selected, option, checked === true);
              // Keep the chosen values in the order of the list.
              onChange(options.filter((value) => next.includes(value)));
            }}
          >
            {option}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RowActions({ order }: { order: Order }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for order ${orderNumber(order.id)}`}>
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void copyOrderNumber(order.id)}>Copy order number</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => exampleNotice("The order page")}>View order</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function OrdersPage() {
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<OrderStatus[]>([]);
  const [plans, setPlans] = useState<OrderPlan[]>([]);
  const [newestFirst, setNewestFirst] = useState(true);
  const [selected, setSelected] = useState<ReadonlySet<number>>(() => new Set([3209]));
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [hidden, setHidden] = useState<readonly OptionalColumn[]>(["plan"]);

  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = orders.filter(
      (order) =>
        (needle === "" || order.customer.toLowerCase().includes(needle) || order.email.toLowerCase().includes(needle)) &&
        (statuses.length === 0 || statuses.includes(order.status)) &&
        (plans.length === 0 || plans.includes(order.plan)),
    );
    // `orders` is newest first.
    return newestFirst ? rows : rows.reverse();
  }, [query, statuses, plans, newestFirst]);

  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = matching.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const selectedCount = matching.filter((order) => selected.has(order.id)).length;
  const pageSelected = pageRows.length > 0 && pageRows.every((order) => selected.has(order.id));

  const show = (column: OptionalColumn) => !hidden.includes(column);
  // Checkbox, order, customer and actions are always there.
  const columnCount = 4 + optionalColumns.filter((column) => show(column.id)).length;
  const filtered = query !== "" || statuses.length > 0 || plans.length > 0;

  const changeFilters = (apply: () => void) => {
    apply();
    setPage(0);
  };

  const selectRows = (ids: number[], on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  return (
    <div>
      <ExampleHeader active="orders" className="max-w-6xl" />
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
            <p className="text-muted-foreground">{orders.length} orders this month.</p>
          </div>
          <NoticeButton notice="New order">
            <Plus data-icon="inline-start" />
            New order
          </NoticeButton>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="w-72">
            <InputGroupInput
              placeholder="Filter by customer"
              aria-label="Filter by customer"
              value={query}
              onChange={(event) => changeFilters(() => setQuery(event.target.value))}
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
          <FacetedFilter
            title="Status"
            options={orderStatuses}
            selected={statuses}
            onChange={(next) => changeFilters(() => setStatuses(next))}
          />
          <FacetedFilter title="Plan" options={orderPlans} selected={plans} onChange={(next) => changeFilters(() => setPlans(next))} />
          {filtered && (
            <Button
              variant="ghost"
              onClick={() =>
                changeFilters(() => {
                  setQuery("");
                  setStatuses([]);
                  setPlans([]);
                })
              }
            >
              Reset
              <X data-icon="inline-end" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                <SlidersHorizontal data-icon="inline-start" />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              {optionalColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={show(column.id)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(checked) => setHidden(toggle(hidden, column.id, checked !== true))}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="overflow-hidden rounded-2xl border">
          <Table aria-label="Orders">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={pageSelected}
                    onCheckedChange={(checked) =>
                      selectRows(
                        pageRows.map((order) => order.id),
                        checked === true,
                      )
                    }
                    aria-label="Select all orders on this page"
                  />
                </TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                {show("status") && <TableHead>Status</TableHead>}
                {show("plan") && <TableHead>Plan</TableHead>}
                {show("date") && (
                  <TableHead aria-sort={newestFirst ? "descending" : "ascending"}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3"
                      onClick={() => changeFilters(() => setNewestFirst(!newestFirst))}
                    >
                      Date
                      <ArrowUpDown data-icon="inline-end" className="size-3.5 text-muted-foreground" />
                    </Button>
                  </TableHead>
                )}
                {show("amount") && <TableHead className="text-right">Amount</TableHead>}
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((order) => (
                <TableRow key={order.id} data-state={selected.has(order.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(order.id)}
                      onCheckedChange={(checked) => selectRows([order.id], checked === true)}
                      aria-label={`Select order ${orderNumber(order.id)}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{orderNumber(order.id)}</TableCell>
                  <TableCell>{order.customer}</TableCell>
                  {show("status") && (
                    <TableCell>
                      <OrderStatusBadge status={order.status} />
                    </TableCell>
                  )}
                  {show("plan") && <TableCell>{order.plan}</TableCell>}
                  {show("date") && <TableCell className="text-muted-foreground">{formatDate(order.date, true)}</TableCell>}
                  {show("amount") && <TableCell className="text-right tabular-nums">{formatMoney(order.amount)}</TableCell>}
                  <TableCell>
                    <RowActions order={order} />
                  </TableCell>
                </TableRow>
              ))}
              {pageRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columnCount} className="h-32 text-center text-muted-foreground">
                    No orders match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
          <span role="status" className="text-muted-foreground">
            {selectedCount} of {matching.length} selected
          </span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="orders-rows-per-page" className="font-normal">
                Rows per page
              </Label>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(0);
                }}
              >
                <SelectTrigger id="orders-rows-per-page" size="sm">
                  <SelectValue>{pageSize}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {pageSizes.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="font-medium">
              Page {currentPage + 1} of {pageCount}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous page"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next page"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
