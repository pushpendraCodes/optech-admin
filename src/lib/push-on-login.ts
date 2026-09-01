import { registerWebPushToken } from "./firebase-push";

export async function pushTokenForLogin(): Promise<string | undefined> {
  try {
    return (await registerWebPushToken()) ?? undefined;
  } catch {
    return undefined;
  }
}
