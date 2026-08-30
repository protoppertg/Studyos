import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const genAI = new GoogleGenerativeAI(process.env.AI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

    const prompt = `You are an academic assistant. Extract the subjects, chapters, and topics from this syllabus document. 
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
    }`;

    const result = await model.generateContent([
      { inlineData: { data: base64, mimeType: file.type || 'application/pdf' } },
      { text: prompt }
    ]);

    const responseText = result.response.text();
    const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanText);

    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
