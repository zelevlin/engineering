#!/usr/bin/env python3
import argparse
from pathlib import Path

import numpy as np
import pandas as pd


def generate_dataset(output_path: Path, rows: int, chunk_size: int, seed: int) -> None:
    rng = np.random.default_rng(seed)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with output_path.open("w", encoding="utf-8", newline="") as handle:
        for start in range(0, rows, chunk_size):
            count = min(chunk_size, rows - start)

            age = rng.integers(18, 75, count)
            income = np.clip(rng.normal(72000, 26000, count), 15000, 220000)
            visits = rng.poisson(8, count)
            purchases = rng.poisson(np.maximum(visits * 0.35, 1))
            avg_order_value = np.clip(rng.normal(95, 38, count), 8, 500)
            support_tickets = rng.poisson(1.2, count)

            churn_score = (
                -2.1
                + support_tickets * 0.52
                - purchases * 0.18
                - visits * 0.06
                + (age < 25) * 0.32
                + (income < 45000) * 0.42
                + rng.normal(0, 0.8, count)
            )
            churn_probability = 1 / (1 + np.exp(-churn_score))
            churn = rng.binomial(1, churn_probability)

            frame = pd.DataFrame(
                {
                    "age": age,
                    "income": income.round(2),
                    "visits": visits,
                    "purchases": purchases,
                    "avg_order_value": avg_order_value.round(2),
                    "support_tickets": support_tickets,
                    "churn": churn,
                }
            )
            frame.to_csv(handle, index=False, header=start == 0)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate customer churn CSV data.")
    parser.add_argument("--output", type=Path, default=Path("demo_churn.csv"))
    parser.add_argument("--rows", type=int, default=100_000)
    parser.add_argument("--chunk-size", type=int, default=25_000)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    generate_dataset(args.output, args.rows, args.chunk_size, args.seed)
    print(f"Generated {args.rows} rows at {args.output}")


if __name__ == "__main__":
    main()
