// backend/server.js - COM DATA DINÂMICA
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Configuração do Cloudinary - SUAS CREDENCIAIS AQUI!
const CLOUDINARY_CONFIG = {
  cloud_name: 'carboncars',
  api_key: process.env.CLOUDINARY_API_KEY || 'SUA_API_KEY_AQUI',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'SEU_API_SECRET_AQUI'
};

// Middleware
app.use(cors({
  origin: ['https://carbon.carlosmachado.tech', 'https://carbon.carlosmachado.tech'],
  credentials: true
}));
app.use(express.json());

// ✅ FUNÇÃO PARA OBTER DATA ATUAL NO FORMATO YYYY-MM-DD
function getCurrentDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ✅ FUNÇÃO PARA GERAR EXPRESSÃO DE BUSCA COM DATA DINÂMICA
function generateSearchExpression(additionalTerms = '') {
  const currentDate = getCurrentDate();
  
  let baseExpression = `resource_type:video AND (asset_folder:vendedores/*) AND (metadata.validade>${currentDate})`;
  
  if (additionalTerms && additionalTerms.trim()) {
    baseExpression = `${additionalTerms.trim()} AND ${baseExpression}`;
  }
  
  return baseExpression;
}

// Função para gerar assinatura do Cloudinary
function generateCloudinarySignature(params, apiSecret) {
  const timestamp = Math.floor(Date.now() / 1000);
  params.timestamp = timestamp;
  
  // Ordenar parâmetros
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  // Criar string para assinar
  const stringToSign = `${sortedParams}${apiSecret}`;
  
  // Gerar SHA1 hash
  const signature = crypto
    .createHash('sha1')
    .update(stringToSign)
    .digest('hex');
  
  return { signature, timestamp };
}

// ✅ ROTA CORRIGIDA - Buscar todos os vídeos com data dinâmica
app.get('/api/videos', async (req, res) => {
  try {
    const currentDate = getCurrentDate();
    console.log(`🔍 Buscando vídeos válidos a partir de: ${currentDate}`);
    
    // ✅ Usar expressão com data dinâmica
    const expression = generateSearchExpression();
    
    const searchBody = {
      expression: expression,
      with_field: ["metadata", "context", "tags"],
      max_results: 500,
      sort_by: [{"created_at": "desc"}]
    };

    console.log('📤 Expression de busca:', expression);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/resources/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`).toString('base64')}`
      },
      body: JSON.stringify(searchBody)
    });

    console.log('📥 Status da resposta:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro da API Cloudinary:', errorText);
      
      // ✅ FALLBACK: Se der erro de ordenação, tenta sem ordenação
      if (errorText.includes('sort format') || errorText.includes('Incorrect sort format')) {
        console.log('🔄 Tentando busca sem ordenação...');
        
        const fallbackBody = {
          expression: expression,
          with_field: ["metadata", "context", "tags"],
          max_results: 500
        };
        
        const fallbackResponse = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/resources/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`).toString('base64')}`
          },
          body: JSON.stringify(fallbackBody)
        });
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          
          // ✅ Ordenar manualmente no JavaScript
          if (fallbackData.resources) {
            fallbackData.resources.sort((a, b) => {
              return new Date(b.created_at) - new Date(a.created_at);
            });
            console.log('✅ Ordenação manual aplicada com sucesso');
          }
          
          console.log('✅ Vídeos encontrados (fallback):', fallbackData.resources?.length || 0);
          return res.json({
            ...fallbackData,
            _sorted_manually: true,
            _current_date: currentDate,
            _note: 'Ordenação feita manualmente devido a limitação da API'
          });
        }
      }
      
      return res.status(response.status).json({ 
        error: 'Erro na API do Cloudinary', 
        details: errorText 
      });
    }

    const data = await response.json();
    console.log('✅ Vídeos encontrados:', data.resources?.length || 0);
    
    res.json({
      ...data,
      _current_date: currentDate,
      _note: 'Busca realizada com data dinâmica'
    });

  } catch (error) {
    console.error('❌ Erro no servidor:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor', 
      message: error.message 
    });
  }
});

