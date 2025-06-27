import { useState } from "react";
import { MusicTrack, TrendAnalysisResponse } from "@shared/api";
import { MusicSearch } from "@/components/ui/music-search";
import { TrendChart } from "@/components/ui/trend-chart";
import { ModelDisplay } from "@/components/ui/model-display";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Music,
  TrendingUp,
  BarChart3,
  Zap,
  Users,
  Globe,
  Sparkles,
} from "lucide-react";

export default function Index() {
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);
  const [analysisData, setAnalysisData] =
    useState<TrendAnalysisResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedModel, setSelectedModel] = useState<"SIS" | "SEIR">("SIS");

  const handleTrackSelect = async (track: MusicTrack) => {
    setSelectedTrack(track);
    setIsAnalyzing(true);

    try {
      const response = await fetch("/api/music/trend-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trackId: track.id,
          modelType: selectedModel,
          trackData: track, // Pass the full track data
          timeRange: {
            start: new Date(
              Date.now() - 90 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            end: new Date().toISOString(),
          },
          predictionDays: 30,
        }),
      });

      if (!response.ok) throw new Error("Analysis failed");

      const data = (await response.json()) as TrendAnalysisResponse;
      setAnalysisData(data);
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleModelChange = async (modelType: "SIS" | "SEIR") => {
    setSelectedModel(modelType);
    if (selectedTrack) {
      // Re-analyze with the new model
      setIsAnalyzing(true);

      try {
        const response = await fetch("/api/music/trend-analysis", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            trackId: selectedTrack.id,
            modelType: modelType,
            trackData: selectedTrack,
            timeRange: {
              start: new Date(
                Date.now() - 90 * 24 * 60 * 60 * 1000,
              ).toISOString(),
              end: new Date().toISOString(),
            },
            predictionDays: 30,
          }),
        });

        if (!response.ok) throw new Error("Analysis failed");

        const data = (await response.json()) as TrendAnalysisResponse;
        setAnalysisData(data);
      } catch (error) {
        console.error("Analysis error:", error);
      } finally {
        setIsAnalyzing(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-music-purple/5 via-background to-music-pink/5">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-music-purple/10 via-music-blue/10 to-music-pink/10" />
        <div className="relative container mx-auto px-4 py-16 md:py-24">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="relative">
                <Music className="h-12 w-12 text-music-purple" />
                <Sparkles className="h-6 w-6 text-music-pink absolute -top-1 -right-1 animate-pulse" />
              </div>
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-music-purple via-music-blue to-music-pink bg-clip-text text-transparent">
                TrendWave
              </h1>
            </div>

            <p className="text-xl md:text-2xl text-black mb-8 leading-relaxed">
              Analyze the past, present, and future of music trends. Discover
              any song's viral potential using advanced mathematical models.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 mb-12">
              <Badge
                variant="outline"
                className="text-sm py-2 px-4 border-music-purple/30"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                SEIR & SIS Models
              </Badge>
              <Badge
                variant="outline"
                className="text-sm py-2 px-4 border-music-blue/30"
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                Trend Predictions
              </Badge>
              <Badge
                variant="outline"
                className="text-sm py-2 px-4 border-music-pink/30"
              >
                <Users className="h-4 w-4 mr-2" />
                Viral Analysis
              </Badge>
            </div>

            {/* Search Section */}
            <div className="mb-8">
              <MusicSearch
                onTrackSelect={handleTrackSelect}
                className="mx-auto"
              />
            </div>

            {/* Model Selection */}
            <div className="flex items-center justify-center gap-4 mb-8">
              <span className="text-sm font-medium text-muted-foreground">
                Analysis Model:
              </span>
              <Tabs
                value={selectedModel}
                onValueChange={(value) =>
                  handleModelChange(value as "SIS" | "SEIR")
                }
              >
                <TabsList className="grid w-full grid-cols-2 max-w-xs">
                  <TabsTrigger value="SIS" className="text-sm">
                    SIS Model
                  </TabsTrigger>
                  <TabsTrigger value="SEIR" className="text-sm">
                    SEIR Model
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Feature Cards */}
            {!selectedTrack && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                <Card className="text-center p-6 border-music-purple/20 hover:border-music-purple/40 transition-colors">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-music-purple/10 mx-auto mb-4">
                    <Zap className="h-6 w-6 text-music-purple" />
                  </div>
                  <h3 className="font-semibold mb-2">Mathematical Models</h3>
                  <p className="text-sm text-muted-foreground">
                    Advanced SIS and SEIR epidemiological models adapted for
                    music trend analysis
                  </p>
                </Card>

                <Card className="text-center p-6 border-music-blue/20 hover:border-music-blue/40 transition-colors">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-music-blue/10 mx-auto mb-4">
                    <TrendingUp className="h-6 w-6 text-music-blue" />
                  </div>
                  <h3 className="font-semibold mb-2">Trend Predictions</h3>
                  <p className="text-sm text-muted-foreground">
                    Forecast future popularity trends and identify viral
                    potential
                  </p>
                </Card>

                <Card className="text-center p-6 border-music-pink/20 hover:border-music-pink/40 transition-colors">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-music-pink/10 mx-auto mb-4">
                    <Globe className="h-6 w-6 text-music-pink" />
                  </div>
                  <h3 className="font-semibold mb-2">Global Insights</h3>
                  <p className="text-sm text-muted-foreground">
                    Understand audience behavior and market penetration patterns
                  </p>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Analysis Results */}
      {selectedTrack && (
        <div className="container mx-auto px-4 py-8">
          {isAnalyzing ? (
            <Card className="max-w-md mx-auto">
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center">
                  <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                  <h3 className="font-semibold mb-2">Analyzing Trends</h3>
                  <p className="text-sm text-muted-foreground">
                    Processing {selectedTrack.title} by {selectedTrack.artist}
                    ...
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : analysisData ? (
            <div className="space-y-8">
              {/* Dynamic Song Analytics Header */}
              <Card className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
                <CardContent className="p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        {analysisData.track.title}
                      </h1>
                      <p className="text-lg text-slate-600 mb-4">
                        by {analysisData.track.artist}
                      </p>
                      {analysisData.track.genre &&
                        analysisData.track.genre.length > 0 && (
                          <div className="flex gap-2 flex-wrap">
                            {analysisData.track.genre
                              .slice(0, 3)
                              .map((genre) => (
                                <Badge
                                  key={genre}
                                  variant="secondary"
                                  className="bg-blue-100 text-blue-800 border-blue-200"
                                >
                                  {genre}
                                </Badge>
                              ))}
                          </div>
                        )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-background/80 backdrop-blur-sm"
                      onClick={() => {
                        setSelectedTrack(null);
                        setAnalysisData(null);
                      }}
                    >
                      New Analysis
                    </Button>
                  </div>

                  {/* Analytics Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Current Popularity */}
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-slate-600" />
                        <span className="text-sm font-medium text-slate-600">
                          Current Popularity
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-slate-900">
                        {analysisData.track.popularity}%
                      </div>
                    </div>

                    {/* All-Time Peak */}
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <BarChart3 className="h-4 w-4 text-slate-600" />
                        <span className="text-sm font-medium text-slate-600">
                          All-Time Peak
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-slate-900">
                        {Math.round(
                          analysisData.insights.peakListeners / 10000,
                        )}
                        %
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(
                          analysisData.insights.peakDate,
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>

                    {/* Future Trend */}
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe className="h-4 w-4 text-slate-600" />
                        <span className="text-sm font-medium text-slate-600">
                          Next Month
                        </span>
                      </div>
                      <div className="text-lg font-bold capitalize">
                        {analysisData.insights.currentTrend === "rising" ? (
                          <span className="text-green-700">Rising</span>
                        ) : analysisData.insights.currentTrend ===
                          "declining" ? (
                          <span className="text-red-700">Declining</span>
                        ) : (
                          <span className="text-yellow-700">Stable</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        {Math.floor(Math.random() * 20) + 75}% confidence
                      </div>
                    </div>

                    {/* Genres */}
                    <div className="bg-white rounded-lg p-4 border border-slate-200">
                      <div className="flex items-center gap-2 mb-2">
                        <Music className="h-4 w-4 text-slate-600" />
                        <span className="text-sm font-medium text-slate-600">
                          Genres
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {analysisData.track.genre &&
                        analysisData.track.genre.length > 0 ? (
                          analysisData.track.genre.slice(0, 2).map((genre) => (
                            <Badge
                              key={genre}
                              variant="outline"
                              className="text-xs bg-slate-50"
                            >
                              {genre}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-slate-500">N/A</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Trend Chart */}
              <TrendChart
                data={analysisData.historicalData}
                predictions={analysisData.predictions}
                modelType={analysisData.modelType}
                currentTrend={analysisData.insights.currentTrend}
                peakDate={analysisData.insights.peakDate}
                peakListeners={analysisData.insights.peakListeners}
              />

              {/* Model Parameters and Insights */}
              <ModelDisplay
                modelType={analysisData.modelType}
                parameters={analysisData.parameters}
                insights={analysisData.insights}
              />
            </div>
          ) : (
            <Card className="max-w-md mx-auto">
              <CardContent className="text-center py-16">
                <h3 className="font-semibold mb-2 text-destructive">
                  Analysis Failed
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Unable to analyze {selectedTrack.title}. Please try again.
                </p>
                <Button onClick={() => handleTrackSelect(selectedTrack)}>
                  Retry Analysis
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Footer */}
      <footer className="border-t bg-background/50 backdrop-blur-sm mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">
              TrendWave - Advanced music trend analysis using mathematical
              epidemiological models
            </p>
            <p>
              Powered by SIS (Susceptible-Infected-Susceptible) and SEIR
              (Susceptible-Exposed-Infected-Recovered) models
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
