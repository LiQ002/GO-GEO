import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  OrdersWorkspace,
  PlansWorkspace,
  SettingsWorkspace,
  SubscriptionWorkspace,
} from "@/components/console/enterprise-pages";
import { KeywordWorkspace } from "@/components/console/keyword-question-panel";
import { SectionPage } from "@/components/console/section-page";
import { consoleSections, staticSectionSlugs } from "@/lib/console-sections";

type Props = { params: Promise<{ section: string }> };

export function generateStaticParams() {
  return [...staticSectionSlugs, "subscription", "settings", "plans", "orders"].map(
    (section) => ({ section }),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { section } = await params;
  if (section === "subscription") return { title: "套餐与用量" };
  if (section === "settings") return { title: "企业设置" };
  if (section === "plans") return { title: "可购套餐" };
  if (section === "orders") return { title: "我的订单" };
  return { title: consoleSections[section]?.title ?? "企业工作台" };
}

export default async function DynamicSectionPage({ params }: Props) {
  const { section } = await params;

  if (section === "subscription") return <SubscriptionWorkspace />;
  if (section === "settings") return <SettingsWorkspace />;
  if (section === "plans") return <PlansWorkspace />;
  if (section === "orders") return <OrdersWorkspace />;
  if (section === "keywords") return <KeywordWorkspace />;

  const config = consoleSections[section];
  if (!config) notFound();
  return <SectionPage section={config} slug={section} />;
}
