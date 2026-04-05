import { GoogleGenAI, Type, Part } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function parseResume(resumePart: Part) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            text: `Parse the following resume and extract information into a structured JSON format. 
            Extract specific tools (e.g. VS Code, Jira, Docker), programming languages (e.g. Python, TypeScript), and certifications.
            IMPORTANT: Do not extract age, gender, race, or marital status.`
          },
          resumePart
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            experienceYears: { type: Type.NUMBER },
            experienceDetails: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            education: { type: Type.STRING },
            skills: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            tools: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            languages: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            certifications: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            }
          },
          required: ["name", "experienceYears", "experienceDetails", "education", "skills", "tools", "languages", "certifications"]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No text returned from Gemini");
    }

    // Clean up response text in case it contains markdown code blocks
    const cleanedText = text.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error("Error in parseResume:", error);
    throw error;
  }
}

export async function analyzeCandidateFit(jobDescription: string, candidateProfile: any) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze the fit between this job description and the candidate profile.
    
    Job Description:
    ${jobDescription}
    
    Candidate Profile:
    ${JSON.stringify(candidateProfile)}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fitScore: { type: Type.NUMBER, description: "Score from 0 to 100" },
          summary: { type: Type.STRING },
          skillsAnalysis: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          },
          redFlags: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING } 
          }
        },
        required: ["fitScore", "summary", "skillsAnalysis", "redFlags"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function answerAnalyticsQuestion(question: string, data: any) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on the following recruitment data, answer the user's question.
    
    Data:
    ${JSON.stringify(data)}
    
    Question:
    ${question}`,
    config: {
      systemInstruction: "You are an HR analytics expert. Provide a concise, professional answer based on the provided data."
    }
  });

  return response.text;
}
