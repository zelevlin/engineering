const express = require('express');
const os = require('os');

const app = express();
const port = Number(process.env.PORT || 3000);
const startedAt = new Date();

function busyWork(durationMs) {
  const end = Date.now() + durationMs;
  let value = 0;

  while (Date.now() < end) {
    value += Math.sqrt(Math.random() * 1000);
  }

  return value;
}

app.get('/', (req, res) => {
  res.json({
    service: 'engineering-lab7-k8s',
    status: 'ok',
    hostname: os.hostname(),
    startedAt: startedAt.toISOString(),
    uptimeSeconds: Math.round(process.uptime())
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

app.get('/cpu', (req, res) => {
  const duration = Math.min(Number(req.query.ms || 250), 2000);
  const result = busyWork(duration);

  res.json({
    status: 'loaded',
    durationMs: duration,
    hostname: os.hostname(),
    result: Number(result.toFixed(2))
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`engineering-lab7-k8s listening on port ${port}`);
});
