import type { Metadata } from "next";
import Link from "next/link";
import { ArticleGenerator } from "@/components/console/article-generator";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = { title: "创建文章" };

export default function NewArticlePage() {
  return (
    <div>
      <Link
        href="/console/articles"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#74747c] hover:text-[#3478f6]"
      >
        <Icon name="arrow-right" className="h-3.5 w-3.5 rotate-180" />
        返回文章列表
      </Link>
      <div className="mt-4">
        <h1 className="text-[27px] font-semibold tracking-[-.04em]">
          创建文章
        </h1>
        <p className="mt-2 text-sm text-[#717179]">
          从品牌知识和目标问题出发，生成适合不同渠道的可信内容。
        </p>
      </div>
      <div className="mt-7">
        <ArticleGenerator />
      </div>
    </div>
  );
}
