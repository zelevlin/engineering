import json
import math
import os
import uuid
from pathlib import Path

import numpy as np
import pandas as pd
from flask import Flask, jsonify, redirect, render_template, request, send_file, url_for
from sklearn.linear_model import SGDClassifier
from sklearn.metrics import accuracy_score, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from werkzeug.utils import secure_filename

from scripts.generate_dataset import generate_dataset


DATA_DIR = Path(os.environ.get("DATA_DIR", "/tmp/lab9-data"))
UPLOAD_DIR = DATA_DIR / "uploads"
GENERATED_DIR = DATA_DIR / "generated"
CHUNK_SIZE = int(os.environ.get("CSV_CHUNK_SIZE", "25000"))
MAX_CONTENT_MB = int(os.environ.get("MAX_CONTENT_MB", "200"))
FEATURE_COLUMNS = [
    "age",
    "income",
    "visits",
    "purchases",
    "avg_order_value",
    "support_tickets",
]
TARGET_COLUMN = "churn"

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_MB * 1024 * 1024

STATE = {
    "dataset": None,
    "analysis": None,
    "training": None,
}


def ensure_dirs() -> None:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)


def file_size_mb(path: Path) -> float:
    return round(path.stat().st_size / (1024 * 1024), 2)


def clean_float(value):
    if pd.isna(value):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        if math.isnan(float(value)):
            return None
        return round(float(value), 4)
    return value


def current_dataset_path() -> Path:
    dataset = STATE.get("dataset")
    if not dataset:
        raise FileNotFoundError("Dataset is not loaded")
    path = Path(dataset["path"])
    if not path.exists():
        raise FileNotFoundError("Dataset file is missing")
    return path


def inspect_dataset(path: Path) -> dict:
    preview = pd.read_csv(path, nrows=8)
    columns = list(preview.columns)
    row_count = 0
    numeric_columns = set()

    for chunk in pd.read_csv(path, chunksize=CHUNK_SIZE):
        row_count += len(chunk)
        numeric_columns.update(chunk.select_dtypes(include="number").columns.tolist())

    return {
        "filename": path.name,
        "path": str(path),
        "size_mb": file_size_mb(path),
        "rows": row_count,
        "columns": columns,
        "numeric_columns": sorted(numeric_columns),
        "preview": preview.fillna("").to_dict(orient="records"),
    }


def analyze_dataset(path: Path) -> dict:
    numeric_stats = {}
    histograms = {}
    correlations_sample = []

    for chunk in pd.read_csv(path, chunksize=CHUNK_SIZE):
        numeric = chunk.select_dtypes(include="number")
        if numeric.empty:
            continue

        describe = numeric.describe().to_dict()
        for column, values in describe.items():
            target = numeric_stats.setdefault(
                column,
                {
                    "count": 0,
                    "sum": 0.0,
                    "min": None,
                    "max": None,
                    "std_samples": [],
                },
            )
            target["count"] += int(values.get("count", 0))
            target["sum"] += float(numeric[column].sum())
            column_min = clean_float(values.get("min"))
            column_max = clean_float(values.get("max"))
            if column_min is not None:
                target["min"] = column_min if target["min"] is None else min(target["min"], column_min)
            if column_max is not None:
                target["max"] = column_max if target["max"] is None else max(target["max"], column_max)
            target["std_samples"].append(float(values.get("std", 0) or 0))

        for column in numeric.columns[:6]:
            counts, edges = np.histogram(numeric[column].dropna(), bins=12)
            stored = histograms.setdefault(
                column,
                {"counts": np.zeros(12, dtype=int), "edges": edges.tolist()},
            )
            stored["counts"] += counts

        if len(correlations_sample) < 6000:
            correlations_sample.extend(numeric.head(6000 - len(correlations_sample)).to_dict(orient="records"))

    summary = []
    for column, values in numeric_stats.items():
        count = values["count"]
        summary.append(
            {
                "column": column,
                "count": count,
                "mean": round(values["sum"] / count, 4) if count else None,
                "min": clean_float(values["min"]),
                "max": clean_float(values["max"]),
                "std": round(float(np.mean(values["std_samples"])), 4) if values["std_samples"] else None,
            }
        )

    chart_histograms = {
        column: {
            "labels": [f"{edges[i]:.1f}-{edges[i + 1]:.1f}" for i in range(len(edges) - 1)],
            "counts": data["counts"].astype(int).tolist(),
        }
        for column, data in histograms.items()
        for edges in [data["edges"]]
    }

    correlation = []
    if correlations_sample:
        corr = pd.DataFrame(correlations_sample).corr(numeric_only=True).fillna(0)
        correlation = [
            {"x": row, "y": col, "value": round(float(corr.loc[row, col]), 3)}
            for row in corr.index
            for col in corr.columns
        ]

    analysis = {
        "summary": sorted(summary, key=lambda item: item["column"]),
        "histograms": chart_histograms,
        "correlation": correlation,
    }
    STATE["analysis"] = analysis
    return analysis


