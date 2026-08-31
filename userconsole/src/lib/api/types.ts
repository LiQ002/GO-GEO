import type {
  UserV1EnterpriseProfile,
  UserV1LoginReply,
  UserV1Notification,
  UserV1Quota,
  UserV1Session,
} from "./user-api.generated";

export type ApiErrorPayload = {
  code?: number;
  message?: string;
  metadata?: Record<string, string>;
  reason?: string;
};

export type EnterpriseProfile = UserV1EnterpriseProfile;
export type LoginReply = UserV1LoginReply & {
  accessToken: string;
  refreshToken: string;
};
export type LoginSession = UserV1Session;
export type Notification = UserV1Notification;
export type Quota = UserV1Quota;
