import { cookies } from "next/headers";

export const CUSTOMER_ACCESS_COOKIE = "chaveflow_customer_access";

export async function getCustomerAccessToken(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(CUSTOMER_ACCESS_COOKIE)?.value;
  } catch {
    return undefined;
  }
}
