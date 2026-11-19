import type { Metadata } from "next";

import { LandingPage } from "@/features/examples/landing";

export const metadata: Metadata = { title: "Landing page" };

export default function Page() {
  return <LandingPage />;
}
