"use client";

import { Modal } from "./modal";
import { Icon, type IconName } from "@/components/ui/icon";

type SubscriptionPromptModalProps = {
  open: boolean;
  onClose: () => void;
};

const restrictedFeatures = [
  { icon: "article" as IconName, title: "文章创作", desc: "AI 辅助生成高质量文章" },
  { icon: "send" as IconName, title: "一键投放", desc: "多平台内容分发与监测" },
  { icon: "geo" as IconName, title: "GEO 洞察", desc: "获取搜索流量增长机会" },
  { icon: "database" as IconName, title: "知识管理", desc: "构建企业知识资产库" },
];

export function SubscriptionPromptModal({ open, onClose }: SubscriptionPromptModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="您暂未开通服务"
      description="当前企业尚未开通套餐，请联系管理员开通后使用全部功能"
      size="md"
    >
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3b64d]/10">
            <Icon name="wallet" className="h-7 w-7 text-[#f3b64d]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#1d1d1f]">功能暂不可用</h3>
            <p className="text-sm text-[#66666d] mt-0.5">
              开通套餐后可解锁以下核心功能
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          {restrictedFeatures.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-3 p-3 rounded-xl bg-[#f5f5f7]"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm">
                <Icon name={f.icon} className="h-4 w-4 text-[#8a5a16]" />
              </div>
              <div>
                <div className="text-sm font-medium text-[#1d1d1f]">{f.title}</div>
                <div className="text-xs text-[#66666d] mt-0.5">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-[#f5f5f7] rounded-xl p-4 text-xs text-[#66666d] mb-6">
          <p className="font-medium text-[#1d1d1f] mb-2">开通说明</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>请联系管理员为您的企业开通套餐</li>
            <li>可选套餐包含月度、年度等多种方案</li>
            <li>开通后可立即使用全部功能</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            className="flex-1 h-11 rounded-xl border border-[#e5e5ea] bg-white text-sm font-semibold text-[#55555c] hover:bg-[#f5f5f7] transition"
            onClick={onClose}
          >
            我知道了
          </button>
        </div>
      </div>
    </Modal>
  );
}