// ✅ ROTA CORRIGIDA - Buscar vídeos por termo com data dinâmica
app.post('/api/videos/search', async (req, res) => {
  try {
    const { searchTerm } = req.body;
    const currentDate = getCurrentDate();
    console.log(`🔍 Buscando vídeos com termo: "${searchTerm}" válidos a partir de: ${currentDate}`);
    
    // ✅ Usar expressão com data dinâmica
    const expression = generateSearchExpression(searchTerm);

    const searchBody = {
      expression: expression,
      with_field: ["metadata", "context", "tags"],
      max_results: 500,
      sort_by: [{"created_at": "desc"}]
    };

    console.log('📤 Expression de busca:', expression);

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
      console.error('❌ Erro da API Cloudinary:', errorText);
      
      // ✅ FALLBACK: Se der erro de ordenação, tenta sem ordenação
      if (errorText.includes('sort format') || errorText.includes('Incorrect sort format')) {
        console.log('🔄 Tentando busca sem ordenação...');
        
        const fallbackBody = {
          expression: expression,
          with_field: ["metadata", "context", "tags"],
          max_results: 500
        };
        
        const fallbackResponse = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/resources/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`).toString('base64')}`
          },
          body: JSON.stringify(fallbackBody)
        });
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          
          // ✅ Ordenar manualmente no JavaScript
          if (fallbackData.resources) {
            fallbackData.resources.sort((a, b) => {
              return new Date(b.created_at) - new Date(a.created_at);
            });
            console.log('✅ Ordenação manual aplicada com sucesso');
          }
          
          console.log('✅ Resultados da busca (fallback):', fallbackData.resources?.length || 0);
          return res.json({
            ...fallbackData,
            _sorted_manually: true,
            _current_date: currentDate,
            _search_term: searchTerm,
            _note: 'Ordenação feita manualmente devido a limitação da API'
          });
        }
      }
      
      return res.status(response.status).json({ 
        error: 'Erro na API do Cloudinary', 
        details: errorText 
      });
    }

    const data = await response.json();
    console.log('✅ Resultados da busca:', data.resources?.length || 0);
    
    res.json({
      ...data,
      _current_date: currentDate,
      _search_term: searchTerm,
      _note: 'Busca realizada com data dinâmica'
    });

  } catch (error) {
    console.error('❌ Erro no servidor:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor', 
      message: error.message 
    });
  }
});

// Rota para upload de vídeo (para admins)
app.post('/api/videos/upload', async (req, res) => {
  try {
    const { publicId, title, caption, tags } = req.body;
    
    // Gerar assinatura para upload
    const uploadParams = {
      public_id: `vendedores/${publicId}`,
      resource_type: 'video',
      context: `title=${title}|caption=${caption}`,
      tags: tags.join(','),
      metadata: JSON.stringify({
        validade: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        acesso_grupo_iesa: 'sim'
      })
    };

    const { signature, timestamp } = generateCloudinarySignature(uploadParams, CLOUDINARY_CONFIG.api_secret);
    
    res.json({
      signature,
      timestamp,
      api_key: CLOUDINARY_CONFIG.api_key,
      cloud_name: CLOUDINARY_CONFIG.cloud_name,
      upload_params: uploadParams
    });

  } catch (error) {
    console.error('❌ Erro ao gerar assinatura:', error);
    res.status(500).json({ 
      error: 'Erro ao gerar assinatura', 
      message: error.message 
    });
  }
});

// Rota de teste
app.get('/api/health', (req, res) => {
  const currentDate = getCurrentDate();
  res.json({ 
    status: 'OK', 
    message: 'Backend funcionando!', 
    cloudinary_configured: !!(CLOUDINARY_CONFIG.api_key && CLOUDINARY_CONFIG.api_secret),
    current_date: currentDate,
    timestamp: new Date().toISOString()
  });
});

// ✅ ROTA PARA TESTAR EXPRESSÕES COM DATA DINÂMICA
app.get('/api/test-expressions', (req, res) => {
  const currentDate = getCurrentDate();
  
  const testExpressions = [
    {
      name: 'Busca geral',
      expression: generateSearchExpression(),
      description: 'Todos os vídeos válidos'
    },
    {
      name: 'Busca com termo',
      expression: generateSearchExpression('carro'),
      description: 'Vídeos com termo "carro" válidos'
    },
    {
      name: 'Busca com múltiplos termos',
      expression: generateSearchExpression('carro AND sedan'),
      description: 'Vídeos com "carro" E "sedan" válidos'
    }
  ];
  
  res.json({
    current_date: currentDate,
    expressions: testExpressions,
    note: 'Todas as expressões usam a data atual para filtrar vídeos válidos'
  });
});

