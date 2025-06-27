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
  track?: MusicTrack,
): TrendDataPoint[] {
  const { beta, gamma, sigma = 0.1, initialInfected, totalPopulation } = params;

  // Determine song characteristics for proper initialization
  const currentYear = new Date().getFullYear();
  const age = currentYear - (track?.releaseYear || currentYear);
  const isNewSong = age <= 1;
  const isRecentTrend = age <= 2;
  const popularity = (track?.popularity || 50) / 100;

  // Initialize compartments based on song characteristics
  let S, E, I, R;

  if (isNewSong && popularity > 0.6) {
    // New trendy songs: High exposure and active listeners, minimal lost interest
    I = initialInfected * 1.5; // High active listening
    E = initialInfected * 0.8; // High exposure (people hearing about it)
    R = Math.floor(totalPopulation * 0.01); // Very few have lost interest yet
    S = totalPopulation - I - E - R;
  } else if (isRecentTrend && popularity > 0.4) {
    // Recent songs: Good activity, growing exposure
    I = initialInfected * 1.2;
    E = initialInfected * 0.6;
    R = Math.floor(totalPopulation * 0.05); // Some initial churn
    S = totalPopulation - I - E - R;
  } else if (age > 10) {
    // Older songs: Lower active listening, higher recovered (people who used to listen)
    I = initialInfected * 0.7;
    E = initialInfected * 0.3;
    R = Math.floor(totalPopulation * 0.2); // Many have already cycled through
    S = totalPopulation - I - E - R;
  } else {
    // Standard initialization for other songs
    I = initialInfected;
    E = Math.floor(initialInfected * 0.4);
    R = Math.floor(totalPopulation * 0.08);
    S = totalPopulation - I - E - R;
  }

  // Ensure values are within bounds
  S = Math.max(0, S);
  E = Math.max(0, E);
  I = Math.max(1, I);
  R = Math.max(0, R);

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
  const currentYear = new Date().getFullYear();
  const age = currentYear - (track.releaseYear || currentYear);
  const isViral =
    track.genre?.includes("Pop") || track.genre?.includes("Alternative");
  const isClassic = age > 20;
  const isRecent = age <= 2; // More strict definition of "new"
  const isNew = age <= 1; // Brand new songs

  // More varied parameters based on track characteristics
  let baseBeta, baseGamma;

  // Different behavior for different song types with better new song handling
  if (isNew) {
    // Brand new songs: high growth potential, very low decline rate
    baseBeta = 0.3 + popularity * 0.4 + seededRandom(trackSeed) * 0.2;
    baseGamma = 0.01 + seededRandom(trackSeed + 1) * 0.02; // Much slower decline
  } else if (isRecent && isViral) {
    // Recent viral songs: high initial spread, moderate decline
    baseBeta = 0.35 + seededRandom(trackSeed) * 0.2;
    baseGamma = 0.04 + seededRandom(trackSeed + 1) * 0.03;
  } else if (isClassic) {
    // Classic songs: stable, recurring popularity
    baseBeta = 0.15 + seededRandom(trackSeed) * 0.1;
    baseGamma = 0.02 + seededRandom(trackSeed + 1) * 0.02;
  } else if (isViral) {
    // Viral songs: moderate spread, cyclical
    baseBeta = 0.25 + seededRandom(trackSeed) * 0.15;
    baseGamma = 0.04 + seededRandom(trackSeed + 1) * 0.03;
  } else {
    // Regular songs: slower spread, steady
    baseBeta = 0.1 + seededRandom(trackSeed) * 0.08;
    baseGamma = 0.03 + seededRandom(trackSeed + 1) * 0.02;
  }

  // Adjust for popularity
  baseBeta *= 0.6 + popularity * 0.4;

  const totalPopulation =
    5000000 + Math.floor(seededRandom(trackSeed + 2) * 5000000); // 5-10M

  // Calculate initial infected based on song characteristics
  let baseInitialInfected;
  if (isNew && popularity > 0.6) {
    // New trendy songs get a big boost in initial listeners
    baseInitialInfected = popularity * 80000 + 50000; // Higher base for trending new songs
  } else if (isRecent && popularity > 0.4) {
    // Recent popular songs get moderate boost
    baseInitialInfected = popularity * 60000 + 30000;
  } else if (isClassic && popularity > 0.5) {
    // Classic songs have steady baseline
    baseInitialInfected = popularity * 50000 + 20000;
  } else {
    // Regular songs
    baseInitialInfected = popularity * 40000 + 15000;
  }

  const initialInfected = Math.floor(
    baseInitialInfected + seededRandom(trackSeed + 3) * 30000,
  ); // Add some variation

  if (modelType === "SIS") {
    return {
      beta: Math.max(0.001, Math.min(0.7, baseBeta)),
      gamma: Math.max(0.005, Math.min(0.12, baseGamma)),
      initialInfected,
      totalPopulation,
    };
  } else {
    // For SEIR, adjust gamma to be lower for new songs
    const adjustedGamma = isNew ? baseGamma * 0.5 : baseGamma;

    return {
      beta: Math.max(0.001, Math.min(0.8, baseBeta * 1.2)),
      gamma: Math.max(0.005, Math.min(0.1, adjustedGamma * 0.8)),
      sigma: Math.max(
        0.02,
        Math.min(
          0.3,
          0.08 + popularity * 0.2 + seededRandom(trackSeed + 4) * 0.1,
        ),
      ),
      initialInfected,
      totalPopulation,
    };
  }
}

