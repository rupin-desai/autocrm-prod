import { QueryClient, QueryFunction } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = await res.text();
    let json: any;
    
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(text || res.statusText);
    }
    
    if (json.code === 'INACTIVITY_TIMEOUT') {
      queryClient.clear();
      window.location.href = '/';
      throw new Error('Session expired due to inactivity. Please login again.');
    }
    
    throw new Error(json.error || json.message || text || res.statusText);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

queryClient.setDefaultOptions({
  queries: {
    queryFn: getQueryFn({ on401: "throw" }),
  },
});
