import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, LayoutDashboard, LayoutTemplate, LogIn, Settings, Table2, type LucideIcon } from "lucide-react";

import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";

export const metadata: Metadata = { title: "Examples" };

const examples: { href: string; title: string; description: string; icon: LucideIcon }[] = [
  {
    href: "/examples/landing",
    title: "Landing page",
    description: "Hero, product preview, features, pricing and common questions.",
    icon: LayoutTemplate,
  },
  {
    href: "/examples/dashboard",
    title: "Dashboard",
    description: "Sidebar navigation, key numbers, an interactive chart and recent orders.",
    icon: LayoutDashboard,
  },
  {
    href: "/examples/table",
    title: "Orders table",
    description: "Filter, select and page through a table of orders.",
    icon: Table2,
  },
  {
    href: "/examples/settings",
    title: "Settings",
    description: "A profile form, notification switches and a confirmed delete action.",
    icon: Settings,
  },
  {
    href: "/examples/sign-in",
    title: "Sign in",
    description: "A split layout around the working sign-in form.",
    icon: LogIn,
  },
];

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Examples</h1>
        <p className="text-muted-foreground">Starting points for common pages. Open one, then adapt it to your product.</p>
      </header>
      <nav aria-label="Examples">
        <ul className="flex flex-col gap-3">
          {examples.map(({ href, title, description, icon: Icon }) => (
            <li key={href}>
              <Item variant="outline" asChild>
                <Link href={href}>
                  <ItemMedia variant="icon" className="size-10 rounded-xl bg-muted">
                    <Icon aria-hidden="true" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{title}</ItemTitle>
                    <ItemDescription>{description}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
                  </ItemActions>
                </Link>
              </Item>
            </li>
          ))}
        </ul>
      </nav>
      <p className="text-sm text-muted-foreground">These pages use sample content and have no backend.</p>
    </main>
  );
}
