import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChartColumn,
  CircleCheck,
  MessageSquareMore,
  Plus,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { LandingPricing } from "./landing-pricing";
import { ExampleBrand, NoticeButton } from "./shared";

const sectionLinks = [
  { id: "features", label: "Features" },
  { id: "pricing", label: "Pricing" },
  { id: "customers", label: "Customers" },
  { id: "faq", label: "FAQ" },
];

const customers = ["Northwind", "Lumen", "Arcadia", "Fieldnote", "Halcyon"];

const features: { icon: LucideIcon; title: string; description: string }[] = [
  { icon: Target, title: "Weekly priorities", description: "Agree on the three things that matter, and see them every morning." },
  { icon: MessageSquareMore, title: "Async check-ins", description: "Two quick questions a day replace the status meeting." },
  { icon: ChartColumn, title: "Progress reports", description: "A Friday summary that writes itself from what got done." },
  { icon: Bell, title: "Gentle reminders", description: "Nudges at the right time, never a flood of notifications." },
  { icon: Smartphone, title: "On every device", description: "Web and phone stay in sync, even after time offline." },
  { icon: ShieldCheck, title: "Private by default", description: "Your data stays yours. Export or delete it any time." },
];

const testimonials = [
  { quote: "We dropped two meetings a week and still know exactly where everything stands.", name: "Maya Reyes", role: "Head of Ops, Lumen", initials: "MR" },
  { quote: "The Friday report is the first thing our founders read. It just works.", name: "Daniel Kovač", role: "Product lead, Arcadia", initials: "DK" },
  { quote: "Setup took ten minutes. Everyone actually uses it, which is a first.", name: "Sara Okafor", role: "Founder, Fieldnote", initials: "SO" },
];

const questions = [
  {
    id: "free-plan",
    question: "Is there a free plan?",
    answer: <>Yes. Teams of up to five people can use Tempo for free, with no time limit.</>,
  },
  {
    id: "import",
    question: "Can I import from another tool?",
    answer: <>Yes. Bring tasks in from a spreadsheet or CSV file and Tempo matches the columns for you.</>,
  },
  {
    id: "billing",
    question: "How does billing work for new members?",
    answer: <>New members are added to your next invoice, prorated for the days they are on the team.</>,
  },
  {
    id: "delete",
    question: "Can I delete my data?",
    answer: (
      <>
        Any time. Export everything first, then delete your account from <Link href="/examples/settings">Settings</Link>.
      </>
    ),
  },
];

interface FooterLink {
  label: string;
  /** Links without a destination in this example explain that when pressed. */
  href?: string;
}

const footerColumns: { title: string; links: FooterLink[] }[] = [
  { title: "Product", links: [{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "Changelog" }] },
  { title: "Company", links: [{ label: "About" }, { label: "Careers" }, { label: "Contact" }] },
  { title: "Legal", links: [{ label: "Privacy" }, { label: "Terms" }] },
];

function LandingHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <ExampleBrand href="/examples/landing" />
        <nav aria-label="Sections" className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {sectionLinks.map((link) => (
            <a key={link.id} href={`#${link.id}`} className="rounded-md transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/examples/sign-in">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/examples/sign-in">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/** A picture of the product. It is decoration, so it is described once and kept out of the tab order. */
function ProductPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of the Tempo weekly board: tasks grouped as to do, in progress and done"
      className="mt-16 w-full rounded-4xl border bg-muted/40 p-2 shadow-2xl shadow-foreground/5"
    >
      <div inert className="flex overflow-hidden rounded-3xl border bg-background text-left">
        <div className="hidden w-52 shrink-0 flex-col gap-1 border-r bg-sidebar p-3 text-sm md:flex">
          <div className="mb-2 flex items-center gap-2 px-2 font-semibold">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-3" />
            </span>
            Tempo
          </div>
          <span className="flex h-8 items-center gap-2 rounded-lg bg-sidebar-accent px-2 font-medium">
            <CalendarDays className="size-4" />
            This week
          </span>
          <span className="flex h-8 items-center gap-2 rounded-lg px-2 text-muted-foreground">
            <Target className="size-4" />
            Goals
          </span>
          <span className="flex h-8 items-center gap-2 rounded-lg px-2 text-muted-foreground">
            <Users className="size-4" />
            Team
          </span>
          <span className="flex h-8 items-center gap-2 rounded-lg px-2 text-muted-foreground">
            <ChartColumn className="size-4" />
            Reports
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-lg font-semibold">This week</span>
              <span className="text-sm text-muted-foreground">Oct 12 – Oct 18 · 14 of 22 done</span>
            </div>
            <div className="flex items-center gap-2">
              <AvatarGroup className="-space-x-0.5">
                {["AM", "RK", "JL"].map((initials) => (
                  <Avatar key={initials} size="sm">
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                ))}
              </AvatarGroup>
              <Button size="sm">
                <Plus data-icon="inline-start" />
                Add
              </Button>
            </div>
          </div>
          <Progress value={64} className="h-2" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="flex flex-col gap-2 rounded-2xl border p-3">
              <span className="text-xs font-medium text-muted-foreground">To do · 5</span>
              <div className="rounded-xl border bg-card p-3 text-sm">
                <div className="font-medium">Draft Q4 roadmap</div>
                <div className="mt-2 flex items-center justify-between">
                  <Badge variant="secondary">Planning</Badge>
                  <span className="text-xs text-muted-foreground">Fri</span>
                </div>
              </div>
              <div className="rounded-xl border bg-card p-3 text-sm">
                <div className="font-medium">Customer interviews</div>
                <div className="mt-2 flex items-center justify-between">
                  <Badge variant="secondary">Research</Badge>
                  <span className="text-xs text-muted-foreground">Thu</span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl border p-3">
              <span className="text-xs font-medium text-muted-foreground">In progress · 3</span>
              <div className="rounded-xl border bg-card p-3 text-sm">
                <div className="font-medium">New onboarding flow</div>
                <div className="mt-2 flex items-center justify-between">
                  <Badge variant="secondary">Design</Badge>
                  <span className="text-xs text-muted-foreground">Today</span>
                </div>
                <Progress value={70} className="mt-3 h-1.5" />
              </div>
            </div>
            <div className="flex flex-col gap-2 rounded-2xl border p-3">
              <span className="text-xs font-medium text-muted-foreground">Done · 14</span>
              <div className="rounded-xl border bg-card p-3 text-sm text-muted-foreground">
                <div className="font-medium line-through">Pricing page copy</div>
                <div className="mt-2 flex items-center gap-1.5 text-xs">
                  <CircleCheck className="size-3.5" />
                  Ana · Mon
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center px-6 pt-24 text-center">
      <Badge variant="outline" className="h-7 gap-1.5 px-3 text-sm [&>svg]:size-3.5!" asChild>
        <a href="#features">
          <Badge>New</Badge>
          Weekly reports are here
          <ArrowRight />
        </a>
      </Badge>
      <h1 className="mt-6 max-w-3xl text-5xl font-semibold tracking-tighter text-balance md:text-7xl">
        Plan less.
        <br />
        Get more done.
      </h1>
      <p className="mt-6 max-w-xl text-lg text-balance text-muted-foreground">
        Tempo keeps your team’s week in one calm place: priorities, check-ins and progress, without the busywork.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" className="h-11 px-6!" asChild>
          <Link href="/examples/sign-in">
            Start for free
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
        <NoticeButton notice="Booking a demo" variant="outline" size="lg" className="h-11 px-6!">
          Book a demo
        </NoticeButton>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Free for teams up to 5 · No card needed</p>
      <ProductPreview />
    </section>
  );
}

function Customers() {
  return (
    <section id="customers" className="mx-auto max-w-6xl scroll-mt-20 px-6 pt-20 text-center">
      <p className="text-sm text-muted-foreground">Trusted by teams at</p>
      <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-xl font-semibold tracking-tight text-muted-foreground/70">
        {customers.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-6 pt-28">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-4xl font-semibold tracking-tight">Everything a week needs</h2>
        <p className="mt-4 text-lg text-muted-foreground">Simple building blocks that fit how your team already works.</p>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        {features.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader className="gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-28">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {testimonials.map((testimonial) => (
          <Card key={testimonial.name}>
            <CardContent>
              <figure className="flex flex-col gap-6">
                <blockquote className="text-base">“{testimonial.quote}”</blockquote>
                <figcaption className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>{testimonial.initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col text-sm">
                    <span className="font-medium">{testimonial.name}</span>
                    <span className="text-muted-foreground">{testimonial.role}</span>
                  </div>
                </figcaption>
              </figure>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-6 pt-28">
      <h2 className="text-center text-4xl font-semibold tracking-tight">Questions</h2>
      <Accordion type="single" collapsible defaultValue="free-plan" className="mt-10">
        {questions.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger className="text-base">{item.question}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function CallToAction() {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-28">
      <div className="flex flex-col items-center gap-6 rounded-4xl bg-primary px-6 py-16 text-center text-primary-foreground">
        <h2 className="max-w-xl text-4xl font-semibold tracking-tight">Give your team a calmer week</h2>
        <p className="max-w-md text-base opacity-80">Set up in minutes. Free for small teams.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="secondary" size="lg" className="h-11 px-6!" asChild>
            <Link href="/examples/sign-in">Start for free</Link>
          </Button>
          <NoticeButton
            notice="Talking to us"
            variant="ghost"
            size="lg"
            className="h-11 px-6! text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground dark:hover:bg-primary-foreground/10"
          >
            Talk to us
          </NoticeButton>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="mx-auto mt-24 max-w-6xl border-t px-6 py-12">
      <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
        <div className="col-span-2 flex flex-col gap-3">
          <ExampleBrand href="/examples/landing" />
          <p className="max-w-xs text-sm text-muted-foreground">A calm planner for small teams.</p>
        </div>
        {footerColumns.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col items-start gap-2 text-sm">
            <span className="font-medium">{column.title}</span>
            {column.links.map((link) =>
              link.href ? (
                <a key={link.label} href={link.href} className="rounded-md text-muted-foreground transition-colors hover:text-foreground">
                  {link.label}
                </a>
              ) : (
                <NoticeButton
                  key={link.label}
                  notice={`${link.label} page`}
                  variant="link"
                  className="h-auto border-0 p-0 font-normal text-muted-foreground hover:text-foreground hover:no-underline"
                >
                  {link.label}
                </NoticeButton>
              ),
            )}
          </nav>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted-foreground">© 2026 Tempo. All rights reserved.</p>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div>
      <LandingHeader />
      <main>
        <Hero />
        <Customers />
        <Features />
        <Testimonials />
        <LandingPricing />
        <Faq />
        <CallToAction />
      </main>
      <LandingFooter />
    </div>
  );
}
