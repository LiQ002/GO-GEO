"use client";

import type { ConsoleRecord } from "@/components/console/console-data-provider";
import { createClientID } from "@/lib/client-id";
import type { ConsoleFormValue } from "@/lib/console-forms";
import {
  AuthorizationResourceType,
  AuthorizationStatus,
  AuthorizationUsageStatus,
  authorizationStatusLabel,
  BrandStatus,
  brandStatusLabel,
  KnowledgeCategory,
  KnowledgeParseStatus,
  KnowledgeSourceType,
  keywordDistillationStatusOptions,
  knowledgeCategoryLabel,
  MonitorPlanStatus,
  MonitorScheduleType,
  MonitorTerminalType,
  monitorPlanStatusOptions,
  monitorScheduleOptions,
  optionLabel,
  PublishPlanStatus,
  PublishScheduleType,
  publishPlanStatusOptions,
  QuestionStatus,
} from "@/lib/user-enums";
import {
  type UserV1Article,
  type UserV1ArticleTypeCatalogItem,
  type UserV1Brand,
  type UserV1CatalogItem,
  type UserV1GalleryAlbum,
  type UserV1Keyword,
  type UserV1KnowledgeDocument,
  type UserV1MonitorPlan,
  type UserV1PlatformAccount,
  type UserV1PublishPlan,
  type UserV1Question,
  userApi,
} from "./user-api.generated";

export type SelectChoice = {
  articleType?: UserV1ArticleTypeCatalogItem;
  brandId?: string;
  disabled?: boolean;
  hint?: string;
  label: string;
  resourceId?: string;
  resourceType?: number;
  keywordId?: string;
  imageCount?: number;
  region?: string;
  value: string;
};
export type ResourceChoices = Record<string, SelectChoice[]>;

export const CONSOLE_PAGE_SIZE = 10;

export type ResourcePage = {
  nextPageToken: string;
  pageSize: number;
  pageToken: string;
  totalSize: number;
};

export type ResourcePageRequest = {
  keyword?: string;
  pageSize?: number;
  pageToken?: string;
  status?: number | string;
};

export type ResourcePageResult = {
  page: ResourcePage;
  records: ConsoleRecord[];
};

type ID = number | string;
type Entity = { id?: ID; version?: ID };
type PaginatedReply<T> = {
  items?: T[];
  nextPageToken?: string;
  totalSize?: number | string;
};

type Article = UserV1Article;
type ArticleTypeCatalogItem = UserV1ArticleTypeCatalogItem;
type Brand = UserV1Brand;
type CatalogItem = UserV1CatalogItem;
type Keyword = UserV1Keyword;
type KnowledgeDocument = UserV1KnowledgeDocument;
type GalleryAlbum = UserV1GalleryAlbum;
type MonitorPlan = UserV1MonitorPlan;
type PlatformAccount = UserV1PlatformAccount;
type PublishPlan = UserV1PublishPlan;
type Question = UserV1Question;

export type ResourceSnapshot = {
  articleTypes: ArticleTypeCatalogItem[];
  articles: Article[];
  brands: Brand[];
  choices: ResourceChoices;
  inclusionSites: CatalogItem[];
  galleryAlbums: GalleryAlbum[];
  knowledgeDocuments: KnowledgeDocument[];
  keywords: Keyword[];
  monitorPlans: MonitorPlan[];
  platformAccounts: PlatformAccount[];
  pages: Record<string, ResourcePage>;
  publishChannels: CatalogItem[];
  publishPlans: PublishPlan[];
  publishTargets: CatalogItem[];
  questions: Question[];
  records: Record<string, ConsoleRecord[]>;
  writingModels: CatalogItem[];
};

