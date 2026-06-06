import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSubgraphSchema } from '@apollo/subgraph';
import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import gql from 'graphql-tag';

const port = Number(process.env.PORT || 4001);

const users = new Map([
  ['u1', { id: 'u1', name: 'Anna Petrova', email: 'anna@example.com', role: 'customer' }],
  ['u2', { id: 'u2', name: 'Ivan Smirnov', email: 'ivan@example.com', role: 'manager' }]
]);

let nextId = 3;

const typeDefs = gql`
  type User @key(fields: "id") {
    id: ID!
    name: String!
    email: String!
    role: String!
  }

  input CreateUserInput {
    name: String!
    email: String!
    role: String!
  }

  input UpdateUserInput {
    name: String
    email: String
    role: String
  }

  type Query {
    users: [User!]!
    user(id: ID!): User
  }

  type Mutation {
    createUser(input: CreateUserInput!): User!
    updateUser(id: ID!, input: UpdateUserInput!): User
    deleteUser(id: ID!): Boolean!
  }
`;

const resolvers = {
  User: {
    __resolveReference(reference) {
      return users.get(reference.id) || null;
    }
  },
  Query: {
    users: () => [...users.values()],
    user: (_, { id }) => users.get(id) || null
  },
  Mutation: {
    createUser: (_, { input }) => {
      const id = `u${nextId++}`;
      const user = { id, ...input };
      users.set(id, user);
      return user;
    },
    updateUser: (_, { id, input }) => {
      const current = users.get(id);
      if (!current) return null;
      const updated = { ...current, ...input };
      users.set(id, updated);
      return updated;
    },
    deleteUser: (_, { id }) => users.delete(id)
  }
};

const app = express();
app.get('/healthz', (_req, res) => res.json({ status: 'ok', service: 'users' }));

const server = new ApolloServer({
  schema: buildSubgraphSchema([{ typeDefs, resolvers }])
});

await server.start();
app.use('/graphql', cors(), bodyParser.json(), expressMiddleware(server));

app.listen(port, () => {
  console.log(`Users subgraph ready at http://localhost:${port}/graphql`);
});
