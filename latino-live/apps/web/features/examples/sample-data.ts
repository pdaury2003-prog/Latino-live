/**
 * Sample content for the example pages. Everything here is fictional.
 *
 * It is generated deterministically (no Math.random, no Date.now), so the
 * server and the browser always render the same numbers.
 */

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-15" becomes "Oct 15", or "Oct 15, 2026". Parsed by hand so no time zone can shift the day. */
export function formatDate(iso: string, withYear = false): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${MONTHS[month - 1]} ${day}${withYear ? `, ${year}` : ""}`;
}

/** 1200 becomes "$1,200.00" and -39 becomes "−$39.00". */
export function formatMoney(amount: number): string {
  const digits = Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${amount < 0 ? "−" : ""}$${digits}`;
}

/** Formats an order number for display: the number with a leading hash sign. */
export function orderNumber(id: number): string {
  return `#${id}`;
}

/** "Jordan Lee" becomes "JL". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** A small seeded generator (mulberry32). */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------------------- */
/* Visitors (dashboard chart)                                                 */
/* -------------------------------------------------------------------------- */

export interface VisitorDay {
  /** ISO date, for example "2026-10-15". */
  date: string;
  visitors: number;
  /** The part of `visitors` who had visited before. */
  returning: number;
}

export const visitorRanges = [
  { id: "90d", label: "3 months", days: 90, description: "Total for the last 3 months" },
  { id: "30d", label: "30 days", days: 30, description: "Total for the last 30 days" },
  { id: "7d", label: "7 days", days: 7, description: "Total for the last 7 days" },
] as const;

export type VisitorRangeId = (typeof visitorRanges)[number]["id"];

const DAY_MS = 24 * 60 * 60 * 1000;
const LAST_DAY = Date.UTC(2026, 9, 15);
const HISTORY_DAYS = 90;

function buildVisitors(): VisitorDay[] {
  const random = createRandom(2026);
  let drift = 0;
  return Array.from({ length: HISTORY_DAYS }, (_, index) => {
    const day = new Date(LAST_DAY - (HISTORY_DAYS - 1 - index) * DAY_MS);
    const weekday = day.getUTCDay();
    const weekend = weekday === 0 || weekday === 6;
    drift = drift * 0.8 + (random() - 0.5) * 260;
    const visitors = Math.round(1250 + index * 6 + drift - (weekend ? 240 : 0));
    const returning = Math.round(visitors * (0.34 + random() * 0.08));
    return { date: day.toISOString().slice(0, 10), visitors, returning };
  });
}

/** Ninety days ending on Oct 15, 2026, oldest first. */
export const visitorsByDay: readonly VisitorDay[] = buildVisitors();

/* -------------------------------------------------------------------------- */
/* Orders (dashboard and orders table)                                        */
/* -------------------------------------------------------------------------- */

export type OrderStatus = "Paid" | "Pending" | "Refunded" | "Draft";
export type OrderPlan = "Pro monthly" | "Pro yearly" | "Team";

export const orderStatuses: readonly OrderStatus[] = ["Paid", "Pending", "Refunded", "Draft"];
export const orderPlans: readonly OrderPlan[] = ["Pro monthly", "Pro yearly", "Team"];

export interface Order {
  /** The order number, for example 3210. `orderNumber` formats it for display. */
  id: number;
  customer: string;
  email: string;
  status: OrderStatus;
  plan: OrderPlan;
  /** ISO date. */
  date: string;
  /** Negative for a refund. */
  amount: number;
}

const PLAN_PRICE: Record<OrderPlan, number> = { "Pro monthly": 39, "Pro yearly": 399, Team: 1200 };

const ORDER_COUNT = 128;

const LATEST_ORDERS: readonly Order[] = [
  { id: 3210, customer: "Olivia Martin", email: "olivia@example.com", status: "Paid", plan: "Pro yearly", date: "2026-10-15", amount: 399 },
  { id: 3209, customer: "Jackson Chen", email: "jackson@example.com", status: "Pending", plan: "Pro monthly", date: "2026-10-15", amount: 39 },
  { id: 3208, customer: "Isabella Nguyen", email: "isabella@example.com", status: "Paid", plan: "Team", date: "2026-10-14", amount: 1200 },
  { id: 3207, customer: "William Kim", email: "will@example.com", status: "Refunded", plan: "Pro monthly", date: "2026-10-13", amount: -39 },
  { id: 3206, customer: "Sofia Davis", email: "sofia@example.com", status: "Paid", plan: "Pro yearly", date: "2026-10-12", amount: 399 },
  { id: 3205, customer: "Liam Johnson", email: "liam@example.com", status: "Draft", plan: "Pro monthly", date: "2026-10-11", amount: 39 },
];

const CUSTOMERS = [
  "Emma Wilson", "Noah Brown", "Ava Taylor", "Lucas Garcia", "Mia Anderson",
  "Ethan Thomas", "Amelia Moore", "Mason Jackson", "Harper White", "Logan Harris",
  "Ella Clark", "Aiden Lewis", "Grace Walker", "Jacob Hall", "Chloe Allen",
  "Henry Young", "Zoe King", "Samuel Wright", "Lily Scott", "Daniel Green",
  "Nora Baker", "Owen Adams", "Hazel Nelson", "Caleb Carter", "Layla Mitchell",
  "Wyatt Perez", "Stella Roberts", "Julian Turner", "Ruby Phillips", "Leo Campbell",
  "Maya Parker", "Isaac Evans", "Aria Edwards", "Eli Collins", "Luna Stewart",
  "Nathan Morris", "Penelope Rogers", "Ryan Reed", "Violet Cook", "Dylan Morgan",
];

function buildOrders(): Order[] {
  const random = createRandom(3210);
  const earlier = Array.from({ length: ORDER_COUNT - LATEST_ORDERS.length }, (_, index): Order => {
    const customer = CUSTOMERS[(index * 7 + 3) % CUSTOMERS.length];
    const [first, last] = customer.toLowerCase().split(" ");
    const statusRoll = random();
    const status: OrderStatus =
      statusRoll < 0.72 ? "Paid" : statusRoll < 0.84 ? "Pending" : statusRoll < 0.92 ? "Draft" : "Refunded";
    const planRoll = random();
    const plan: OrderPlan = planRoll < 0.5 ? "Pro monthly" : planRoll < 0.85 ? "Pro yearly" : "Team";
    const day = 11 - Math.floor(index / 11.1);
    return {
      id: 3204 - index,
      customer,
      email: `${first}.${last}@example.com`,
      status,
      plan,
      date: `2026-10-${String(day).padStart(2, "0")}`,
      amount: status === "Refunded" ? -PLAN_PRICE[plan] : PLAN_PRICE[plan],
    };
  });
  return [...LATEST_ORDERS, ...earlier];
}

/** 128 orders, newest first. */
export const orders: readonly Order[] = buildOrders();
