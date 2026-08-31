"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiError } from "@/lib/api/client";
import {
  createConsoleResource,
  deleteConsoleResource,
  loadConsoleResourcePage,
  loadConsoleResources,
  type ResourceChoices,
  type ResourcePage,
  type ResourcePageRequest,
  type ResourceSnapshot,
  type SelectChoice,
  updateConsoleResource,
} from "@/lib/api/console-resources";
import type {
  EnterpriseProfile,
  LoginSession,
  Notification,
} from "@/lib/api/types";
import { userApi } from "@/lib/api/user-api.generated";
import type { ConsoleFormValue } from "@/lib/console-forms";

export type ConsoleRecord = {
  formValues?: ConsoleFormValue[];
  id: string;
  raw?: unknown;
  values: string[];
};

type ConsoleRecords = Record<string, ConsoleRecord[]>;

const EMPTY_CHOICES: SelectChoice[] = [];

type ConsoleDataContextValue = {
  addRecord: (
    section: string,
    values: ConsoleFormValue[],
  ) => Promise<string | undefined>;
  deleteRecord: (section: string, record: ConsoleRecord) => Promise<void>;
  getChoices: (source?: string) => SelectChoice[];
  getResourcePage: (section: string) => ResourcePage | undefined;
  getRecords: (section: string) => ConsoleRecord[];
  loadRecordPage: (
    section: string,
    request: ResourcePageRequest,
  ) => Promise<void>;
  resourceError: string | null;
  resourceLoading: boolean;
  resourcePageLoading: boolean;
  resourceSnapshot: ResourceSnapshot | null;
  refreshResources: () => Promise<void>;
  updateRecord: (
    section: string,
    record: ConsoleRecord,
    values: ConsoleFormValue[],
  ) => Promise<void>;
  accountError: string | null;
  accountLoading: boolean;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  notifications: Notification[];
  profile: EnterpriseProfile | null;
  revokeSession: (id: string) => Promise<void>;
  sessions: LoginSession[];
  updateProfile: (updates: Partial<EnterpriseProfile>) => Promise<void>;
};

const ConsoleDataContext = createContext<ConsoleDataContextValue | null>(null);

