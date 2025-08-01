// backend/server.js
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Configuração do Cloudinary
const CLOUDINARY_CONFIG = {
  cloud_name: 'carboncars',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
};

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://carboncontent.carlosmachado.tech'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// ✅ ENDPOINT DE CONFIRMAÇÃO (A SOLUÇÃO)
// Este endpoint atua como um proxy para o link de confirmação do Supabase.
app.get('/api/confirm', (req, res) => {
  const { confirmation_url } = req.query;

  if (confirmation_url) {
    console.log(`🔗 Redirecionando para o URL de confirmação: ${confirmation_url}`);
    // Redireciona o utilizador para o link final do Supabase.
    res.redirect(confirmation_url);
  } else {
    res.status(400).send('URL de confirmação não fornecido.');
  }
});


// FUNÇÃO PARA OBTER DATA ATUAL NO FORMATO YYYY-MM-DD
function getCurrentDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// FUNÇÃO PARA GERAR EXPRESSÃO DE BUSCA COM DATA DINÂMICA
function generateSearchExpression(additionalTerms = '') {
  const currentDate = getCurrentDate();
  let baseExpression = `resource_type:video AND (asset_folder:vendedores/*) AND (metadata.validade>${currentDate})`;
  if (additionalTerms && additionalTerms.trim()) {
    baseExpression = `${additionalTerms.trim()} AND ${baseExpression}`;
  }
  return baseExpression;
}

// ROTA - Buscar todos os vídeos com data dinâmica
app.get('/api/videos', async (req, res) => {
  try {
    const expression = generateSearchExpression();
    const searchBody = {
      expression: expression,
      with_field: ["metadata", "context", "tags"],
      max_results: 500,
      sort_by: [{"created_at": "desc"}]
    };

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/resources/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`).toString('base64')}`
      },
      body: JSON.stringify(searchBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ 
            error: 'Erro na API do Cloudinary', 
            details: errorText 
        });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    res.status(500).json({ 
      error: 'Erro interno do servidor', 
      message: error.message 
    });
  }
});

// ROTA - Buscar vídeos por termo com data dinâmica
app.post('/api/videos/search', async (req, res) => {
  try {
    const { searchTerm } = req.body;
    const expression = generateSearchExpression(searchTerm);

    const searchBody = {
      expression: expression,
      with_field: ["metadata", "context", "tags"],
      max_results: 500,
      sort_by: [{"created_at": "desc"}]
    };

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/resources/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`).toString('base64')}`
      },
      body: JSON.stringify(searchBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ 
        error: 'Erro na API do Cloudinary', 
        details: errorText 
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    res.status(500).json({ 
      error: 'Erro interno do servidor', 
      message: error.message 
    });
  }
});

// Rota de teste
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend funcionando!', 
  });
});

const PORT_FINAL = process.env.PORT || 5001;

app.listen(PORT_FINAL, () => {
  console.log(`🚀 Backend rodando na porta ${PORT_FINAL}`);
});

module.exports = app;
