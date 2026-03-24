import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Extract text from a base64-encoded PDF using the Lovable AI vision model */
async function extractTextWithVision(base64Data: string, apiKey: string): Promise<string> {
  console.log("Using vision API for PDF text extraction...");
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Extract ALL text content from this document. Return ONLY the raw extracted text, preserving paragraphs and structure. No commentary." },
            {
              type: "image_url",
              image_url: { url: `data:application/pdf;base64,${base64Data}` },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Vision extraction error:", response.status, errText);
    throw new Error("Failed to extract text from PDF via vision API");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, fileBase64, fileName, numQuestions, difficulty, questionType } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let extractedText = text || "";

    // If base64 file data is provided, extract text server-side
    if (fileBase64 && (!extractedText || extractedText.trim().length < 50)) {
      const ext = (fileName || "").split(".").pop()?.toLowerCase();

      if (ext === "pdf") {
        // Use vision API for PDF extraction (handles both digital & scanned PDFs)
        extractedText = await extractTextWithVision(fileBase64, LOVABLE_API_KEY);
      } else if (ext === "docx") {
        // Decode base64 and extract text from DOCX XML
        const bytes = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));
        const decoder = new TextDecoder("utf-8", { fatal: false });
        const raw = decoder.decode(bytes);
        const parts: string[] = [];
        const regex = /<w:t[^>]*>([^<]+)<\/w:t>/g;
        let match;
        while ((match = regex.exec(raw)) !== null) {
          parts.push(match[1]);
        }
        extractedText = parts.join(" ").trim();
        if (!extractedText) {
          extractedText = raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        }
      }
    }

    if (!extractedText || extractedText.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Could not extract enough text from the file. Try a different file or format." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const truncatedText = extractedText.slice(0, 15000);

    const systemPrompt = `You are an expert quiz generator. Generate exactly ${numQuestions || 10} ${questionType === "msq" ? "multiple-select" : "multiple-choice"} questions at ${difficulty || "Medium"} difficulty level based on the provided study material.

For each question, provide:
- question: the question text
- options: exactly 4 answer options as an array of strings
- correct_answer: the 0-based index of the correct option
- explanation: a brief explanation of why the answer is correct

Create plausible distractors that test real understanding. Vary question types (definitions, applications, comparisons, analysis).

Return ONLY a valid JSON array of question objects. No markdown, no extra text.`;

    console.log("Generating quiz from extracted text, length:", truncatedText.length);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate quiz questions from this study material:\n\n${truncatedText}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_questions",
              description: "Generate quiz questions from study material",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        options: { type: "array", items: { type: "string" }, minItems: 4, maxItems: 4 },
                        correct_answer: { type: "integer", minimum: 0, maximum: 3 },
                        explanation: { type: "string" },
                      },
                      required: ["question", "options", "correct_answer"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_questions" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI generation failed");
    }

    const data = await response.json();

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let questions;
    if (toolCall) {
      const parsed = JSON.parse(toolCall.function.arguments);
      questions = parsed.questions;
    } else {
      const content = data.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse AI response");
      }
    }

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-quiz error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