// ✅ ROTA PARA TESTAR DIFERENTES FORMATOS DE ORDENAÇÃO
app.get('/api/test-sort', async (req, res) => {
  const testResults = [];
  const currentDate = getCurrentDate();
  
  // Teste 1: Formato objeto (recomendado)
  try {
    const testBody1 = {
      expression: generateSearchExpression(),
      max_results: 5,
      sort_by: [{"created_at": "desc"}]
    };
    
    const response1 = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/resources/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`).toString('base64')}`
      },
      body: JSON.stringify(testBody1)
    });
    
    testResults.push({
      method: 'object_format',
      status: response1.ok ? 'success' : 'error',
      status_code: response1.status,
      error: response1.ok ? null : await response1.text()
    });
  } catch (error) {
    testResults.push({
      method: 'object_format',
      status: 'error',
      error: error.message
    });
  }
  
  // Teste 2: Formato array aninhado (que estava causando erro)
  try {
    const testBody2 = {
      expression: generateSearchExpression(),
      max_results: 5,
      sort_by: [["created_at", "desc"]]
    };
    
    const response2 = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/resources/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`).toString('base64')}`
      },
      body: JSON.stringify(testBody2)
    });
    
    testResults.push({
      method: 'nested_array_format',
      status: response2.ok ? 'success' : 'error',
      status_code: response2.status,
      error: response2.ok ? null : await response2.text()
    });
  } catch (error) {
    testResults.push({
      method: 'nested_array_format',
      status: 'error',
      error: error.message
    });
  }
  
  // Teste 3: Sem ordenação
  try {
    const testBody3 = {
      expression: generateSearchExpression(),
      max_results: 5
    };
    
    const response3 = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/resources/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`).toString('base64')}`
      },
      body: JSON.stringify(testBody3)
    });
    
    testResults.push({
      method: 'no_sorting',
      status: response3.ok ? 'success' : 'error',
      status_code: response3.status,
      error: response3.ok ? null : await response3.text()
    });
  } catch (error) {
    testResults.push({
      method: 'no_sorting',
      status: 'error',
      error: error.message
    });
  }
  
  res.json({
    success: true,
    current_date: currentDate,
    test_results: testResults,
    recommendation: 'Use object_format se funcionar, senão use no_sorting + ordenação manual'
  });
});

// Rota para testar credenciais
app.get('/api/test-cloudinary', async (req, res) => {
  try {
    console.log('🧪 Testando credenciais do Cloudinary...');
    
    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloud_name}/resources/image`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${CLOUDINARY_CONFIG.api_key}:${CLOUDINARY_CONFIG.api_secret}`).toString('base64')}`
      }
    });

    console.log('📥 Status do teste:', response.status);

    if (response.ok) {
      res.json({ 
        success: true, 
        message: 'Credenciais do Cloudinary funcionando!',
        cloud_name: CLOUDINARY_CONFIG.cloud_name,
        current_date: getCurrentDate()
      });
    } else {
      const errorText = await response.text();
      res.status(response.status).json({ 
        success: false, 
        error: 'Credenciais inválidas', 
        details: errorText 
      });
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao testar credenciais', 
      message: error.message 
    });
  }
});

const PORT_FINAL = process.env.PORT || 5001;

app.listen(PORT_FINAL, () => {
  const currentDate = getCurrentDate();
  console.log(`🚀 Backend rodando na porta ${PORT_FINAL}`);
  console.log(`📊 Cloudinary configurado: ${CLOUDINARY_CONFIG.cloud_name}`);
  console.log(`🔑 API Key configurada: ${CLOUDINARY_CONFIG.api_key ? 'SIM' : 'NÃO'}`);
  console.log(`🔐 API Secret configurada: ${CLOUDINARY_CONFIG.api_secret ? 'SIM' : 'NÃO'}`);
  console.log(`📅 Data atual para filtros: ${currentDate}`);
  console.log(`🌐 CORS habilitado para: https://carbon.carlosmachado.tech`);
  console.log(`🔗 Endpoints disponíveis:`);
  console.log(`   GET  /api/health - Status do servidor`);
  console.log(`   GET  /api/videos - Buscar todos os vídeos válidos`);
  console.log(`   POST /api/videos/search - Buscar vídeos por termo`);
  console.log(`   GET  /api/test-expressions - Testar expressões de busca`);
  console.log(`   GET  /api/test-sort - Testar formatos de ordenação`);
  console.log(`   GET  /api/test-cloudinary - Testar credenciais`);
});

module.exports = app;