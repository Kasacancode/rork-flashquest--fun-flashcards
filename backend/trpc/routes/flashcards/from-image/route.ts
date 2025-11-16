import { generateObject } from "@rork-ai/toolkit-sdk";
import { z } from "zod";

import { publicProcedure } from "../../../create-context";

const FlashcardSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  tags: z.array(z.string()).max(8).optional(),
});

const ResponseSchema = z.object({
  flashcards: z.array(FlashcardSchema).min(1).max(24),
  suggestedDeckName: z.string().optional(),
  summary: z.string().optional(),
});

export default publicProcedure
  .input(
    z.object({
      images: z
        .array(
          z.object({
            base64: z.string().min(32),
            mimeType: z.string().min(3),
            name: z.string().min(1),
          })
        )
        .min(1)
        .max(6),
      deckContext: z.string().optional(),
      language: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const { images, deckContext, language } = input;

    const languageText = language?.trim().length ? language.trim() : "English";

    const messages = [
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: [
              "You are an expert educator extracting study flashcards from study notes.",
              deckContext ? `Focus on the deck context: ${deckContext}.` : "",
              `Produce clear, concise flashcards in ${languageText}.`,
              "Return thoughtfully crafted question and answer pairs ready for spaced repetition.",
              "Avoid duplicate or trivial flashcards. Skip any content that is unreadable.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
          ...images.map((image) => ({
            type: "image" as const,
            image: `data:${image.mimeType};base64,${image.base64}`,
          })),
        ],
      },
    ];

    try {
      const result = await generateObject({
        messages,
        schema: ResponseSchema,
      });

      return result;
    } catch (error) {
      console.error("[flashcards.fromImage] Failed to generate flashcards", error);
      throw new Error(
        "We were unable to read these images. Please retry with clearer photos or different lighting."
      );
    }
  });
