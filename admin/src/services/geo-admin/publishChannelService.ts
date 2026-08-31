// @ts-ignore
/* eslint-disable */
import { request } from "@umijs/max";

/** 上传发布渠道图标 上传发布渠道图标。 POST /api/admin/v1/publish-channel-icons */
export async function publishChannelServiceUploadPublishChannelIcon(
  body: API.UploadPublishChannelIconRequest,
  options?: { [key: string]: any }
) {
  return request<API.UploadPublishChannelIconReply>(
    "/api/admin/v1/publish-channel-icons",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      data: body,
      ...(options || {}),
    }
  );
}

/** 查询发布渠道列表 查询发布渠道列表。 GET /api/admin/v1/publish-channels */
export async function publishChannelServiceListPublishChannels(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PublishChannelServiceListPublishChannelsParams,
  options?: { [key: string]: any }
) {
  return request<API.ListPublishChannelsReply>(
    "/api/admin/v1/publish-channels",
    {
      method: "GET",
      params: {
        ...params,
      },
      ...(options || {}),
    }
  );
}

/** 创建投放渠道 创建投放渠道。 POST /api/admin/v1/publish-channels */
export async function publishChannelServiceCreatePublishChannel(
  body: API.CreatePublishChannelRequest,
  options?: { [key: string]: any }
) {
  return request<API.PublishChannel>("/api/admin/v1/publish-channels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: body,
    ...(options || {}),
  });
}

/** 获取投放渠道 获取投放渠道。 GET /api/admin/v1/publish-channels/${param0} */
export async function publishChannelServiceGetPublishChannel(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PublishChannelServiceGetPublishChannelParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<API.PublishChannel>(
    `/api/admin/v1/publish-channels/${param0}`,
    {
      method: "GET",
      params: { ...queryParams },
      ...(options || {}),
    }
  );
}

/** 删除投放渠道 删除投放渠道。 DELETE /api/admin/v1/publish-channels/${param0} */
export async function publishChannelServiceDeletePublishChannel(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PublishChannelServiceDeletePublishChannelParams,
  options?: { [key: string]: any }
) {
  const { id: param0, ...queryParams } = params;
  return request<any>(`/api/admin/v1/publish-channels/${param0}`, {
    method: "DELETE",
    params: {
      ...queryParams,
    },
    ...(options || {}),
  });
}

/** 更新投放渠道 更新投放渠道。 PUT /api/admin/v1/publish-channels/${param0} */
export async function publishChannelServiceUpdatePublishChannel(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PublishChannelServiceUpdatePublishChannelParams,
  body: API.UpdatePublishChannelRequest,
  options?: { [key: string]: any }
) {
  const { "publish_channel.id": param0, ...queryParams } = params;
  return request<API.PublishChannel>(
    `/api/admin/v1/publish-channels/${param0}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 查询发布目标列表 查询发布目标列表。 GET /api/admin/v1/publish-channels/${param0}/targets */
export async function publishChannelServiceListPublishTargets(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PublishChannelServiceListPublishTargetsParams,
  options?: { [key: string]: any }
) {
  const { publishChannelId: param0, ...queryParams } = params;
  return request<API.ListPublishTargetsReply>(
    `/api/admin/v1/publish-channels/${param0}/targets`,
    {
      method: "GET",
      params: {
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}

/** 创建发布目标 创建发布目标。 POST /api/admin/v1/publish-channels/${param0}/targets */
export async function publishChannelServiceCreatePublishTarget(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PublishChannelServiceCreatePublishTargetParams,
  body: API.CreatePublishTargetRequest,
  options?: { [key: string]: any }
) {
  const { publishChannelId: param0, ...queryParams } = params;
  return request<API.PublishTarget>(
    `/api/admin/v1/publish-channels/${param0}/targets`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 更新发布目标 更新发布目标。 PUT /api/admin/v1/publish-channels/${param0}/targets/${param1} */
export async function publishChannelServiceUpdatePublishTarget(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PublishChannelServiceUpdatePublishTargetParams,
  body: API.UpdatePublishTargetRequest,
  options?: { [key: string]: any }
) {
  const {
    publishChannelId: param0,
    "target.id": param1,
    ...queryParams
  } = params;
  return request<API.PublishTarget>(
    `/api/admin/v1/publish-channels/${param0}/targets/${param1}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      params: { ...queryParams },
      data: body,
      ...(options || {}),
    }
  );
}

/** 删除发布目标 删除发布目标。 DELETE /api/admin/v1/publish-channels/${param0}/targets/${param1} */
export async function publishChannelServiceDeletePublishTarget(
  // 叠加生成的Param类型 (非body参数swagger默认没有生成对象)
  params: API.PublishChannelServiceDeletePublishTargetParams,
  options?: { [key: string]: any }
) {
  const { publishChannelId: param0, targetId: param1, ...queryParams } = params;
  return request<any>(
    `/api/admin/v1/publish-channels/${param0}/targets/${param1}`,
    {
      method: "DELETE",
      params: {
        ...queryParams,
      },
      ...(options || {}),
    }
  );
}