export async function loadConsoleResources(): Promise<ResourceSnapshot> {
  const [
    brandReply,
    documentReply,
    keywordReply,
    questionReply,
    articleReply,
    publishReply,
    monitorReply,
    accountReply,
    articleTypeReply,
    writingModelReply,
    channelReply,
    targetReply,
    siteReply,
    galleryAlbumReply,
  ] = await Promise.all([
    userApi.brand.listBrands({ pageSize: CONSOLE_PAGE_SIZE }),
    userApi.knowledge.listKnowledgeDocuments({ pageSize: CONSOLE_PAGE_SIZE }),
    userApi.keyword.listKeywords({ pageSize: CONSOLE_PAGE_SIZE }),
    userApi.question.listQuestions({ pageSize: CONSOLE_PAGE_SIZE }),
    userApi.article.listArticles({ pageSize: CONSOLE_PAGE_SIZE }),
    userApi.publishTask.listPublishPlans({ pageSize: CONSOLE_PAGE_SIZE }),
    userApi.geoMonitor.listMonitorPlans({ pageSize: CONSOLE_PAGE_SIZE }),
    userApi.platformAccount.listPlatformAccounts(),
    userApi.catalog.listArticleTypeCatalog(),
    userApi.catalog.listWritingModelCatalog(),
    userApi.catalog.listPublishChannelCatalog(),
    userApi.catalog.listPublishTargetCatalog(),
    userApi.catalog.listInclusionSiteCatalog(),
    userApi.gallery.listGalleryAlbums({ pageSize: CONSOLE_PAGE_SIZE }),
  ]);

  const brandPageItems = brandReply.items ?? [];
  const knowledgePageItems = documentReply.items ?? [];
  const keywordPageItems = keywordReply.items ?? [];
  const articlePageItems = articleReply.items ?? [];
  const publishPlans = publishReply.items ?? [];
  const monitorPlans = monitorReply.items ?? [];
  const platformAccounts = accountReply.items ?? [];
  const articleTypes = articleTypeReply.items ?? [];
  const writingModels = writingModelReply.items ?? [];
  const publishChannels = channelReply.items ?? [];
  const publishTargets = targetReply.items ?? [];
  const inclusionSites = siteReply.items ?? [];
  const [
    brands,
    knowledgeDocuments,
    keywords,
    questions,
    articles,
    galleryAlbums,
  ] = await Promise.all([
    collectPageItems(brandReply, (pageToken) =>
      userApi.brand.listBrands({ pageSize: 100, pageToken }),
    ),
    collectPageItems(documentReply, (pageToken) =>
      userApi.knowledge.listKnowledgeDocuments({ pageSize: 100, pageToken }),
    ),
    collectPageItems(keywordReply, (pageToken) =>
      userApi.keyword.listKeywords({ pageSize: 100, pageToken }),
    ),
    collectPageItems(questionReply, (pageToken) =>
      userApi.question.listQuestions({ pageSize: 100, pageToken }),
    ),
    collectPageItems(articleReply, (pageToken) =>
      userApi.article.listArticles({ pageSize: 100, pageToken }),
    ),
    collectPageItems(galleryAlbumReply, (pageToken) =>
      userApi.gallery.listGalleryAlbums({ pageSize: 100, pageToken }),
    ),
  ]);

  const brandNames = nameMap(brands);
  const articleTypeNames = nameMap(articleTypes);
  const articleNames = nameMap(articles, "title");
  const channelNames = nameMap(publishChannels);
  const siteNames = nameMap(inclusionSites);
  const keywordIDs = new Set(keywords.map((item) => id(item.id)));

  const choices: ResourceChoices = {
    articleTypes: articleTypes.map((item) => {
      const articleTypeId = id(item.id);
      return {
        articleType: item,
        hint: `配置修订 v${item.configRevision ?? 0} · ${item.config?.contentGoal || "按平台配置生成"}`,
        label: item.name || `文章类型 #${articleTypeId}`,
        resourceId: articleTypeId,
        value: articleTypeId,
      };
    }),
    // 保留旧选项名称，供尚未迁移的局部组件兼容；值也统一为稳定的文章类型 ID。
    articleTypeVersions: articleTypes.map((item) => ({
      articleType: item,
      hint: `配置修订 v${item.configRevision ?? 0}`,
      label: item.name || `文章类型 #${id(item.id)}`,
      resourceId: id(item.id),
      value: id(item.id),
    })),
    articles: articles
      .filter(
        (item) => item.status === "normal" && Number(item.latestSnapshotId) > 0,
      )
      .map((item) => choice(item.id, item.title)),
    brands: toChoices(brands),
    keywords: keywords.map((item) => ({
      brandId: id(item.brandId),
      label: `${item.text || id(item.id)}${item.region ? ` · ${item.region}` : ""}`,
      region: item.region,
      value: id(item.id),
    })),
    inclusionSites: toChoices(inclusionSites),
    knowledgeDocuments: knowledgeDocuments
      .filter((item) => item.parseStatus === KnowledgeParseStatus.parsed)
      .map((item) => ({
        hint: `${knowledgeCategoryLabel(item.category)} · ${contentPreview(item.content)}`,
        label: item.title || `企业知识 #${id(item.id)}`,
        value: id(item.id),
      })),
    galleryAlbums: galleryAlbums.map((item) => ({
      disabled: Number(item.imageCount || 0) === 0,
      hint: item.description || `${Number(item.imageCount || 0)} 张可用图片`,
      imageCount: Number(item.imageCount || 0),
      label: `${item.name || `图库 #${id(item.id)}`} · ${Number(item.imageCount || 0)} 张`,
      value: id(item.id),
    })),
    platformAccounts: toChoices(platformAccounts, "accountName"),
    geoExecutor: platformAccounts
      .filter(
        (item) =>
          item.resourceType === AuthorizationResourceType.inclusionSite &&
          item.authorizationStatus === AuthorizationStatus.active &&
          item.usageStatus === AuthorizationUsageStatus.enabled,
      )
      .map((item) =>
        choice(
          item.resourceId,
          `${siteNames[id(item.resourceId)] || "AI 平台"} · ${item.accountName || id(item.id)}`,
        ),
      ),
    publishAccounts: platformAccounts
      .filter(
        (item) =>
          item.resourceType === AuthorizationResourceType.publishChannel &&
          item.authorizationStatus === AuthorizationStatus.active &&
          item.usageStatus === AuthorizationUsageStatus.enabled,
      )
      .map((item) =>
        choice(
          item.id,
          `${channelNames[id(item.resourceId)] || "内容渠道"} · ${item.accountName || id(item.id)}`,
        ),
      ),
    publishChannels: toChoices(publishChannels),
    publishTargets: publishTargets.map((item) =>
      choice(
        item.id,
        `${channelNames[id(item.parentId)] || "渠道"} · ${item.name || id(item.id)}`,
      ),
    ),
    officialMediaPlatforms: publishChannels
      .filter((item) => Number(item.category) === 2)
      .map((item) => choice(item.id, `官方媒体 · ${item.name || id(item.id)}`)),
    kolPlatforms: publishChannels
      .filter((item) => Number(item.category) === 3)
      .map((item) => choice(item.id, `大 V · ${item.name || id(item.id)}`)),
    questions: questions
      .filter(
        (item) =>
          item.status === QuestionStatus.approved &&
          keywordIDs.has(id(item.keywordId)),
      )
      .map((item) => ({
        brandId: id(item.brandId),
        keywordId: id(item.keywordId),
        label: item.text || id(item.id),
        region: item.region,
        value: id(item.id),
      })),
    writingModels: toChoices(writingModels),
  };

  const records: Record<string, ConsoleRecord[]> = {
    brand: brandRecords(brandPageItems),
    knowledge: knowledgeRecords(knowledgePageItems),
    keywords: keywordRecords(keywordPageItems, brandNames),
    articles: articleRecords(articlePageItems, articleTypeNames, brandNames),
    publishing: publishPlanRecords(publishPlans, articleNames),
    geo: monitorPlanRecords(monitorPlans, brandNames),
    authorizations: platformAccounts.map((item) => ({
      id: id(item.id),
      raw: item,
      values: [
        item.accountName || item.maskedIdentity || "未命名账号",
        item.resourceType === AuthorizationResourceType.publishChannel
          ? channelNames[id(item.resourceId)] || "内容投放"
          : siteNames[id(item.resourceId)] || "GEO 检查",
        item.maskedIdentity || "客户端授权",
        formatDateTime(item.lastVerifiedAt),
        formatDateTime(item.expiresAt),
        authorizationStatusLabel(item.authorizationStatus, item.usageStatus),
      ],
    })),
  };

  return {
    articleTypes,
    articles,
    brands,
    choices,
    inclusionSites,
    galleryAlbums,
    knowledgeDocuments,
    keywords,
    monitorPlans,
    pages: {
      articles: resourcePage(articleReply, "", CONSOLE_PAGE_SIZE),
      brand: resourcePage(brandReply, "", CONSOLE_PAGE_SIZE),
      geo: resourcePage(monitorReply, "", CONSOLE_PAGE_SIZE),
      keywords: resourcePage(keywordReply, "", CONSOLE_PAGE_SIZE),
      knowledge: resourcePage(documentReply, "", CONSOLE_PAGE_SIZE),
      publishing: resourcePage(publishReply, "", CONSOLE_PAGE_SIZE),
      questions: resourcePage(questionReply, "", CONSOLE_PAGE_SIZE),
    },
    platformAccounts,
    publishChannels,
    publishPlans,
    publishTargets,
    questions,
    records,
    writingModels,
  };
}

