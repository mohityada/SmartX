import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { botsApi } from "@/lib/api";
import type { CreateBotPayload, UpdateBotPayload } from "@/types";
import { toast } from "sonner";

export function useBots() {
  return useQuery({
    queryKey: ["bots"],
    queryFn: botsApi.list,
  });
}

export function useBot(id: string) {
  return useQuery({
    queryKey: ["bots", id],
    queryFn: () => botsApi.get(id),
    enabled: !!id,
  });
}

export function useBotActivity(id: string, limit = 20) {
  return useQuery({
    queryKey: ["bots", id, "activity", limit],
    queryFn: () => botsApi.getActivity(id, limit),
    enabled: !!id,
  });
}

export function useCreateBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBotPayload) => botsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      toast.success("Bot created successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create bot");
    },
  });
}

export function useUpdateBot(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateBotPayload) => botsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      toast.success("Bot updated successfully");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update bot");
    },
  });
}

export function useDeleteBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => botsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      toast.success("Bot deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete bot");
    },
  });
}

export function useToggleBot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      isActive ? botsApi.stop(id) : botsApi.start(id),
    onSuccess: (_data, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      toast.success(isActive ? "Bot stopped" : "Bot started");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to toggle bot");
    },
  });
}
