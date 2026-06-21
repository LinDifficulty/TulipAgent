/**
 * 轻量级数据事件总线 — 用于跨组件实例同步数据变更。
 *
 * 使用方式：
 *   import { emitDataChange, useDataChangeListener } from "@/lib/data-events";
 *
 *   // 变更后发出事件
 *   await deleteEvent(id);
 *   emitDataChange("events");
 *
 *   // 其他实例监听并刷新
 *   useDataChangeListener("events", loadEvents);
 */

import { useEffect } from "react";

type Domain = "events" | "todos" | "packages" | "anniversaries" | "worklogs";

const listeners = new Map<Domain, Set<() => void>>();

/** 发出数据变更事件，通知同域所有监听者刷新 */
export function emitDataChange(domain: Domain) {
  const cbs = listeners.get(domain);
  if (cbs) {
    cbs.forEach((cb) => {
      try { cb(); } catch { /* swallow */ }
    });
  }
}

/** 订阅数据变更事件，返回取消订阅函数 */
export function onDataChange(domain: Domain, callback: () => void): () => void {
  if (!listeners.has(domain)) {
    listeners.set(domain, new Set());
  }
  listeners.get(domain)!.add(callback);
  return () => {
    listeners.get(domain)?.delete(callback);
  };
}

/** React hook: 订阅数据变更并在卸载时自动取消 */
export function useDataChangeListener(domain: Domain, callback: () => void) {
  useEffect(() => {
    return onDataChange(domain, callback);
  }, [domain, callback]);
}