export async function loadConsoleResourcePage(
  section: string,
  request: ResourcePageRequest,
  snapshot: ResourceSnapshot,
): Promise<ResourcePageResult> {
  const pageSize = request.pageSize || CONSOLE_PAGE_SIZE;
  const pageToken = request.pageToken || "";
  switch (section) {
    case "brand": {
      const reply = await userApi.brand.listBrands({
        keyword: request.keyword || undefined,
        pageSize,
        pageToken,
        status:
          typeof request.status === "number" && request.status > 0
            ? request.status
            : undefined,
      });
      return {
        page: resourcePage(reply, pageToken, pageSize),
        records: brandRecords(reply.items ?? []),
      };
    }
    case "knowledge": {
      const reply = await userApi.knowledge.listKnowledgeDocuments({
        keyword: request.keyword || undefined,
        pageSize,
        pageToken,
      });
      return {
        page: resourcePage(reply, pageToken, pageSize),
        records: knowledgeRecords(reply.items ?? []),
      };
    }
    case "keywords": {
      const reply = await userApi.keyword.listKeywords({
        keyword: request.keyword || undefined,
        pageSize,
        pageToken,
        status:
          typeof request.status === "string" && request.status
            ? request.status
            : undefined,
      });
      return {
        page: resourcePage(reply, pageToken, pageSize),
        records: keywordRecords(reply.items ?? [], nameMap(snapshot.brands)),
      };
    }
    case "articles": {
      const reply = await userApi.article.listArticles({
        keyword: request.keyword || undefined,
        pageSize,
        pageToken,
        status:
          typeof request.status === "string" && request.status
            ? request.status
            : undefined,
      });
      return {
        page: resourcePage(reply, pageToken, pageSize),
        records: articleRecords(
          reply.items ?? [],
          nameMap(snapshot.articleTypes),
          nameMap(snapshot.brands),
        ),
      };
    }
    case "publishing": {
      const reply = await userApi.publishTask.listPublishPlans({
        pageSize,
        pageToken,
        status:
          typeof request.status === "number" && request.status > 0
            ? request.status
            : undefined,
      });
      return {
        page: resourcePage(reply, pageToken, pageSize),
        records: publishPlanRecords(
          reply.items ?? [],
          nameMap(snapshot.articles, "title"),
        ),
      };
    }
    case "geo": {
      const reply = await userApi.geoMonitor.listMonitorPlans({
        pageSize,
        pageToken,
        status:
          typeof request.status === "number" && request.status > 0
            ? request.status
            : undefined,
      });
      return {
        page: resourcePage(reply, pageToken, pageSize),
        records: monitorPlanRecords(
          reply.items ?? [],
          nameMap(snapshot.brands),
        ),
      };
    }
    default:
      throw new Error("当前栏目暂不支持服务端分页");
  }
}

