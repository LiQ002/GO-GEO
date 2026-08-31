import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ConsoleShell } from "@/components/console/console-shell";
import { accessCookieName, refreshCookieName } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "企业工作台", template: "%s | GEOHelper 企业工作台" },
  robots: { index: false, follow: false },
};

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  if (
    !cookieStore.has(accessCookieName) &&
    !cookieStore.has(refreshCookieName)
  ) {
    redirect("/login");
  }
  return <ConsoleShell>{children}</ConsoleShell>;
}
