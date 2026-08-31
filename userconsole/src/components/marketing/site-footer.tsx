import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";

const columns = [
  { title: "产品", links: ["GEO 监测", "内容优化", "智能投放", "品牌知识库"] },
  { title: "资源", links: ["帮助中心", "客户案例", "行业报告", "客户端下载"] },
  { title: "关于", links: ["关于我们", "联系我们", "隐私政策", "服务条款"] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-[#dfe9e6] bg-white">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-14 md:grid-cols-[1.5fr_2fr] lg:px-8">
        <div>
          <BrandLogo />
          <p className="mt-5 max-w-sm text-sm leading-7 text-[#667b82]">
            面向 AI
            搜索时代的品牌增长基础设施，让每一次用户提问都成为品牌被看见、被理解、被选择的机会。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="mb-4 text-sm font-semibold text-[#17333c]">
                {column.title}
              </h3>
              <ul className="space-y-3 text-sm text-[#708188]">
                {column.links.map((label) => (
                  <li key={label}>
                    <Link href="#" className="hover:text-[#00a98f]">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-[#edf2f0] px-5 py-6 text-center text-xs text-[#8b999e]">
        © 2026 GEOHelper. All rights reserved.
      </div>
    </footer>
  );
}
