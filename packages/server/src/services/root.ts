import { Server, IncomingMessage, ServerResponse } from 'http'
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default (
  fastify: FastifyInstance<Server, IncomingMessage, ServerResponse>,
  _: FastifyPluginOptions,
  next: (error?: Error) => void,
) => {
  fastify.get('/', (_, reply) => {
    const query = '{ add(x: 2, y: 2) }'
    return reply.graphql(query)
  })

  next()
}
