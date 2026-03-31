import { z } from 'zod';

import { analyticsService } from '../../analytics/service';
import { ANALYTICS_EVENT_NAMES } from '../../analytics/types';
import { createTRPCRouter, publicProcedure } from '../create-context';

const analyticsPropertyValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const analyticsEventSchema = z.object({
  event: z.enum(ANALYTICS_EVENT_NAMES),
  timestamp: z.number().int().nonnegative().optional(),
  sessionId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  roomCode: z.string().min(1).optional(),
  deckId: z.string().min(1).optional(),
  properties: z.record(z.string(), analyticsPropertyValueSchema).optional(),
});

export const analyticsRouter = createTRPCRouter({
  track: publicProcedure
    .input(analyticsEventSchema)
    .mutation(async ({ input }) => {
      try {
        const event = await analyticsService.trackEvent(input);
        return { success: true, accepted: 1, event };
      } catch (error) {
        console.error('[AnalyticsRouter] track failed:', error);
        return { success: false, accepted: 0 };
      }
    }),

  batchTrack: publicProcedure
    .input(z.array(analyticsEventSchema).min(1).max(100))
    .mutation(async ({ input }) => {
      try {
        const events = await analyticsService.trackEvents(input);
        return { success: true, accepted: events.length };
      } catch (error) {
        console.error('[AnalyticsRouter] batchTrack failed:', error);
        return { success: false, accepted: 0 };
      }
    }),

  summary: publicProcedure
    .input(z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional())
    .query(async ({ input }) => {
      try {
        return await analyticsService.getSummary(input?.day);
      } catch (error) {
        console.error('[AnalyticsRouter] summary failed:', error);
        return analyticsService.getEmptySummary(input?.day);
      }
    }),
});
