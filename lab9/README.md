# Lab 9: Big Data Processing

## Goal

Build a simple application for working with large datasets: upload data, run chunked analysis, train a model, and visualize results through a web interface.

## Demo

The application is a Flask dashboard for customer churn data. It accepts CSV files, processes them in pandas chunks, calculates numeric statistics, trains a scikit-learn model, and renders summary charts with Chart.js.

The demo dataset uses these columns:

- `age`
- `income`
- `visits`
- `purchases`
- `avg_order_value`
- `support_tickets`
- `churn`

Uploaded and generated files are stored in `/tmp/lab9-data`. This is temporary demo storage. It is suitable for the lab scenario but is not intended for production persistence.

## Architecture

- Flask serves the UI and API.
- pandas reads CSV files by chunks to avoid loading the whole file at once.
- scikit-learn trains an `SGDClassifier` for churn prediction.
- Chart.js renders distributions and correlation samples in the browser.
- Kubernetes deploys one application pod with an `emptyDir` volume for temporary files.

## Local Run

```bash
cd lab9/app
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Open `http://localhost:8080`.

## Generate a Large CSV

```bash
cd lab9/app
python scripts/generate_dataset.py --output /tmp/demo_churn.csv --rows 200000
```

The same dataset can also be generated from the web interface.

## API

- `GET /` opens the dashboard.
- `GET /healthz` returns health status.
- `POST /upload` uploads a CSV file.
- `POST /generate` generates a demo dataset on the server.
- `POST /analyze` runs chunked statistics.
- `POST /train` trains the churn model.
- `GET /api/results` returns the current dataset, analysis, and training state.

## Docker Build

```bash
docker build -t engineering-lab9-app:1.0.0 lab9/app
docker run --rm -p 8080:8080 engineering-lab9-app:1.0.0
```

## Kubernetes Deploy

The manifests use namespace `engineering-lab9` and host `engineering.lab9.zelenkov-labs.ru`.

```bash
kubectl apply -k lab9/k8s
kubectl -n engineering-lab9 get pods
kubectl -n engineering-lab9 get svc,ingress
```

## VPS Check

```bash
cd /root/engineering
eval "$(minikube docker-env)"
docker build -t engineering-lab9-app:1.0.0 lab9/app
kubectl apply -k lab9/k8s
kubectl -n engineering-lab9 get pods
kubectl -n engineering-lab9 get svc,ingress
curl http://engineering.lab9.zelenkov-labs.ru/healthz
curl http://engineering.lab9.zelenkov-labs.ru/
kubectl -n engineering-lab7 get pods
kubectl -n engineering-lab8 get pods
```

## Video Demonstration Scenario

1. Open `http://engineering.lab9.zelenkov-labs.ru`.
2. Generate a demo dataset with 100000 or 200000 rows.
3. Show dataset size, row count, detected columns, and preview.
4. Run analysis and show chunked summary statistics plus charts.
5. Train the model and show accuracy, confusion matrix, and feature weights.
6. Open `/api/results` to show the API response.
