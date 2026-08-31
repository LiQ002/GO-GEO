"use client";

import { useCallback, useEffect, useState } from "react";
import { userApi, type UserV1RealnameAuthentication } from "@/lib/api/user-api.generated";

export type RealnameStatus = "pending" | "approved" | "rejected";

export type RealnameAuth = UserV1RealnameAuthentication;

function isValidAuth(data: any): data is RealnameAuth {
  if (!data) return false;
  if (typeof data !== 'object') return false;
  // id 为 "0" 或不存在都视为无效
  if (!('id' in data) || !data.id || data.id === '0') return false;
  return true;
}

export function useRealnameStatus() {
  const [auth, setAuth] = useState<RealnameAuth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userApi.realname.getMyRealnameAuthentication();
      if (isValidAuth(data)) {
        setAuth(data);
      } else {
        setAuth(null);
      }
    } catch (err) {
      setAuth(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const isVerified = auth?.status === "approved";
  const isPending = auth?.status === "pending";
  const isRejected = auth?.status === "rejected";
  const hasSubmitted = auth !== null;

  return {
    auth,
    loading,
    error,
    isVerified,
    isPending,
    isRejected,
    hasSubmitted,
    refresh: fetchStatus,
  };
}
