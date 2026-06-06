import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';

const port = Number(process.env.PORT || 4000);

const serviceList = [
  { name: 'users', url: process.env.USERS_URL || 'http://localhost:4001/graphql' },
  { name: 'products', url: process.env.PRODUCTS_URL || 'http://localhost:4002/graphql' },
  { name: 'orders', url: process.env.ORDERS_URL || 'http://localhost:4003/graphql' }
];

async function waitForSubgraph({ name, url }) {
  const healthUrl = url.replace(/\/graphql$/, '/healthz');
  const maxAttempts = Number(process.env.SUBGRAPH_WAIT_ATTEMPTS || 30);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) return;
    } catch {
      // The service can exist before its HTTP listener is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Subgraph "${name}" did not become ready at ${healthUrl}`);
}

await Promise.all(serviceList.map(waitForSubgraph));

const gateway = new ApolloGateway({
  supergraphSdl: new IntrospectAndCompose({ subgraphs: serviceList })
});

const server = new ApolloServer({ gateway });

const app = express();
app.get('/healthz', (_req, res) => res.json({ status: 'ok', service: 'gateway' }));

await server.start();
app.use('/graphql', cors(), bodyParser.json(), expressMiddleware(server));

app.listen(port, () => {
  console.log(`Gateway ready at http://localhost:${port}/graphql`);
});
