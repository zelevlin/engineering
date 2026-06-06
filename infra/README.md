# Shared VPS Infrastructure

The VPS runs one minikube cluster for labs 7, 8 and 9.

## Current Resource Model

- VPS: 4 CPU, 8 GB RAM, 80 GB disk.
- Swap: 10 GB.
- Minikube: 3 CPU, 6 GB RAM.
- Build operations may temporarily use more host resources.
- Runtime workloads are isolated with Kubernetes namespaces, `ResourceQuota` and `LimitRange`.

## Namespaces

```bash
kubectl apply -f infra/namespaces.yaml
```

Namespaces:

- `engineering-lab7`
- `engineering-lab8`
- `engineering-lab9`

Each namespace has runtime quota:

- requests CPU: `1200m`
- requests memory: `2Gi`
- limits CPU: `3`
- limits memory: `3Gi`
- pods: `12`

## Domains

DNS records point to the VPS public IP:

- `engineering.lab7.zelenkov-labs.ru`
- `engineering.lab8.zelenkov-labs.ru`
- `engineering.lab9.zelenkov-labs.ru`

Host nginx proxies all three domains to the minikube ingress IP. The Kubernetes ingress controller routes requests by `Host` header.

Install/update nginx config:

```bash
cp infra/nginx-engineering-labs.conf /etc/nginx/sites-available/engineering-labs
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/engineering-labs /etc/nginx/sites-enabled/engineering-labs
nginx -t
systemctl reload nginx
```
