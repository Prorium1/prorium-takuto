import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { productionConfiguration } from "./environment";
export async function createSupabaseClient() {
  const config = productionConfiguration();
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: { httpOnly: true, secure: true, sameSite: "lax", path: "/" },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        try {
          for (const { name, value, options } of values)
            store.set(name, value, options);
        } catch {
          /* Proxy refreshes cookies when a Server Component cannot write. */
        }
      },
    },
  });
}