// Helper functions for data-driven analysis
function calculateVolatility(data: TrendDataPoint[]): number {
  if (data.length < 2) return 0;

  const values = data.map((d) => d.infected);
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;

  return Math.sqrt(variance) / mean; // coefficient of variation
}

function calculateWeeklyPattern(data: TrendDataPoint[]): number[] {
  const weeklyAvg = Array(7).fill(0);
  const weeklyCounts = Array(7).fill(0);

  data.forEach((point) => {
    const dayOfWeek = new Date(point.date).getDay();
    weeklyAvg[dayOfWeek] += point.infected;
    weeklyCounts[dayOfWeek]++;
  });

  // Calculate averages and normalize
  for (let i = 0; i < 7; i++) {
    weeklyAvg[i] = weeklyCounts[i] > 0 ? weeklyAvg[i] / weeklyCounts[i] : 1;
  }

  const overallAvg = weeklyAvg.reduce((sum, val) => sum + val, 0) / 7;
  return weeklyAvg.map((val) => val / overallAvg); // normalize to 1.0 average
}

function calculateMomentum(data: TrendDataPoint[]): number {
  if (data.length < 4) return 1;

  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));

  const firstAvg =
    firstHalf.reduce((sum, p) => sum + p.infected, 0) / firstHalf.length;
  const secondAvg =
    secondHalf.reduce((sum, p) => sum + p.infected, 0) / secondHalf.length;

  return secondAvg / firstAvg; // momentum factor
}

function generateCreatorRecommendation(
  currentTrend: "rising" | "declining" | "stable",
  futureOutlook: string,
  growthPotential: number,
  momentum: number,
  genres?: string[],
) {
  let action: "use_now" | "wait_and_see" | "safe_choice" | "avoid";
  let timing: "perfect" | "good" | "okay" | "poor";
  let confidence: number;
  let platforms: string[] = [];

  // Determine optimal platforms based on genre
  if (genres) {
    if (
      genres.includes("Pop") ||
      genres.includes("Alternative") ||
      genres.includes("Electronic")
    ) {
      platforms = ["TikTok", "Instagram Reels", "YouTube Shorts"];
    } else if (genres.includes("Hip-Hop") || genres.includes("Rap")) {
      platforms = ["TikTok", "YouTube", "Instagram"];
    } else if (genres.includes("Rock") || genres.includes("Indie")) {
      platforms = ["YouTube", "Instagram", "TikTok"];
    } else if (genres.includes("R&B") || genres.includes("Soul")) {
      platforms = ["Instagram", "TikTok", "YouTube"];
    } else {
      platforms = ["Instagram", "YouTube", "TikTok"];
    }
  } else {
    platforms = ["TikTok", "Instagram", "YouTube"];
  }

  // Determine action and timing based on trends and outlook
  if (
    currentTrend === "rising" &&
    (futureOutlook === "viral_potential" ||
      futureOutlook === "explosive_growth")
  ) {
    action = "use_now";
    timing = "perfect";
    confidence = 90 + Math.floor(Math.random() * 10);
  } else if (
    currentTrend === "rising" &&
    futureOutlook === "sustained_momentum"
  ) {
    action = "use_now";
    timing = "perfect";
    confidence = 85 + Math.floor(Math.random() * 10);
  } else if (currentTrend === "stable" && growthPotential > 1.3) {
    action = "use_now";
    timing = "good";
    confidence = 75 + Math.floor(Math.random() * 15);
  } else if (
    currentTrend === "declining" &&
    futureOutlook === "comeback_likely"
  ) {
    action = "wait_and_see";
    timing = "okay";
    confidence = 60 + Math.floor(Math.random() * 20);
  } else if (currentTrend === "stable" && futureOutlook === "stable_niche") {
    action = "safe_choice";
    timing = "good";
    confidence = 70 + Math.floor(Math.random() * 15);
  } else if (
    currentTrend === "declining" &&
    futureOutlook === "steady_decline"
  ) {
    action = "wait_and_see";
    timing = "poor";
    confidence = 40 + Math.floor(Math.random() * 20);
  } else {
    action = "safe_choice";
    timing = "okay";
    confidence = 65 + Math.floor(Math.random() * 20);
  }

  return {
    action,
    timing,
    platforms,
    confidence,
  };
}