def train_model(path: Path) -> dict:
    sample_frames = []
    total_rows = 0

    for chunk in pd.read_csv(path, chunksize=CHUNK_SIZE):
        missing = [column for column in FEATURE_COLUMNS + [TARGET_COLUMN] if column not in chunk.columns]
        if missing:
            return {"error": f"Missing required columns: {', '.join(missing)}"}
        total_rows += len(chunk)
        sample_frames.append(chunk[FEATURE_COLUMNS + [TARGET_COLUMN]].dropna())
        if sum(len(frame) for frame in sample_frames) >= 120_000:
            break

    if not sample_frames:
        return {"error": "No rows available for training"}

    data = pd.concat(sample_frames, ignore_index=True)
    if data[TARGET_COLUMN].nunique() < 2:
        return {"error": "Target column must contain both classes"}

    train_data, test_data = train_test_split(
        data,
        test_size=0.25,
        random_state=42,
        stratify=data[TARGET_COLUMN],
    )

    model = make_pipeline(
        StandardScaler(),
        SGDClassifier(loss="log_loss", max_iter=1200, tol=1e-3, random_state=42),
    )
    model.fit(train_data[FEATURE_COLUMNS], train_data[TARGET_COLUMN])

    predictions = model.predict(test_data[FEATURE_COLUMNS])
    matrix = confusion_matrix(test_data[TARGET_COLUMN], predictions, labels=[0, 1])
    coefficients = model.named_steps["sgdclassifier"].coef_[0]

    training = {
        "rows_seen": total_rows,
        "rows_used": len(data),
        "accuracy": round(float(accuracy_score(test_data[TARGET_COLUMN], predictions)), 4),
        "confusion_matrix": matrix.astype(int).tolist(),
        "features": [
            {"name": column, "weight": round(float(weight), 4)}
            for column, weight in sorted(zip(FEATURE_COLUMNS, coefficients), key=lambda item: abs(item[1]), reverse=True)
        ],
    }
    STATE["training"] = training
    return training


@app.get("/")
def index():
    return render_template("index.html", state=STATE, state_json=json.dumps(STATE))


@app.get("/healthz")
def healthz():
    return jsonify({"status": "ok"})


@app.post("/upload")
def upload():
    ensure_dirs()
    file = request.files.get("dataset")
    if not file or file.filename == "":
        return redirect(url_for("index"))

    filename = secure_filename(file.filename)
    path = UPLOAD_DIR / f"{uuid.uuid4().hex}_{filename}"
    file.save(path)

    STATE["dataset"] = inspect_dataset(path)
    STATE["analysis"] = None
    STATE["training"] = None
    return redirect(url_for("index"))


@app.post("/generate")
def generate():
    ensure_dirs()
    rows = min(max(int(request.form.get("rows", "100000")), 1000), 1_000_000)
    path = GENERATED_DIR / f"demo_churn_{rows}.csv"
    generate_dataset(path, rows=rows, chunk_size=CHUNK_SIZE, seed=42)
    STATE["dataset"] = inspect_dataset(path)
    STATE["analysis"] = None
    STATE["training"] = None
    return redirect(url_for("index"))


@app.post("/analyze")
def analyze():
    try:
        analyze_dataset(current_dataset_path())
    except FileNotFoundError:
        pass
    return redirect(url_for("index"))


@app.post("/train")
def train():
    try:
        result = train_model(current_dataset_path())
        if "error" in result:
            STATE["training"] = result
    except FileNotFoundError:
        pass
    return redirect(url_for("index"))


@app.get("/download-demo")
def download_demo():
    rows = min(max(int(request.args.get("rows", "100000")), 1000), 1_000_000)
    ensure_dirs()
    path = GENERATED_DIR / f"demo_churn_{rows}.csv"
    if not path.exists():
        generate_dataset(path, rows=rows, chunk_size=CHUNK_SIZE, seed=42)
    return send_file(path, as_attachment=True)


@app.get("/api/status")
@app.get("/api/results")
def api_results():
    return jsonify(STATE)


if __name__ == "__main__":
    ensure_dirs()
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
