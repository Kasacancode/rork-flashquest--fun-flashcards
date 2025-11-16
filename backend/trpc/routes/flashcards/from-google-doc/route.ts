import { generateObject } from "@rork-ai/toolkit-sdk";
import { z } from "zod";

import { publicProcedure } from "../../../create-context";

const FlashcardSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  tags: z.array(z.string()).max(8).optional(),
});

const ResponseSchema = z.object({
  flashcards: z.array(FlashcardSchema).min(1).max(40),
  suggestedDeckName: z.string().optional(),
  summary: z.string().optional(),
});

const extractDocId = (url: string) => {
  const match = /https:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/.exec(url);
  return match?.[1];
};

export default publicProcedure
  .input(
    z.object({
      docUrl: z.string().url(),
      deckContext: z.string().optional(),
      language: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const { docUrl, deckContext, language } = input;
    const docId = extractDocId(docUrl);

    if (!docId) {
      throw new Error("Please provide a valid Google Docs link in the format https://docs.google.com/document/d/{docId}/edit.");
    }

    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

    let textContent: string;

    try {
      const response = await fetch(exportUrl, {
        headers: {
          "User-Agent": "FlashQuestImporter/1.0",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch document: ${response.status}`);
      }

      textContent = await response.text();
    } catch (error) {
      console.error("[flashcards.fromGoogleDoc] Failed to fetch", error);
      throw new Error("We could not access that document. Ensure it is shared with 'Anyone with the link' and try again.");
    }

    if (!textContent.trim().length) {
      throw new Error("The document appears to be empty. Please add content and try again.");
    }

    const languageText = language?.trim().length ? language.trim() : "English";

    const messages = [
      {
        role: "user" as const,
        content: [
          {
            type: "text" as const,
            text: [
              "You are an expert educator turning structured notes into flashcards.",
              deckContext ? `Deck context: ${deckContext}.` : "",
              `Produce comprehensive flashcards in ${languageText}.`,
              "Return rich question and answer pairs that help learners recall information effectively.",
              "Avoid duplicates and merge closely related facts into a single strong flashcard.",
              "Here are the notes to convert:",
              textContent.slice(0, 24000),
            ]
              .filter(Boolean)
              .join("\n"),
          },
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
      console.error("[flashcards.fromGoogleDoc] Failed to generate", error);
      throw new Error("We could not understand that document. Try simplifying the notes or splitting the document into smaller sections.");
    }
  });
