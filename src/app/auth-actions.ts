"use server";

import { signOut } from "@/auth";

// Logout (C3). signOut clears the session cookie and redirects to /login.
export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
