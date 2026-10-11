import type { FastifyReply, FastifyRequest } from 'fastify';

export type RouteHook = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