function analyzeInsights(
  data: TrendDataPoint[],
  predictions: TrendDataPoint[],
  modelType: "SIS" | "SEIR",
  track?: MusicTrack,
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
        track,
      );
    }

    // Generate data-driven future predictions based on historical patterns
    let predictions: TrendDataPoint[] = [];

    // Analyze historical data trends
    const recentDays = 14; // Analyze last 2 weeks
    const recentData = historicalData.slice(-recentDays);
    const currentListeners =
      historicalData[historicalData.length - 1]?.infected ||
      parameters.initialInfected;

    // Calculate trend metrics from actual data
    const trendSlope =
      recentData.length > 1
        ? (recentData[recentData.length - 1].infected -
            recentData[0].infected) /
          recentData.length
        : 0;

    const recentAverage =
      recentData.reduce((sum, point) => sum + point.infected, 0) /
      recentData.length;
    const recentVolatility = calculateVolatility(recentData);
    const weeklyPattern = calculateWeeklyPattern(historicalData);

    // Determine natural trajectory based on actual data
    const naturalGrowthRate = trendSlope / recentAverage; // percentage change per day
    const momentumFactor = calculateMomentum(recentData);

    // Data-driven prediction generation
    predictions = [];

    console.log(`Generating data-driven predictions for ${track.title}`);
    console.log(
      `Current trend: slope=${trendSlope.toFixed(2)}, growth=${(naturalGrowthRate * 100).toFixed(2)}% per day`,
    );

    for (let day = 1; day <= predictionDays; day++) {
      const futureDate = new Date(currentDate);
      futureDate.setDate(futureDate.getDate() + day);

      // Calculate trend continuation with natural decay
      const dayProgress = day / predictionDays;
      const trendDecay = Math.exp(-dayProgress * 0.5); // trends naturally decay over time
      const currentTrendEffect = naturalGrowthRate * trendDecay;

      // Apply weekly pattern
      const dayOfWeek = futureDate.getDay();
      const weeklyMultiplier = weeklyPattern[dayOfWeek] || 1;

      // Add momentum effects
      const momentumEffect =
        (momentumFactor - 1) * Math.exp(-dayProgress * 0.8);

      // Natural volatility based on historical data
      const noiseFactor = 1 + (Math.random() - 0.5) * recentVolatility * 0.5;

      // Calculate base infected count with boost for new trendy songs
      let baseInfected = currentListeners;

      const age =
        new Date().getFullYear() -
        (track.releaseYear || new Date().getFullYear());
      const isNewTrendySong = age <= 1 && track.popularity > 60;

      // Apply trend effect
      baseInfected *= 1 + currentTrendEffect * day;

      // Apply momentum
      baseInfected *= 1 + momentumEffect;

      // Apply extra boost for new trendy songs in the near term
      if (isNewTrendySong && day <= 21) {
        const trendyBoost = 1.05 - day * 0.002; // Slight boost that gradually reduces
        baseInfected *= trendyBoost;
      }

      // Apply weekly pattern and noise
      const newInfected = Math.round(
        baseInfected * weeklyMultiplier * noiseFactor,
      );

      // Calculate other compartments following proper SEIR flow and historical trends
      let newSusceptible, newExposed, newRecovered;

      if (modelType === "SIS") {
        newSusceptible = Math.round(parameters.totalPopulation - newInfected);
        newExposed = undefined;
        newRecovered = undefined;
      } else {
        // SEIR model - follow historical trends for each compartment
        const lastHistorical = historicalData[historicalData.length - 1];
        const prevHistorical =
          historicalData[historicalData.length - 2] || lastHistorical;

        // Calculate historical trends for each compartment
        const susceptibleTrend =
          (lastHistorical.susceptible - prevHistorical.susceptible) /
          Math.max(prevHistorical.susceptible, 1);
        const exposedTrend =
          ((lastHistorical.exposed || 0) - (prevHistorical.exposed || 0)) /
          Math.max(prevHistorical.exposed || 1, 1);
        const recoveredTrend =
          ((lastHistorical.recovered || 0) - (prevHistorical.recovered || 0)) /
          Math.max(prevHistorical.recovered || 1, 1);

        // Apply trends with natural decay
        const trendDecayFactor = Math.exp(-day * 0.1); // trends decay over time

        // Calculate exposed following its historical trend, with boost for new songs
        const baseExposed = lastHistorical.exposed || 0;
        const age =
          new Date().getFullYear() -
          (track.releaseYear || new Date().getFullYear());
        const isNewTrendySong = age <= 1 && track.popularity > 60;

        if (isNewTrendySong && day <= 14) {
          // New trendy songs maintain high exposure in near term
          const exposureBoost = 1.1 - day * 0.005; // Gradual decay
          newExposed = Math.round(
            Math.max(baseExposed * 0.8, baseExposed * exposureBoost),
          );
        } else {
          newExposed = Math.round(
            Math.max(0, baseExposed * (1 + exposedTrend * trendDecayFactor)),
          );
        }

        // Calculate recovered following proper SEIR logic with song age consideration
        const baseRecovered = lastHistorical.recovered || 0;
        const age =
          new Date().getFullYear() -
          (track.releaseYear || new Date().getFullYear());
        const isNewSong = age <= 1;

        // Recovered should increase when infected decreases (conservation of flow)
        const infectedChange = newInfected - lastHistorical.infected;
        let recoveredChange = 0;

        if (infectedChange < 0) {
          // If infected is decreasing, recovered should increase (people lose interest)
          // But for new songs, fewer people "lose interest" - they just haven't discovered it yet
          const recoveryRate = isNewSong ? 0.3 : 0.7; // New songs retain interest better
          recoveredChange = Math.abs(infectedChange) * recoveryRate;
        } else {
          // If infected is increasing, recovered grows very slowly for new songs
          const growthRate = isNewSong ? 0.005 : 0.02; // Much slower for new songs
          recoveredChange = baseRecovered * growthRate;
        }

        newRecovered = Math.round(Math.max(0, baseRecovered + recoveredChange));

        // Calculate susceptible to maintain population conservation
        // S + E + I + R = Total Population
        newSusceptible = Math.round(
          parameters.totalPopulation - newExposed - newInfected - newRecovered,
        );
        newSusceptible = Math.max(0, newSusceptible); // Can't be negative

        // If susceptible would be too low, adjust recovered downward
        if (newSusceptible < parameters.totalPopulation * 0.1) {
          // Minimum 10% susceptible
          const adjustment = parameters.totalPopulation * 0.1 - newSusceptible;
          newRecovered = Math.max(0, newRecovered - adjustment);
          newSusceptible = Math.round(
            parameters.totalPopulation -
              newExposed -
              newInfected -
              newRecovered,
          );
        }
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

    // Simple smoothing to prevent unrealistic day-to-day jumps
    for (let i = 1; i < predictions.length; i++) {
      const prev = predictions[i - 1].infected;
      const curr = predictions[i].infected;

      // Limit to 20% max change per day based on data trends
      const maxChangePercent = 0.2;
      const maxChange = prev * maxChangePercent;

      // Only smooth extreme jumps that don't match data patterns
      if (Math.abs(curr - prev) > maxChange) {
        const direction = curr > prev ? 1 : -1;
        predictions[i].infected = Math.round(prev + maxChange * direction);

        // Recalculate other compartments after smoothing to maintain SEIR flow
        const smoothedInfected = predictions[i].infected;
        const originalInfected = curr;
        const infectedDiff = smoothedInfected - originalInfected;

        if (modelType === "SIS") {
          predictions[i].susceptible = Math.round(
            parameters.totalPopulation - smoothedInfected,
          );
        } else {
          // Adjust other compartments proportionally to maintain conservation
          const originalExposed = predictions[i].exposed || 0;
          const originalRecovered = predictions[i].recovered || 0;

          // If we reduced infected, add the difference to recovered (people lost interest)
          if (infectedDiff < 0) {
            predictions[i].recovered = Math.round(
              originalRecovered + Math.abs(infectedDiff) * 0.7,
            );
            predictions[i].exposed = Math.round(originalExposed * 0.9); // slight reduction in exposed
          } else {
            // If we increased infected, it came from exposed
            predictions[i].exposed = Math.round(
              Math.max(0, originalExposed - infectedDiff * 0.5),
            );
            predictions[i].recovered = originalRecovered; // keep recovered same
          }

          // Recalculate susceptible to maintain total population
          const totalAccounted =
            smoothedInfected +
            (predictions[i].exposed || 0) +
            (predictions[i].recovered || 0);
          predictions[i].susceptible = Math.round(
            parameters.totalPopulation - totalAccounted,
          );
        }
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
    const insights = analyzeInsights(
      historicalData,
      predictions,
      modelType,
      track,
    );

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
