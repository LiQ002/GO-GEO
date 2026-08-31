"use client";

import { useRouter } from "next/navigation";
import { Modal } from "./modal";
import { Icon, type IconName } from "@/components/ui/icon";

type RealnamePromptModalProps = {
  open: boolean;
  onClose: () => void;
};

const features = [
  { icon: "brand" as IconName, title: "品牌管理", desc: "创建和管理企业品牌资产" },
  { icon: "article" as IconName, title: "内容创作", desc: "AI 辅助生成高质量文章" },
  { icon: "send" as IconName, title: "一键投放", desc: "多平台内容分发与监测" },
  { icon: "geo" as IconName, title: "GEO 洞察", desc: "获取搜索流量增长机会" },
];

export function RealnamePromptModal({ open, onClose }: RealnamePromptModalProps) {
  const router = useRouter();

  const handleGoAuth = () => {
    onClose();
    router.push("/console/realname");
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="完成实名认证"
      description="为保障账户安全并使用全部功能，请先完成实名认证"
      size="md"
    >
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3478f6]/10">
            <Icon name="shield" className="h-7 w-7 text-[#3478f6]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#1d1d1f]">开启全部功能</h3>
            <p className="text-sm text-[#66666d] mt-0.5">
              认证后可解锁以下核心功能
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-3 p-3 rounded-xl bg-[#f5f5f7] hover:bg-[#f0f4ff] transition"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                <Icon name={f.icon} className="h-4 w-4 text-[#3478f6]" />
              </div>
              <div>
                <div className="text-sm font-medium text-[#1d1d1f]">{f.title}</div>
                <div className="text-xs text-[#66666d] mt-0.5">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#f5f5f7] rounded-xl p-4 text-xs text-[#66666d] mb-6">
          <p className="font-medium text-[#1d1d1f] mb-2">认证说明</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>支持个人认证和企业认证两种方式</li>
            <li>认证审核一般在 1-3 个工作日内完成</li>
            <li>请确保填写的信息真实有效</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            className="flex-1 h-11 rounded-xl border border-[#e5e5ea] bg-white text-sm font-semibold text-[#55555c] hover:bg-[#f5f5f7] transition"
            onClick={onClose}
          >
            稍后再说
          </button>
          <button
            type="button"
            className="flex-1 h-11 rounded-xl bg-[#3478f6] text-sm font-semibold text-white hover:bg-[#175ccc] shadow-[0_8px_18px_rgba(52,120,246,.24)] transition"
            onClick={handleGoAuth}
          >
            立即认证
          </button>
        </div>
      </div>
    </Modal>
  );
}
