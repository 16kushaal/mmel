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

  // Enhanced future trend analysis
  const currentListeners = data[data.length - 1]?.infected || 0;
  const futureEnd =
    predictions[predictions.length - 1]?.infected || currentListeners;
  const futureMax = Math.max(...predictions.map((p) => p.infected));
  const futureMin = Math.min(...predictions.map((p) => p.infected));
  const futureAverage =
    predictions.reduce((sum, p) => sum + p.infected, 0) / predictions.length;

  // Calculate trend metrics
  const growthPotential = futureMax / currentListeners;
  const volatilityFactor = (futureMax - futureMin) / futureAverage;
  const endTrend = futureEnd / currentListeners;
  const overallTrend = futureAverage / currentListeners;

  // Analyze trend momentum (first vs second half of predictions)
  const firstHalf = predictions.slice(0, Math.floor(predictions.length / 2));
  const secondHalf = predictions.slice(Math.floor(predictions.length / 2));
  const firstHalfAvg =
    firstHalf.reduce((sum, p) => sum + p.infected, 0) / firstHalf.length;
  const secondHalfAvg =
    secondHalf.reduce((sum, p) => sum + p.infected, 0) / secondHalf.length;
  const momentum = secondHalfAvg / firstHalfAvg;

  let futureOutlook:
    | "viral_potential"
    | "steady_decline"
    | "comeback_likely"
    | "stable_niche"
    | "explosive_growth"
    | "sustained_momentum";

  // Enhanced outlook analysis with more nuanced categories
  if (growthPotential > 2.5 && volatilityFactor > 0.8) {
    futureOutlook = "explosive_growth";
  } else if (growthPotential > 1.6 && momentum > 1.1) {
    futureOutlook = "viral_potential";
  } else if (overallTrend > 1.2 && momentum > 0.95) {
    futureOutlook = "sustained_momentum";
  } else if (endTrend < 0.8 && momentum < 0.9 && growthPotential < 1.1) {
    futureOutlook = "steady_decline";
  } else if (volatilityFactor > 0.4 && futureMax > currentListeners * 1.4) {
    futureOutlook = "comeback_likely";
  } else {
    futureOutlook = "stable_niche";
  }

  // Generate content creator recommendations
  const track = data[0]; // Get track info from context if available
  const creatorRecommendation = generateCreatorRecommendation(
    currentTrend,
    futureOutlook,
    growthPotential,
    momentum,
    track?.genre,
  );

  return {
    peakDate,
    peakListeners,
    currentTrend,
    futureOutlook,
    creatorRecommendation,
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

    // Enhanced prediction scenarios with better music-specific modeling
    const scenarios = [
      "viral_breakthrough",
      "organic_growth",
      "cyclical_waves",
      "steady_momentum",
      "discovery_surge",
      "playlist_boost",
      "social_media_viral",
      "algorithm_pick",
      "comeback_story",
      "underground_rise",
    ];

    // Weight scenarios based on song characteristics
    let scenarioWeights = {
      viral_breakthrough: isRecent && popularity > 70 ? 0.25 : 0.05,
      organic_growth: isClassic || popularity > 60 ? 0.2 : 0.15,
      cyclical_waves: isClassic ? 0.25 : 0.1,
      steady_momentum: popularity > 50 ? 0.2 : 0.15,
      discovery_surge: isRecent ? 0.15 : 0.05,
      playlist_boost: isViral ? 0.2 : 0.1,
      social_media_viral: isRecent && isViral ? 0.3 : 0.08,
      algorithm_pick: popularity < 50 ? 0.15 : 0.05,
      comeback_story: age > 10 && age < 30 ? 0.2 : 0.02,
      underground_rise: popularity < 40 ? 0.15 : 0.02,
    };

    // Normalize weights
    const totalWeight = Object.values(scenarioWeights).reduce(
      (a, b) => a + b,
      0,
    );
    Object.keys(scenarioWeights).forEach((key) => {
      scenarioWeights[key as keyof typeof scenarioWeights] /= totalWeight;
    });

    // Select scenario based on weighted probability
    const random = seededRandom(trackSeed);
    let cumulative = 0;
    let selectedScenario = "steady_momentum";

    for (const [scenario, weight] of Object.entries(scenarioWeights)) {
      cumulative += weight;
      if (random <= cumulative) {
        selectedScenario = scenario;
        break;
      }
    }

    console.log(`Selected scenario for ${track.title}: ${selectedScenario}`);

    // Create prediction data points with enhanced modeling
    predictions = [];

    for (let day = 1; day <= predictionDays; day++) {
      const futureDate = new Date(currentDate);
      futureDate.setDate(futureDate.getDate() + day);

      const dayProgress = day / predictionDays;
      const weekPhase = (day % 7) / 7;
      const randomSeed = trackSeed + day * 13;
      const dailyRandom = seededRandom(randomSeed);
      const noiseFactor = 0.95 + dailyRandom * 0.1; // ±5% daily variation

      let baseMultiplier = 1;
      let volatilityMultiplier = 1;
      let trendDirection = 1; // 1 for growth, -1 for decline

      // Apply enhanced scenario-specific patterns
      switch (selectedScenario) {
        case "viral_breakthrough":
          // Exponential growth that levels off
          const viralPeak = 0.6; // Peak at 60% through prediction period
          if (dayProgress < viralPeak) {
            baseMultiplier =
              1 + (dayProgress / viralPeak) * 3.5 * Math.exp(-dayProgress * 2);
          } else {
            baseMultiplier = 1 + 2.8 * Math.exp(-(dayProgress - viralPeak) * 4);
          }
          volatilityMultiplier = 1.3;
          trendDirection = dayProgress < viralPeak ? 1 : 0.5;
          break;

        case "organic_growth":
          // Steady upward trend with minor fluctuations
          baseMultiplier =
            1 + dayProgress * 0.8 + Math.sin(dayProgress * 4 * Math.PI) * 0.1;
          volatilityMultiplier = 1.1;
          trendDirection = 1;
          break;

        case "cyclical_waves":
          // Multiple cycles of growth and decline
          baseMultiplier =
            1 +
            Math.sin(dayProgress * 6 * Math.PI) * 0.4 +
            Math.sin(dayProgress * 2 * Math.PI) * 0.2;
          volatilityMultiplier = 1.15;
          trendDirection = Math.sin(dayProgress * 6 * Math.PI) > 0 ? 1 : 0.8;
          break;

        case "steady_momentum":
          // Consistent growth with weekend spikes
          baseMultiplier =
            1 + dayProgress * 0.3 + Math.sin(dayProgress * 8 * Math.PI) * 0.05;
          volatilityMultiplier = 1.05;
          trendDirection = 1;
          break;

        case "discovery_surge":
          // Sudden spike in the middle of prediction period
          const surgePeak = 0.4 + seededRandom(trackSeed + 100) * 0.3;
          const surgeIntensity = Math.exp(
            -Math.pow((dayProgress - surgePeak) / 0.15, 2),
          );
          baseMultiplier = 1 + surgeIntensity * 2.2 + dayProgress * 0.2;
          volatilityMultiplier = 1.2;
          trendDirection = 1;
          break;

        case "playlist_boost":
          // Multiple smaller boosts throughout period
          let playlistMultiplier = 1;
          if (day % 7 === 3 || day % 7 === 6) {
            // Wednesday and Saturday boosts
            playlistMultiplier = 1.4;
          }
          baseMultiplier =
            1 + dayProgress * 0.5 + Math.sin(dayProgress * 10 * Math.PI) * 0.15;
          baseMultiplier *= playlistMultiplier;
          volatilityMultiplier = 1.25;
          trendDirection = 1;
          break;

        case "social_media_viral":
          // Sharp spike early, then gradual decline with mini-resurgences
          if (dayProgress < 0.3) {
            baseMultiplier = 1 + (dayProgress / 0.3) * 4.2;
          } else {
            baseMultiplier =
              1 +
              3.8 * Math.exp(-(dayProgress - 0.3) * 3) +
              Math.sin(dayProgress * 8 * Math.PI) * 0.3;
          }
          volatilityMultiplier = 1.4;
          trendDirection = dayProgress < 0.3 ? 1 : 0.7;
          break;

        case "algorithm_pick":
          // Gradual build-up to significant growth
          const algorithmKick = 0.5;
          if (dayProgress < algorithmKick) {
            baseMultiplier = 1 + dayProgress * 0.3;
          } else {
            baseMultiplier = 1 + 0.15 + (dayProgress - algorithmKick) * 1.8;
          }
          volatilityMultiplier = 1.1;
          trendDirection = 1;
          break;

        case "comeback_story":
          // Slow start, then accelerating growth
          baseMultiplier =
            1 +
            Math.pow(dayProgress, 1.8) * 1.5 +
            Math.sin(dayProgress * 3 * Math.PI) * 0.2;
          volatilityMultiplier = 1.2;
          trendDirection = 1;
          break;

        case "underground_rise":
          // Steady, consistent growth with increasing momentum
          baseMultiplier =
            1 +
            dayProgress * 1.2 * (1 + dayProgress * 0.8) +
            Math.sin(dayProgress * 5 * Math.PI) * 0.1;
          volatilityMultiplier = 1.15;
          trendDirection = 1;
          break;
      }

      // Add genre and popularity modifiers
      if (isViral && selectedScenario !== "steady_momentum") {
        volatilityMultiplier *= 1.15;
        baseMultiplier *= 1.1;
      }

      if (isClassic) {
        // Classics have more stable, predictable patterns
        volatilityMultiplier *= 0.85;
        baseMultiplier = (baseMultiplier + 1) / 2; // Reduce extremes
      }

      if (isRecent && popularity > 80) {
        // Recent popular songs have more potential for viral moments
        volatilityMultiplier *= 1.2;
        if (dailyRandom > 0.85) {
          // 15% chance of mini viral moment
          baseMultiplier *= 1.5;
        }
      }

      // Enhanced weekend/weekday patterns
      const isWeekend = futureDate.getDay() === 0 || futureDate.getDay() === 6;
      const isFriday = futureDate.getDay() === 5;
      let timeMultiplier = 1;

      if (isWeekend) {
        timeMultiplier = 1.15; // Weekend boost
      } else if (isFriday) {
        timeMultiplier = 1.08; // Friday boost
      } else {
        timeMultiplier = 0.96; // Weekday reduction
      }

      // Add momentum effects - trending songs gain more momentum
      let momentumMultiplier = 1;
      if (day > 3) {
        const recentGrowth =
          predictions.slice(-3).reduce((sum, p, i) => {
            if (i === 0) return sum;
            return (
              sum +
              (p.infected - predictions[predictions.length - 4 + i].infected)
            );
          }, 0) / 3;

        if (recentGrowth > 0) {
          momentumMultiplier =
            1 + Math.min((recentGrowth / recentAverage) * 0.1, 0.2);
        }
      }

      // Calculate final infected count with improved formula
      const newInfected = Math.round(
        recentAverage *
          baseMultiplier *
          volatilityMultiplier *
          noiseFactor *
          timeMultiplier *
          momentumMultiplier,
      );

      // Calculate other compartments for SEIR model with more realistic distributions
      let newSusceptible, newExposed, newRecovered;

      if (modelType === "SIS") {
        newSusceptible = Math.round(parameters.totalPopulation - newInfected);
        newExposed = undefined;
        newRecovered = undefined;
      } else {
        // Enhanced SEIR model calculations
        const infectedRatio = newInfected / parameters.totalPopulation;

        // Exposed population varies based on viral potential and current trends
        const exposureRate =
          0.2 + (popularity / 100) * 0.3 + (trendDirection > 0.9 ? 0.2 : 0);
        newExposed = Math.round(
          newInfected * exposureRate * (1 - dayProgress * 0.3),
        );

        // Recovered population grows more slowly for viral/trending content
        const recoverySlowdown =
          selectedScenario.includes("viral") ||
          selectedScenario.includes("surge")
            ? 0.7
            : 1;
        const baseRecovered = Math.round(
          newInfected * (0.5 + dayProgress * 1.5) * recoverySlowdown,
        );
        newRecovered = Math.max(0, baseRecovered);

        // Adjust susceptible population
        const totalKnown = newInfected + (newExposed || 0) + newRecovered;
        newSusceptible = Math.round(parameters.totalPopulation - totalKnown);
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

    // Enhanced smoothing that preserves intentional patterns while preventing unrealistic jumps
    for (let i = 1; i < predictions.length; i++) {
      const prev = predictions[i - 1].infected;
      const curr = predictions[i].infected;

      // Dynamic max change based on current trend and scenario
      let maxChangePercent = 0.25; // Base 25% max change

      // Allow larger changes for viral scenarios
      if (
        selectedScenario.includes("viral") ||
        selectedScenario.includes("surge")
      ) {
        maxChangePercent = 0.4; // 40% for viral content
      } else if (
        selectedScenario.includes("growth") ||
        selectedScenario.includes("boost")
      ) {
        maxChangePercent = 0.3; // 30% for growth scenarios
      }

      const maxChange = prev * maxChangePercent;

      // Only limit extremely unrealistic jumps
      if (Math.abs(curr - prev) > maxChange) {
        // Preserve direction but limit magnitude
        const direction = curr > prev ? 1 : -1;
        predictions[i].infected = Math.round(prev + maxChange * direction);
      }
    }

    // Preserve pattern integrity - only smooth extreme outliers
    for (let i = 2; i < predictions.length - 1; i++) {
      const prev = predictions[i - 1].infected;
      const curr = predictions[i].infected;
      const next = predictions[i + 1].infected;

      // Calculate local trend
      const localTrend = (next - prev) / 2;
      const expectedValue = prev + localTrend;

      // Only smooth if the current value is a severe outlier (>50% off expected)
      if (
        Math.abs(curr - expectedValue) > expectedValue * 0.5 &&
        expectedValue > 0
      ) {
        // Light smoothing that preserves 80% of original character
        predictions[i].infected = Math.round(curr * 0.8 + expectedValue * 0.2);
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
