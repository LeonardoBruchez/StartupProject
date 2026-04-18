import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pdf from 'pdf-parse-fork'; // Biblioteca atualizada para Node 24
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fallback: se iniciar o processo na raiz, tenta carregar server/.env.
if (!process.env.GEMINI_API_KEY) {
  dotenv.config({ path: path.join(__dirname, '.env') });
}

const app = express();
const port = process.env.PORT || 8787;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

app.use(cors());
app.use(express.json());

// --- FUNÇÕES DE SUPORTE ---

function limitText(text, maxChars = 30000) {
  if (!text) return '';
  return text.length > maxChars ? `${text.slice(0, maxChars)}... [TRUNCADO]` : text;
}

function buildPrompt(studyType, sourceText, difficulty, count) {
  const format = studyType === 'summary' 
    ? '{"type": "summary", "title": "...", "content": "..."}'
    : '{"type": "questions", "questions": [{"id": 1, "statement": "...", "options": ["A","B","C","D"], "answer": "A", "explanation": "..."}]}';

  return `
    Você é um professor assistente. Com base no texto abaixo, gere um ${studyType === 'summary' ? 'RESUMO' : 'QUESTIONÁRIO com ' + count + ' questões'}.
    Nível: ${difficulty}.
    
    TEXTO:
    ${sourceText}

    RETORNE APENAS O JSON:
    ${format}
  `;
}

function isQuotaExceededError(error) {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('429') || message.includes('quota exceeded') || message.includes('too many requests');
}

function buildMockStudyMaterial(studyType, sourceText, difficulty, questionCount, questionMode, additionalInfo) {
  if (studyType === 'questions') {
    const total = Number(questionCount) || 5;
    const questions = Array.from({ length: total }, (_, index) => ({
      id: index + 1,
      statement: `Questao ${index + 1}: com base no texto, qual alternativa melhor representa a ideia principal?`,
      options: [
        'Conceito central apresentado no documento',
        'Detalhe secundario sem relacao com o tema',
        'Informacao contraditoria ao texto base',
        'Conclusao sem evidencia no documento',
      ],
      answer: 'A',
      explanation: 'A alternativa A resume o foco principal abordado no material.',
    }));

    return {
      type: 'questions',
      title: 'Questionario (modo mock por limite de cota)',
      mode: 'mock',
      difficulty,
      questionMode: questionMode === 'simulation' ? 'simulation' : 'practice',
      additionalInfo: additionalInfo || '',
      questions,
      contentPreview: sourceText.slice(0, 250),
    };
  }

  return {
    type: 'summary',
    title: 'Resumo (modo mock por limite de cota)',
    content: `A API de IA atingiu o limite de cota e o sistema retornou um resumo de contingencia para testes.\n\nTrecho do material analisado:\n${sourceText.slice(0, 600) || 'Sem texto extraido suficiente.'}`,
  };
}

function parseModelJson(rawText) {
  const normalizedText = rawText.replace(/```json|```/g, '').trim();
  return JSON.parse(normalizedText);
}

async function generateWithModelFallback(genAI, preferredModel, prompt) {
  const modelCandidates = [
    preferredModel,
    'gemini-3-flash-preview',
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
  ].filter(Boolean);

  const uniqueModels = [...new Set(modelCandidates)];
  let lastError;

  for (const modelName of uniqueModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      return result;
    } catch (error) {
      lastError = error;
      const message = String(error?.message || '');
      const isModelNotFound = message.includes('404 Not Found') || message.includes('is not found');
      if (!isModelNotFound) {
        throw error;
      }
      console.warn(`[IA] Modelo indisponivel: ${modelName}. Tentando proximo...`);
    }
  }

  throw lastError;
}

// --- ROTA PRINCIPAL ---

app.post('/api/study-material', upload.single('file'), async (req, res) => {
  let sourceText = '';
  try {
    if (!req.file) return res.status(400).json({ error: 'Envie um PDF.' });

    console.log(`[PDF] Lendo arquivo: ${req.file.originalname}`);

    // Com pdf-parse-fork, a chamada volta a ser simples e direta
    const data = await pdf(req.file.buffer);
    sourceText = limitText(data.text);
    
    console.log(`[PDF] Texto extraído (${sourceText.length} caracteres).`);

    const apiKey = process.env.GEMINI_API_KEY;
    const forceMockMode = String(process.env.AI_FORCE_MOCK || '').toLowerCase() === 'true';

    if (forceMockMode) {
      console.warn('[IA] AI_FORCE_MOCK=true. Retornando mock sem chamar Gemini.');
      const mock = buildMockStudyMaterial(
        req.body.studyType,
        sourceText,
        req.body.difficulty || 'intermediate',
        req.body.questionCount,
        req.body.questionMode,
        req.body.additionalInfo
      );

      return res.json({
        ...mock,
        warning: 'Modo mock forcado ativo no .env (AI_FORCE_MOCK=true).',
        timestamp: new Date().toLocaleString('pt-BR'),
      });
    }

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY nao configurada no .env.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const preferredModel = (process.env.GEMINI_MODEL || 'gemini-3-flash-preview')
      .trim()
      .replace(/[.;,\s]+$/g, '');

    console.log(`[IA] Chamando Gemini para ${req.body.studyType}...`);
    
    const prompt = buildPrompt(
      req.body.studyType, 
      sourceText, 
      req.body.difficulty,
      req.body.questionCount
    );

    const result = await generateWithModelFallback(genAI, preferredModel, prompt);
    const parsed = parseModelJson(result.response.text());

    res.json({
      ...parsed,
      timestamp: new Date().toLocaleString('pt-BR'),
    });

    console.log('[IA] Sucesso!');

  } catch (error) {
    if (isQuotaExceededError(error)) {
      console.warn('[IA] Quota excedida no Gemini. Retornando mock para manter o fluxo de testes.');
      const mock = buildMockStudyMaterial(
        req.body.studyType,
        sourceText,
        req.body.difficulty || 'intermediate',
        req.body.questionCount,
        req.body.questionMode,
        req.body.additionalInfo
      );

      return res.json({
        ...mock,
        warning: 'Quota da Gemini excedida. Resposta mock retornada para testes.',
        timestamp: new Date().toLocaleString('pt-BR'),
      });
    }

    console.error('[ERRO]:', error.message);
    res.status(500).json({ error: 'Erro: ' + error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 SERVIDOR RODANDO EM http://localhost:${port}`);
});