export async function createConsoleResource(
  section: string,
  values: ConsoleFormValue[],
  snapshot: ResourceSnapshot,
) {
  switch (section) {
    case "brand":
      await userApi.brand.createBrand({
        brand: {
          description: text(values[4]),
          industry: text(values[1]),
          name: text(values[0]),
          officialDomain: text(values[2]),
          region: text(values[3]),
          status: code(values[5], BrandStatus.active),
        },
      });
      return;
    case "knowledge":
      await userApi.knowledge.createKnowledgeDocument({
        content: text(values[2]),
        document: {
          category: code(values[1], KnowledgeCategory.enterpriseProfile),
          sourceType: KnowledgeSourceType.text,
          title: text(values[0]),
        },
      });
      return;
    case "keywords": {
      await userApi.keyword.createKeyword({
        keyword: {
          brandId: text(values[1]),
          priority: code(values[3]),
          region: text(values[2]),
          source: "manual",
          status: "active",
          tagsJson: "[]",
          text: text(values[0]),
        },
      });
      return "关键词已保存，请选择该关键词并点击“蒸馏问题”";
    }
    case "articles":
      await userApi.article.createArticle({
        article: {
          articleTypeId: text(values[1]),
          brandId: text(values[2]),
          contentMarkdown: text(values[4]),
          source: "manual",
          summary: text(values[3]),
          title: text(values[0]),
        },
      });
      return;
    case "publishing": {
      // values[1] = 选中的文章 ID 数组（multiSelect）
      // values[3] = 选中的执行账号/平台 ID 数组（multiSelect）
      // values[5] = 去重策略（per_platform / all_unique / no_dedup）
      const articleIds = (
        Array.isArray(values[1]) ? values[1] : [String(values[1])]
      )
        .map((item) => String(item))
        .filter(Boolean);
      const targetCategory = Number(values[2]);
      const executorIds = (
        Array.isArray(values[3]) ? values[3] : [String(values[3])]
      )
        .map((item) => String(item))
        .filter(Boolean);
      const dedupStrategy = String(values[5] || "per_platform") as
        | "per_platform"
        | "all_unique"
        | "no_dedup";

      if (articleIds.length === 0) throw new Error("请至少选择一篇文章");
      if (executorIds.length === 0)
        throw new Error("请至少选择一个执行账号/平台");
      if (![1, 2, 3].includes(targetCategory)) {
        throw new Error("请选择有效投稿目标");
      }

      // 解析所有执行账号/平台为 targets
      type ResolvedTarget = {
        publishChannelId: string;
        platformAccountId?: string;
      };
      const resolvedTargets: ResolvedTarget[] = executorIds.map(
        (executorId) => {
          if (targetCategory === 1) {
            const account = snapshot.platformAccounts.find(
              (item) => id(item.id) === executorId,
            );
            if (!account) throw new Error(`执行账号不存在：${executorId}`);
            if (
              Number(account.resourceType) !==
              AuthorizationResourceType.publishChannel
            ) {
              throw new Error("执行账号必须是自媒体授权账号");
            }
            return {
              publishChannelId: id(account.resourceId),
              platformAccountId: id(account.id),
            };
          }
          const channel = snapshot.publishChannels.find(
            (item) => id(item.id) === executorId,
          );
          if (!channel) throw new Error(`投放平台不存在：${executorId}`);
          if (Number(channel.category) !== targetCategory) {
            throw new Error("投放平台与投稿目标类型不一致");
          }
          return { publishChannelId: id(channel.id) };
        },
      );

      // 校验所有选中文章，并组装 article_ids + article_snapshot_ids
      const resolvedArticles = articleIds.map((articleId) => {
        const article = snapshot.articles.find(
          (item) => id(item.id) === articleId,
        );
        if (!article) throw new Error(`文章不存在：${articleId}`);
        if (article.status !== "normal")
          throw new Error(
            `文章「${article.title}」状态非正常，无法创建投放任务`,
          );
        if (!article.latestSnapshotId)
          throw new Error(`文章「${article.title}」尚无可投放快照`);
        return article;
      });

      const scheduled = Boolean(text(values[4]));
      const scheduleType = scheduled
        ? PublishScheduleType.scheduled
        : PublishScheduleType.immediate;
      const scheduledAt = scheduled
        ? new Date(text(values[4])).toISOString()
        : undefined;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      // 单个 PublishPlan 容纳多文章×多平台，由后端按 dedup_strategy 生成 tasks
      // 注：resolvedArticles 已校验 id/latestSnapshotId 必存在，用 String() 规避可选类型
      await userApi.publishTask.createPublishPlan({
        articleIds: resolvedArticles.map((a) => String(a.id)),
        articleSnapshotIds: resolvedArticles.map((a) =>
          String(a.latestSnapshotId),
        ),
        clientRequestId: createClientID(),
        dedupStrategy,
        failurePolicyJson: "{}",
        name: text(values[0]),
        scheduleType,
        scheduledAt,
        targets: resolvedTargets.map((target) => ({
          executionMode: "automatic",
          platformAccountId: target.platformAccountId,
          priority: 0,
          publishChannelId: target.publishChannelId,
        })),
        timezone,
      });

      // 根据返回的计划 ID 提示创建任务数（粗略：文章×平台，实际由后端去重策略决定）
      const expectedTasks =
        dedupStrategy === "all_unique"
          ? resolvedArticles.length
          : resolvedArticles.length * resolvedTargets.length;
      return `投放计划已创建，预计 ${expectedTasks} 条任务`;
    }
    case "geo": {
      const questionIds = (
        Array.isArray(values[3]) ? values[3] : [String(values[3])]
      )
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0);
      const siteIds = (
        Array.isArray(values[4]) ? values[4] : [String(values[4])]
      )
        .map((item) => String(item))
        .filter(Boolean);

      if (questionIds.length === 0) throw new Error("请至少选择一个问题");
      if (siteIds.length === 0) throw new Error("请至少选择一个检查站点");

      const siteTargets = siteIds.map((siteId) => {
        const site = snapshot.inclusionSites.find(
          (item) => id(item.id) === siteId,
        );
        const account = snapshot.platformAccounts.find(
          (item) =>
            item.resourceType === AuthorizationResourceType.inclusionSite &&
            id(item.resourceId) === siteId &&
            item.authorizationStatus === AuthorizationStatus.active,
        );
        return {
          inclusion_site_id: Number(siteId),
          platform_account_id: account ? Number(account.id) : 0,
          model_entry: firstModelEntry(site),
          locale: "zh-CN",
          region: "CN",
          priority: 0,
        };
      });

      const monitorTerminal = code(values[5], MonitorTerminalType.parallel);
      const scheduleType = code(values[6], MonitorScheduleType.once);
      const cronExpression = buildMonitorCron(scheduleType, text(values[7]));
      const scheduledAt = text(values[7]);
      const nextRunAt = scheduledAt
        ? new Date(scheduledAt).toISOString()
        : undefined;

      await userApi.geoMonitor.createMonitorPlan({
        plan: {
          brandId: text(values[1]),
          clientRequestId: createClientID(),
          cronExpression,
          monitorTerminal,
          name: text(values[0]),
          nextRunAt,
          questionIdsJson: JSON.stringify(questionIds),
          scheduleType,
          siteTargetsJson: JSON.stringify(siteTargets),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });

      const terminalMultiplier = monitorTerminal === MonitorTerminalType.parallel ? 2 : 1;
      const totalQueries = questionIds.length * siteTargets.length * terminalMultiplier;
      const terminalLabel = monitorTerminal === MonitorTerminalType.parallel ? '（PC + 移动端并行）' : monitorTerminal === MonitorTerminalType.mobile ? '（移动端）' : '（电脑端）';
      return `监测计划已创建，本轮 ${totalQueries} 次查询${terminalLabel}（${questionIds.length} 个问题 × ${siteTargets.length} 个站点 × ${terminalMultiplier} 个终端）`;
    }
    default:
      throw new Error("当前栏目暂不支持创建");
  }
}

