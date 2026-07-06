"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export interface LoginState {
  error?: string;
}

// Server action driving the credentials login (C1). On success signIn throws a NEXT_REDIRECT
// to redirectTo — that MUST be re-thrown (it is control flow, not an error). On bad creds
// next-auth throws AuthError → ONE generic Thai message for both bad-username and bad-password
// (E5, no user enumeration).
export async function authenticate(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
    }
    throw error; // re-throw NEXT_REDIRECT and any real error
  }
}
