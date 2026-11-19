"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { NoticeButton } from "./shared";

type Billing = "monthly" | "yearly";

interface Plan {
  id: string;
  name: string;
  description: string;
  monthly: number;
  yearly: number;
  unit: string;
  features: string[];
  cta: { label: string; href?: string };
  badge?: string;
  featured?: boolean;
}

// Yearly billing is 20% below monthly.
const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    description: "For small teams getting started.",
    monthly: 0,
    yearly: 0,
    unit: "forever",
    features: ["Up to 5 people", "Weekly priorities", "Daily check-ins"],
    cta: { label: "Get started", href: "/examples/sign-in" },
  },
  {
    id: "pro",
    name: "Pro",
    description: "For teams that want the full picture.",
    monthly: 10,
    yearly: 8,
    unit: "per person / month",
    features: ["Unlimited people", "Progress reports", "Goals and history", "Priority support"],
    cta: { label: "Start 14-day trial", href: "/examples/sign-in" },
    badge: "Popular",
    featured: true,
  },
  {
    id: "business",
    name: "Business",
    description: "For larger organizations.",
    monthly: 17.5,
    yearly: 14,
    unit: "per person / month",
    features: ["Everything in Pro", "Single sign-on", "Audit log"],
    cta: { label: "Contact sales" },
  },
];

function formatPrice(value: number): string {
  return `$${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

function PlanCard({ plan, billing }: { plan: Plan; billing: Billing }) {
  const variant = plan.featured ? "default" : "outline";
  return (
    <Card className={cn(plan.featured && "ring-2 ring-primary")}>
      <CardHeader>
        <CardTitle>{plan.name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
        {plan.badge && (
          <CardAction>
            <Badge>{plan.badge}</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-semibold tracking-tight">{formatPrice(plan[billing])}</span>
          <span className="text-sm text-muted-foreground">{plan.unit}</span>
        </div>
        <ul className="flex flex-col gap-2.5 text-sm">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-center gap-2">
              <Check className="size-4" aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        {plan.cta.href ? (
          <Button variant={variant} size="lg" className="w-full" asChild>
            <Link href={plan.cta.href}>{plan.cta.label}</Link>
          </Button>
        ) : (
          <NoticeButton notice="Contacting sales" variant={variant} size="lg" className="w-full">
            {plan.cta.label}
          </NoticeButton>
        )}
      </CardFooter>
    </Card>
  );
}

function PlanGrid({ billing }: { billing: Billing }) {
  return (
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
      {plans.map((plan) => (
        <PlanCard key={plan.id} plan={plan} billing={billing} />
      ))}
    </div>
  );
}

/** Pricing with a working monthly / yearly switch. */
export function LandingPricing() {
  const [billing, setBilling] = useState<Billing>("yearly");

  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-6 pt-28">
      <Tabs value={billing} onValueChange={(value) => setBilling(value as Billing)} className="gap-0">
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <h2 className="text-4xl font-semibold tracking-tight">Simple pricing</h2>
          <p className="mt-4 text-lg text-muted-foreground">Start free. Upgrade when your team grows.</p>
          <TabsList className="mt-6" aria-label="Billing period">
            <TabsTrigger value="monthly" className="px-4">
              Monthly
            </TabsTrigger>
            <TabsTrigger value="yearly" className="px-4">
              Yearly · save 20%
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="monthly" className="mt-10">
          <PlanGrid billing="monthly" />
        </TabsContent>
        <TabsContent value="yearly" className="mt-10">
          <PlanGrid billing="yearly" />
        </TabsContent>
      </Tabs>
    </section>
  );
}