export function ConsoleDataProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<ConsoleRecords>({});
  const [resourceSnapshot, setResourceSnapshot] =
    useState<ResourceSnapshot | null>(null);
  const [choices, setChoices] = useState<ResourceChoices>({});
  const [resourcePages, setResourcePages] = useState<
    Record<string, ResourcePage>
  >({});
  const [resourceLoading, setResourceLoading] = useState(true);
  const [resourcePageLoading, setResourcePageLoading] = useState(false);
  const [resourceError, setResourceError] = useState<string | null>(null);
  const [profile, setProfile] = useState<EnterpriseProfile | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [sessions, setSessions] = useState<LoginSession[]>([]);
  const [accountLoading, setAccountLoading] = useState(true);
  const [accountError, setAccountError] = useState<string | null>(null);

  const loadAccountData = useCallback(async () => {
    setAccountLoading(true);
    setAccountError(null);
    try {
      const [nextProfile, notificationReply, sessionReply] = await Promise.all([
        userApi.auth.getCurrentEnterprise(),
        userApi.notification.listNotifications({ pageSize: 10 }),
        userApi.auth.listSessions(),
      ]);
      setProfile(nextProfile);
      setNotifications(notificationReply.items ?? []);
      setSessions(sessionReply.items ?? []);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        window.location.assign("/login");
        return;
      }
      setAccountError(
        caught instanceof Error ? caught.message : "企业数据加载失败",
      );
    } finally {
      setAccountLoading(false);
    }
  }, []);

  const accountLoadedRef = useRef(false);
  useEffect(() => {
    if (accountLoadedRef.current) return;
    accountLoadedRef.current = true;
    void loadAccountData();
  }, [loadAccountData]);

  const loadResources = useCallback(async () => {
    setResourceLoading(true);
    setResourceError(null);
    try {
      const snapshot = await loadConsoleResources();
      setResourceSnapshot(snapshot);
      setChoices(snapshot.choices);
      setResourcePages(snapshot.pages);
      setRecords(snapshot.records);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 401) {
        window.location.assign("/login");
        return;
      }
      setResourceError(
        caught instanceof Error ? caught.message : "业务数据加载失败",
      );
    } finally {
      setResourceLoading(false);
    }
  }, []);

  const resourcesLoadedRef = useRef(false);
  useEffect(() => {
    if (resourcesLoadedRef.current) return;
    resourcesLoadedRef.current = true;
    void loadResources();
  }, [loadResources]);

  const getRecords = useCallback(
    (section: string) => records[section] ?? [],
    [records],
  );

  const getChoices = useCallback(
    (source?: string) =>
      source ? (choices[source] ?? EMPTY_CHOICES) : EMPTY_CHOICES,
    [choices],
  );

  const getResourcePage = useCallback(
    (section: string) => resourcePages[section],
    [resourcePages],
  );

  const loadRecordPage = useCallback(
    async (section: string, request: ResourcePageRequest) => {
      if (!resourceSnapshot) throw new Error("业务数据尚未加载");
      setResourcePageLoading(true);
      setResourceError(null);
      try {
        const result = await loadConsoleResourcePage(
          section,
          request,
          resourceSnapshot,
        );
        setRecords((current) => ({
          ...current,
          [section]: result.records,
        }));
        setResourcePages((current) => ({
          ...current,
          [section]: result.page,
        }));
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 401) {
          window.location.assign("/login");
          return;
        }
        const message =
          caught instanceof Error ? caught.message : "分页数据加载失败";
        setResourceError(message);
        throw caught;
      } finally {
        setResourcePageLoading(false);
      }
    },
    [resourceSnapshot],
  );

  const addRecord = useCallback(
    async (section: string, values: ConsoleFormValue[]) => {
      if (!resourceSnapshot) throw new Error("业务数据尚未加载");
      const message = await createConsoleResource(
        section,
        values,
        resourceSnapshot,
      );
      await loadResources();
      return message;
    },
    [loadResources, resourceSnapshot],
  );

  const updateRecord = useCallback(
    async (
      section: string,
      record: ConsoleRecord,
      values: ConsoleFormValue[],
    ) => {
      await updateConsoleResource(section, record, values);
      await loadResources();
    },
    [loadResources],
  );

  const deleteRecord = useCallback(
    async (section: string, record: ConsoleRecord) => {
      await deleteConsoleResource(section, record);
      await loadResources();
    },
    [loadResources],
  );

  const updateProfile = useCallback(
    async (updates: Partial<EnterpriseProfile>) => {
      if (!profile) throw new Error("企业资料尚未加载");
      const updated = await userApi.auth.updateEnterpriseProfile({
        enterprise: { ...profile, ...updates },
      });
      setProfile(updated);
    },
    [profile],
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await userApi.auth.changePassword({
        currentPassword,
        newPassword,
      });
    },
    [],
  );

  const revokeSession = useCallback(async (id: string) => {
    await userApi.auth.revokeSession(id);
    setSessions((current) =>
      current.filter((session) => String(session.id) !== id),
    );
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    const updated = await userApi.notification.markNotificationRead(id, {
      id,
    });
    setNotifications((current) =>
      current.map((item) => (String(item.id) === id ? updated : item)),
    );
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    await userApi.notification.markAllNotificationsRead();
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, readAt })));
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ allSessions: false }),
    });
    window.location.assign("/login");
  }, []);

  const value = useMemo(
    () => ({
      accountError,
      accountLoading,
      addRecord,
      changePassword,
      deleteRecord,
      getChoices,
      getResourcePage,
      getRecords,
      loadRecordPage,
      logout,
      markAllNotificationsRead,
      markNotificationRead,
      notifications,
      profile,
      resourceError,
      resourceLoading,
      resourcePageLoading,
      resourceSnapshot,
      refreshResources: loadResources,
      revokeSession,
      sessions,
      updateProfile,
      updateRecord,
    }),
    [
      accountError,
      accountLoading,
      addRecord,
      changePassword,
      deleteRecord,
      getChoices,
      getResourcePage,
      getRecords,
      loadRecordPage,
      logout,
      markAllNotificationsRead,
      markNotificationRead,
      notifications,
      profile,
      resourceError,
      resourceLoading,
      resourcePageLoading,
      resourceSnapshot,
      loadResources,
      revokeSession,
      sessions,
      updateProfile,
      updateRecord,
    ],
  );

  return (
    <ConsoleDataContext.Provider value={value}>
      {children}
    </ConsoleDataContext.Provider>
  );
}

export function useConsoleData() {
  const context = useContext(ConsoleDataContext);
  if (!context) {
    throw new Error("useConsoleData must be used inside ConsoleDataProvider");
  }
  return context;
}
