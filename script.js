const sections = [...document.querySelectorAll("section[id]")];
const navLinks = [...document.querySelectorAll(".nav-links a")];

const setActiveLink = () => {
  const current = sections.reduce((active, section) => {
    const top = section.getBoundingClientRect().top;
    return top <= 120 ? section.id : active;
  }, "home");

  navLinks.forEach((link) => {
    link.classList.toggle("active", link.getAttribute("href") === `#${current}`);
  });
};

setActiveLink();
window.addEventListener("scroll", setActiveLink, { passive: true });

const launchButton = document.getElementById('launch-dashboard');
const refreshButton = document.getElementById('refresh-dashboard');
const updatedTimestamp = document.getElementById('dashboard-updated');
const dashboardContent = document.getElementById('dashboard-content');
const dashboardError = document.getElementById('dashboard-error');
const currentSolarActivity = document.getElementById('current-solar-activity');
const todayFlarePrediction = document.getElementById('today-flare-prediction');
const probabilityGauge = document.getElementById('probability-gauge');
const probabilityLabel = document.getElementById('probability-label');
const predictedFlareClass = document.getElementById('predicted-flare-class');
const aiConfidenceScore = document.getElementById('ai-confidence-score');
const historicalGraph = document.getElementById('historical-graph');
const interactiveCharts = document.getElementById('interactive-charts');
const recentEventsList = document.getElementById('recent-events-list');
const satelliteAlertsList = document.getElementById('satellite-alerts-list');
const alertNotificationsList = document.getElementById('alert-notifications-list');
const riskLegend = document.getElementById('risk-legend');
const lastUpdatedBadge = document.getElementById('last-updated');
const refreshStatus = document.getElementById('refresh-status');
const satelliteDetail = document.getElementById('satellite-detail');
const forecastWindows = document.getElementById('forecast-windows');
const recommendationBox = document.getElementById('recommendation-box');
let loadedParameters = null;
let selectedRiskFilter = null;
let lastPredictionStrength = 42;

const fallbackParameters = [
  'HHH X-pos',
  'HHH y-pos',
  'AAA lo',
  'AAA hi',
  'AAA X-pos',
  'AAA Y-pos',
  'AAA',
  'BBB',
  'CCC',
  'DDD',
  'EEE',
  'FFF',
  'GGG',
  'duration_sec',
  'rise_sec',
  'decay_sec',
  'start_hour',
  'start_weekday',
];

const backendBase = 'http://127.0.0.1:8000';
const autoRefreshIntervalMs = 30000;
let autoRefreshTimer = null;

const buildSampleValue = (feature, index) => {
  const base = feature.length * 3;
  return Math.round(base + index * 2 + 10);
};

const setDashboardError = (message) => {
  if (!dashboardError) return;
  if (!message) {
    dashboardError.classList.add('hidden');
    dashboardError.textContent = '';
    return;
  }
  dashboardError.classList.remove('hidden');
  dashboardError.textContent = message;
};

