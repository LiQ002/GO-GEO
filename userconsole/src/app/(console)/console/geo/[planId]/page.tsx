import type { Metadata } from "next";
import { GeoPlanDetailWorkspace } from "@/components/console/geo-plan-detail-workspace";

type Props = { params: Promise<{ planId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { planId } = await params;
  return { title: `GEO 监测详情 #${planId}` };
}

export default async function GeoPlanDetailPage({ params }: Props) {
  const { planId } = await params;
  return <GeoPlanDetailWorkspace planId={planId} />;
}
