import type { Metadata } from "next";
import { ArticleEditor } from "@/components/console/article-editor";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
};

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { mode } = await searchParams;
  return { title: mode === "view" ? "查看文章" : "编辑文章" };
}

export default async function ArticleEditorPage({
  params,
  searchParams,
}: Props) {
  const [{ id }, { mode }] = await Promise.all([params, searchParams]);
  return (
    <ArticleEditor articleId={id} mode={mode === "view" ? "view" : "edit"} />
  );
}
