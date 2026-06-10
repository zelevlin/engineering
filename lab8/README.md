# Lab 8: Microservices with GraphQL

Domain: `engineering.lab8.zelenkov-labs.ru`

## Goal

Build a small microservice application with GraphQL communication between the frontend and backend services. The demo supports CRUD operations for users, products, and orders.

## Architecture

```text
Browser
  -> Frontend (React, nginx)
    -> /graphql
      -> Apollo Gateway
        -> Users subgraph
        -> Products subgraph
        -> Orders subgraph
```

The frontend calls only the GraphQL gateway. The gateway composes three Apollo Federation subgraphs. Each microservice stores demo data in memory, which keeps the lab focused on service boundaries, GraphQL, and Kubernetes deployment.

## Services

```text
lab8/
  frontend/           # React CRUD interface
  gateway/            # Apollo Federation gateway
  services/users/     # Users GraphQL subgraph
  services/products/  # Products GraphQL subgraph
  services/orders/    # Orders GraphQL subgraph
  k8s/                # Kubernetes manifests
```

## GraphQL API

Users:

- `users`
- `user(id)`
- `createUser(input)`
- `updateUser(id, input)`
- `deleteUser(id)`

Products:

- `products`
- `product(id)`
- `createProduct(input)`
- `updateProduct(id, input)`
- `deleteProduct(id)`

Orders:

- `orders`
- `order(id)`
- `createOrder(input)`
- `updateOrder(id, input)`
- `deleteOrder(id)`

Federation links:

- `Order.user`
- `Order.products`
- `User.orders`

## Local Run

Install dependencies once:

```bash
cd lab8/services/users && npm install
cd ../products && npm install
cd ../orders && npm install
cd ../../gateway && npm install
cd ../frontend && npm install
```

Start the subgraphs in separate terminals:

```bash
cd lab8/services/users && npm run dev
cd lab8/services/products && npm run dev
cd lab8/services/orders && npm run dev
```

Start the gateway:

```bash
cd lab8/gateway
npm run dev
```

Start the frontend:

```bash
cd lab8/frontend
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

The Vite development server proxies `/graphql` to `http://localhost:4000`.

## Docker Build

Build images inside minikube's Docker environment on the VPS:

```bash
eval "$(minikube docker-env)"

docker build -t engineering-lab8-users:1.0.0 lab8/services/users
docker build -t engineering-lab8-products:1.0.0 lab8/services/products
docker build -t engineering-lab8-orders:1.0.0 lab8/services/orders
docker build -t engineering-lab8-gateway:1.0.0 lab8/gateway
docker build -t engineering-lab8-frontend:1.0.0 lab8/frontend
```

The Kubernetes deployments use `imagePullPolicy: IfNotPresent`, so minikube can run these locally built images.

## Kubernetes Deploy

Deploy to the lab namespace:

```bash
kubectl apply -k lab8/k8s
kubectl -n engineering-lab8 get pods
kubectl -n engineering-lab8 get svc,ingress
```

Expected result:

- namespace `engineering-lab8` exists;
- users, products, orders, gateway, and frontend pods are running;
- microservices and gateway use ClusterIP services;
- ingress host is `engineering.lab8.zelenkov-labs.ru`.

Check the site:

```bash
curl http://engineering.lab8.zelenkov-labs.ru/
```

Check GraphQL through the public frontend proxy:

```bash
curl -s http://engineering.lab8.zelenkov-labs.ru/graphql \
  -H 'content-type: application/json' \
  --data '{"query":"query { users { id name email role } products { id name price stock } orders { id status user { name } products { name } } }"}'
```

## CRUD Examples

Create a user:

```bash
curl -s http://engineering.lab8.zelenkov-labs.ru/graphql \
  -H 'content-type: application/json' \
  --data '{"query":"mutation($input: CreateUserInput!) { createUser(input: $input) { id name email role } }","variables":{"input":{"name":"Demo User","email":"demo@example.com","role":"customer"}}}'
```

Update a product:

```bash
curl -s http://engineering.lab8.zelenkov-labs.ru/graphql \
  -H 'content-type: application/json' \
  --data '{"query":"mutation($id: ID!, $input: UpdateProductInput!) { updateProduct(id: $id, input: $input) { id name price stock } }","variables":{"id":"p1","input":{"stock":12}}}'
```

Create an order:

```bash
curl -s http://engineering.lab8.zelenkov-labs.ru/graphql \
  -H 'content-type: application/json' \
  --data '{"query":"mutation($input: CreateOrderInput!) { createOrder(input: $input) { id status user { name } products { name } } }","variables":{"input":{"userId":"u1","productIds":["p1","p2"],"status":"new"}}}'
```

Delete an order:

```bash
curl -s http://engineering.lab8.zelenkov-labs.ru/graphql \
  -H 'content-type: application/json' \
  --data '{"query":"mutation($id: ID!) { deleteOrder(id: $id) }","variables":{"id":"o2"}}'
```

## VPS Verification

```bash
kubectl -n engineering-lab8 get all
kubectl -n engineering-lab8 logs deployment/engineering-lab8-gateway
kubectl -n engineering-lab8 describe ingress engineering-lab8
curl http://engineering.lab8.zelenkov-labs.ru/
```

Check that other labs are still running in their own namespaces:

```bash
kubectl get namespaces | grep engineering-lab
kubectl -n engineering-lab7 get pods
```

## Cleanup

```bash
kubectl delete -k lab8/k8s
```
