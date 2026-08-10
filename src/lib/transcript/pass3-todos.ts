import OpenAI from "openai";
import type { TodoProposalPayload } from "@/types/transcript";

const openai = new OpenAI();

export interface Pass3Result {
  summary: string;
  todos: TodoProposalPayload[];
}

/** Pass 3: extract action items + a meeting summary. */
export async function pass3Todos(
  filteredText: string,
  pass2Summary: string,
  contextPrompt?: string
): Promise<Pass3Result> {
  const contextSection = contextPrompt
    ? `\n\nContext about meeting participants:\n${contextPrompt}\nUse this to determine todo ownership and priority.`
    : "";
  const attempt = async (extra = ""): Promise<Pass3Result> => {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You extract action items and write a meeting summary from a business meeting transcript.

Context of what was already extracted from this meeting:
${pass2Summary}

Return JSON exactly:
{
  "summary": "<3-5 sentence human-readable recap of decisions and outcomes>",
  "todos": [
    {
      "text": "<action item text>",
      "targetName": "<capability name this relates to, or null>",
      "priority": "low" | "medium" | "high",
      "owner": "<person's name or null>",
      "sourceQuote": "<verbatim quote from the transcript>"
    }
  ]
}

Rules:
- Only include genuine action items with clear ownership or urgency
- targetName should be the exact or approximate capability name mentioned, or null if none
- Every todo must have a non-empty sourceQuote${contextSection}${extra}`,
        },
        { role: "user", content: filteredText },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    if (typeof parsed.summary !== "string" || !Array.isArray(parsed.todos)) {
      throw new Error("Invalid shape");
    }
    return {
      summary: parsed.summary,
      todos: parsed.todos as TodoProposalPayload[],
    };
  };

  try {
    return await attempt();
  } catch {
    return await attempt(" You MUST return valid JSON with summary (string) and todos (array).");
  }
}
