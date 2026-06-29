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
const alertNotificationsList = document.getElementById('alert-notifications-list');
let loadedParameters = null;

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

const renderDashboardOverview = (prediction) => {
  const activityText = 'Moderate flux, 4 active regions, single M-class event detected.';
  const probability = Math.round(Math.min(95, Math.max(35, prediction ? prediction.flare_strength * 0.08 : 58)));
  const confidence = Math.round(Math.min(98, Math.max(62, prediction ? 92 : 75)));
  const flareClass = prediction ? prediction.flare_prefix : 'M';

  if (currentSolarActivity) currentSolarActivity.textContent = activityText;
  if (todayFlarePrediction) todayFlarePrediction.textContent = `Expected ${flareClass}-class flare within 24 hrs`;
  if (probabilityGauge) probabilityGauge.style.width = `${probability}%`;
  if (probabilityLabel) probabilityLabel.textContent = `${probability}%`;
  if (predictedFlareClass) predictedFlareClass.textContent = flareClass;
  if (aiConfidenceScore) aiConfidenceScore.textContent = `${confidence}%`;
  if (historicalGraph) {
    // show the same reading for all days (use dashboard probability for a consistent metric)
    const barHeight = probability; // percentage value computed above
    historicalGraph.innerHTML = [...Array(7).keys()]
      .map((day) => {
        return `<div class="trend-bar"><span>${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][day]}</span><div class="trend-fill" style="height:${barHeight}%"></div></div>`;
      })
      .join('');
  }
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

if (launchButton && dashboardContent) {
  launchButton.addEventListener('click', async () => {
    setDashboardError('');
    dashboardContent.classList.remove('hidden');
    launchButton.textContent = 'Dashboard launched';

    // try to get a live prediction for dashboard overview
    const parameters = loadedParameters || (await fetchParameters());
    loadedParameters = parameters;
    const payload = buildPredictionPayload(parameters);
    const prediction = await fetchPrediction(payload);

    if (!prediction) {
      setDashboardError('Backend prediction unavailable. Showing dashboard overview with static solar metrics.');
      renderDashboardOverview(null);
      return;
    }

    renderDashboardOverview(prediction);
  });
}
