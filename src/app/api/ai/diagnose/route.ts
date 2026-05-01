// AI Diagnosis Protocol - Groq Integration (Llama-3.3-70b)
import { NextResponse } from "next/server";
import { TRADES } from "@/lib/constants";

export async function POST(req: Request) {
  try {
    const { description } = await req.json();

    if (!description || description.length < 5) {
      return NextResponse.json({ error: "Input too short" }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
       console.error("AI Route: GROQ_API_KEY is missing in environment");
       throw new Error("Groq API Key is missing. Please check .env or Firebase Secrets.");
    }
    console.log("AI Route: API Key present, proceeding with Groq request");

    const prompt = `
      You are an expert multilingual maintenance dispatcher for "Fix Link," a premium home services marketplace.
      
      CUSTOMER INPUT:
      "${description}"

      TASK:
      1. Analyze the technical root cause of the issue.
      2. Set urgency: Emergency (danger/flood/fire), High (broken essential), Medium (needs prep), Low (cosmetic).
      3. SELECT THE TOP 3 PROFESSIONALS: Select EXACTLY 3 categories from this list that are most relevant (MATCH NAMES PERFECTLY):
         ${TRADES.join(", ")}
         
      CRITICAL RULES:
      - You MUST select EXACTLY 3 items from the list above.
      - Use the EXACT strings provided in the list.
      - If fewer than 3 are obvious, include "Handymen (General Maintenance)" as a fallback.
      - The "analysis" and "proposedTitle" MUST ALWAYS be in English.

      RESPONSE FORMAT (STRICT JSON):
      {
        "analysis": "Professional technical breakdown in English",
        "urgency": "Low" | "Medium" | "High" | "Emergency",
        "urgencyReason": "Brief explanation why",
        "suggestedTrades": ["Exact Trade Name 1", "Exact Trade Name 2", "Exact Trade Name 3"],
        "proposedTitle": "Engaging job title in English",
        "potentialParts": ["part1", "part2"]
      }
    `;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: "You are a professional maintenance dispatcher. You strictly output valid JSON and only use provided trade names from the allowed list." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Groq intelligence failure");
    }

    const result = await response.json();
    const text = result.choices[0]?.message?.content;
    
    if (!text) throw new Error("AI returned empty result");

    try {
      const data = JSON.parse(text);
      
      // Validation & Normalization
      let normalizedTrades: string[] = [];
      
      if (Array.isArray(data.suggestedTrades)) {
        normalizedTrades = data.suggestedTrades
          .map((t: string) => {
            // 1. Exact match
            const exactMatch = TRADES.find(valid => valid === t);
            if (exactMatch) return exactMatch;
            
            // 2. Fuzzy match
            const fuzzyMatch = TRADES.find(valid => 
              valid.toLowerCase().includes(t.toLowerCase()) || 
              t.toLowerCase().includes(valid.toLowerCase())
            );
            return fuzzyMatch || null;
          })
          .filter((t: string | null): t is string => t !== null);
      }

      // Ensure we have 3 trades, fallback to Handymen if needed
      if (normalizedTrades.length < 3) {
        const fallback = "Handymen (General Maintenance)";
        if (!normalizedTrades.includes(fallback)) {
          normalizedTrades.push(fallback);
        }
        
        // Fill remaining if still short
        const others = ["Plumbers", "Electricians (Domestic & Industrial)", "Painters & Decorators (Interior & Exterior)"];
        for (const other of others) {
          if (normalizedTrades.length >= 3) break;
          if (!normalizedTrades.includes(other)) normalizedTrades.push(other);
        }
      }

      data.suggestedTrades = normalizedTrades.slice(0, 3);
      
      return NextResponse.json(data);
    } catch (parseError) {
      console.error("AI Parse Failure:", parseError, "Raw Text:", text);
      throw new Error("Intelligence Formatting Failure");
    }
  } catch (error: any) {
    console.error("AI Diagnosis Error:", error);
    const errorMessage = error?.message || "Unknown intelligence failure";
    const isRateLimit = errorMessage.includes("429");
    
    return NextResponse.json({ 
      error: isRateLimit ? "Server Overloaded. Please wait a moment." : errorMessage, 
      details: errorMessage,
      status: error?.status || 500,
      hint: !process.env.GROQ_API_KEY ? "GROQ_API_KEY is missing in environment variables" : "Check Groq API console"
    }, { status: error?.status || 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "online", 
    service: "Fix Link AI Diagnosis",
    env: process.env.GROQ_API_KEY ? "configured" : "missing"
  });
}
