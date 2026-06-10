# Lab 7: Kubernetes, HPA, Prometheus and Grafana

Domain: `engineering.lab7.zelenkov-labs.ru`

## Goal

Deploy a containerized HTTP application to Kubernetes with minikube, run it with three replicas, configure CPU-based Horizontal Pod Autoscaler, and add Prometheus/Grafana monitoring.

## Project Structure

```text
lab7/
  app/                         # Node.js HTTP service
  k8s/                         # Kubernetes manifests
  monitoring/                  # kube-prometheus-stack values
  scripts/generate-load.sh     # Load generator for HPA demonstration
```

## Prerequisites

Install the following tools on the VPS:

- Docker
- kubectl
- minikube
- Helm

Check versions:

```bash
docker --version
kubectl version --client
minikube version
helm version
```

## Start Minikube

```bash
minikube start --driver=docker --cpus=2 --memory=4096
minikube addons enable ingress
kubectl get nodes
```

The ingress addon is required for `engineering.lab7.zelenkov-labs.ru`.

## Build Docker Image

Build the image inside minikube's Docker environment:

```bash
cd lab7/app
eval "$(minikube docker-env)"
docker build -t engineering-lab7-app:1.0.0 .
docker images | grep engineering-lab7-app
```

The Kubernetes deployment uses `imagePullPolicy: IfNotPresent`, so the image can be loaded from the local minikube Docker daemon.

## Deploy Application

```bash
cd ../..
kubectl apply -k lab7/k8s
kubectl -n engineering-lab7 get pods
kubectl -n engineering-lab7 get deployment,service,ingress,hpa
```

Expected result:

- deployment `engineering-lab7-app` is available;
- three pods are running before HPA changes the replica count;
- service exposes port `80`;
- ingress accepts host `engineering.lab7.zelenkov-labs.ru`.

## Configure Domain Access

Get the minikube IP:

```bash
minikube ip
```

For local verification on the VPS, add a temporary hosts record:

```bash
echo "$(minikube ip) engineering.lab7.zelenkov-labs.ru" >> /etc/hosts
curl http://engineering.lab7.zelenkov-labs.ru/
```

For public access, create an `A` record for `engineering.lab7.zelenkov-labs.ru` pointing to the public VPS IP and expose the ingress controller. With minikube this is usually done through a running tunnel:

```bash
minikube tunnel
```

Keep the tunnel process running while demonstrating the domain.

## Install Metrics Server

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl -n kube-system rollout status deployment/metrics-server
kubectl top nodes
kubectl -n engineering-lab7 top pods
```

If `kubectl top` fails in minikube because of kubelet TLS verification, patch Metrics Server:

```bash
kubectl -n kube-system patch deployment metrics-server --type=json -p='[
  {
    "op": "add",
    "path": "/spec/template/spec/containers/0/args/-",
    "value": "--kubelet-insecure-tls"
  }
]'
kubectl -n kube-system rollout restart deployment/metrics-server
kubectl -n kube-system rollout status deployment/metrics-server
```

## Verify HPA

The HPA manifest matches the task parameters: `minReplicas=2`, `maxReplicas=5`, CPU target `50%`.

Check current state:

```bash
kubectl -n engineering-lab7 get hpa
kubectl -n engineering-lab7 describe hpa engineering-lab7-app
```

Generate CPU load:

```bash
kubectl -n engineering-lab7 run load-generator \
  --image=busybox:1.36 \
  --restart=Never \
  -- sh -c 'while true; do wget -q -O - http://engineering-lab7-app/cpu?ms=700 >/dev/null; done'
```

Watch scaling:

```bash
kubectl -n engineering-lab7 get hpa -w
kubectl -n engineering-lab7 get pods -w
```

Stop load:

```bash
kubectl -n engineering-lab7 delete pod load-generator
```

## Install Prometheus and Grafana

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

kubectl create namespace monitoring
helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  -f lab7/monitoring/kube-prometheus-stack-values.yaml

kubectl -n monitoring get pods
```

Grafana is exposed through the same lab7 ingress host under `/grafana`:

```text
http://engineering.lab7.zelenkov-labs.ru/grafana
```

Grafana credentials:

- login: `admin`
- password: `lab7-admin`

The Grafana service remains `ClusterIP`; only the ingress route is public.

Use the built-in Kubernetes dashboards from kube-prometheus-stack. For the video demonstration, show CPU usage and pod count for namespace `engineering-lab7`.

## Useful Commands

```bash
kubectl -n engineering-lab7 get all
kubectl -n engineering-lab7 logs deployment/engineering-lab7-app
kubectl -n engineering-lab7 describe deployment engineering-lab7-app
kubectl -n engineering-lab7 describe hpa engineering-lab7-app
kubectl -n monitoring get svc
```

## Cleanup

```bash
kubectl delete -k lab7/k8s
helm -n monitoring uninstall prometheus
kubectl delete namespace monitoring
minikube stop
```
