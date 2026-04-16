import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import { PDFParse } from 'pdf-parse';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 8787;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
      return;
    }
    cb(new Error('Apenas arquivos PDF sao permitidos.'));
  },
});

app.use(cors());
app.use(express.json());

const difficultyLabels = {
  beginner: 'INICIANTE',
  intermediate: 'INTERMEDIARIO',
  expert: 'AVANCADO',
};

const summaryModeLabels = {
  quick: 'RAPIDO',
  deep: 'APROFUNDADO',
};

const questionModeLabels = {
  practice: 'TREINO',
  simulation: 'SIMULADO',
};

function limitText(text, maxChars = 70000) {
  if (!text) return '';
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n\n[TEXTO TRUNCADO]` : text;
}

function buildMockSummary({ baseName, difficulty, summaryMode, additionalInfo, sourceText }) {
  return {
    type: 'summary',
    title: `Resumo: ${baseName}`,
    content: [
      'Resumo gerado em modo mock (sem chave de IA configurada).',
      '',
      `NIVEL: ${difficultyLabels[difficulty]} | MODO: ${summaryModeLabels[summaryMode]}`,
      '',
      'Principais pontos identificados no PDF:',
      `1. Introducao ao tema central de ${baseName}.`,
      '2. Conceitos e definicoes importantes para revisao.',
      '3. Aplicacoes praticas e exemplos comuns em prova.',
      '4. Fechamento com foco em revisao rapida.',
      '',
      additionalInfo ? `Contexto adicional considerado: ${additionalInfo}` : 'Sem contexto adicional informado.',
      '',
      `Trecho detectado no PDF: ${sourceText.slice(0, 300) || 'Nao foi possivel extrair texto.'}`,
    ].join('\n'),
  };
}

function buildMockQuestions({ baseName, difficulty, questionMode, questionCount, additionalInfo }) {
  const topics = [
    'conceitos basicos',
    'analise de caso',
    'aplicacao pratica',
    'revisao teorica',
    'interpretacao',
  ];

  const questions = Array.from({ length: questionCount }, (_, index) => {
    const topic = topics[index % topics.length];
    return {
      id: index + 1,
      statement: `No contexto de ${baseName}, qual alternativa melhor responde sobre ${topic}?`,
      options: ['Alternativa A', 'Alternativa B', 'Alternativa C', 'Alternativa D'],
      answer: ['A', 'B', 'C', 'D'][index % 4],
      explanation: `Explicacao de treino para ${topic} no nivel ${difficultyLabels[difficulty].toLowerCase()}.`,
    };
  });

  return {
    type: 'questions',
    title: `${questionMode === 'practice' ? 'Treino' : 'Simulado'}: ${baseName}`,
    mode: questionModeLabels[questionMode],
    questionMode,
    questions,
    additionalInfo,
  };
}

async function generateWithOpenAI({
  studyType,
  summaryMode,
  questionMode,
  questionCount,
  difficulty,
  additionalInfo,
  baseName,
  sourceText,
}) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const systemPrompt = [
    'Voce e um especialista educacional em criacao de materiais para estudo.',
    'Responda SOMENTE em JSON valido.',
    'Nao use markdown e nao inclua texto fora do JSON.',
    'Idioma: portugues do Brasil.',
  ].join(' ');

  const outputShape = studyType === 'summary'
    ? `{
  "type": "summary",
  "title": "Resumo: ...",
  "content": "texto completo"
}`
    : `{
  "type": "questions",
  "title": "Treino: ... ou Simulado: ...",
  "mode": "TREINO ou SIMULADO",
  "questionMode": "practice ou simulation",
  "questions": [
    {
      "id": 1,
      "statement": "...",
      "options": ["A...", "B...", "C...", "D..."],
      "answer": "A",
      "explanation": "..."
    }
  ]
}`;

  const userPrompt = [
    `Arquivo base: ${baseName}`,
    `Tipo de estudo: ${studyType}`,
    `Dificuldade: ${difficulty} (${difficultyLabels[difficulty]})`,
    studyType === 'summary'
      ? `Modo de resumo: ${summaryMode} (${summaryModeLabels[summaryMode]})`
      : `Modo de questoes: ${questionMode} (${questionModeLabels[questionMode]}) com ${questionCount} questoes`,
    `Informacoes adicionais do usuario: ${additionalInfo || 'nenhuma'}`,
    'Texto extraido do PDF:',
    sourceText,
    '',
    'Retorne neste formato JSON exatamente com os campos esperados:',
    outputShape,
  ].join('\n');

  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error('A IA nao retornou conteudo.');
  }

  const parsed = JSON.parse(raw);

  if (studyType === 'summary') {
    return {
      type: 'summary',
      title: parsed.title || `Resumo: ${baseName}`,
      content: parsed.content || 'Nao foi possivel montar o resumo.',
    };
  }

  const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
  return {
    type: 'questions',
    title: parsed.title || `${questionMode === 'practice' ? 'Treino' : 'Simulado'}: ${baseName}`,
    mode: parsed.mode || questionModeLabels[questionMode],
    questionMode: parsed.questionMode || questionMode,
    questions: questions.map((question, index) => ({
      id: Number(question.id) || index + 1,
      statement: question.statement || `Questao ${index + 1}`,
      options: Array.isArray(question.options) && question.options.length === 4
        ? question.options
        : ['Alternativa A', 'Alternativa B', 'Alternativa C', 'Alternativa D'],
      answer: question.answer || 'A',
      explanation: question.explanation || 'Sem explicacao fornecida.',
    })),
  };
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY),
  });
});

app.post('/api/study-material', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo PDF foi enviado.' });
    }

    const studyType = req.body.studyType === 'questions' ? 'questions' : 'summary';
    const summaryMode = req.body.summaryMode === 'deep' ? 'deep' : 'quick';
    const questionMode = req.body.questionMode === 'simulation' ? 'simulation' : 'practice';
    const questionCount = Number(req.body.questionCount) || 10;
    const difficulty = ['beginner', 'intermediate', 'expert'].includes(req.body.difficulty)
      ? req.body.difficulty
      : 'intermediate';
    const additionalInfo = (req.body.additionalInfo || '').trim();

    const parser = new PDFParse({ data: req.file.buffer });
    const pdfData = await parser.getText();
    await parser.destroy();
    const sourceText = limitText((pdfData.text || '').replace(/\s{2,}/g, ' ').trim());
    const baseName = req.file.originalname.replace(/\.pdf$/i, '');

    const materialInput = {
      studyType,
      summaryMode,
      questionMode,
      questionCount,
      difficulty,
      additionalInfo,
      baseName,
      sourceText,
    };

    const generated = process.env.OPENAI_API_KEY
      ? await generateWithOpenAI(materialInput)
      : (studyType === 'summary'
        ? buildMockSummary(materialInput)
        : buildMockQuestions(materialInput));

    const responsePayload = {
      ...generated,
      difficulty: difficultyLabels[difficulty],
      additionalInfo,
      timestamp: new Date().toLocaleString('pt-BR'),
    };

    return res.json(responsePayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno ao processar o arquivo.';
    return res.status(500).json({ error: message });
  }
});

app.use((error, _req, res) => {
  const message = error instanceof Error ? error.message : 'Erro inesperado.';
  res.status(400).json({ error: message });
});

app.listen(port, () => {
  console.log(`API de estudo rodando em http://localhost:${port}`);
});
