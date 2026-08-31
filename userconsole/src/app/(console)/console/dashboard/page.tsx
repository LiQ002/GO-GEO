import type { Metadata } from "next";
import { DashboardWorkspace } from "@/components/console/dashboard-workspace";

export const metadata: Metadata = { title: "工作台" };

export default function DashboardPage() {
  return <DashboardWorkspace />;
}
