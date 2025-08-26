// backend/server.js
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// --- CONFIGURAÇÕES ---
const CLOUDINARY_CONFIG = {
  cloud_name: 'carboncars',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// --- MIDDLEWARE ---
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://carboncontent.carlosmachado.tech',
  'https://carbon-content-frontend.qqbqnt.easypanel.host'
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

// --- ROTAS PÚBLICAS E DE MÍDIA ---
app.get('/api/confirm', (req, res) => {
  const { confirmation_url } = req.query;
  if (confirmation_url) {
    res.redirect(confirmation_url);
  } else {
    res.status(400).send('URL de confirmação não fornecido.');
  }
});

function getCurrentDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function generateSearchExpression(additionalTerms = '') {
  const currentDate = getCurrentDate();
  let baseExpression = `(resource_type:video OR resource_type:image) AND (asset_folder:vendedores/*) AND (metadata.validade>${currentDate})`;
  if (additionalTerms && additionalTerms.trim()) {
    baseExpression = `${additionalTerms.trim()} AND ${baseExpression}`;
  }
  return baseExpression;
}

app.get('/api/media', async (req, res) => {
  try {
    const expression = generateSearchExpression();
    const searchBody = { expression, with_field: ["metadata", "context", "tags"], max_results: 500, sort_by: [{"created_at": "desc"}] };
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/resources/search`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${Buffer.from(`${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`).toString('base64')}` }, body: JSON.stringify(searchBody) });
    if (!response.ok) throw new Error('Erro na API do Cloudinary');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  }
});

app.post('/api/media/search', async (req, res) => {
  try {
    const { searchTerm } = req.body;
    const expression = generateSearchExpression(searchTerm);
    const searchBody = { expression, with_field: ["metadata", "context", "tags"], max_results: 500, sort_by: [{"created_at": "desc"}] };
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/resources/search`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${Buffer.from(`${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`).toString('base64')}` }, body: JSON.stringify(searchBody) });
    if (!response.ok) throw new Error('Erro na API do Cloudinary');
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro interno do servidor', message: error.message });
  }
});


// --- ROTAS DA API ADMIN ---

const checkAdminConfig = (req, res, next) => {
    if (!SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
        const missingKeys = [];
        if (!SUPABASE_SERVICE_KEY) missingKeys.push('SUPABASE_SERVICE_ROLE_KEY');
        if (!SUPABASE_ANON_KEY) missingKeys.push('SUPABASE_ANON_KEY');
        const errorMessage = `Erro de configuração no servidor. As seguintes chaves não foram encontradas no arquivo .env do backend: ${missingKeys.join(', ')}`;
        console.error(`ERRO GRAVE: ${errorMessage}`);
        return res.status(500).json({ error: 'Erro de Configuração', details: errorMessage });
    }
    next();
};

const getAdminHeaders = () => ({
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json'
});

app.get('/api/admin/users', checkAdminConfig, async (req, res) => {
    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, { method: 'GET', headers: getAdminHeaders() });
        const data = await response.json();
        if (!response.ok) throw data;
        res.json(data);
    } catch (error) {
        console.error("Erro ao buscar usuários (Admin):", error);
        res.status(error.code || 500).json({ error: 'Falha ao buscar usuários', details: error.message || 'Erro desconhecido.' });
    }
});

app.post('/api/admin/invite', checkAdminConfig, async (req, res) => {
    const { users } = req.body;

    if (!users || !Array.isArray(users) || users.length === 0) {
        return res.status(400).json({ error: 'A lista de usuários (users) é obrigatória.' });
    }

    const invitePromises = users.map(user => {
        const { email, name } = user;
        if (!email) {
            return Promise.resolve({ email: 'Inválido', status: 'rejected', reason: 'Email não fornecido.' });
        }

        const invitePayload = {
            email: email.trim(),
            data: {
                name: name || ''
            }
        };

        return fetch(`${SUPABASE_URL}/auth/v1/invite`, {
            method: 'POST',
            headers: getAdminHeaders(),
            body: JSON.stringify(invitePayload)
        }).then(async response => {
            if (response.ok) {
                return { email, status: 'fulfilled' };
            }
            const errorText = await response.text();
            let reason = 'Erro desconhecido';
            try {
                const errorJson = JSON.parse(errorText);
                reason = errorJson.msg || errorJson.message || errorText;
            } catch (e) {
                reason = errorText;
            }
            return { email, status: 'rejected', reason };
        });
    });

    const results = await Promise.all(invitePromises);

    const successful = results.filter(r => r.status === 'fulfilled').map(r => r.email);
    const failed = results.filter(r => r.status === 'rejected').map(r => {
        let cleanReason = r.reason;
        if (cleanReason.includes('duplicate key') || cleanReason.includes('already exists')) {
            cleanReason = 'Usuário já existe.';
        } else if (cleanReason.includes('Failed to send email')) {
            cleanReason = 'Falha no envio do e-mail (SMTP).';
        }
        return { email: r.email, reason: cleanReason };
    });

    res.status(200).json({ successful, failed });
});


app.post('/api/admin/recover', checkAdminConfig, async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email é obrigatório.' });
    }
    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
            method: 'POST',
            headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw errorData;
        }

        res.status(200).json({ message: 'Link de recuperação enviado com sucesso.' });
    } catch (error) {
        console.error("Erro ao enviar link de recuperação (Admin):", error);
        res.status(error.code || 500).json({ error: error.msg || 'Falha ao enviar link de recuperação', details: error.message || 'Erro desconhecido.' });
    }
});


app.put('/api/admin/users/:id', checkAdminConfig, async (req, res) => {
    const { id } = req.params;
    const { role, name } = req.body;

    const user_metadata = {};
    if (role) {
        user_metadata.role = role;
    }
    if (typeof name === 'string') {
        user_metadata.name = name;
    }

    if (Object.keys(user_metadata).length === 0) {
        return res.status(400).json({ error: 'Nenhum dado para atualizar. Forneça "name" e/ou "role".' });
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
            method: 'PUT',
            headers: getAdminHeaders(),
            body: JSON.stringify({ user_metadata })
        });
        const data = await response.json();
        if (!response.ok) throw data;

        res.json(data);
    } catch (error) {
        console.error("Erro ao atualizar usuário (Admin):", error);
        res.status(error.code || 500).json({ error: 'Falha ao atualizar usuário', details: error.message });
    }
});

app.delete('/api/admin/users/:id', checkAdminConfig, async (req, res) => {
    const { id } = req.params;
    try {
        const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: getAdminHeaders() });
        if (response.status !== 204 && response.status !== 200) {
             const errorData = await response.json().catch(() => ({}));
             throw errorData;
        }
        res.status(204).send();
    } catch (error) {
        console.error("Erro ao deletar usuário (Admin):", error);
        res.status(error.code || 500).json({ error: 'Falha ao deletar usuário', details: error.message });
    }
});

// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(PORT, () => {
  console.log(`🚀 Backend rodando na porta ${PORT}`);
});

module.exports = app;
