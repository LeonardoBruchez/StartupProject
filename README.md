# EduSpark

### Plataforma em desenvolvimento

Aplicacao para gerar material de estudo a partir de PDF:
- Resumo (rapido/profundo)
- Perguntas (treino/simulado)
- Campo de informacoes adicionais para orientar a IA

## Tecnologias

- Frontend: React + Vite
- Backend: Express
- Upload de PDF: Multer
- Extracao de texto: pdf-parse
- IA: OpenAI API (com fallback mock sem chave)

## 1. Configurar variaveis de ambiente

1. Copie [ .env.example ] para um arquivo chamado `.env` na raiz.
2. Preencha sua chave:

```env
OPENAI_API_KEY=sua_chave_real
OPENAI_MODEL=gpt-4o-mini
PORT=8787
```

Se `OPENAI_API_KEY` nao for informada, o backend responde com modo mock (para voce testar o fluxo sem custo).

## 2. Instalar dependencias

```bash
npm install
```

## 3. Rodar frontend + backend juntos

```bash
npm run dev
```

Isso sobe:
- Vite (frontend)
- API em `http://localhost:8787`

## 4. Fluxo de uso

1. Envie um PDF.
2. Escolha formato de estudo: resumo ou perguntas.
3. Ajuste dificuldade e opcoes de modo.
4. Preencha informacoes adicionais (opcional).
5. Clique em gerar.

## Endpoints da API

- `GET /api/health`
	- Retorna status e se existe chave configurada.

- `POST /api/study-material`
	- `multipart/form-data`
	- Campos esperados:
		- `file` (PDF)
		- `studyType` (`summary` ou `questions`)
		- `summaryMode` (`quick` ou `deep`)
		- `questionMode` (`practice` ou `simulation`)
		- `questionCount` (numero)
		- `difficulty` (`beginner`, `intermediate`, `expert`)
		- `additionalInfo` (texto opcional)

## Observacoes importantes

- A chave da IA fica apenas no backend.
- O frontend chama `\/api\/study-material` e o Vite faz proxy para a API local.
- PDFs escaneados (imagem) podem precisar de OCR para melhorar a extracao.
