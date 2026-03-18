import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";

export function useBotAnalytics(botId: string) {
  return useQuery({
    queryKey: ["analytics", botId, "summary"],
    queryFn: () => analyticsApi.getBotSummary(botId),
    enabled: !!botId,
  });
}

export function useBotAnalyticsActivity(botId: string) {
  return useQuery({
    queryKey: ["analytics", botId, "activity"],
    queryFn: () => analyticsApi.getBotActivity(botId),
    enabled: !!botId,
  });
}
