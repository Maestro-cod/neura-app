import "react-native-url-polyfill/auto.js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

// During Node SSR/static rendering the global WebSocket is missing; provide
// a no-op stub so supabase-js's RealtimeClient constructor doesn't blow up
// the bundle. We don't actually use realtime channels.
if (typeof (globalThis as any).WebSocket === "undefined") {
  (globalThis as any).WebSocket = class {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
    set onopen(_v: any) {}
    set onmessage(_v: any) {}
    set onerror(_v: any) {}
    set onclose(_v: any) {}
  };
}

// In Node SSR there is no `window`, but AsyncStorage tries to access it.
// Provide a tiny in-memory store so auth init won't crash during static render.
const memoryStore: Record<string, string> = {};
const safeStorage =
  typeof window === "undefined"
    ? {
        getItem: async (k: string) => memoryStore[k] ?? null,
        setItem: async (k: string, v: string) => {
          memoryStore[k] = v;
        },
        removeItem: async (k: string) => {
          delete memoryStore[k];
        },
      }
    : AsyncStorage;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: safeStorage as any,
    autoRefreshToken: typeof window !== "undefined",
    persistSession: true,
    detectSessionInUrl: false,
  },
});