const SATELLITES = [
  { name: 'GOES-16', orbit: 'GEO', mission: 'Space weather monitoring', source: 'GOES', icon: '☀️', patch: 'G16', location: 'Over Atlantic', altitude: '35,786 km', sector: 'Eastern hemisphere', coord: '5°N, 45°W', mapX: 28, mapY: 42 },
  { name: 'GOES-18', orbit: 'GEO', mission: 'Solar flare early warning', source: 'GOES', icon: '🛰️', patch: 'G18', location: 'Over Pacific', altitude: '35,786 km', sector: 'Western hemisphere', coord: '8°N, 140°W', mapX: 65, mapY: 36 },
  { name: 'NOAA-20', orbit: 'SSO', mission: 'Earth and space weather', source: 'NOAA', icon: '🌍', patch: 'N20', location: 'Crossing South America', altitude: '824 km', sector: 'Polar pass', coord: '10°S, 60°W', mapX: 32, mapY: 72 },
  { name: 'SWARM-A', orbit: 'LEO', mission: 'Magnetosphere research', source: 'ESA/NASA', icon: '⚡', patch: 'A', location: 'Over North Atlantic', altitude: '450 km', sector: 'Low Earth orbit', coord: '45°N, 20°W', mapX: 24, mapY: 40 },
  { name: 'SWARM-B', orbit: 'LEO', mission: 'Magnetosphere research', source: 'ESA/NASA', icon: '🧲', patch: 'B', location: 'Approaching Europe', altitude: '450 km', sector: 'Low Earth orbit', coord: '50°N, 10°E', mapX: 43, mapY: 35 },
  { name: 'SWARM-C', orbit: 'LEO', mission: 'Magnetosphere research', source: 'ESA/NASA', icon: '🛰️', patch: 'C', location: 'South Atlantic anomaly region', altitude: '450 km', sector: 'Low Earth orbit', coord: '30°S, 35°W', mapX: 28, mapY: 66 },
  { name: 'GPS IIF-3', orbit: 'MEO', mission: 'Navigation and timing', source: 'GPS', icon: '🧭', patch: 'IIF', location: 'Above India', altitude: '20,200 km', sector: 'Medium Earth orbit', coord: '20°N, 80°E', mapX: 71, mapY: 44 },
  { name: 'SES-17', orbit: 'GEO', mission: 'Communications services', source: 'SES', icon: '📡', patch: 'S17', location: 'Above Brazil', altitude: '35,786 km', sector: 'Geostationary orbit', coord: '10°S, 45°W', mapX: 28, mapY: 54 },
  { name: 'MetOp-C', orbit: 'SSO', mission: 'Weather & climate data', source: 'EUMETSAT', icon: '☁️', patch: 'M-C', location: 'Over Indian Ocean', altitude: '817 km', sector: 'Sun-synchronous orbit', coord: '15°S, 85°E', mapX: 78, mapY: 64 },
  { name: 'Himawari-8', orbit: 'GEO', mission: 'Asia-Pacific weather imaging', source: 'JMA', icon: '🌦️', patch: 'H8', location: 'Above Japan', altitude: '35,786 km', sector: 'Geostationary orbit', coord: '24°N, 140°E', mapX: 85, mapY: 38 },
  { name: 'COSMIC-2A', orbit: 'LEO', mission: 'Ionospheric sounding', source: 'NOAA/USSF', icon: '🌐', patch: 'C2', location: 'Over East Asia', altitude: '520 km', sector: 'Low Earth orbit', coord: '30°N, 120°E', mapX: 83, mapY: 46 },
  { name: 'Terra', orbit: 'SSO', mission: 'Earth observation', source: 'NASA', icon: '🛰️', patch: 'TR', location: 'Crossing North America', altitude: '705 km', sector: 'Sun-synchronous orbit', coord: '40°N, 100°W', mapX: 16, mapY: 42 },
  { name: 'Aqua', orbit: 'SSO', mission: 'Hydrology monitoring', source: 'NASA', icon: '💧', patch: 'AQ', location: 'Over South Pacific', altitude: '705 km', sector: 'Sun-synchronous orbit', coord: '20°S, 150°W', mapX: 68, mapY: 62 },
  { name: 'Sentinel-6', orbit: 'SSO', mission: 'Sea level measurement', source: 'ESA/NASA', icon: '🌊', patch: 'S6', location: 'Off the coast of Africa', altitude: '800 km', sector: 'Sun-synchronous orbit', coord: '0°N, 20°W', mapX: 35, mapY: 52 },
];

const ORBIT_RISK = {
  GEO: 1.25,
  MEO: 1.0,
  LEO: 0.9,
  SSO: 0.95,
};

const renderSatelliteAlerts = (strength) => {
  if (!satelliteAlertsList) return;

  const strengthPercent = Math.max(0, Math.min(100, Math.round(strength || 0)));
  const liveVibe = Math.max(18, Math.round(strengthPercent * 0.8));

  const rows = SATELLITES.map((sat, index) => {
    const orbitScore = ORBIT_RISK[sat.orbit] || 1.0;
    const dynamicStrength = Math.max(15, Math.min(100, Math.round(strengthPercent * orbitScore + (index % 5) * 3 - (index % 4) * 2)));
    const riskLabel = dynamicStrength >= 90 ? 'Critical' : dynamicStrength >= 70 ? 'High' : dynamicStrength >= 50 ? 'Medium' : 'Low';
    const alertText = riskLabel === 'Critical' ? 'Immediate action' : riskLabel === 'High' ? 'Elevated watch' : riskLabel === 'Medium' ? 'Standby' : 'Normal';
    const statusClass = `status-${riskLabel.toLowerCase()}`;

    if (selectedRiskFilter && selectedRiskFilter !== riskLabel) {
      return null;
    }

    return `
      <article class="satellite-item ${statusClass}" data-sat-index="${index}" data-risk="${riskLabel}">
        <div class="satellite-thumb">
          ${sat.icon}
          <div class="satellite-patch">${sat.patch}</div>
        </div>
        <div class="satellite-copy">
          <strong>${sat.name}</strong>
          <span>${sat.orbit} • ${sat.source}</span>
          <p>${sat.mission}</p>
        </div>
        <div class="satellite-meta">
          <span>${riskLabel}</span>
          <small>${alertText} • ${dynamicStrength}%</small>
        </div>
      </article>
    `;
  });

  const html = rows.filter(Boolean).join('');
  satelliteAlertsList.innerHTML = html || '<div class="no-alerts">No satellites match the selected risk level.</div>';
  bindSatelliteDetailEvents(strengthPercent);
};