export async function updateConsoleResource(
  section: string,
  record: ConsoleRecord,
  values: ConsoleFormValue[],
) {
  switch (section) {
    case "brand":
      await userApi.brand.updateBrand(record.id, {
        brand: {
          ...(record.raw as Brand),
          description: text(values[4]),
          industry: text(values[1]),
          name: text(values[0]),
          officialDomain: text(values[2]),
          region: text(values[3]),
          status: code(values[5], BrandStatus.active),
        },
      });
      return;
    case "knowledge":
      await userApi.knowledge.updateKnowledgeDocument(record.id, {
        content: text(values[2]),
        document: {
          ...(record.raw as KnowledgeDocument),
          category: code(values[1], KnowledgeCategory.enterpriseProfile),
          sourceType: KnowledgeSourceType.text,
          title: text(values[0]),
        },
      });
      return;
    case "keywords": {
      const current = record.raw as Keyword;
      await userApi.keyword.updateKeyword(record.id, {
        keyword: {
          ...current,
          brandId: text(values[1]),
          priority: code(values[3]),
          region: text(values[2]),
          text: text(values[0]),
        },
      });
      return;
    }
    case "articles":
      await userApi.article.updateArticle(record.id, {
        article: {
          ...(record.raw as Article),
          articleTypeId: text(values[1]),
          brandId: text(values[2]),
          contentMarkdown: text(values[4]),
          summary: text(values[3]),
          title: text(values[0]),
        },
        changeSummary: "用户控制台编辑",
      });
      return;
    case "publishing":
      await changePublishPlanStatus(record, code(values[5]));
      return;
    case "geo": {
      const plan = record.raw as MonitorPlan;
      const newName = text(values[0]);
      const newStatus = code(values[8]);
      const nameChanged = Boolean(newName) && newName !== plan.name;
      const statusChanged = plan.status !== newStatus;
      // 改名走 updateMonitorPlan（PATCH，body: {name, version}，乐观锁）；
      // 改状态走 changeMonitorPlanStatus。若同时改名又改状态，需用 update
      // 返回的新 version 继续调状态变更，避免乐观锁冲突。
      if (!nameChanged && !statusChanged) return;
      let version = id(plan.version);
      if (nameChanged) {
        const updated = await userApi.geoMonitor.updateMonitorPlan(record.id, {
          name: newName,
          version,
        });
        version = id(updated.version);
      }
      if (statusChanged) {
        let action = "resume";
        if (newStatus === MonitorPlanStatus.paused) action = "pause";
        if (newStatus === MonitorPlanStatus.stopped) action = "stop";
        await userApi.geoMonitor.changeMonitorPlanStatus(record.id, {
          id: record.id,
          action,
          version,
        });
      }
      return;
    }
    default:
      throw new Error("当前栏目暂不支持编辑");
  }
}

