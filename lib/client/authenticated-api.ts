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
  body?: unknown | FormData;
};

export async function authenticatedApiRequest<T>(
  url: string,
  options: AuthenticatedApiOptions = {},
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
      error: sessionError?.message || "You must be signed in.",
      unauthenticated: true,
    };
  }

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const headers: HeadersInit = {
    Authorization: `Bearer ${session.access_token}`,
  };

  let requestBody: BodyInit | undefined;

  if (options.body !== undefined) {
    if (isFormData) {
      requestBody = options.body as FormData;
    } else {
      headers["Content-Type"] = "application/json";
      requestBody = JSON.stringify(options.body);
    }
  }

  const response = await fetch(url, {
    method: options.method ?? "POST",
    headers,
    body: requestBody,
  });

  const responseText = await response.text();

  let data: T | null = null;
  let responseError = "";

  if (responseText) {
    try {
      data = JSON.parse(responseText) as T;

      if (
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof data.error === "string"
      ) {
        responseError = data.error;
      }
    } catch {
      responseError = "The server returned an invalid response.";
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    error:
      responseError ||
      (response.ok ? "" : `The request failed with status ${response.status}.`),
    unauthenticated: response.status === 401,
  };
}
