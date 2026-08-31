"use client";

import { useState, useRef, useCallback } from "react";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/console/modal";
import { useRealnameStatus } from "@/lib/hooks/use-realname-status";
import { userApi } from "@/lib/api/user-api.generated";

type RealnameStatus = "pending" | "approved" | "rejected";

const statusConfig: Record<RealnameStatus, { color: string; text: string }> = {
  pending: { color: "bg-amber-100 text-amber-700 border-amber-200", text: "待审核" },
  approved: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", text: "已通过" },
  rejected: { color: "bg-red-100 text-red-700 border-red-200", text: "已驳回" },
};

export default function RealnamePage() {
  const { auth, loading, refresh } = useRealnameStatus();
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    type: "enterprise" as const,
    realName: "",
    idCardNumber: "",
    mobile: "",
    companyName: "",
    registrationNo: "",
    licenseImageUrl: "",
    idCardImageUrl: "",
  });

  const updateField = useCallback((key: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  function openModal() {
    setFormData({
      type: "enterprise",
      realName: "",
      idCardNumber: "",
      mobile: "",
      companyName: "",
      registrationNo: "",
      licenseImageUrl: "",
      idCardImageUrl: "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
  }

  async function handleSubmit() {
    if (!formData.companyName.trim() || !formData.registrationNo.trim()) {
      alert("请填写企业名称和营业执照注册号");
      return;
    }
    if (!formData.licenseImageUrl) {
      alert("请上传营业执照图片");
      return;
    }
    if (!formData.realName.trim() || !formData.idCardNumber.trim() || !formData.mobile.trim()) {
      alert("请填写认证人姓名、身份证号和手机号");
      return;
    }
    if (!formData.idCardImageUrl) {
      alert("请上传认证人身份证正面照片");
      return;
    }

    setSubmitting(true);
    try {
      await userApi.realname.submitRealnameAuthentication(formData);
      alert("实名认证已提交，等待审核");
      setShowModal(false);
      await refresh();
    } catch (error: any) {
      alert(error?.message || "提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-[#3478f6] border-t-transparent rounded-full" />
      </div>
    );
  }

  const status = auth?.status as RealnameStatus | undefined;
  const statusInfo = status ? statusConfig[status] : null;

  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end mb-6">
        <div>
          <h1 className="mt-2 text-[27px] font-semibold tracking-[-.04em] text-[#1d1d1f]">
            企业实名认证
          </h1>
          <p className="mt-2 text-sm text-[#717179]">
            完成企业实名认证后可解锁全部功能
          </p>
        </div>
      </div>

      {!auth ? (
        <div className="console-card p-6 sm:p-8">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3478f6]/10 mb-4">
                <Icon name="building" className="h-7 w-7 text-[#3478f6]" />
              </div>
              <h2 className="text-xl font-semibold text-[#1d1d1f]">企业实名认证</h2>
              <p className="mt-2 text-sm text-[#66666d]">请填写企业认证信息，审核将在 1-3 个工作日内完成</p>
            </div>

            <div className="bg-[#f5f5f7] rounded-xl p-4 mb-6">
              <h3 className="text-sm font-medium text-[#1d1d1f] mb-3">所需材料</h3>
              <ul className="text-xs text-[#66666d] space-y-2">
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#3478f6]" />
                  <div><span className="font-medium text-[#1d1d1f]">营业执照</span>：请上传清晰的营业执照照片</div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#3478f6]" />
                  <div><span className="font-medium text-[#1d1d1f]">认证人身份证</span>：请上传身份证正面照片</div>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-[#3478f6]" />
                  <div><span className="font-medium text-[#1d1d1f]">企业信息</span>：需填写企业名称、注册号及认证人信息</div>
                </li>
              </ul>
            </div>

            <button
              type="button"
              onClick={openModal}
              className="w-full h-12 rounded-xl bg-[#3478f6] text-sm font-semibold text-white hover:bg-[#175ccc] transition"
            >
              开始认证
            </button>
          </div>
        </div>
      ) : (
        <div className="console-card p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                status === "approved" ? "bg-emerald-100" :
                status === "rejected" ? "bg-red-100" : "bg-amber-100"
              }`}>
                <Icon
                  name={status === "approved" ? "check" : status === "rejected" ? "x" : "clock"}
                  className={`h-6 w-6 ${
                    status === "approved" ? "text-emerald-600" :
                    status === "rejected" ? "text-red-600" : "text-amber-600"
                  }`}
                />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#1d1d1f]">认证状态</h2>
                {statusInfo && (
                  <span className={`inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                    {statusInfo.text}
                  </span>
                )}
              </div>
            </div>
            {status === "rejected" && (
              <button
                type="button"
                className="h-10 rounded-xl bg-[#3478f6] px-5 text-sm font-semibold text-white hover:bg-[#175ccc]"
                onClick={openModal}
              >
                重新提交
              </button>
            )}
          </div>

          {auth.rejectReason && status === "rejected" && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
              <div className="flex items-center gap-2 text-red-700 text-sm font-medium">
                <Icon name="alert" className="h-4 w-4" />
                驳回原因
              </div>
              <p className="text-red-600 text-sm mt-2">{auth.rejectReason}</p>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3">企业信息</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <InfoItem label="企业名称" value={auth.companyName} />
              <InfoItem label="营业执照注册号" value={auth.registrationNo} />
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3">认证人信息</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <InfoItem label="认证人姓名" value={auth.realName} />
              <InfoItem label="身份证号" value={auth.idCardNumber} />
              <InfoItem label="手机号" value={auth.mobile} />
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-sm font-semibold text-[#1d1d1f] mb-3">认证材料</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {auth.licenseImageUrl && (
                <ImagePreview label="营业执照" url={auth.licenseImageUrl} />
              )}
              {auth.idCardImageUrl && (
                <ImagePreview label="认证人身份证" url={auth.idCardImageUrl} />
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {auth.submittedAt && (
              <InfoItem label="提交时间" value={new Date(auth.submittedAt).toLocaleString("zh-CN")} />
            )}
            {auth.reviewedAt && (
              <InfoItem label="审核时间" value={new Date(auth.reviewedAt).toLocaleString("zh-CN")} />
            )}
          </div>

          {(status === "pending" || status === "approved") && (
            <div className="mt-6 p-4 rounded-xl bg-[#f5f5f7]">
              <p className="text-sm text-[#66666d]">
                {status === "pending"
                  ? "您的企业实名认证正在审核中，审核完成后将通过系统消息通知您。"
                  : "您的企业实名认证已通过，现在可以使用全部功能了！"}
              </p>
            </div>
          )}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={closeModal}
        title="企业实名认证"
        description="请填写真实信息，审核将在 1-3 个工作日内完成"
        size="lg"
      >
        <div className="space-y-5">
          <div className="bg-[#f5f5f7] rounded-xl p-4">
            <h3 className="text-sm font-medium text-[#1d1d1f] mb-3">企业信息</h3>
            <div className="space-y-4">
              <FormField
                label="企业名称"
                required
                value={formData.companyName}
                onChange={(e) => updateField("companyName", e.target.value)}
                placeholder="请输入企业名称（与营业执照一致）"
              />
              <FormField
                label="营业执照注册号"
                required
                value={formData.registrationNo}
                onChange={(e) => updateField("registrationNo", e.target.value)}
                placeholder="请输入统一社会信用代码或注册号"
              />
              <ImageUpload
                label="营业执照照片"
                required
                value={formData.licenseImageUrl}
                onChange={(url) => updateField("licenseImageUrl", url)}
                usage="license"
              />
            </div>
          </div>

          <div className="bg-[#f5f5f7] rounded-xl p-4">
            <h3 className="text-sm font-medium text-[#1d1d1f] mb-3">认证人信息</h3>
            <div className="space-y-4">
              <FormField
                label="认证人姓名"
                required
                value={formData.realName}
                onChange={(e) => updateField("realName", e.target.value)}
                placeholder="请输入认证人真实姓名"
              />
              <FormField
                label="认证人身份证号"
                required
                value={formData.idCardNumber}
                onChange={(e) => updateField("idCardNumber", e.target.value)}
                placeholder="请输入认证人身份证号"
              />
              <FormField
                label="手机号"
                required
                value={formData.mobile}
                onChange={(e) => updateField("mobile", e.target.value)}
                placeholder="请输入认证人手机号"
              />
              <ImageUpload
                label="认证人身份证正面照片"
                required
                value={formData.idCardImageUrl}
                onChange={(url) => updateField("idCardImageUrl", url)}
                usage="id_card"
              />
            </div>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            type="button"
            className="flex-1 h-11 rounded-xl bg-[#f5f5f7] text-sm font-semibold text-[#1d1d1f] hover:bg-[#e5e5ea]"
            onClick={closeModal}
          >
            取消
          </button>
          <button
            type="button"
            className="flex-1 h-11 rounded-xl bg-[#3478f6] text-sm font-semibold text-white hover:bg-[#175ccc] disabled:opacity-50"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "提交中..." : "提交认证"}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function FormField({
  label,
  required,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#1d1d1f] mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full h-10 px-4 rounded-xl border border-[#e5e5ea] bg-white text-sm text-[#1d1d1f] placeholder-[#8e8e93] focus:outline-none focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/20"
      />
    </div>
  );
}

function ImagePreview({ label, url }: { label: string; url: string }) {
  return (
    <div>
      <div className="text-xs text-[#66666d] mb-1">{label}</div>
      <div className="rounded-xl overflow-hidden border border-[#e5e5ea] bg-[#f5f5f7]">
        <img
          src={url}
          alt={label}
          className="w-full h-40 object-contain"
        />
      </div>
    </div>
  );
}

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunks: string[] = [];
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)),
    );
  }
  return window.btoa(chunks.join(""));
}

