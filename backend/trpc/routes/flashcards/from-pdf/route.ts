import { z } from "zod";

import { publicProcedure } from "../../../create-context";

const PdfFileSchema = z.object({
  base64: z.string().min(32),
  mimeType: z.literal("application/pdf"),
  name: z.string().min(1),
  sizeBytes: z.number().min(1),
});

export default publicProcedure
  .input(
    z.object({
      files: z.array(PdfFileSchema).min(1).max(3),
      deckContext: z.string().optional(),
      language: z.string().optional(),
    })
  )
  .mutation(() => {
    throw new Error("PDF import preparation in progress. Please try again shortly.");
  });
