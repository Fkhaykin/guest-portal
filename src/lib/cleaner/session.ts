import { cookies } from "next/headers";
import {
  CLEANER_COOKIE_NAME,
  cleanerCookieOptions,
} from "@/lib/cleaner/cookie";

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(CLEANER_COOKIE_NAME)?.value;
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(CLEANER_COOKIE_NAME, token, cleanerCookieOptions());
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(CLEANER_COOKIE_NAME);
}
