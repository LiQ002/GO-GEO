"use client";

import {
  type ChangeEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "@/components/ui/icon";
import {
  CONSOLE_PAGE_SIZE,
  type ResourcePage,
} from "@/lib/api/console-resources";
import {
  type UserV1GalleryAlbum,
  type UserV1GalleryImage,
  userApi,
} from "@/lib/api/user-api.generated";
import {
  KnowledgeCategory,
  knowledgeCategoryLabel,
  knowledgeCategoryOptions,
} from "@/lib/user-enums";
import { ConfirmDialog, Modal, Toast } from "./modal";

const maxImageSize = 10 * 1024 * 1024;
const allowedImageTypes = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type AlbumEditorState =
  | { mode: "create"; album: null }
  | { mode: "edit"; album: UserV1GalleryAlbum }
  | null;

type DeleteTarget =
  | { kind: "album"; album: UserV1GalleryAlbum }
  | { kind: "image"; image: UserV1GalleryImage }
  | null;

export function GalleryWorkspace() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [albums, setAlbums] = useState<UserV1GalleryAlbum[]>([]);
  const [images, setImages] = useState<UserV1GalleryImage[]>([]);
  const [selectedAlbumID, setSelectedAlbumID] = useState("");
  const [category, setCategory] = useState(0);
  const [query, setQuery] = useState("");
  const [albumPage, setAlbumPage] = useState<ResourcePage | null>(null);
  const [albumPageIndex, setAlbumPageIndex] = useState(0);
  const [albumPageTokens, setAlbumPageTokens] = useState([""]);
  const [imagePage, setImagePage] = useState<ResourcePage | null>(null);
  const [imagePageIndex, setImagePageIndex] = useState(0);
  const [imagePageTokens, setImagePageTokens] = useState([""]);
  const [loadingAlbums, setLoadingAlbums] = useState(true);
  const [loadingImages, setLoadingImages] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editor, setEditor] = useState<AlbumEditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [toast, setToast] = useState<string | null>(null);

  const selectedAlbum = useMemo(
    () => albums.find((album) => album.id === selectedAlbumID) ?? null,
    [albums, selectedAlbumID],
  );

  const visibleAlbums = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-CN");
    return albums.filter((album) => {
      if (album.category != null && album.category < 0) return false;
      const matchesCategory = category === 0 || album.category === category;
      const matchesQuery =
        normalizedQuery === "" ||
        album.name?.toLocaleLowerCase("zh-CN").includes(normalizedQuery) ||
        album.description?.toLocaleLowerCase("zh-CN").includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [albums, category, query]);

  const loadAlbums = useCallback(
    async (preferredAlbumID?: string, pageToken = "") => {
      setLoadingAlbums(true);
      try {
        const reply = await userApi.gallery.listGalleryAlbums({
          category: category || undefined,
          keyword: query.trim() || undefined,
          pageSize: CONSOLE_PAGE_SIZE,
          pageToken,
        });
        const nextAlbums = reply.items ?? [];
        setAlbums(nextAlbums);
        setAlbumPage({
          nextPageToken: reply.nextPageToken || "",
          pageSize: CONSOLE_PAGE_SIZE,
          pageToken,
          totalSize: Number(reply.totalSize || 0),
        });
        setSelectedAlbumID((current) => {
          const preferred = preferredAlbumID ?? current;
          if (preferred && nextAlbums.some((album) => album.id === preferred)) {
            return preferred;
          }
          return nextAlbums[0]?.id ?? "";
        });
        return true;
      } catch (caught) {
        setToast(errorMessage(caught, "相册加载失败"));
        return false;
      } finally {
        setLoadingAlbums(false);
      }
    },
    [category, query],
  );

  const loadImages = useCallback(async (albumID: string, pageToken = "") => {
    if (!albumID) {
      setImages([]);
      setImagePage(null);
      return true;
    }
    setLoadingImages(true);
    try {
      const reply = await userApi.gallery.listGalleryImages({
        albumId: albumID,
        pageSize: CONSOLE_PAGE_SIZE,
        pageToken,
      });
      setImages(reply.items ?? []);
      setImagePage({
        nextPageToken: reply.nextPageToken || "",
        pageSize: CONSOLE_PAGE_SIZE,
        pageToken,
        totalSize: Number(reply.totalSize || 0),
      });
      return true;
    } catch (caught) {
      setImages([]);
      setToast(errorMessage(caught, "图片加载失败"));
      return false;
    } finally {
      setLoadingImages(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAlbumPageIndex(0);
      setAlbumPageTokens([""]);
      void loadAlbums();
    }, 320);
    return () => window.clearTimeout(timer);
  }, [loadAlbums]);

  useEffect(() => {
    setImagePageIndex(0);
    setImagePageTokens([""]);
    void loadImages(selectedAlbumID);
  }, [loadImages, selectedAlbumID]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const albumTotalPages = Math.max(
    1,
    Math.ceil((albumPage?.totalSize ?? 0) / CONSOLE_PAGE_SIZE),
  );
  const imageTotalPages = Math.max(
    1,
    Math.ceil((imagePage?.totalSize ?? 0) / CONSOLE_PAGE_SIZE),
  );

  async function changeAlbumPage(direction: "next" | "previous") {
    if (!albumPage || loadingAlbums) return;
    const targetIndex =
      direction === "next" ? albumPageIndex + 1 : albumPageIndex - 1;
    if (targetIndex < 0 || targetIndex >= albumTotalPages) return;
    const pageToken =
      direction === "next"
        ? albumPage.nextPageToken
        : albumPageTokens[targetIndex];
    if (!pageToken && direction === "next") return;
    const loaded = await loadAlbums(undefined, pageToken);
    if (!loaded) return;
    setAlbumPageIndex(targetIndex);
    if (direction === "next") {
      setAlbumPageTokens((current) => {
        const next = current.slice(0, targetIndex);
        next[targetIndex] = pageToken;
        return next;
      });
    }
  }

  async function changeImagePage(direction: "next" | "previous") {
    if (!imagePage || loadingImages) return;
    const targetIndex =
      direction === "next" ? imagePageIndex + 1 : imagePageIndex - 1;
    if (targetIndex < 0 || targetIndex >= imageTotalPages) return;
    const pageToken =
      direction === "next"
        ? imagePage.nextPageToken
        : imagePageTokens[targetIndex];
    if (!pageToken && direction === "next") return;
    const loaded = await loadImages(selectedAlbumID, pageToken);
    if (!loaded) return;
    setImagePageIndex(targetIndex);
    if (direction === "next") {
      setImagePageTokens((current) => {
        const next = current.slice(0, targetIndex);
        next[targetIndex] = pageToken;
        return next;
      });
    }
  }

  async function saveAlbum(values: {
    category: number;
    description: string;
    name: string;
  }) {
    if (editor?.mode === "edit") {
      const updated = await userApi.gallery.updateGalleryAlbum(
        editor.album.id ?? "",
        {
          album: {
            ...editor.album,
            category: values.category,
            description: values.description,
            name: values.name,
          },
        },
      );
      setEditor(null);
      setToast(`相册“${updated.name ?? values.name}”已更新`);
      await loadAlbums(updated.id, albumPage?.pageToken || "");
      return;
    }
    const created = await userApi.gallery.createGalleryAlbum({
      album: values,
    });
    setEditor(null);
    setToast(`相册“${created.name ?? values.name}”已创建`);
    setAlbumPageIndex(0);
    setAlbumPageTokens([""]);
    await loadAlbums(created.id);
  }

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selectedAlbum || files.length === 0) return;

    const invalid = files.find(
      (file) => !allowedImageTypes.has(file.type) || file.size > maxImageSize,
    );
    if (invalid) {
      setToast(
        `${invalid.name} 不符合要求，请上传 10MB 以内的 JPEG、PNG、GIF 或 WebP 图片`,
      );
      return;
    }

    setUploading(true);
    try {
      for (const file of files) {
        await userApi.gallery.uploadGalleryImage({
          albumId: selectedAlbum.id,
          content: await fileToBase64(file),
          mimeType: file.type,
          originalName: file.name,
        });
      }
      setToast(
        files.length === 1
          ? `${files[0].name} 已上传`
          : `${files.length} 张图片已上传`,
      );
      setImagePageIndex(0);
      setImagePageTokens([""]);
      await Promise.all([
        loadImages(selectedAlbum.id ?? ""),
        loadAlbums(selectedAlbum.id, albumPage?.pageToken || ""),
      ]);
    } catch (caught) {
      setToast(errorMessage(caught, "图片上传失败"));
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === "image") {
        const { image } = deleteTarget;
        await userApi.gallery.deleteGalleryImage(image.id ?? "", {
          version: image.version,
        });
        setToast(`${image.originalName ?? "图片"} 已删除`);
        setDeleteTarget(null);
        const moveToPreviousPage = images.length === 1 && imagePageIndex > 0;
        const targetPageIndex = moveToPreviousPage
          ? imagePageIndex - 1
          : imagePageIndex;
        const imagePageToken = moveToPreviousPage
          ? imagePageTokens[targetPageIndex]
          : imagePage?.pageToken || "";
        await Promise.all([
          loadImages(selectedAlbumID, imagePageToken),
          loadAlbums(selectedAlbumID, albumPage?.pageToken || ""),
        ]);
        if (moveToPreviousPage) setImagePageIndex(targetPageIndex);
        return;
      }
      const { album } = deleteTarget;
      await userApi.gallery.deleteGalleryAlbum(album.id ?? "", {
        version: album.version,
      });
      setToast(`相册“${album.name ?? ""}”已删除`);
      setDeleteTarget(null);
      const moveToPreviousPage = albums.length === 1 && albumPageIndex > 0;
      const targetPageIndex = moveToPreviousPage
        ? albumPageIndex - 1
        : albumPageIndex;
      const pageToken = moveToPreviousPage
        ? albumPageTokens[targetPageIndex]
        : albumPage?.pageToken || "";
      await loadAlbums(undefined, pageToken);
      if (moveToPreviousPage) setAlbumPageIndex(targetPageIndex);
    } catch (caught) {
      setToast(errorMessage(caught, "删除失败"));
    }
  }

  function requestAlbumDelete(album: UserV1GalleryAlbum) {
    if (Number(album.imageCount ?? 0) > 0) {
      setToast("请先删除相册内的图片，再删除相册");
      return;
    }
    setDeleteTarget({ kind: "album", album });
  }

  return (
    <div>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3478f6]">
            <Icon name="image" className="h-4 w-4" />
            企业内容资产
          </div>
          <h1 className="mt-2 text-[27px] font-semibold tracking-[-.04em]">
            企业图库
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#717179]">
            按企业知识分类沉淀品牌、产品、案例与资质图片，创建 GEO
            内容时可作为企业视觉素材使用。
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditor({ mode: "create", album: null })}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(145deg,#3f8fff,#6e6af4)] px-4 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(69,112,235,.24),inset_0_1px_0_rgba(255,255,255,.28)] transition hover:-translate-y-0.5"
        >
          <Icon name="plus" className="h-4 w-4" />
          新建相册
        </button>
      </div>

      <section className="console-card mt-7 overflow-hidden">
        <div className="grid min-h-[620px] lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-b border-white/70 bg-white/20 lg:border-r lg:border-b-0">
            <div className="space-y-3 border-b border-white/70 p-4">
              <label className="glass-control flex h-10 items-center gap-2 rounded-[14px] px-3 text-[#85858c]">
                <Icon name="search" className="h-4 w-4" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="搜索相册"
                  placeholder="搜索相册…"
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#3a3a40] outline-none"
                />
              </label>
              <select
                value={category}
                onChange={(event) => setCategory(Number(event.target.value))}
                aria-label="按知识分类筛选相册"
                className="glass-control h-10 w-full rounded-[14px] px-3 text-xs font-medium text-[#5f5f66] outline-none"
              >
                <option value={0}>全部分类</option>
                {knowledgeCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-[350px] space-y-2 overflow-y-auto p-3 lg:max-h-[530px]">
              {visibleAlbums.map((album) => {
                const active = album.id === selectedAlbumID;
                return (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() => setSelectedAlbumID(album.id ?? "")}
                    className={`flex w-full items-center gap-3 rounded-[16px] p-3 text-left transition ${
                      active
                        ? "border border-white/85 bg-white/75 shadow-[0_8px_22px_rgba(63,82,123,.1)]"
                        : "border border-transparent hover:bg-white/45"
                    }`}
                  >
                    <AlbumCover album={album} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#34343a]">
                        {album.name}
                      </span>
                      <span className="mt-1 block truncate text-[11px] text-[#7a7a82]">
                        {knowledgeCategoryLabel(album.category)} ·{" "}
                        {album.imageCount ?? "0"} 张
                      </span>
                    </span>
                    <Icon
                      name="arrow-right"
                      className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[#3478f6]" : "text-[#9a9aa1]"}`}
                    />
                  </button>
                );
              })}
              {!loadingAlbums && visibleAlbums.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Icon
                    name="image"
                    className="mx-auto h-7 w-7 text-[#a0a0a7]"
                  />
                  <p className="mt-3 text-sm font-medium text-[#65656d]">
                    暂无匹配相册
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCategory(0);
                      setQuery("");
                    }}
                    className="mt-2 text-xs text-[#3478f6]"
                  >
                    清除筛选
                  </button>
                </div>
              ) : null}
              {loadingAlbums ? (
                <p className="px-4 py-12 text-center text-xs text-[#7a7a82]">
                  正在加载相册…
                </p>
              ) : null}
            </div>
            <GalleryPaginationFooter
              currentPage={albumPageIndex + 1}
              loading={loadingAlbums}
              nextDisabled={!albumPage?.nextPageToken}
              onNext={() => void changeAlbumPage("next")}
              onPrevious={() => void changeAlbumPage("previous")}
              totalPages={albumTotalPages}
              totalSize={albumPage?.totalSize ?? albums.length}
            />
          </aside>

          <div className="min-w-0">
            {selectedAlbum ? (
              <>
                <div className="flex flex-col gap-4 border-b border-white/70 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold tracking-[-.025em] text-[#2f2f35]">
                        {selectedAlbum.name}
                      </h2>
                      <span className="rounded-full border border-white/80 bg-[#eaf2ff]/75 px-2.5 py-1 text-[10px] font-medium text-[#3478f6]">
                        {knowledgeCategoryLabel(selectedAlbum.category)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-[#77777e]">
                      {selectedAlbum.description || "未填写相册说明"}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setEditor({ mode: "edit", album: selectedAlbum })
                      }
                      className="glass-control inline-flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-xs font-medium text-[#5f5f66]"
                    >
                      <Icon name="edit" className="h-3.5 w-3.5" />
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => requestAlbumDelete(selectedAlbum)}
                      className="glass-control inline-flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-xs font-medium text-[#d45d52]"
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                      删除相册
                    </button>
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-[12px] bg-[linear-gradient(145deg,#438fff,#706af4)] px-3 text-xs font-semibold text-white shadow-[0_7px_16px_rgba(69,112,235,.2)] disabled:opacity-60"
                    >
                      <Icon name="plus" className="h-3.5 w-3.5" />
                      {uploading ? "正在上传…" : "上传图片"}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={(event) => void handleFiles(event)}
                    />
                  </div>
                </div>

                <div className="p-5">
                  <p className="mb-4 text-[11px] text-[#85858d]">
                    支持 JPEG、PNG、GIF、WebP，单张不超过 10MB，可一次选择多张。
                  </p>
                  {images.length > 0 ? (
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                      {images.map((image) => (
                        <GalleryImageCard
                          key={image.id}
                          image={image}
                          onDelete={() =>
                            setDeleteTarget({ kind: "image", image })
                          }
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[380px] flex-col items-center justify-center rounded-[22px] border border-dashed border-white/90 bg-white/20 px-5 text-center">
                      <span className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/80 bg-white/55 text-[#6f7d93] shadow-[inset_0_1px_0_white]">
                        <Icon name="image" className="h-6 w-6" />
                      </span>
                      <p className="mt-4 text-sm font-semibold text-[#505057]">
                        {loadingImages ? "正在加载图片…" : "这个相册还没有图片"}
                      </p>
                      {!loadingImages ? (
                        <>
                          <p className="mt-2 text-xs leading-5 text-[#85858c]">
                            上传企业品牌、产品、案例或资质素材，后续可在内容生成中使用。
                          </p>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="mt-4 text-xs font-semibold text-[#3478f6]"
                          >
                            选择图片上传
                          </button>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
                <GalleryPaginationFooter
                  currentPage={imagePageIndex + 1}
                  loading={loadingImages}
                  nextDisabled={!imagePage?.nextPageToken}
                  onNext={() => void changeImagePage("next")}
                  onPrevious={() => void changeImagePage("previous")}
                  totalPages={imageTotalPages}
                  totalSize={imagePage?.totalSize ?? images.length}
                />
              </>
            ) : (
              <div className="flex min-h-[620px] flex-col items-center justify-center px-6 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/80 bg-white/50 text-[#6f7d93] shadow-[inset_0_1px_0_white]">
                  <Icon name="image" className="h-7 w-7" />
                </span>
                <h2 className="mt-5 text-base font-semibold text-[#44444b]">
                  先创建一个企业相册
                </h2>
                <p className="mt-2 max-w-sm text-xs leading-6 text-[#818188]">
                  相册分类沿用企业知识分类，便于后续文章生成时准确选择对应的视觉素材。
                </p>
                <button
                  type="button"
                  onClick={() => setEditor({ mode: "create", album: null })}
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-[14px] bg-[linear-gradient(145deg,#438fff,#706af4)] px-4 text-xs font-semibold text-white"
                >
                  <Icon name="plus" className="h-4 w-4" />
                  新建相册
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      <AlbumEditor
        key={`${editor?.mode ?? "closed"}-${editor?.album?.id ?? "new"}`}
        state={editor}
        onClose={() => setEditor(null)}
        onSave={saveAlbum}
        onError={setToast}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.kind === "album" ? "删除相册" : "删除图片"}
        description={
          deleteTarget?.kind === "album"
            ? `确认删除空相册“${deleteTarget.album.name ?? ""}”吗？此操作无法撤销。`
            : `确认删除图片“${deleteTarget?.image.originalName ?? ""}”吗？存储中的原始文件也会一并删除。`
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />
      <Toast message={toast} />
    </div>
  );
}

function GalleryPaginationFooter({
  currentPage,
  loading,
  nextDisabled,
  onNext,
  onPrevious,
  totalPages,
  totalSize,
}: {
  currentPage: number;
  loading: boolean;
  nextDisabled: boolean;
  onNext: () => void;
  onPrevious: () => void;
  totalPages: number;
  totalSize: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-white/70 px-3 py-3 text-[10px] text-[#77777e]">
      <span>共 {totalSize} 条</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={currentPage <= 1 || loading}
          onClick={onPrevious}
          className="glass-control h-8 rounded-[9px] px-2.5 disabled:cursor-not-allowed disabled:opacity-45"
        >
          上一页
        </button>
        <span className="min-w-12 text-center">
          {currentPage}/{totalPages}
        </span>
        <button
          type="button"
          disabled={nextDisabled || currentPage >= totalPages || loading}
          onClick={onNext}
          className="glass-control h-8 rounded-[9px] px-2.5 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {loading ? "加载中" : "下一页"}
        </button>
      </div>
    </div>
  );
}

function AlbumCover({ album }: { album: UserV1GalleryAlbum }) {
  const url = galleryAssetURL(album.coverImageUrl);
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[13px] border border-white/80 bg-white/55 text-[#718096] shadow-[inset_0_1px_0_white]">
      {url ? (
        // biome-ignore lint/performance/noImgElement: image domains are configured dynamically by storage.
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <Icon name="image" className="h-4 w-4" />
      )}
    </span>
  );
}

function GalleryImageCard({
  image,
  onDelete,
}: {
  image: UserV1GalleryImage;
  onDelete: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-[18px] border border-white/80 bg-white/42 shadow-[inset_0_1px_0_white]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#eef2f7]/70">
        {/* biome-ignore lint/performance/noImgElement: image domains are configured dynamically by storage. */}
        <img
          src={galleryAssetURL(image.url)}
          alt={image.originalName ?? "企业图库图片"}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
          loading="lazy"
        />
        <button
          type="button"
          aria-label={`删除${image.originalName ?? "图片"}`}
          onClick={onDelete}
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-[10px] border border-white/80 bg-white/85 text-[#d45d52] opacity-100 shadow-sm backdrop-blur transition sm:opacity-0 sm:group-hover:opacity-100"
        >
          <Icon name="trash" className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="p-3">
        <p
          className="truncate text-xs font-medium text-[#414147]"
          title={image.originalName}
        >
          {image.originalName}
        </p>
        <p className="mt-1 text-[10px] text-[#85858c]">
          {formatFileSize(image.sizeBytes)}
        </p>
      </div>
    </article>
  );
}

function AlbumEditor({
  onClose,
  onError,
  onSave,
  state,
}: {
  onClose: () => void;
  onError: (message: string) => void;
  onSave: (values: {
    category: number;
    description: string;
    name: string;
  }) => Promise<void>;
  state: AlbumEditorState;
}) {
  const album = state?.mode === "edit" ? state.album : null;
  const [name, setName] = useState(album?.name ?? "");
  const [category, setCategory] = useState(
    album?.category ?? KnowledgeCategory.enterpriseProfile,
  );
  const [description, setDescription] = useState(album?.description ?? "");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      onError("请填写相册名称");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        category,
        description: description.trim(),
        name: name.trim(),
      });
    } catch (caught) {
      onError(errorMessage(caught, "相册保存失败"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      key={`${state?.mode ?? "closed"}-${album?.id ?? "new"}`}
      open={Boolean(state)}
      onClose={onClose}
      title={state?.mode === "edit" ? "编辑企业相册" : "新建企业相册"}
      description="相册分类沿用企业知识分类，后续可按内容用途选择图片。"
      size="md"
    >
      <form onSubmit={(event) => void submit(event)} className="p-5 sm:p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-[#55555c]">
              相册名称 <span className="text-[#e05e51]">*</span>
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={128}
              placeholder="例如：核心产品图片"
              className="glass-control mt-2 h-11 w-full rounded-[14px] px-3.5 text-sm text-[#36363c] outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[#55555c]">
              知识分类 <span className="text-[#e05e51]">*</span>
            </span>
            <select
              value={category}
              onChange={(event) => setCategory(Number(event.target.value))}
              className="glass-control mt-2 h-11 w-full rounded-[14px] px-3.5 text-sm text-[#36363c] outline-none"
            >
              {knowledgeCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-5 block">
          <span className="text-xs font-semibold text-[#55555c]">相册说明</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={1024}
            rows={4}
            placeholder="说明图片用途、适用产品或使用规范"
            className="glass-control mt-2 w-full resize-y rounded-[14px] px-3.5 py-3 text-sm leading-6 text-[#36363c] outline-none"
          />
        </label>
        <div className="mt-6 flex justify-end gap-3 border-t border-white/70 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="glass-control h-10 rounded-[13px] px-4 text-xs font-semibold text-[#55555c]"
          >
            取消
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-[13px] bg-[linear-gradient(145deg,#438fff,#706af4)] px-5 text-xs font-semibold text-white shadow-[0_8px_18px_rgba(69,112,235,.2)] disabled:opacity-60"
          >
            {saving
              ? "正在保存…"
              : state?.mode === "edit"
                ? "保存修改"
                : "确认创建"}
          </button>
        </div>
      </form>
    </Modal>
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

function galleryAssetURL(value?: string) {
  const url = value?.trim() ?? "";
  if (!url || /^(https?:)?\/\//i.test(url) || url.startsWith("data:")) {
    return url;
  }
  const backendPrefix = "/api/user/v1/";
  if (url.startsWith(backendPrefix)) {
    return `/api/backend/${url.slice(backendPrefix.length)}`;
  }
  return url;
}

function formatFileSize(value?: string) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function errorMessage(caught: unknown, fallback: string) {
  return caught instanceof Error && caught.message ? caught.message : fallback;
}
