import { RequestHandler } from "express";
import {
  TrendAnalysisResponse,
  TrendDataPoint,
  ModelParameters,
  MusicTrack,
} from "@shared/api";

// Cache for storing track data from searches
const trackCache: Record<string, MusicTrack> = {};

// SIS Model: dS/dt = γI - βSI, dI/dt = βSI - γI
function simulateSIS(
  params: ModelParameters,
  startDate: Date,
  days: number,
  addNoise: boolean = true,
): TrendDataPoint[] {
  const { beta, gamma, initialInfected, totalPopulation } = params;

  let S = totalPopulation - initialInfected; // Susceptible
  let I = initialInfected; // Infected (active listeners)

  const results: TrendDataPoint[] = [];
  const dt = 0.1; // Time step
  const stepsPerDay = Math.floor(1 / dt);

  for (let day = 0; day <= days; day++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + day);

    // Add seasonal and random variations for historical data
    let seasonalFactor = 1;
    let noiseFactor = 1;

    if (addNoise) {
      // Seasonal pattern (holidays, summer, etc.)
      const dayOfYear = Math.floor(
        (currentDate.getTime() -
          new Date(currentDate.getFullYear(), 0, 0).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      seasonalFactor = 1 + 0.3 * Math.sin((dayOfYear / 365) * 2 * Math.PI); // Yearly cycle

      // Weekly pattern (weekends vs weekdays)
      const dayOfWeek = currentDate.getDay();
      const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 1.2 : 0.9;
      seasonalFactor *= weekendFactor;

      // Random noise (events, viral moments, etc.)
      noiseFactor = 0.8 + Math.random() * 0.4; // ±20% random variation
    }

    if (day % 1 === 0) {
      const noisyI = Math.round(I * seasonalFactor * noiseFactor);
      const noisyS = Math.round(S * seasonalFactor * noiseFactor);

      results.push({
        date: currentDate.toISOString().split("T")[0],
        susceptible: Math.max(0, Math.min(totalPopulation, noisyS)),
        infected: Math.max(1, Math.min(totalPopulation, noisyI)),
        totalPopulation,
      });
    }

    // Model simulation with external influences
    const currentBeta = beta * seasonalFactor;
    const currentGamma = gamma / seasonalFactor;

    for (let step = 0; step < stepsPerDay; step++) {
      const dS = currentGamma * I - (currentBeta * S * I) / totalPopulation;
      const dI = (currentBeta * S * I) / totalPopulation - currentGamma * I;

      S += dS * dt;
      I += dI * dt;

      // Ensure values stay within bounds
      S = Math.max(0, Math.min(totalPopulation, S));
      I = Math.max(1, Math.min(totalPopulation, I));
    }
  }

  return results;
}

// SEIR Model: dS/dt = -βSI, dE/dt = βSI - σE, dI/dt = σE - γI, dR/dt = γI
function simulateSEIR(
  params: ModelParameters,
  startDate: Date,
  days: number,
  addNoise: boolean = true,
): TrendDataPoint[] {
  const { beta, gamma, sigma = 0.1, initialInfected, totalPopulation } = params;

  let S = totalPopulation - initialInfected; // Susceptible
  let E = 0; // Exposed
  let I = initialInfected; // Infected (active listeners)
  let R = 0; // Recovered (lost interest)

  const results: TrendDataPoint[] = [];
  const dt = 0.1; // Time step
  const stepsPerDay = Math.floor(1 / dt);

  for (let day = 0; day <= days; day++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + day);

    // Add realistic variations
    let seasonalFactor = 1;
    let noiseFactor = 1;

    if (addNoise) {
      // Seasonal and weekly patterns
      const dayOfYear = Math.floor(
        (currentDate.getTime() -
          new Date(currentDate.getFullYear(), 0, 0).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      seasonalFactor = 1 + 0.2 * Math.sin((dayOfYear / 365) * 2 * Math.PI);

      const dayOfWeek = currentDate.getDay();
      const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 1.15 : 0.95;
      seasonalFactor *= weekendFactor;

      // Random events and viral moments
      noiseFactor = 0.85 + Math.random() * 0.3;
    }

    if (day % 1 === 0) {
      results.push({
        date: currentDate.toISOString().split("T")[0],
        susceptible: Math.max(0, Math.round(S * seasonalFactor * noiseFactor)),
        exposed: Math.max(0, Math.round(E * seasonalFactor * noiseFactor)),
        infected: Math.max(1, Math.round(I * seasonalFactor * noiseFactor)),
        recovered: Math.max(0, Math.round(R * seasonalFactor * noiseFactor)),
        totalPopulation,
      });
    }

    // Model with external influences
    const currentBeta = beta * seasonalFactor;
    const currentSigma = sigma * (0.8 + 0.4 * seasonalFactor);
    const currentGamma = gamma / seasonalFactor;

    for (let step = 0; step < stepsPerDay; step++) {
      const dS = (-currentBeta * S * I) / totalPopulation;
      const dE = (currentBeta * S * I) / totalPopulation - currentSigma * E;
      const dI = currentSigma * E - currentGamma * I;
      const dR = currentGamma * I;

      S += dS * dt;
      E += dE * dt;
      I += dI * dt;
      R += dR * dt;

      // Ensure values stay within bounds
      S = Math.max(0, S);
      E = Math.max(0, E);
      I = Math.max(1, I);
      R = Math.max(0, R);
    }
  }

  return results;
}

function generateModelParameters(
  track: MusicTrack,
  modelType: "SIS" | "SEIR",
): ModelParameters {
  // Create unique seed based on track title and artist for consistent results
  const trackSeed = (track.title + track.artist).split("").reduce((a, b) => {
    a = (a << 5) - a + b.charCodeAt(0);
    return a & a;
  }, 0);

  // Seeded random function
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  };

  const popularity = track.popularity / 100;
  const age = new Date().getFullYear() - (track.releaseYear || 2020);
  const isViral =
    track.genre?.includes("Pop") || track.genre?.includes("Alternative");
  const isClassic = age > 20;
  const isRecent = age <= 3;

  // More varied parameters based on track characteristics
  let baseBeta, baseGamma;

  // Different behavior for different song types
  if (isClassic) {
    // Classic songs: stable, recurring popularity
    baseBeta = 0.15 + seededRandom(trackSeed) * 0.1;
    baseGamma = 0.02 + seededRandom(trackSeed + 1) * 0.03;
  } else if (isRecent && isViral) {
    // Recent viral songs: high initial spread, faster decline
    baseBeta = 0.4 + seededRandom(trackSeed) * 0.2;
    baseGamma = 0.08 + seededRandom(trackSeed + 1) * 0.05;
  } else if (isViral) {
    // Viral songs: moderate spread, cyclical
    baseBeta = 0.25 + seededRandom(trackSeed) * 0.15;
    baseGamma = 0.04 + seededRandom(trackSeed + 1) * 0.04;
  } else {
    // Regular songs: slower spread, steady
    baseBeta = 0.1 + seededRandom(trackSeed) * 0.08;
    baseGamma = 0.03 + seededRandom(trackSeed + 1) * 0.02;
  }

  // Adjust for popularity
  baseBeta *= 0.5 + popularity * 0.5;

  const totalPopulation =
    5000000 + Math.floor(seededRandom(trackSeed + 2) * 5000000); // 5-10M
  const initialInfected = Math.floor(
    popularity * 50000 + seededRandom(trackSeed + 3) * 50000,
  ); // More variation

  if (modelType === "SIS") {
    return {
      beta: Math.max(0.001, Math.min(0.6, baseBeta)),
      gamma: Math.max(0.005, Math.min(0.15, baseGamma)),
      initialInfected,
      totalPopulation,
    };
  } else {
    return {
      beta: Math.max(0.001, Math.min(0.7, baseBeta * 1.1)),
      gamma: Math.max(0.005, Math.min(0.12, baseGamma * 0.9)),
      sigma: Math.max(
        0.02,
        Math.min(
          0.25,
          0.1 + popularity * 0.15 + seededRandom(trackSeed + 4) * 0.1,
        ),
      ),
      initialInfected,
      totalPopulation,
    };
  }
}

function analyzeInsights(
  data: TrendDataPoint[],
  predictions: TrendDataPoint[],
  modelType: "SIS" | "SEIR",
) {
  const allData = [...data, ...predictions];

  // Find peak across all data
  let peakDate = allData[0].date;
  let peakListeners = allData[0].infected;

  allData.forEach((point) => {
    if (point.infected > peakListeners) {
      peakListeners = point.infected;
      peakDate = point.date;
    }
  });

  // Analyze recent historical trend (last 14 days)
  const recentData = data.slice(-14);
  const trendSlope =
    recentData.length > 1
      ? (recentData[recentData.length - 1].infected - recentData[0].infected) /
        recentData.length
      : 0;

  const currentTrend =
    trendSlope > 50 ? "rising" : trendSlope < -50 ? "declining" : "stable";

  // Analyze future predictions trend
  const currentListeners = data[data.length - 1]?.infected || 0;
  const futureEnd =
    predictions[predictions.length - 1]?.infected || currentListeners;
  const futureMax = Math.max(...predictions.map((p) => p.infected));
  const futureMin = Math.min(...predictions.map((p) => p.infected));

  const growthPotential = futureMax / currentListeners;
  const volatilityFactor = (futureMax - futureMin) / currentListeners;
  const endTrend = futureEnd / currentListeners;

  let futureOutlook:
    | "viral_potential"
    | "steady_decline"
    | "comeback_likely"
    | "stable_niche";

  // More sophisticated outlook analysis
  if (growthPotential > 1.8 && volatilityFactor > 0.5) {
    futureOutlook = "viral_potential";
  } else if (endTrend < 0.7 && growthPotential < 1.2) {
    futureOutlook = "steady_decline";
  } else if (
    modelType === "SIS" &&
    volatilityFactor > 0.3 &&
    futureMax > currentListeners * 1.3
  ) {
    futureOutlook = "comeback_likely";
  } else {
    futureOutlook = "stable_niche";
  }

  return {
    peakDate,
    peakListeners,
    currentTrend,
    futureOutlook,
  };
}

export const handleTrendAnalysis: RequestHandler = async (req, res) => {
  try {
    const {
      trackId,
      modelType = "SIS",
      timeRange,
      predictionDays = 30,
      trackData, // Allow passing track data directly from frontend
    } = req.body;

    // Priority: use trackData from request, then check cache
    let track: MusicTrack;

    if (trackData) {
      track = trackData;
      // Store in cache for future use
      trackCache[trackId] = trackData;
    } else {
      track = trackCache[trackId];
    }

    if (!track) {
      console.error(`Track not found for ID: ${trackId}`);
      return res.status(404).json({
        error: "Track not found. Please search for the track again.",
      });
    }

    console.log(`Analyzing track: ${track.title} by ${track.artist}`);

    // Generate model parameters
    const parameters = generateModelParameters(track, modelType);

    // Calculate historical data (more realistic timeframe)
    const currentDate = new Date();
    const historicalStartDate = new Date(currentDate);
    historicalStartDate.setDate(historicalStartDate.getDate() - 180); // Last 6 months

    const historicalDays = 180;

    let historicalData: TrendDataPoint[] = [];
    if (modelType === "SIS") {
      historicalData = simulateSIS(
        parameters,
        historicalStartDate,
        historicalDays,
        true,
      );
    } else {
      historicalData = simulateSEIR(
        parameters,
        historicalStartDate,
        historicalDays,
        true,
      );
    }

    // Generate highly varied and realistic future predictions
    let predictions: TrendDataPoint[] = [];

    // Create unique prediction characteristics based on song
    const trackSeed = (track.title + track.artist).split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);

    const seededRandom = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    // Get current baseline from historical data
    const currentListeners =
      historicalData[historicalData.length - 1]?.infected ||
      parameters.initialInfected;
    const historicalTrend = historicalData.slice(-7);
    const recentAverage =
      historicalTrend.reduce((sum, point) => sum + point.infected, 0) /
      historicalTrend.length;

    // Determine song-specific prediction characteristics
    const popularity = track.popularity / 100;
    const age = new Date().getFullYear() - (track.releaseYear || 2020);
    const isViral =
      track.genre?.includes("Pop") || track.genre?.includes("Alternative");
    const isClassic = age > 20;
    const isRecent = age <= 3;

    // Generate multiple prediction scenarios based on song type
    const scenarios = [
      "viral_explosion",
      "steady_decline",
      "cyclical_resurgence",
      "plateau_stability",
      "gradual_growth",
      "volatile_swings",
      "weekend_warrior",
      "seasonal_boost",
    ];

    const scenarioIndex = Math.floor(
      seededRandom(trackSeed) * scenarios.length,
    );
    const selectedScenario = scenarios[scenarioIndex];

    // Create prediction data points manually for maximum control
    predictions = [];

    for (let day = 1; day <= predictionDays; day++) {
      const futureDate = new Date(currentDate);
      futureDate.setDate(futureDate.getDate() + day);

      const dayProgress = day / predictionDays;
      const weekPhase = (day % 7) / 7;
      const randomSeed = trackSeed + day * 7;
      const dailyRandom = seededRandom(randomSeed);
      const noiseFactor = 0.92 + dailyRandom * 0.16; // ±8% daily variation (reduced from ±20%)

      let baseMultiplier = 1;
      let volatilityMultiplier = 1;

      // Apply scenario-specific patterns (reduced intensity)
      switch (selectedScenario) {
        case "viral_explosion":
          baseMultiplier = 1 + dayProgress * 1.8 * Math.exp(-dayProgress * 1.5); // Reduced from 2.5
          volatilityMultiplier = 1.15; // Reduced from 1.4
          break;

        case "steady_decline":
          baseMultiplier =
            1 - dayProgress * 0.4 - Math.sin(dayProgress * 4 * Math.PI) * 0.06; // Reduced
          volatilityMultiplier = 1.08; // Reduced from 1.2
          break;

        case "cyclical_resurgence":
          baseMultiplier =
            1 +
            Math.sin(dayProgress * 3 * Math.PI + Math.PI) * 0.25 +
            dayProgress * 0.15; // Reduced
          volatilityMultiplier = 1.12; // Reduced from 1.3
          break;

        case "plateau_stability":
          baseMultiplier = 1 + Math.sin(dayProgress * 8 * Math.PI) * 0.08; // Reduced
          volatilityMultiplier = 1.05; // Reduced from 1.1
          break;

        case "gradual_growth":
          baseMultiplier =
            1 + dayProgress * 0.5 + Math.sin(dayProgress * 6 * Math.PI) * 0.06; // Reduced
          volatilityMultiplier = 1.08; // Reduced from 1.2
          break;

        case "volatile_swings":
          baseMultiplier =
            1 +
            Math.sin(dayProgress * 12 * Math.PI + dailyRandom * 2 * Math.PI) *
              0.25; // Reduced from 0.5
          volatilityMultiplier = 1.2; // Reduced from 1.6
          break;

        case "weekend_warrior":
          const isWeekend =
            futureDate.getDay() === 0 || futureDate.getDay() === 6;
          baseMultiplier = 1 + (isWeekend ? 0.2 : -0.1) + dayProgress * 0.08; // Reduced
          volatilityMultiplier = 1.1; // Reduced from 1.3
          break;

        case "seasonal_boost":
          baseMultiplier =
            1 + Math.sin(dayProgress * 2 * Math.PI) * 0.18 + dayProgress * 0.1; // Reduced
          volatilityMultiplier = 1.08; // Reduced from 1.25
          break;
      }

      // Add genre-specific modifiers (reduced impact)
      if (isViral) {
        volatilityMultiplier *= 1.08; // Reduced from 1.2
      }
      if (isClassic) {
        baseMultiplier = (baseMultiplier + 1) / 2; // More stable
        volatilityMultiplier *= 0.9; // Reduced from 0.8
      }
      if (isRecent && popularity > 80) {
        volatilityMultiplier *= 1.15; // Reduced from 1.4
      }

      // Weekend/weekday patterns (reduced impact)
      const weekendBoost = weekPhase < 0.286 || weekPhase > 0.714 ? 1.08 : 0.98; // Reduced from 1.15/0.95

      // Calculate final infected count
      const newInfected = Math.round(
        recentAverage *
          baseMultiplier *
          volatilityMultiplier *
          noiseFactor *
          weekendBoost,
      );

      // Calculate other compartments based on model type and infected count
      let newSusceptible, newExposed, newRecovered;

      if (modelType === "SIS") {
        newSusceptible = Math.round(parameters.totalPopulation - newInfected);
        newExposed = undefined;
        newRecovered = undefined;
      } else {
        // SEIR model
        const totalAccounted = newInfected * (2 + dayProgress); // More recovered over time
        newSusceptible = Math.round(
          parameters.totalPopulation - totalAccounted,
        );
        newExposed = Math.round(newInfected * 0.3 * (1 - dayProgress)); // Decreasing exposure over time
        newRecovered = Math.round(
          totalAccounted - newInfected - (newExposed || 0),
        );
      }

      predictions.push({
        date: futureDate.toISOString().split("T")[0],
        susceptible: Math.max(0, newSusceptible),
        exposed: newExposed,
        infected: Math.max(1, newInfected),
        recovered: newRecovered,
        totalPopulation: parameters.totalPopulation,
      });
    }

    // Apply smoothing to prevent extreme day-to-day jumps
    for (let i = 1; i < predictions.length; i++) {
      const prev = predictions[i - 1].infected;
      const curr = predictions[i].infected;
      const maxChange = prev * 0.18; // Maximum 18% change per day (reduced from 40%)

      if (Math.abs(curr - prev) > maxChange) {
        if (curr > prev) {
          predictions[i].infected = Math.round(prev + maxChange);
        } else {
          predictions[i].infected = Math.round(prev - maxChange);
        }
      }
    }

    // Add gentle smoothing to reduce excessive spikes while preserving character
    for (let i = 2; i < predictions.length - 1; i++) {
      const prev = predictions[i - 1].infected;
      const curr = predictions[i].infected;
      const next = predictions[i + 1].infected;
      const average = (prev + curr + next) / 3;

      // Only smooth if current value is an extreme outlier
      if (Math.abs(curr - average) > average * 0.25) {
        predictions[i].infected = Math.round(curr * 0.7 + average * 0.3);
      }
    }

    // Remove the first prediction point to avoid duplication with historical data
    predictions = predictions.slice(1);

    // Analyze insights
    const insights = analyzeInsights(historicalData, predictions, modelType);

    const response: TrendAnalysisResponse = {
      track,
      modelType,
      parameters,
      historicalData: historicalData, // Show all 6 months of historical data
      predictions,
      insights,
    };

    res.json(response);
  } catch (error) {
    console.error("Trend analysis error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
