import { ModelParameters } from "@shared/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";
import { Badge } from "./badge";
import { Info, Calculator, Zap, Users, RotateCcw, Timer } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

interface ModelDisplayProps {
  modelType: "SIS" | "SEIR";
  parameters: ModelParameters;
  insights: {
    peakDate: string;
    peakListeners: number;
    currentTrend: "rising" | "declining" | "stable";
    futureOutlook:
      | "viral_potential"
      | "steady_decline"
      | "comeback_likely"
      | "stable_niche";
  };
}

export function ModelDisplay({
  modelType,
  parameters,
  insights,
}: ModelDisplayProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const getOutlookColor = (outlook: string) => {
    switch (outlook) {
      case "viral_potential":
        return "text-green-600 bg-green-100";
      case "comeback_likely":
        return "text-blue-600 bg-blue-100";
      case "stable_niche":
        return "text-yellow-600 bg-yellow-100";
      case "steady_decline":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getOutlookDescription = (outlook: string) => {
    switch (outlook) {
      case "viral_potential":
        return "High probability of viral spread";
      case "comeback_likely":
        return "May experience renewed interest";
      case "stable_niche":
        return "Steady fanbase, limited growth";
      case "steady_decline":
        return "Gradually losing listener interest";
      default:
        return "Trend unclear";
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Model Equations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            {modelType} Mathematical Model
          </CardTitle>
          <CardDescription>
            {modelType === "SIS"
              ? "Susceptible-Infected-Susceptible model for recurring music trends"
              : "Susceptible-Exposed-Infected-Recovered model for viral music spread"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {modelType === "SIS" ? (
              <>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                  <div className="mb-2 font-semibold">SIS Model Equations:</div>
                  <div>dS/dt = γI - βSI</div>
                  <div>dI/dt = βSI - γI</div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">S:</span> Susceptible (not
                    yet fans)
                  </div>
                  <div>
                    <span className="font-semibold">I:</span> Infected (active
                    listeners)
                  </div>
                  <div>
                    <span className="font-semibold">β:</span> Discovery rate
                  </div>
                  <div>
                    <span className="font-semibold">γ:</span> Loss of interest
                    rate
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="bg-muted p-4 rounded-lg font-mono text-sm">
                  <div className="mb-2 font-semibold">
                    SEIR Model Equations:
                  </div>
                  <div>dS/dt = -βSI</div>
                  <div>dE/dt = βSI - σE</div>
                  <div>dI/dt = σE - γI</div>
                  <div>dR/dt = γI</div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-semibold">S:</span> Susceptible
                    (unaware)
                  </div>
                  <div>
                    <span className="font-semibold">E:</span> Exposed (heard,
                    considering)
                  </div>
                  <div>
                    <span className="font-semibold">I:</span> Infected (active
                    fans)
                  </div>
                  <div>
                    <span className="font-semibold">R:</span> Recovered (lost
                    interest)
                  </div>
                  <div>
                    <span className="font-semibold">β:</span> Exposure rate
                  </div>
                  <div>
                    <span className="font-semibold">σ:</span> Conversion rate
                  </div>
                  <div>
                    <span className="font-semibold">γ:</span> Recovery rate
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Model Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Model Parameters
          </CardTitle>
          <CardDescription>
            Calculated parameters for this track's trend analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Rate at which people discover this music</p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-sm font-medium">
                    Discovery Rate (β)
                  </span>
                </div>
                <Badge variant="secondary">{parameters.beta.toFixed(4)}</Badge>
              </div>

              {parameters.sigma && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Tooltip>
                      <TooltipTrigger>
                        <Timer className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          Rate of conversion from exposure to active listening
                        </p>
                      </TooltipContent>
                    </Tooltip>
                    <span className="text-sm font-medium">
                      Conversion Rate (σ)
                    </span>
                  </div>
                  <Badge variant="secondary">
                    {parameters.sigma.toFixed(4)}
                  </Badge>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger>
                      <RotateCcw className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Rate at which people lose interest</p>
                    </TooltipContent>
                  </Tooltip>
                  <span className="text-sm font-medium">Loss Rate (γ)</span>
                </div>
                <Badge variant="secondary">{parameters.gamma.toFixed(4)}</Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Initial Listeners</span>
                </div>
                <Badge variant="outline">
                  {formatNumber(parameters.initialInfected)}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Total Market</span>
                </div>
                <Badge variant="outline">
                  {formatNumber(parameters.totalPopulation)}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Insights */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Trend Insights
          </CardTitle>
          <CardDescription>
            Analysis and predictions based on the mathematical model
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">
                Peak Listeners
              </p>
              <p className="text-2xl font-bold text-blue-800">
                {formatNumber(insights.peakListeners)}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                {new Date(insights.peakDate).toLocaleDateString()}
              </p>
            </div>

            <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">
                Current Trend
              </p>
              <p className="text-lg font-bold text-purple-800 capitalize">
                {insights.currentTrend}
              </p>
            </div>

            <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
              <p className="text-sm text-green-600 font-medium">Model Type</p>
              <p className="text-lg font-bold text-green-800">{modelType}</p>
              <p className="text-xs text-green-600 mt-1">
                {modelType === "SIS" ? "Cyclical" : "One-time Spread"}
              </p>
            </div>

            <div className="text-center p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Future Outlook</p>
              <Badge
                className={`${getOutlookColor(insights.futureOutlook)} text-sm px-3 py-1`}
                variant="secondary"
              >
                {insights.futureOutlook.replace("_", " ").toUpperCase()}
              </Badge>
              <p className="text-xs text-muted-foreground mt-2">
                {getOutlookDescription(insights.futureOutlook)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
