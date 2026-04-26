import type { ScoreCategory } from "@/entities/rating/model/types";

export const categoryLabels: Record<ScoreCategory, string> = {
  activity: "Активность",
  productivity: "Продуктивность",
  communication: "Коммуникация",
  quality: "Качество",
  flow: "Рабочий процесс",
  repository_health: "Здоровье репозитория",
};
