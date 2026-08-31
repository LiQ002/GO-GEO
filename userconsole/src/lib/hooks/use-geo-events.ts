"use client";

import { useEffect, useRef } from "react";

export type GeoEventType = "geo_task_completed" | "publish_task_completed";

export interface GeoEvent {
  type: GeoEventType;
  enterprise_id: number;
  task_id: number;
  status: string;
  brand_mentioned?: boolean;
}

interface UseGeoEventsOptions {
  onEvent?: (event: GeoEvent) => void;
}

/**
 * 订阅后端 SSE 事件流，在收到 GEO/发文任务完成事件时回调。
 * 自动重连（5秒）。仅在浏览器端运行。
 */
export function useGeoEvents(options: UseGeoEventsOptions = {}) {
  const callbackRef = useRef(options.onEvent);
  callbackRef.current = options.onEvent;

  useEffect(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) return;

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      es = new EventSource("/api/events/stream", { withCredentials: true });

      es.addEventListener("geo_task_completed", (e) => {
        try {
          const payload = JSON.parse(e.data) as GeoEvent;
          callbackRef.current?.(payload);
        } catch {
          // 忽略解析错误
        }
      });

      es.addEventListener("publish_task_completed", (e) => {
        try {
          const payload = JSON.parse(e.data) as GeoEvent;
          callbackRef.current?.(payload);
        } catch {
          // 忽略解析错误
        }
      });

      es.onerror = () => {
        // 连接断开，5秒后重连
        es?.close();
        es = null;
        reconnectTimer = setTimeout(connect, 5_000);
      };
    };

    connect();

    return () => {
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);
}
