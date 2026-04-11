import React, { useState, useRef } from 'react';
import { Upload, FileText, Zap, Brain, Download, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import './index.css';

function App() {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('quick');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
    } else {
      alert('Por favor, selecione um arquivo PDF.');
    }
  };

  const handleGenerate = () => {
    if (!file) return;

    setIsGenerating(true);
    setResult(null);

    // Simulação do processamento da IA
    setTimeout(() => {
      setIsGenerating(false);
      setResult({
        title: `Resumo: ${file.name.replace('.pdf', '')}`,
        content: `Este é um exemplo de como o resumo aparecerá. 
        \n\nNível: ${difficulty.toUpperCase()} | Modo: ${mode === 'quick' ? 'RÁPIDO' : 'APROFUNDADO'}
        \n\nPrincipais Pontos:
        1. Resumo estruturado do conteúdo acadêmico.
        2. Principais conceitos e definições chaves.
        3. Fórmulas ou metodologias importantes identificadas no texto.
        4. Conclusões e insights derivados do plano de aula.
        \n\nA IA do EduSpark analisou seu arquivo e formatou estas informações para facilitar seu estudo.`,
        timestamp: new Date().toLocaleString()
      });
    }, 3000);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
  };

  return (
    <div className="container">
      <header>
        <h1>EduSpark</h1>
        <p className="subtitle">Transforme seus planos de aula em resumos e provas inteligentes em segundos com o poder da IA.</p>
      </header>

      <main className="glass-card">
        {!result ? (
          <>
            <div className="upload-section">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".pdf"
                style={{ display: 'none' }}
              />
              <div
                className={`dropzone ${file ? 'active' : ''}`}
                onClick={() => fileInputRef.current.click()}
              >
                {file ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <CheckCircle2 color="#8b5cf6" size={48} style={{ marginBottom: '1rem' }} />
                    <p style={{ fontWeight: 600 }}>{file.name}</p>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Arquivo carregado com sucesso</p>
                  </div>
                ) : (
                  <>
                    <Upload className="dropzone-icon" color="var(--primary)" />
                    <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>Arraste seu PDF aqui</p>
                    <p style={{ color: 'var(--text-muted)' }}>ou clique para procurar no seu computador</p>
                  </>
                )}
              </div>
            </div>

            <div className="controls">
              <div className="control-group">
                <label>Modo de Resumo</label>
                <div className="radio-group">
                  <button
                    className={`option-btn ${mode === 'quick' ? 'selected' : ''}`}
                    onClick={() => setMode('quick')}
                  >
                    <Zap size={16} style={{ marginBottom: '4px' }} /><br />Rápido
                  </button>
                  <button
                    className={`option-btn ${mode === 'deep' ? 'selected' : ''}`}
                    onClick={() => setMode('deep')}
                  >
                    <Brain size={16} style={{ marginBottom: '4px' }} /><br />Profundo
                  </button>
                </div>
              </div>

              <div className="control-group">
                <label>Nível de Dificuldade</label>
                <div className="radio-group">
                  <button
                    className={`option-btn ${difficulty === 'beginner' ? 'selected' : ''}`}
                    onClick={() => setDifficulty('beginner')}
                  >
                    Iniciante
                  </button>
                  <button
                    className={`option-btn ${difficulty === 'intermediate' ? 'selected' : ''}`}
                    onClick={() => setDifficulty('intermediate')}
                  >
                    Interm.
                  </button>
                  <button
                    className={`option-btn ${difficulty === 'expert' ? 'selected' : ''}`}
                    onClick={() => setDifficulty('expert')}
                  >
                    Avançado
                  </button>
                </div>
              </div>
            </div>

            <button
              className="generate-btn"
              disabled={!file || isGenerating}
              onClick={handleGenerate}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" /> Processando...
                </>
              ) : (
                <>
                  <Sparkles size={20} /> Gerar Material de Estudo
                </>
              )}
            </button>
          </>
        ) : (
          <div className="result-section">
            <div className="result-header">
              <h2>{result.title}</h2>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="download-btn" onClick={() => window.print()}>
                  <Download size={18} /> Baixar PDF
                </button>
                <button className="download-btn" style={{ background: 'transparent' }} onClick={reset}>
                  Novo Texto
                </button>
              </div>
            </div>
            <div className="content-preview">
              <p style={{ whiteSpace: 'pre-wrap' }}>{result.content}</p>
            </div>
            <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Gerado em {result.timestamp} • EduSpark AI
            </p>
          </div>
        )}
      </main>

      <footer style={{ marginTop: 'auto', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        &copy; 2026 EduSpark - Revolucionando o aprendizado acadêmico.
      </footer>
    </div>
  );
}

export default App;
