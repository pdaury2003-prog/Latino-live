import type { Metadata } from "next";

import { SignInPage } from "@/features/examples/sign-in";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return <SignInPage />;
}