const bindSatelliteDetailEvents = (strengthPercent) => {
  if (!satelliteAlertsList || !satelliteDetail) return;
  satelliteAlertsList.querySelectorAll('.satellite-item').forEach((item) => {
    item.addEventListener('click', () => {
      const index = Number(item.dataset.satIndex);
      const sat = SATELLITES[index];
      const orbitScore = ORBIT_RISK[sat.orbit] || 1.0;
      const dynamicStrength = Math.max(15, Math.min(100, Math.round(strengthPercent * orbitScore + (index % 5) * 3 - (index % 4) * 2)));
      const riskLabel = dynamicStrength >= 90 ? 'Critical' : dynamicStrength >= 70 ? 'High' : dynamicStrength >= 50 ? 'Medium' : 'Low';
      const detail = `
        <strong>${sat.name}</strong>
        <p class="satellite-detail-mission">${sat.mission}</p>
        <div class="satellite-location">
          <div class="location-map">
            <div class="location-dot risk-${riskLabel.toLowerCase()}" style="left: ${sat.mapX}%; top: ${sat.mapY}%" aria-hidden="true"></div>
          </div>
          <div class="location-meta">
            <p><strong>Orbit:</strong> ${sat.orbit} (${sat.source})</p>
            <p><strong>Current sector:</strong> ${sat.sector}</p>
            <p><strong>Position:</strong> ${sat.location}</p>
            <p><strong>Coordinates:</strong> ${sat.coord}</p>
            <p><strong>Altitude:</strong> ${sat.altitude}</p>
          </div>
        </div>
        <div class="satellite-risk-detail">
          <p><strong>Risk:</strong> ${riskLabel} — ${dynamicStrength}% likelihood of solar performance impact.</p>
          <p><strong>Why:</strong> ${riskLabel === 'Critical' ? 'Current flare activity is strong enough to disturb this orbit, increasing drag, comms risk, and electronics exposure.' : riskLabel === 'High' ? 'Elevated flux levels may affect payload operations and communications.' : riskLabel === 'Medium' ? 'Solar activity is moderate; operators should monitor telemetry closely.' : 'Conditions are low risk, but routine monitoring is advised.'}</p>
        </div>
      `;
      satelliteDetail.innerHTML = detail;
      satelliteAlertsList.querySelectorAll('.satellite-item').forEach((row) => row.classList.remove('selected'));
      item.classList.add('selected');
    });
  });
};

