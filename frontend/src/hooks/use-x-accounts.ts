import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { xAccountsApi } from "@/lib/api";
import { toast } from "sonner";

export function useXAccounts() {
  return useQuery({
    queryKey: ["x-accounts"],
    queryFn: xAccountsApi.list,
  });
}

export function useDisconnectXAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => xAccountsApi.disconnect(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["x-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["bots"] });
      toast.success("X account disconnected");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to disconnect X account");
    },
  });
}
