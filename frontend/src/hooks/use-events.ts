import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { eventsApi } from "@/lib/api";
import { toast } from "sonner";
import { Event } from "@/types";

export function useEventCategories() {
  return useQuery({
    queryKey: ["events", "categories"],
    queryFn: () => eventsApi.getCategories(),
  });
}

export function useEvents(filters?: {
  category?: string;
  source?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["events", "list", filters],
    queryFn: () => eventsApi.list(filters),
  });
}

export function useForwardEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, botId }: { id: string; botId: string }) =>
      eventsApi.forward(id, botId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tweets"] });
      toast.success("Event manually forwarded for tweet generation");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to forward event");
    },
  });
}
