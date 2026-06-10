import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import gql from 'graphql-tag';

const port = Number(process.env.PORT || 4002);

const products = new Map([
  ['p1', { id: 'p1', name: 'Mechanical Keyboard', price: 119.99, stock: 15 }],
  ['p2', { id: 'p2', name: 'USB-C Dock', price: 89.5, stock: 24 }],
  ['p3', { id: 'p3', name: 'Web Camera', price: 54.0, stock: 32 }]
]);

let nextId = 4;

const typeDefs = gql`
  type Product @key(fields: "id") {
    id: ID!
    name: String!
    price: Float!
    stock: Int!
  }

  input CreateProductInput {
    name: String!
    price: Float!
    stock: Int!
  }

  input UpdateProductInput {
    name: String
    price: Float
    stock: Int
  }

  type Query {
    products: [Product!]!
    product(id: ID!): Product
  }

  type Mutation {
    createProduct(input: CreateProductInput!): Product!
    updateProduct(id: ID!, input: UpdateProductInput!): Product
    deleteProduct(id: ID!): Boolean!
  }
`;

const resolvers = {
  Product: {
    __resolveReference(reference) {
      return products.get(reference.id) || {
        id: reference.id,
        name: `Unknown product ${reference.id}`,
        price: 0,
        stock: 0
      };
    }
  },
  Query: {
    products: () => [...products.values()],
    product: (_, { id }) => products.get(id) || null
  },
  Mutation: {
    createProduct: (_, { input }) => {
      const id = `p${nextId++}`;
      const product = { id, ...input };
      products.set(id, product);
      return product;
    },
    updateProduct: (_, { id, input }) => {
      const current = products.get(id);
      if (!current) return null;
      const updated = { ...current, ...input };
      products.set(id, updated);
      return updated;
    },
    deleteProduct: (_, { id }) => products.delete(id)
  }
};

const app = express();
app.get('/healthz', (_req, res) => res.json({ status: 'ok', service: 'products' }));

const server = new ApolloServer({
  schema: buildSubgraphSchema([{ typeDefs, resolvers }])
});

await server.start();
app.use('/graphql', cors(), bodyParser.json(), expressMiddleware(server));

app.listen(port, () => {
  console.log(`Products subgraph ready at http://localhost:${port}/graphql`);
});