export async function deleteConsoleResource(
  section: string,
  record: ConsoleRecord,
) {
  const entity = record.raw as Entity & { documentVersion?: number };
  switch (section) {
    case "brand":
      await userApi.brand.deleteBrand(record.id, {
        version: id(entity.version),
      });
      return;
    case "knowledge":
      await userApi.knowledge.deleteKnowledgeDocument(record.id, {
        documentVersion: entity.documentVersion,
      });
      return;
    case "keywords":
      await userApi.keyword.deleteKeyword(record.id, {
        version: id(entity.version),
      });
      return;
    case "articles":
      await userApi.article.deleteArticle(record.id, {
        version: id(entity.version),
      });
      return;
    case "publishing":
      throw new Error("发布计划不可删除，请编辑状态将其停止");
    case "geo":
      await userApi.geoMonitor.deleteMonitorPlan(record.id);
      return;
    default:
      throw new Error("当前栏目暂不支持删除");
  }
}

async function changePublishPlanStatus(
  record: ConsoleRecord,
  nextStatus: number,
) {
  const raw = record.raw as Entity & { status?: number };
  if (raw.status === nextStatus) return;
  let action = "resume";
  if (nextStatus === PublishPlanStatus.paused) action = "pause";
  if (
    nextStatus === PublishPlanStatus.stopped ||
    nextStatus === PublishPlanStatus.cancelled
  ) {
    action = "stop";
  }
  await userApi.publishTask.changePublishPlanStatus(record.id, {
    id: record.id,
    action,
    version: id(raw.version),
  });
}