const renderDashboardOverview = (prediction) => {
  const activityText = 'Moderate flux, 4 active regions, single M-class event detected.';
  const probability = Math.round(Math.min(95, Math.max(35, prediction ? prediction.flare_strength * 0.08 : 58)));
  const confidence = Math.round(Math.min(98, Math.max(62, prediction ? 92 : 75)));
  const flareClass = prediction ? prediction.flare_prefix : 'M';

  if (currentSolarActivity) currentSolarActivity.textContent = activityText;
  if (todayFlarePrediction) todayFlarePrediction.textContent = `Expected ${flareClass}-class flare within 24 hrs`;
  if (probabilityGauge) probabilityGauge.style.width = `${probability}%`;

  const animateNumber = (el, to, ms = 700) => {
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    const delta = to - start;
    const startTime = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - startTime) / ms);
      el.textContent = `${Math.round(start + delta * p)}%`;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  if (probabilityLabel) animateNumber(probabilityLabel, probability);
  if (predictedFlareClass) predictedFlareClass.textContent = flareClass;
  if (aiConfidenceScore) animateNumber(aiConfidenceScore, confidence);
  if (interactiveCharts) {
    interactiveCharts.innerHTML = ['Magnetic flux', 'UV emission', 'Sunspot count']
      .map((label, index) => {
        const value = [72, 58, 44][index];
        return `<div class="mini-chart"><strong>${label}</strong><div class="mini-bar"><span style="width:${value}%"></span></div><small>${value}%</small></div>`;
      })
      .join('');
  }
  if (recentEventsList) {
    recentEventsList.innerHTML = [
      '2026-06-28: M1.8 flare from AR3059',
      '2026-06-27: C4.3 event with minor radio burst',
      '2026-06-26: B9.7 quiet period',
    ]
      .map((event) => `<li>${event}</li>`)
      .join('');
  }
  if (alertNotificationsList) {
    alertNotificationsList.innerHTML = [
      'Yellow alert: Solar wind rising',
      'Geo-risk watch: elevated satellite drag',
      'Notify: expected radio blackout windows',
    ]
      .map((alert) => `<li>${alert}</li>`)
      .join('');
  }

  return probability;
};

const fetchParameters = async () => {
  try {
    const response = await fetch(`${backendBase}/api/features`);
    if (!response.ok) {
      throw new Error('Unable to fetch model features');
    }

    const data = await response.json();
    return Array.isArray(data.features) ? data.features : fallbackParameters;
  } catch (error) {
    console.warn('Falling back to local parameter list:', error);
    return fallbackParameters;
  }
};

