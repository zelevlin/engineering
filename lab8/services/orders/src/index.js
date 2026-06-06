import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import gql from 'graphql-tag';

const port = Number(process.env.PORT || 4003);

const orders = new Map([
  ['o1', { id: 'o1', userId: 'u1', productIds: ['p1', 'p2'], status: 'new' }],
  ['o2', { id: 'o2', userId: 'u2', productIds: ['p3'], status: 'processing' }]
]);

let nextId = 3;

const typeDefs = gql`
  type Order @key(fields: "id") {
    id: ID!
    userId: ID!
    productIds: [ID!]!
    status: String!
    user: User
    products: [Product!]!
  }

  type User @key(fields: "id") {
    id: ID!
    orders: [Order!]!
  }

  type Product @key(fields: "id") {
    id: ID!
  }

  input CreateOrderInput {
    userId: ID!
    productIds: [ID!]!
    status: String!
  }

  input UpdateOrderInput {
    userId: ID
    productIds: [ID!]
    status: String
  }

  type Query {
    orders: [Order!]!
    order(id: ID!): Order
  }

  type Mutation {
    createOrder(input: CreateOrderInput!): Order!
    updateOrder(id: ID!, input: UpdateOrderInput!): Order
    deleteOrder(id: ID!): Boolean!
  }
`;

const resolvers = {
  Order: {
    __resolveReference(reference) {
      return orders.get(reference.id) || null;
    },
    user: (order) => ({ __typename: 'User', id: order.userId }),
    products: (order) => order.productIds.map((id) => ({ __typename: 'Product', id }))
  },
  User: {
    orders: (user) => [...orders.values()].filter((order) => order.userId === user.id)
  },
  Query: {
    orders: () => [...orders.values()],
    order: (_, { id }) => orders.get(id) || null
  },
  Mutation: {
    createOrder: (_, { input }) => {
      const id = `o${nextId++}`;
      const order = { id, status: 'new', ...input };
      orders.set(id, order);
      return order;
    },
    updateOrder: (_, { id, input }) => {
      const current = orders.get(id);
      if (!current) return null;
      const updated = { ...current, ...input };
      orders.set(id, updated);
      return updated;
    },
    deleteOrder: (_, { id }) => orders.delete(id)
  }
};

const app = express();
app.get('/healthz', (_req, res) => res.json({ status: 'ok', service: 'orders' }));

const server = new ApolloServer({
  schema: buildSubgraphSchema([{ typeDefs, resolvers }])
});

await server.start();
app.use('/graphql', cors(), bodyParser.json(), expressMiddleware(server));

app.listen(port, () => {
  console.log(`Orders subgraph ready at http://localhost:${port}/graphql`);
});
