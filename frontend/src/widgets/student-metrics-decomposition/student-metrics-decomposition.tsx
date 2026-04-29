import { useState } from "react";

import type { UserRating } from "@/entities/rating/model/types";
import { MetricsDetail } from "@/widgets/metrics-detail/metrics-detail";
import { cn, formatNumber } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import { TooltipHint } from "@/shared/ui/tooltip-hint";

export function StudentMetricsDecomposition({
  ratings,
  title = "Декомпозиция по студентам",
  description = "Выберите студента, чтобы посмотреть категории и компоненты его score.",
  embedded = false,
}: {
  ratings: UserRating[];
  title?: string;
  description?: string;
  embedded?: boolean;
}) {
  const [selectedKey, setSelectedKey] = useState("");
  const ratingsWithComponents = ratings.filter(
    (rating) => rating.scoreComponents?.length,
  );
  const selected =
    ratingsWithComponents.find((rating) => ratingKey(rating) === selectedKey) ??
    ratingsWithComponents[0];

  if (!ratingsWithComponents.length || !selected) return null;

  const content = (
    <div className="grid min-w-0 gap-4 2xl:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="max-h-[42rem] space-y-2 overflow-y-auto pr-1 sticky top-[1rem]">
        {ratingsWithComponents.map((rating) => {
          const key = ratingKey(rating);
          const active = key === ratingKey(selected);

          return (
            <Button
              key={key}
              variant="outline"
              className={cn(
                "h-auto w-full justify-start whitespace-normal rounded-2xl border bg-background/60 p-3 text-left",
                active && "border-primary/40 bg-primary/10",
              )}
              onClick={() => setSelectedKey(key)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">
                    {rating.contributorLogin}
                  </span>
                  <Badge variant={rating.rank <= 3 ? "soft" : "secondary"}>
                    #{rating.rank || "n/a"}
                  </Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>Score {formatNumber(rating.score)}</span>
                  <TooltipHint
                    label={`${rating.scoreComponents.length} метрик`}
                    description="Количество отдельных метрик, из которых рассчитан score студента."
                    align="right"
                    focusable={false}
                  />
                </div>
              </div>
            </Button>
          );
        })}
      </div>

      <div className="min-w-0 space-y-3 overflow-visible">
        <MetricsDetail components={selected.scoreComponents} />
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <Card className="surface">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 overflow-visible">{content}</CardContent>
    </Card>
  );
}

function ratingKey(rating: UserRating) {
  return rating.contributorId || rating.contributorLogin;
}
