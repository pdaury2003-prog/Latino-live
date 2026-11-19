import type { Metadata } from "next";

import { OrdersPage } from "@/features/examples/table";

export const metadata: Metadata = { title: "Orders" };

export default function Page() {
  return <OrdersPage />;
}
