import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tweetsApi } from "@/lib/api";
import type { TweetStatus } from "@/types";
import { toast } from "sonner";

export function useTweets(filters?: { status?: TweetStatus; botId?: string }) {
  return useQuery({
    queryKey: ["tweets", filters],
    queryFn: () => tweetsApi.list(filters),
  });
}

export function useTweet(id: string) {
  return useQuery({
    queryKey: ["tweets", id],
    queryFn: () => tweetsApi.get(id),
    enabled: !!id,
  });
}

export function useApproveTweet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tweetsApi.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tweets"] });
      toast.success("Tweet approved");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to approve tweet");
    },
  });
}

export function useEditTweet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      tweetsApi.edit(id, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tweets"] });
      toast.success("Tweet updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update tweet");
    },
  });
}

export function useScheduleTweet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, scheduledFor }: { id: string; scheduledFor: string }) =>
      tweetsApi.schedule(id, scheduledFor),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tweets"] });
      toast.success("Tweet scheduled");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to schedule tweet");
    },
  });
}

export function usePostNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tweetsApi.postNow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tweets"] });
      toast.success("Tweet queued for posting");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to post tweet");
    },
  });
}
