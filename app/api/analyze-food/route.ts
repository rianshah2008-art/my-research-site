import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const LEAN_BULK_PROMPT = `You are a nutrition expert analyzing a meal photo for someone on a lean bulk diet (target: 2600 calories, 140g protein daily).

Analyze this food image and return ONLY valid JSON with no markdown formatting:
{
  "dish_name": "descriptive name of the dish",
  "calories": estimated total calories (integer),
  "protein_g": estimated protein in grams (integer),
  "carbs_g": estimated carbohydrates in grams (integer),
  "fat_g": estimated fat in grams (integer)
}

Be conservative but realistic with portion estimates. Focus on accuracy for protein content.`;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          dish_name: "Grilled Chicken & Quinoa Bowl",
          calories: 580,
          protein_g: 42,
          carbs_g: 55,
          fat_g: 16,
          demo: true,
        },
        { status: 200 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent([
      LEAN_BULK_PROMPT,
      {
        inlineData: {
          mimeType: file.type || "image/jpeg",
          data: base64,
        },
      },
    ]);

    const text = result.response.text();
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 500 }
      );
    }

    const analysis = JSON.parse(jsonMatch[0]);
    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Food analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze food image" },
      { status: 500 }
    );
  }
}
