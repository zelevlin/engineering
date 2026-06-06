const state = window.dashboardState || {};

function firstHistogram() {
  const histograms = state.analysis?.histograms || {};
  const [name, data] = Object.entries(histograms)[0] || [];
  return name ? { name, data } : null;
}

const histogram = firstHistogram();
if (histogram) {
  new Chart(document.getElementById("histogramChart"), {
    type: "bar",
    data: {
      labels: histogram.data.labels,
      datasets: [
        {
          label: histogram.name,
          data: histogram.data.counts,
          backgroundColor: "#2563eb",
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { maxRotation: 45, minRotation: 45 } } },
    },
  });
}

const correlation = state.analysis?.correlation || [];
if (correlation.length) {
  const labels = [...new Set(correlation.map((item) => item.x))];
  const matrix = labels.map((row) =>
    labels.map((column) => {
      const point = correlation.find((item) => item.x === row && item.y === column);
      return point ? point.value : 0;
    }),
  );

  new Chart(document.getElementById("correlationChart"), {
    type: "bar",
    data: {
      labels,
      datasets: labels.map((column, index) => ({
        label: column,
        data: matrix.map((row) => row[index]),
        backgroundColor: `hsl(${(index * 53) % 360} 64% 48%)`,
        borderRadius: 3,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { min: -1, max: 1 },
      },
    },
  });
}
