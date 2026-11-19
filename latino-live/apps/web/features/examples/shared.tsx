"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "./sample-data";

/**
 * Controls that would need a backend, or a page this example does not have,
 * say so instead of pretending to work. `subject` reads as the start of a
 * sentence: "Export", "Booking a demo", "Customers page".
 */
export function exampleNotice(subject: string) {
  toast.info(`${subject} isn’t available in this example`, {
    description: "The example pages use sample content and have no backend.",
  });
}

/**
 * A card header puts its action beside the title. On a narrow card this moves
 * the action under the text instead of squeezing the text into a thin column.
 * Pass it as the className of CardAction, and `stackedCardDescription` as the
 * className of the CardDescription.
 */
export const stackedCardAction =
  "@max-md/card-header:col-start-1 @max-md/card-header:row-span-1 @max-md/card-header:row-start-3 @max-md/card-header:mt-2 @max-md/card-header:justify-self-start";

/** Goes on the CardDescription next to a `stackedCardAction`, so grid auto-placement keeps it in the first column. */
export const stackedCardDescription = "@max-md/card-header:col-start-1";

/** A button that explains that it is only part of the example. */
export function NoticeButton({
  notice,
  onClick,
  ...props
}: ComponentProps<typeof Button> & { notice: string }) {
  return (
    <Button
      type="button"
      onClick={(event) => {
        onClick?.(event);
        exampleNotice(notice);
      }}
      {...props}
    />
  );
}

/** The product mark used across the example pages. */
export function ExampleBrand({
  href,
  className,
  labelClassName,
}: {
  href: string;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 rounded-md font-semibold", className)}>
      <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="size-3.5" aria-hidden="true" />
      </span>
      <span className={labelClassName}>Tempo</span>
    </Link>
  );
}

const headerLinks = [
  { id: "overview", label: "Overview", href: "/examples/dashboard" },
  { id: "orders", label: "Orders", href: "/examples/table" },
  { id: "settings", label: "Settings", href: "/examples/settings" },
] as const;

/** The top bar of the orders and settings pages. */
export function ExampleHeader({
  active,
  className,
}: {
  active: (typeof headerLinks)[number]["id"];
  /** Sets the content width, for example "max-w-6xl". */
  className?: string;
}) {
  return (
    <header className="border-b">
      <div className={cn("mx-auto flex h-16 items-center gap-4 px-6 sm:gap-6", className)}>
        <ExampleBrand href="/examples/dashboard" labelClassName="sr-only sm:not-sr-only" />
        <nav aria-label="Primary" className="flex items-center gap-4 text-sm text-muted-foreground sm:gap-5">
          {headerLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              aria-current={link.id === active ? "page" : undefined}
              className={cn("rounded-md transition-colors hover:text-foreground", link.id === active && "font-medium text-foreground")}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Avatar className="ml-auto" role="img" aria-label="Jordan Lee">
          <AvatarFallback>JL</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

/** Paid and pending carry a status dot; refunded and draft use the badge colors. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  switch (status) {
    case "Paid":
      return (
        <Badge variant="outline">
          <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
          Paid
        </Badge>
      );
    case "Pending":
      return (
        <Badge variant="outline">
          <span className="size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
          Pending
        </Badge>
      );
    case "Refunded":
      return <Badge variant="destructive">Refunded</Badge>;
    case "Draft":
      return <Badge variant="secondary">Draft</Badge>;
  }
}
