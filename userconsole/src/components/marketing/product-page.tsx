import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";

type ProductPageProps = {
  eyebrow: string;
  title: string;
  highlight: string;
  description: string;
  items: Array<{
    icon: IconName;
    title: string;
    description: string;
    meta?: string;
  }>;
};

export function ProductPage({
  eyebrow,
  title,
  highlight,
  description,
  items,
}: ProductPageProps) {
  return (
    <>
      <section className="hero-glow site-grid px-5 py-20 text-center lg:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-bold tracking-[.18em] text-[#00a98f]">
            {eyebrow}
          </p>
          <h1 className="mt-5 text-[42px] font-semibold leading-[1.1] tracking-[-.055em] sm:text-[58px]">
            {title}
            <br />
            <span className="text-gradient">{highlight}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-8 text-[#5f737a]">
            {description}
          </p>
          <div className="mt-9 flex justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-[#071a23] px-6 text-sm font-semibold text-white"
            >
              免费开始 <Icon name="arrow-right" className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex h-12 items-center rounded-xl border border-[#cfddd9] bg-white px-6 text-sm font-semibold text-[#29434b]"
            >
              查看价格
            </Link>
          </div>
        </div>
      </section>
      <section className="bg-white px-5 py-20 lg:px-8 lg:py-28">
        <div className="mx-auto grid max-w-[1120px] gap-5 md:grid-cols-2">
          {items.map((item, index) => (
            <article
              key={item.title}
              className={`lift rounded-[22px] border border-[#dfe9e6] p-7 sm:p-9 ${index === 0 ? "bg-[#eefaf7]" : "bg-[#fbfdfc]"}`}
            >
              <div className="flex items-start justify-between">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#00a98f] shadow-sm">
                  <Icon name={item.icon} className="h-6 w-6" />
                </span>
                {item.meta ? (
                  <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-[#008c77]">
                    {item.meta}
                  </span>
                ) : null}
              </div>
              <h2 className="mt-8 text-[23px] font-semibold tracking-[-.035em]">
                {item.title}
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#667b82]">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
