import { GoogleGenerativeAI } from '@google/generative-ai'
import { dbOps } from './database'

function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = dbOps.getSetting<string>('gemini_api_key', '')
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add your key in Settings.')
  }
  return new GoogleGenerativeAI(apiKey)
}

async function generateWithPrompt(prompt: string, text: string): Promise<string> {
  const genAI = getGeminiClient()
  const modelName = dbOps.getSetting<string>('gemini_model_name', 'gemini-1.5-flash')
  const model = genAI.getGenerativeModel({ model: modelName })

  const result = await model.generateContent(`${prompt}\n\nText:\n"${text}"`)
  const response = await result.response
  return response.text().trim()
}

// Clean markdown JSON wrapper blocks (e.g. ```json ... ```)
function cleanJsonString(raw: string): string {
  return raw
    .replace(/^```json/i, '')
    .replace(/^```/i, '')
    .replace(/```$/, '')
    .trim()
}

export const aiOps = {
  async generateSummary(text: string): Promise<string> {
    const prompt = 'Summarize the following text in 1-2 concise and clear sentences.'
    dbOps.logStatEvent('ai_summary', { type: 'summary' })
    return generateWithPrompt(prompt, text)
  },

  async explainSimply(text: string): Promise<string> {
    const prompt = 'Explain the following concept or text in very simple language, as if explaining to a 10-year-old. Keep it brief and clear.'
    dbOps.logStatEvent('ai_summary', { type: 'explain' })
    return generateWithPrompt(prompt, text)
  },

  async generateFlashcards(text: string): Promise<{ question: string; answer: string }[]> {
    const prompt = `Analyze the following text and generate 2 to 5 high-quality Q&A flashcards for study.
    Return ONLY a valid JSON array of objects, where each object has "question" and "answer" properties.
    Do not include any explanation or markdown formatting. E.g.
    [{"question": "What is X?", "answer": "X is..."}]`

    const responseText = await generateWithPrompt(prompt, text)
    try {
      const cleanJson = cleanJsonString(responseText)
      return JSON.parse(cleanJson) as { question: string; answer: string }[]
    } catch (e) {
      console.error('Failed to parse flashcards JSON. Raw output was:', responseText)
      throw new Error('AI generated invalid flashcard data. Please try again.')
    }
  },

  async generateQuiz(text: string): Promise<{ question: string; options: string[]; answer: number }[]> {
    const prompt = `Generate a multiple choice quiz of 3 questions based on the following text.
    Return ONLY a valid JSON array of objects, where each object has:
    - "question" (string)
    - "options" (array of 4 strings)
    - "answer" (integer index of the correct option, 0 to 3)
    Do not include any explanation or markdown formatting.`

    const responseText = await generateWithPrompt(prompt, text)
    try {
      const cleanJson = cleanJsonString(responseText)
      return JSON.parse(cleanJson) as { question: string; options: string[]; answer: number }[]
    } catch (e) {
      console.error('Failed to parse quiz JSON. Raw output was:', responseText)
      throw new Error('AI generated invalid quiz data. Please try again.')
    }
  },

  async extractKeyPoints(text: string): Promise<string> {
    const prompt = 'Extract the key concepts, main points, or important takeaways from the text below as a short bulleted list.'
    return generateWithPrompt(prompt, text)
  },

  async generateDefinitions(text: string): Promise<string> {
    const prompt = 'Identify any key terms or vocabulary in the following text and provide a concise definition for each.'
    return generateWithPrompt(prompt, text)
  },

  async suggestTags(text: string): Promise<string[]> {
    const prompt = `Analyze the text and suggest 2 to 5 relevant short tags (single words or short keywords, e.g. "history", "biology", "design").
    Return ONLY a valid JSON array of strings, e.g. ["tag1", "tag2"]. Do not include markdown.`

    const responseText = await generateWithPrompt(prompt, text)
    try {
      const cleanJson = cleanJsonString(responseText)
      return JSON.parse(cleanJson) as string[]
    } catch (e) {
      console.error('Failed to parse tags JSON:', responseText)
      return [] // fallback to no tags
    }
  }
}