const fetchPrediction = async (payload) => {
  try {
    const response = await fetch(`${backendBase}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Prediction request failed');
    }

    return response.json();
  } catch (error) {
    console.error('Prediction failed:', error);
    return null;
  }
};

const buildPredictionPayload = (parameters) => {
  const payload = {};
  parameters.forEach((parameter, index) => {
    payload[parameter] = buildSampleValue(parameter, index);
  });
  return payload;
};

const updateLastRefreshed = () => {
  if (!updatedTimestamp) return;
  const now = new Date();
  updatedTimestamp.textContent = `Last refreshed: ${now.toLocaleString()}`;
  if (lastUpdatedBadge) lastUpdatedBadge.textContent = `Last update: ${now.toLocaleTimeString()}`;
  if (refreshStatus) refreshStatus.textContent = `Auto-refresh active • every ${autoRefreshIntervalMs / 1000}s`;
};

const renderHistoricalChart = (hist, baseline) => {
  if (!historicalGraph) return;

  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const trendData = Array.isArray(hist) && hist.length > 0
    ? hist.slice(0, 7).map((h, index) => ({
        label: h.label || days[index],
        value: Math.max(0, Math.min(100, Math.round(h.predicted_strength || h.predicted_strength || baseline || 18))),
        meta: h.predicted_class || 'N/A',
      }))
    : days.map((label, index) => {
        const variance = (index - 3) * 8 + (index % 2 === 0 ? 6 : -6);
        return {
          label,
          value: Math.max(12, Math.min(94, Math.round((baseline || 48) + variance))),
          meta: 'Simulated',
        };
      });

  const axisLabels = [100, 80, 60, 40, 20, 0];
  const maxValue = Math.max(...trendData.map((item) => item.value), 100);

  historicalGraph.innerHTML = `
    <div class="trend-graph">
      <div class="trend-axis">
        ${axisLabels.map((label) => `<span>${label}</span>`).join('')}
      </div>
      <div class="trend-bars">
        ${trendData
          .map((item) => {
            const height = Math.max(12, Math.round((item.value / maxValue) * 100));
            return `
              <div class="trend-bar">
                <button class="trend-column" type="button" data-value="${item.value}" data-label="${item.label}">
                  <span class="trend-fill" style="height: ${height}%"></span>
                </button>
                <span class="trend-day">${item.label}</span>
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
    <div class="trend-selected" id="trend-selected">Click a bar to inspect value</div>
  `;

  const trendSelected = historicalGraph.querySelector('#trend-selected');
  historicalGraph.querySelectorAll('.trend-column').forEach((bar) => {
    bar.addEventListener('click', () => {
      const value = bar.dataset.value;
      const label = bar.dataset.label;
      if (trendSelected) {
        trendSelected.textContent = `${label}: ${value} predicted strength`;
      }
      historicalGraph.querySelectorAll('.trend-column').forEach((btn) => btn.classList.remove('selected'));
      bar.classList.add('selected');
    });
  });
};

const bindRiskLegendFilters = () => {
  if (!riskLegend) return;
  riskLegend.querySelectorAll('.risk-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const selectedRisk = chip.dataset.risk;
      selectedRiskFilter = selectedRiskFilter === selectedRisk ? null : selectedRisk;
      riskLegend.querySelectorAll('.risk-chip').forEach((item) => {
        item.classList.toggle('selected', item.dataset.risk === selectedRiskFilter);
      });
      renderSatelliteAlerts(lastPredictionStrength);
    });
  });
};

const renderRiskLegend = () => {
  if (!riskLegend) return;

  const legendItems = [
    { label: 'Critical', className: 'risk-chip-critical' },
    { label: 'High', className: 'risk-chip-high' },
    { label: 'Medium', className: 'risk-chip-moderate' },
    { label: 'Low', className: 'risk-chip-low' },
  ];

  riskLegend.innerHTML = legendItems
    .map((item) => `<button type="button" class="risk-chip ${item.className}" data-risk="${item.label}"><span></span>${item.label}</button>`)
    .join('');

  bindRiskLegendFilters();
};

const renderForecastWindow = (probability) => {
  if (!forecastWindows) return;
  if (!recommendationBox) return;

  const windows = [
    { label: '24h', score: probability + 4 },
    { label: '48h', score: Math.max(0, probability - 6) },
    { label: '72h', score: Math.max(0, probability - 12) },
  ];

  forecastWindows.innerHTML = windows
    .map((window) => `
      <div class="forecast-window">
        <strong>${window.label}</strong>
        <span>${window.score}%</span>
        <p>${window.score >= 70 ? 'Elevated risk' : window.score >= 50 ? 'Moderate risk' : 'Lower risk'}</p>
      </div>
    `)
    .join('');

  recommendationBox.innerHTML = probability >= 70
    ? 'Recommended action: reduce satellite operations, ramp up comms monitoring, and schedule sensitive passes outside peak flare periods.'
    : probability >= 50
    ? 'Recommended action: keep operators on alert and verify telemetry, especially for GEO and MEO assets.'
    : 'Recommended action: conditions are relatively stable; maintain normal monitoring cadence.';
};

const renderDashboardData = (prediction, hist) => {
  const probability = renderDashboardOverview(prediction);
  lastPredictionStrength = probability;
  renderSatelliteAlerts(lastPredictionStrength);
  renderHistoricalChart(hist, probability);
  renderRiskLegend();
  renderForecastWindow(probability);
  updateLastRefreshed();
};

const refreshDashboard = async () => {
  setDashboardError('');
  if (dashboardContent) dashboardContent.classList.remove('hidden');
  if (launchButton) launchButton.textContent = 'Dashboard launched';

  const parameters = loadedParameters || (await fetchParameters());
  loadedParameters = parameters;
  const payload = buildPredictionPayload(parameters);

  const [prediction, histResp] = await Promise.allSettled([
    fetchPrediction(payload),
    fetch(`${backendBase}/api/historical`),
  ]);

  let histData = null;
  if (histResp.status === 'fulfilled' && histResp.value.ok) {
    histData = await histResp.value.json();
  }

  if (prediction.status === 'fulfilled' && prediction.value) {
    renderDashboardData(prediction.value, histData);
  } else if (histData) {
    renderDashboardData(null, histData);
  } else {
    setDashboardError('Unable to refresh NASA predictions and model overview right now.');
    renderDashboardOverview(null);
  }
};

const startAutoRefresh = () => {
  if (refreshStatus) refreshStatus.textContent = `Auto-refresh starting...`;
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
  }
  autoRefreshTimer = setInterval(refreshDashboard, autoRefreshIntervalMs);
};

const stopAutoRefresh = () => {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }
};

if (launchButton && dashboardContent) {
  launchButton.addEventListener('click', () => {
    refreshDashboard();
    startAutoRefresh();
  });
}

if (refreshButton) {
  refreshButton.addEventListener('click', () => {
    refreshDashboard();
    startAutoRefresh();
  });
}