function brandRecords(brands: Brand[]): ConsoleRecord[] {
  return brands.map((item) => ({
    id: id(item.id),
    formValues: [
      item.name || "",
      item.industry || "",
      item.officialDomain || "",
      item.region || "",
      item.description || "",
      item.status || BrandStatus.active,
    ],
    raw: item,
    values: [
      item.name || "未命名品牌",
      item.industry || "-",
      item.officialDomain || "-",
      item.region || "-",
      formatDateTime(item.updatedAt),
      brandStatusLabel(item.status),
    ],
  }));
}

function knowledgeRecords(documents: KnowledgeDocument[]): ConsoleRecord[] {
  return documents.map((item) => ({
    id: id(item.id),
    formValues: [
      item.title || "",
      item.category || KnowledgeCategory.enterpriseProfile,
      item.content || "",
    ],
    raw: item,
    values: [
      item.title || "未命名知识",
      knowledgeCategoryLabel(item.category),
      contentPreview(item.content),
      formatDateTime(item.updatedAt),
    ],
  }));
}

function keywordRecords(
  keywords: Keyword[],
  brandNames: Record<string, string>,
): ConsoleRecord[] {
  return keywords.map((item) => ({
    id: id(item.id),
    formValues: [
      item.text || "",
      id(item.brandId),
      item.region || "",
      item.priority ?? 0,
    ],
    raw: item,
    values: [
      item.text || "未命名关键词",
      brandNames[id(item.brandId)] || id(item.brandId),
      item.region || "不限区域",
      `${item.distilledQuestionCount ?? 0} / ${item.requestedQuestionCount ?? 0}`,
      formatDateTime(item.updatedAt),
      optionLabel(keywordDistillationStatusOptions, item.distillationStatus),
    ],
  }));
}

function articleRecords(
  articles: Article[],
  articleTypeNames: Record<string, string>,
  brandNames: Record<string, string>,
): ConsoleRecord[] {
  return articles.map((item) => ({
    id: id(item.id),
    formValues: [
      item.title || "",
      id(item.articleTypeId),
      id(item.brandId),
      item.summary || "",
      item.contentMarkdown || "",
      item.status || "draft",
    ],
    raw: item,
    values: [
      item.title || "未命名文章",
      articleTypeNames[id(item.articleTypeId)] || id(item.articleTypeId),
      brandNames[id(item.brandId)] || id(item.brandId),
      formatDateTime(item.updatedAt),
      `${Math.round(item.qualityScore ?? 0)} 分`,
      statusLabel(item.status),
    ],
  }));
}

function monitorPlanRecords(
  plans: MonitorPlan[],
  brandNames: Record<string, string>,
): ConsoleRecord[] {
  return plans.map((item) => ({
    id: id(item.id),
    formValues: [
      item.name || "",
      id(item.brandId),
      [],
      [],
      item.scheduleType || MonitorScheduleType.once,
      "",
      item.cronExpression || "",
      item.status || MonitorPlanStatus.active,
    ],
    raw: item,
    values: [
      item.name || "未命名监测",
      brandNames[id(item.brandId)] || id(item.brandId),
      optionLabel(monitorScheduleOptions, item.scheduleType),
      formatDateTime(item.nextRunAt),
      formatDateTime(item.lastRunAt),
      optionLabel(monitorPlanStatusOptions, item.status),
    ],
  }));
}

