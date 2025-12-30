import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { apiClient } from "@/lib/api-client";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data } = useQuery({
    queryKey: ["hello"],
    queryFn: () => apiClient.api.hello.$get().then((res) => res.json()),
  });

  return (
    <div>
      <h1>Bun Vite Template</h1>
      <p>Response from /api/hello</p>
      <pre>
        <code>{JSON.stringify(data)}</code>
      </pre>
    </div>
  );
}
