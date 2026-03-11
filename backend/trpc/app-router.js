"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.appRouter = void 0;
const create_context_1 = require("./create-context");
const arena_1 = require("./routes/arena");
exports.appRouter = (0, create_context_1.createTRPCRouter)({
    arena: arena_1.arenaRouter,
});
