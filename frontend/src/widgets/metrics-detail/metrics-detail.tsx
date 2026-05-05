import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type {
  ScoreCategory,
  ScoreComponent,
} from "@/entities/rating/model/types";
import { categoryLabels } from "@/entities/rating/lib/metric-labels";
import {
  cn,
  formatMetricValue,
  formatNumber,
  toFiniteNumber,
} from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { TooltipHint } from "@/shared/ui/tooltip-hint";

type MetricSeverity = "critical" | "warning" | "normal" | "no_data";

const criticalThreshold = 20;
const warningThreshold = 35;

const shortCategoryLabels: Record<ScoreCategory, string> = {
  activity: "Активн.",
  productivity: "Продукт.",
  communication: "Коммуник.",
  quality: "Качество",
  flow: "Flow",
  repository_health: "Репо",
};

export function MetricsDetail({
  components,
}: {
  components: ScoreComponent[];
}) {
  const chartData = groupByCategory(components);
  const componentsByCategory = groupComponentsByCategory(components);

  return (
    <div className="grid min-w-0 gap-4 2xl:grid-cols-1">
      <Card className="surface min-w-0">
        <CardHeader>
          <CardTitle>
            <TooltipHint
              label="Score категорий"
              description="Score категории считается как сумма Weighted по метрикам категории, деленная на сумму их весов."
            />
          </CardTitle>
          <CardDescription>
            Средневзвешенный percentile по компонентам категории, шкала 0-100.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: -18, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="shortLabel"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  interval={0}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  domain={[0, 100]}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  formatter={(value) => [
                    formatNumber(value as number),
                    "Score категории",
                  ]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.label ?? ""
                  }
                />
                <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                  {chartData.map((item) => (
                    <Cell
                      key={item.category}
                      fill={severityColor(item.severity)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span>Красный: score &lt; {criticalThreshold}</span>
            <span>Желтый: score &lt; {warningThreshold}</span>
            <span>Серый: нет применимых метрик</span>
          </div>
        </CardContent>
      </Card>

      <Card className="surface min-w-0">
        <CardHeader>
          <CardTitle>Компоненты рейтинга</CardTitle>
          <CardDescription>
            Метрики сгруппированы по категориям оценки. Критичные компоненты
            подсвечены по percentile-score.
          </CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          {componentsByCategory.map((group) => (
            <div
              key={group.category}
              className="min-w-0 rounded-2xl border bg-background/60 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <Badge variant="soft">{categoryLabels[group.category]}</Badge>
                <span className="text-xs text-muted-foreground">
                  {group.items.length} метрик
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-72">Метрика</TableHead>
                    <TableHead>
                      <TooltipHint
                        label="Raw"
                        description="Исходное значение метрики из агрегированных GitHub-событий за выбранный период."
                      />
                    </TableHead>
                    <TableHead>
                      <TooltipHint
                        label="Percentile"
                        description="Нормализация Raw в шкалу 0-100. Percentile-метрики считаются по общей выборке организации за выбранный период, bounded ratio и absolute-метрики идут по фиксированной шкале."
                      />
                    </TableHead>
                    <TableHead>
                      <TooltipHint
                        label="Weighted"
                        description="Вклад метрики в категорию: Percentile score умножается на вес метрики."
                      />
                    </TableHead>
                    <TableHead>
                      <TooltipHint
                        label="Статус"
                        description={`Критично: percentile меньше ${criticalThreshold}. Риск: percentile меньше ${warningThreshold}. Нет данных: у метрики нулевой вес из-за отсутствующего знаменателя/сэмпла.`}
                        align="right"
                      />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.items.map((component) => {
                    const severity = metricSeverity(component);
                    const label = component.label ?? component.metric;
                    const description =
                      component.description ??
                      "Метрика участвует в расчете score.";

                    return (
                      <TableRow
                        key={`${component.category}-${component.metric}`}
                        className={cn(
                          severity === "critical" &&
                            "bg-destructive/10 hover:bg-destructive/15",
                          severity === "warning" &&
                            "bg-accent/30 hover:bg-accent/40",
                        )}
                      >
                        <TableCell className="min-w-72 max-w-[28rem] font-medium">
                          <div className="space-y-1">
                            <TooltipHint
                              label={label}
                              description={description}
                            />
                            <p className="text-xs font-normal leading-relaxed text-muted-foreground">
                              {description}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatMetricValue(
                            component.metric,
                            toFiniteNumber(component.rawValue),
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            severity === "critical" &&
                              "font-semibold text-destructive",
                            severity === "warning" &&
                              "font-semibold text-accent-foreground",
                          )}
                        >
                          {formatNumber(
                            toFiniteNumber(component.normalizedValue),
                          )}
                        </TableCell>
                        <TableCell>
                          {formatNumber(
                            toFiniteNumber(component.weightedScore),
                          )}
                        </TableCell>
                        <TableCell>
                          <MetricStatusBadge severity={severity} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricStatusBadge({ severity }: { severity: MetricSeverity }) {
  if (severity === "no_data") {
    return <Badge variant="outline">Нет данных</Badge>;
  }

  if (severity === "critical") {
    return <Badge variant="destructive">Критично</Badge>;
  }

  if (severity === "warning") {
    return (
      <Badge
        variant="outline"
        className="border-accent/60 bg-accent/45 text-accent-foreground"
      >
        Риск
      </Badge>
    );
  }

  return <Badge variant="soft">Норма</Badge>;
}

function groupComponentsByCategory(components: ScoreComponent[]) {
  const order: ScoreCategory[] = [
    "activity",
    "productivity",
    "communication",
    "quality",
    "flow",
    "repository_health",
  ];

  return order
    .map((category) => ({
      category,
      items: components.filter((component) => component.category === category),
    }))
    .filter((group) => group.items.length > 0);
}

function groupByCategory(components: ScoreComponent[]) {
  return groupComponentsByCategory(components).map((group) => {
    const totalWeight = group.items.reduce(
      (sum, component) => sum + toFiniteNumber(component.weight),
      0,
    );
    const weightedTotal = group.items.reduce(
      (sum, component) => sum + toFiniteNumber(component.weightedScore),
      0,
    );
    const hasWeight = totalWeight > 0;
    const score = hasWeight ? weightedTotal / totalWeight : 0;

    return {
      category: group.category,
      label: categoryLabels[group.category],
      shortLabel: shortCategoryLabels[group.category],
      score: Number(score.toFixed(2)),
      severity: hasWeight ? scoreSeverity(score) : "no_data",
    };
  });
}

function metricSeverity(component: ScoreComponent): MetricSeverity {
  if (toFiniteNumber(component.weight) <= 0) return "no_data";

  return scoreSeverity(toFiniteNumber(component.normalizedValue));
}

function scoreSeverity(score: number): MetricSeverity {
  if (score < criticalThreshold) return "critical";
  if (score < warningThreshold) return "warning";

  return "normal";
}

function severityColor(severity: MetricSeverity) {
  if (severity === "no_data") return "var(--color-muted-foreground)";
  if (severity === "critical") return "var(--color-destructive)";
  if (severity === "warning") return "var(--color-chart-5)";

  return "var(--color-primary)";
}
