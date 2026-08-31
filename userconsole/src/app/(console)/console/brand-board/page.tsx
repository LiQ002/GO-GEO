import type { Metadata } from "next";
import { BrandBoardWorkspace } from "@/components/console/brand-board-workspace";

export const metadata: Metadata = { title: "品牌看板" };

export default function BrandBoardPage() {
  return <BrandBoardWorkspace />;
}
