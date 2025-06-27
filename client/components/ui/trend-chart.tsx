import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendDataPoint } from "@shared/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";
import { Badge } from "./badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TrendChartProps {
  data: TrendDataPoint[];
  predictions: TrendDataPoint[];
  modelType: "SIS" | "SEIR";
  currentTrend: "rising" | "declining" | "stable";
  peakDate: string;
  peakListeners: number;
  futureOutlook:
    | "viral_potential"
    | "steady_decline"
    | "comeback_likely"
    | "stable_niche"
    | "explosive_growth"
    | "sustained_momentum";
}

export function TrendChart({
  data,
  predictions,
  modelType,
  currentTrend,
  peakDate,
  peakListeners,
  futureOutlook,
}: TrendChartProps) {
  const combinedData = [...data, ...predictions];
  const currentDate = new Date().toISOString().split("T")[0];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const getTrendIcon = () => {
    switch (currentTrend) {
      case "rising":
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case "declining":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getTrendColor = () => {
    switch (currentTrend) {
      case "rising":
        return "text-green-500";
      case "declining":
        return "text-red-500";
      default:
        return "text-yellow-500";
    }
  };

  const getCreatorSignal = () => {
    // Smart timing logic that considers both current trend and future outlook
    if (futureOutlook === "explosive_growth") {
      if (currentTrend === "rising") {
        return {
          signal: "Use Now!",
          color: "text-green-600",
          reasoning: "Perfect timing",
        };
      } else if (currentTrend === "stable") {
        return {
          signal: "Use Now",
          color: "text-green-500",
          reasoning: "Growth starting",
        };
      } else {
        return {
          signal: "Wait for Growth",
          color: "text-orange-500",
          reasoning: "Growth coming",
        };
      }
    } else if (futureOutlook === "viral_potential") {
      if (currentTrend === "rising") {
        return {
          signal: "Use Now!",
          color: "text-green-600",
          reasoning: "Viral momentum",
        };
      } else if (currentTrend === "stable") {
        return {
          signal: "Use Now",
          color: "text-green-500",
          reasoning: "Viral potential",
        };
      } else {
        return {
          signal: "Monitor",
          color: "text-orange-500",
          reasoning: "Potential but declining",
        };
      }
    } else if (futureOutlook === "sustained_momentum") {
      if (currentTrend === "declining") {
        return {
          signal: "Wait & Watch",
          color: "text-orange-500",
          reasoning: "Momentum coming",
        };
      } else {
        return {
          signal: "Use Now",
          color: "text-green-500",
          reasoning: "Steady growth",
        };
      }
    } else if (futureOutlook === "comeback_likely") {
      return {
        signal: "Wait & Use",
        color: "text-orange-500",
        reasoning: "Comeback predicted",
      };
    } else if (futureOutlook === "stable_niche") {
      return {
        signal: "Safe Choice",
        color: "text-blue-500",
        reasoning: "Consistent performance",
      };
    } else if (futureOutlook === "steady_decline") {
      if (currentTrend === "rising") {
        return {
          signal: "Use Soon",
          color: "text-orange-600",
          reasoning: "Act before decline",
        };
      } else {
        return {
          signal: "Consider Alt",
          color: "text-red-500",
          reasoning: "Declining trend",
        };
      }
    } else {
      // Fallback to current trend analysis
      switch (currentTrend) {
        case "rising":
          return {
            signal: "Use Now",
            color: "text-green-500",
            reasoning: "Currently trending",
          };
        case "declining":
          return {
            signal: "Wait",
            color: "text-red-500",
            reasoning: "Currently declining",
          };
        default:
          return {
            signal: "Safe",
            color: "text-blue-500",
            reasoning: "Stable choice",
          };
      }
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const isHistorical = new Date(label) <= new Date(currentDate);
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{formatDate(label)}</p>
          <p
            className={`text-sm ${isHistorical ? "text-muted-foreground" : "text-primary"}`}
          >
            {isHistorical ? "Historical" : "Predicted"}
          </p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatNumber(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {modelType} Model Analysis
              {getTrendIcon()}
            </CardTitle>
            <CardDescription>
              Content creator intelligence: Track audience engagement patterns
              and predict optimal timing for maximum viral potential
            </CardDescription>
          </div>
          <div className="text-right">
            <Badge
              variant="outline"
              className={`${getTrendColor()} border-current`}
            >
              {currentTrend.charAt(0).toUpperCase() + currentTrend.slice(1)}
            </Badge>
            <p className="text-sm text-muted-foreground mt-1">
              Peak: {formatNumber(peakListeners)} on {formatDate(peakDate)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={combinedData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
              />
              <YAxis tickFormatter={formatNumber} tick={{ fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {/* Reference line for current date */}
              <ReferenceLine
                x={currentDate}
                stroke="#8b5cf6"
                strokeDasharray="5 5"
                label={{ value: "Today", position: "topLeft" }}
              />

              {/* Historical data */}
              <Line
                type="monotone"
                dataKey="susceptible"
                stroke="#64748b"
                strokeWidth={2}
                dot={false}
                name="Susceptible"
                strokeDasharray={
                  data.some((d) => new Date(d.date) > new Date(currentDate))
                    ? undefined
                    : "0"
                }
              />

              {modelType === "SEIR" && (
                <Line
                  type="monotone"
                  dataKey="exposed"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  name="Exposed"
                />
              )}

              <Line
                type="monotone"
                dataKey="infected"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={false}
                name="Active Listeners"
              />

              {modelType === "SEIR" && (
                <Line
                  type="monotone"
                  dataKey="recovered"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="Lost Interest"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="text-center">
            <p className="text-muted-foreground">Active Audience</p>
            <p className="font-semibold text-lg text-blue-600">
              {formatNumber(data[data.length - 1]?.infected || 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Viral Peak</p>
            <p className="font-semibold text-lg">
              {formatNumber(peakListeners)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Total Reach</p>
            <p className="font-semibold text-lg text-slate-600">
              {formatNumber(data[0]?.totalPopulation || 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">Creator Signal</p>
            <p className={`font-semibold text-lg ${getCreatorSignal().color}`}>
              {getCreatorSignal().signal}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {getCreatorSignal().reasoning}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
