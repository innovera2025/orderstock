// Auth.js v5 route handler (A5 — REQUIRED). Exposes the GET/POST endpoints that the
// signIn/signOut client flow and session polling hit under /api/auth/*.
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
