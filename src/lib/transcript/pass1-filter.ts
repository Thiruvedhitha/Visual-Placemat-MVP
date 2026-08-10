import OpenAI from "openai";

const openai = new OpenAI();

/** Pass 1: filter out small-talk / admin noise, keep capability-relevant content. */
export async function pass1Filter(cleaned: string, contextPrompt?: string): Promise<string> {
  const contextSection = contextPrompt
    ? `\n\nAdditional context:\n${contextPrompt}`
    : "";
  const attempt = async (extraInstruction = ""): Promise<string> => {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You filter business meeting transcripts.
Keep ONLY paragraphs that discuss: business capabilities, processes, tools, systems, roles, priorities, decisions, or action items.
Drop: small-talk, scheduling admin, off-topic tangents, pleasantries, technical glitches.
Return JSON exactly: { "keptText": "<filtered transcript text with irrelevant lines removed>" }${contextSection}${extraInstruction}`,
        },
        { role: "user", content: cleaned },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    if (typeof parsed.keptText !== "string") throw new Error("keptText missing");
    return parsed.keptText;
  };

  try {
    return await attempt();
  } catch {
    // retry once with stricter instruction
    return await attempt(" You MUST return valid JSON with keptText as a string.");
  }
}
