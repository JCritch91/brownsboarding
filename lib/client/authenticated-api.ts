import { supabase } from "@/lib/supabase";

export type AuthenticatedApiResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
  unauthenticated: boolean;
};

type AuthenticatedApiOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
};

export async function authenticatedApiRequest<T>(
  url: string,
  options: AuthenticatedApiOptions = {}
): Promise<AuthenticatedApiResult<T>> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return {
      ok: false,
      status: 401,
      data: null,
      error:
        sessionError?.message ||
        "Your session has expired. Please sign in again.",
      unauthenticated: true,
    };
  }

  try {
    const response = await fetch(url, {
      method: options.method || "POST",
      headers: {
        Authorization:
          `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body:
        options.body === undefined
          ? undefined
          : JSON.stringify(options.body),
    });

    const responseText = await response.text();

    let data: T | null = null;

    if (responseText) {
      try {
        data = JSON.parse(responseText) as T;
      } catch {
        return {
          ok: false,
          status: response.status,
          data: null,
          error:
            responseText ||
            "The server returned an invalid response.",
          unauthenticated: false,
        };
      }
    }

    const responseData = data as
      | {
          error?: string;
          message?: string;
        }
      | null;

    return {
      ok: response.ok,
      status: response.status,
      data,
      error:
        response.ok
          ? null
          : responseData?.error ||
            responseData?.message ||
            "The request could not be completed.",
      unauthenticated:
        response.status === 401,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Unable to contact the server.",
      unauthenticated: false,
    };
  }
}