function publishPlanRecords(
  plans: PublishPlan[],
  articleNames: Record<string, string>,
): ConsoleRecord[] {
  return plans.map((item) => {
    const articleCount = Number(item.articleCount || 0);
    const platformCount = Number(item.platformCount || 0);
    const taskCount = Number(item.taskCount || 0);
    const succeededCount = Number(item.succeededCount || 0);
    const failedCount = Number(item.failedCount || 0);
    // 多文章计划显示"主文章标题 等 N 篇"，单文章显示标题
    const primaryTitle =
      item.articleTitle ||
      articleNames[id(item.articleId)] ||
      (articleCount > 0 ? `${articleCount} 篇文章` : "-");
    const articleLabel =
      articleCount > 1 ? `${primaryTitle} 等 ${articleCount} 篇` : primaryTitle;
    // 任务进度：succeeded/taskCount（无任务时显示"-"）
    const progressLabel =
      taskCount > 0
        ? `${succeededCount}/${taskCount} 成功` +
          (failedCount > 0 ? ` · ${failedCount} 失败` : "")
        : "-";
    return {
      id: id(item.id),
      formValues: [
        item.name || "",
        id(item.articleId),
        "",
        "",
        toDateTimeLocal(item.scheduledAt),
        item.status || PublishPlanStatus.pending,
      ],
      raw: item,
      values: [
        item.name || "未命名计划",
        articleLabel,
        platformCount > 0 ? `${platformCount} 个平台` : "-",
        progressLabel,
        formatDateTime(item.createdAt),
        optionLabel(publishPlanStatusOptions, item.status),
      ],
    };
  });
}

function resourcePage(
  reply: { nextPageToken?: string; totalSize?: number | string },
  pageToken: string,
  pageSize: number,
): ResourcePage {
  return {
    nextPageToken: reply.nextPageToken || "",
    pageSize,
    pageToken,
    totalSize: Number(reply.totalSize || 0),
  };
}

async function collectPageItems<T>(
  firstReply: PaginatedReply<T>,
  loadPage: (pageToken: string) => Promise<PaginatedReply<T>>,
): Promise<T[]> {
  const items = [...(firstReply.items ?? [])];
  const visitedTokens = new Set<string>();
  let pageToken = firstReply.nextPageToken || "";
  while (pageToken && !visitedTokens.has(pageToken)) {
    visitedTokens.add(pageToken);
    const reply = await loadPage(pageToken);
    items.push(...(reply.items ?? []));
    pageToken = reply.nextPageToken || "";
  }
  return items;
}

function id(value?: ID) {
  return value === undefined || value === null ? "" : String(value);
}

function text(value?: ConsoleFormValue) {
  return value === undefined || value === null ? "" : String(value);
}

function code(value?: ConsoleFormValue, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function choice(value?: ID | string, label?: string) {
  return { label: label || id(value), value: id(value) };
}

function toChoices<T extends { id?: ID }>(items: T[], labelKey = "name") {
  return items.map((item) =>
    choice(
      item.id,
      String((item as Record<string, unknown>)[labelKey] || id(item.id)),
    ),
  );
}

function nameMap<T extends { id?: ID }>(items: T[], labelKey = "name") {
  return Object.fromEntries(
    toChoices(items, labelKey).map((item) => [item.value, item.label]),
  );
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function contentPreview(value?: string) {
  const normalized = value?.replaceAll(/\s+/g, " ").trim() ?? "";
  if (!normalized) return "-";
  return normalized.length > 52 ? `${normalized.slice(0, 52)}…` : normalized;
}

function toDateTimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function statusLabel(value?: string) {
  const labels: Record<string, string> = {
    active: "正常",
    approved: "已通过",
    archived: "已归档",
    cancelled: "已取消",
    completed: "已完成",
    disabled: "禁用",
    draft: "草稿",
    enabled: "正常",
    failed: "失败",
    generated: "已生成",
    generating: "生成中",
    normal: "正常",
    parsed: "可用",
    parsing: "解析中",
    paused: "已暂停",
    pending: "待处理",
    pending_review: "待审核",
    published: "已投放",
    publishing: "投放中",
    queued: "排队中",
    rejected: "已驳回",
    revoked: "已撤销",
    stopped: "已停止",
  };
  return (value && labels[value]) || value || "-";
}

function firstModelEntry(site?: CatalogItem) {
  const raw = site?.displayConfigJson;
  if (!raw) return "default";
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0];
      if (typeof first === "string") return first;
      if (first && typeof first === "object" && "code" in first) {
        return String((first as { code: unknown }).code);
      }
    }
  } catch {
    // Catalog data may be empty on sites that do not require a model entry.
  }
  return "default";
}

function buildMonitorCron(scheduleType: number, customCron: string): string {
  switch (scheduleType) {
    case MonitorScheduleType.hourly:
      return "0 * * * *";
    case MonitorScheduleType.daily:
      return "0 9 * * *";
    case MonitorScheduleType.weekly:
      return "0 9 * * 1";
    case MonitorScheduleType.monthly:
      return "0 9 1 * *";
    case MonitorScheduleType.cron:
      return customCron || "0 9 * * *";
    default:
      return "";
  }
}
