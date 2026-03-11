"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicProcedure = exports.createTRPCRouter = exports.createContext = void 0;
const server_1 = require("@trpc/server");
const superjson_1 = __importDefault(require("superjson"));
const createContext = async (opts) => {
    return {
        req: opts.req,
    };
};
exports.createContext = createContext;
const t = server_1.initTRPC.context().create({
    transformer: superjson_1.default,
});
exports.createTRPCRouter = t.router;
exports.publicProcedure = t.procedure;
