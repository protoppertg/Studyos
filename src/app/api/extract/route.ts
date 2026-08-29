import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.AI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.7-flash' });

    const prompt = `You are an academic assistant. Extract the subjects, chapters, and topics from this syllabus text.
    Return ONLY valid JSON in this exact format, no markdown formatting:
    {
      "subjects": [
        {
          "name": "Subject Name",
          "chapters": [
            {
              "name": "Chapter Name",
              "topics": [
                { "name": "Topic Name" }
              ]
            }
          ]
        }
      ]
    }
    
    Syllabus Text: ${text}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanText);

    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