function ImageUpload({
  label,
  required,
  value,
  onChange,
  usage,
}: {
  label: string;
  required?: boolean;
  value: string;
  onChange: (url: string) => void;
  usage: "id_card" | "license";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("请选择图片文件");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("图片大小不能超过5MB");
      return;
    }

    const tempUrl = URL.createObjectURL(file);
    setPreviewUrl(tempUrl);
    setUploading(true);

    try {
      const content = await fileToBase64(file);
      const result = await userApi.realname.uploadRealnameImage({
        originalName: file.name,
        mimeType: file.type,
        content,
        usage,
      });

      if (result?.url) {
        onChange(result.url);
      } else {
        throw new Error("上传失败");
      }
    } catch (error: any) {
      alert("图片上传失败: " + (error?.message || "请重试"));
      setPreviewUrl("");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewUrl("");
    onChange("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const displayUrl = value || previewUrl;

  return (
    <div>
      <label className="block text-sm font-medium text-[#1d1d1f] mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div
        onClick={() => inputRef.current?.click()}
        className={`relative flex items-center justify-center w-full h-40 rounded-xl border-2 border-dashed cursor-pointer transition ${
          displayUrl
            ? "border-[#3478f6] bg-white"
            : "border-[#e5e5ea] bg-[#f5f5f7] hover:border-[#3478f6] hover:bg-[#3478f6]/5"
        }`}
      >
        {displayUrl ? (
          <div className="relative w-full h-full">
            <img
              src={displayUrl}
              alt={label}
              className="w-full h-full object-contain rounded-xl"
            />
            {uploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                <div className="flex flex-col items-center text-white">
                  <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full mb-2" />
                  <span className="text-xs">上传中...</span>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center bg-black/60 rounded-full text-white hover:bg-black/80 transition"
            >
              <Icon name="x" className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center text-[#8e8e93]">
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mb-2">
              <Icon name="image" className="h-5 w-5 text-[#3478f6]" />
            </div>
            <span className="text-sm">点击上传图片</span>
            <span className="text-xs mt-1">支持 JPG/PNG，最大 5MB</span>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
          disabled={uploading}
        />
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="p-3 rounded-xl bg-[#f5f5f7]">
      <div className="text-xs text-[#66666d] mb-1">{label}</div>
      <div className="text-sm font-medium text-[#1d1d1f]">
        {value || "-"}
      </div>
    </div>
  );
}
