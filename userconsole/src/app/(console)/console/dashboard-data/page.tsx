import type { Metadata } from "next";
import { DashboardDataWorkspace } from "@/components/console/dashboard-data-workspace";

export const metadata: Metadata = { title: "AI数据报表" };

export default function DashboardDataPage() {
  return <DashboardDataWorkspace />;
}
