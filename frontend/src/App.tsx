import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, X, Filter, Upload, Library, Play, Loader2, 
  Download, Calendar, Clock, Hash, ChevronDown, 
  AlertCircle, LogOut, MessageCircle, Share2
} from 'lucide-react';
import './App.css';

// Interfaces
interface CloudinaryVideo {
  public_id: string;
  display_name: string;
  format: string;
  duration: number;
  bytes: number;
  secure_url: string;
  created_at: string;
  tags: string[];
  metadata?: {
    legenda?: string;
  };
  context?: {
    custom?: {
      title?: string;
      caption?: string;
      montadora?: string;
      tipo?: string;
    };
  };
}

interface User {
  id: string;
  email: string;
}

// Configurações
const CLOUDINARY_CLOUD_NAME = 'dwi8kiqq5';
const SUPABASE_URL = 'https://dmrdhhmwxwhhpibqzbyf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtcmRoaG13eHdoaHBpYnF6YnlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ5NTY1MTMsImV4cCI6MjA0MDUzMjUxM30.JkQN5JAkOrsaU5bFLhvdJKKj8NVGOug86cR_tBluJmI';

// Classe simplificada para autenticação
class SupabaseClient {
  private url: string;
  private anonKey: string;
  private token: string | null = null;

  constructor(url: string, anonKey: string) {
    this.url = url;
    this.anonKey = anonKey;
    this.token = localStorage.getItem('supabase_token');
  }

  private getHeaders() {
    return {
      'apikey': this.anonKey,
      'Authorization': `Bearer ${this.token || this.anonKey}`,
      'Content-Type': 'application/json'
    };
  }

  async signIn(email: string, password: string): Promise<{ data: { user: User, session: any }, error: any }> {
    try {
      const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || data.error_description || 'Erro de autenticação');
      }

      this.token = data.access_token;
      const userResponse = await fetch(`${this.url}/auth/v1/user`, {
        headers: this.getHeaders()
      });
      const userData = await userResponse.json();

      const result = {
        user: userData,
        session: data
      };

      if (this.token && data.user) {
        localStorage.setItem('supabase_token', this.token);
        localStorage.setItem('supabase_user', JSON.stringify(data.user));
      } else {
        throw new Error('Dados de autenticação inválidos');
      }

      return { data, error: null };
    } catch (error: any) {
      return { data: null as any, error };
    }
  }

  async signOut(): Promise<{error: any}> {
    try {
      await fetch(`${this.url}/auth/v1/logout`, {
        method: 'POST',
        headers: this.getHeaders()
      });

      this.token = null;
      localStorage.removeItem('supabase_token');
      localStorage.removeItem('supabase_user');

      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }

  getUser(): User | null {
    try {
      const user = localStorage.getItem('supabase_user');
      if (!user || user === 'undefined' || user === 'null') {
        return null;
      }
      return JSON.parse(user);
    } catch (error) {
      console.error('Erro ao recuperar usuário do localStorage:', error);
      localStorage.removeItem('supabase_user');
      localStorage.removeItem('supabase_token');
      return null;
    }
  }
}

// Classe para gerenciar Cloudinary via Backend
class CloudinaryClient {
  private cloudName: string;
  private backendUrl: string;

  constructor() {
    this.cloudName = CLOUDINARY_CLOUD_NAME;
    this.backendUrl = 'https://api.carboncontent.carlosmachado.tech';
  }

  async searchVideos(searchTerm: string): Promise<CloudinaryVideo[]> {
    try {
      console.log(`🔍 Buscando vídeos via backend com termo: "${searchTerm}"`);
      
      const response = await fetch(`${this.backendUrl}/api/videos/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ searchTerm })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Erro do backend:', errorData);
        throw new Error(errorData.error || 'Erro na busca');
      }

      const data = await response.json();
      console.log('✅ Resultados da busca (com tags):', data);
      
      return this.formatCloudinaryVideos(data.resources || []);

    } catch (error: any) {
      console.error('❌ Erro na busca via backend:', error);
      
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Backend não está rodando. Execute: npm run start:backend');
      }
      
      throw error;
    }
  }

  async getAllVideos(): Promise<CloudinaryVideo[]> {
    try {
      console.log('📚 Carregando todos os vídeos da biblioteca...');
      
      const response = await fetch(`${this.backendUrl}/api/videos`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Erro do backend:', errorData);
        throw new Error(errorData.error || 'Erro ao carregar vídeos');
      }

      const data = await response.json();
      console.log('✅ Biblioteca carregada (com tags):', data);
      
      return this.formatCloudinaryVideos(data.resources || []);

    } catch (error: any) {
      console.error('❌ Erro ao carregar biblioteca:', error);
      
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Backend não está rodando. Execute: npm run start:backend');
      }
      
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.backendUrl}/api/health`);
      const data = await response.json();
      console.log('🩺 Status do backend:', data);
      return response.ok;
    } catch (error) {
      console.error('❌ Backend não encontrado:', error);
      return false;
    }
  }

  private formatCloudinaryVideos(resources: any[]): CloudinaryVideo[] {
    console.log('📋 Formatando vídeos encontrados:', resources.length);
    
    return resources.map(resource => {
      console.log('📄 Recurso individual:', resource);
      
      return {
        public_id: resource.public_id,
        display_name: resource.display_name || resource.public_id,
        format: resource.format || 'mp4',
        duration: resource.duration || 0,
        bytes: resource.bytes || 0,
        secure_url: resource.secure_url,
        created_at: resource.created_at,
        tags: Array.isArray(resource.tags) ? resource.tags : [],
        metadata: resource.metadata || {},
        context: resource.context || {}
      };
    });
  }
}

// Funções auxiliares
const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Função para compartilhar vídeo
const shareVideo = async (video: CloudinaryVideo) => {
  try {
    // Check if Web Share API is available
    if (navigator.share && navigator.canShare) {
      // Fetch video as blob
      const response = await fetch(video.secure_url);
      const blob = await response.blob();
      const file = new File([blob], `${video.public_id}.mp4`, { type: 'video/mp4' });

      // Test if we can share files
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Compartilhar vídeo',
          text: 'Confira este vídeo!'
        });
      } else {
        // Fallback to URL sharing
        await navigator.share({
          title: 'Compartilhar vídeo',
          text: 'Confira este vídeo!',
          url: video.secure_url
        });
      }
    } else {
      // If Web Share API is not available, show error message
      alert('Seu navegador não suporta compartilhamento direto. Por favor, use um navegador móvel atualizado.');
    }
  } catch (error) {
    console.error('Erro ao compartilhar:', error);
    // User cancelled or error occurred
    if (error.name !== 'AbortError') {
      alert('Erro ao compartilhar o vídeo. Tente novamente.');
    }
  }
};

// Componente principal
function App() {
  // Estados
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [videos, setVideos] = useState<CloudinaryVideo[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<CloudinaryVideo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMontadora, setSelectedMontadora] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedVideo, setSelectedVideo] = useState<CloudinaryVideo | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloadingVideos, setDownloadingVideos] = useState<Set<string>>(new Set());
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Refs
  const supabase = useRef(new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)).current;
  const cloudinary = useRef(new CloudinaryClient()).current;

  // Verifica autenticação ao carregar
  useEffect(() => {
    const currentUser = supabase.getUser();
    if (currentUser) {
      setUser(currentUser);
    }
  }, []);

  // Carrega vídeos quando o usuário está autenticado
  useEffect(() => {
    if (user) {
      loadAllVideos();
    }
  }, [user]);

  // Filtra vídeos localmente quando algum filtro muda
  useEffect(() => {
    let filtered = [...videos];
    
    // Filtro por montadora
    if (selectedMontadora) {
      filtered = filtered.filter(video => {
        const montadora = video.context?.custom?.montadora?.toLowerCase();
        return montadora === selectedMontadora.toLowerCase();
      });
    }
    
    // Filtro por tag
    if (selectedTag) {
      filtered = filtered.filter(video => 
        video.tags.includes(selectedTag)
      );
    }
    
    setFilteredVideos(filtered);
  }, [videos, selectedMontadora, selectedTag]);

  // Função para carregar todos os vídeos
  const loadAllVideos = async () => {
    setLoading(true);
    setVideos([]);
    
    try {
      const allVideos = await cloudinary.getAllVideos();
      setVideos(allVideos);
    } catch (error: any) {
      console.error('Erro ao carregar vídeos:', error);
      
      if (error.message.includes('Backend não está rodando')) {
        alert('⚠️ Backend não está rodando!\n\n1. Abra um novo terminal\n2. cd backend\n3. npm install\n4. npm run dev');
      } else {
        alert(`Erro ao carregar vídeos: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Função de busca
  const searchVideos = async (term: string) => {
    setLoading(true);
    
    try {
      const results = await cloudinary.searchVideos(term);
      setVideos(results);
    } catch (error: any) {
      console.error('Erro na busca:', error);
      
      if (error.message.includes('Backend não está rodando')) {
        alert('⚠️ Backend não está rodando!\n\n1. Abra um novo terminal\n2. cd backend\n3. npm install\n4. npm run dev');
      } else {
        alert(`Erro na busca: ${error.message}`);
      }
      
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  // Buscar com debounce
  useEffect(() => {
    if (!user) return;
    
    const timeoutId = setTimeout(() => {
      if (searchTerm.trim()) {
        searchVideos(searchTerm);
      } else {
        loadAllVideos();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, user]);

  // Limpar todos os filtros
  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedMontadora('');
    setSelectedTag('');
  };

  // Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsLoggingIn(true);
    
    try {
      console.log('🔑 Tentando fazer login:', email);
      const result = await supabase.signIn(email, password);
      
      console.log('📥 Resultado do login:', result);

      if (result.error) {
        console.error('❌ Erro retornado:', result.error);
        throw result.error;
      }

      console.log('✅ Login bem-sucedido');
      setUser(result.data.user);
      setEmail('');
      setPassword('');
    } catch (error: any) {
      console.error('❌ Erro no login:', error);
      
      let errorMessage = 'Erro de autenticação';
      
      if (error && error.message) {
        const msg = error.message.toLowerCase();
        console.log('🔍 Analisando mensagem de erro:', msg);
        
        if (msg.includes('invalid login credentials') || 
            msg.includes('invalid_credentials') ||
            msg.includes('wrong password') ||
            msg.includes('incorrect password') ||
            msg.includes('email not confirmed')) {
          errorMessage = 'Email ou senha incorretos. Verifique suas credenciais e tente novamente.';
        } else if (msg.includes('user not found') || 
                   msg.includes('email not found') ||
                   msg.includes('no user found')) {
          errorMessage = 'Usuário não encontrado. Entre em contato com o administrador.';
        } else if (msg.includes('too many requests') || 
                   msg.includes('rate limit')) {
          errorMessage = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
        } else if (msg.includes('network') || 
                   msg.includes('connection') ||
                   msg.includes('fetch')) {
          errorMessage = 'Erro de conexão. Verifique sua internet e tente novamente.';
        } else {
          errorMessage = error.message;
        }
      } else {
        errorMessage = 'Erro desconhecido. Tente novamente.';
      }
      
      setAuthError(errorMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    await supabase.signOut();
    setUser(null);
    setVideos([]);
    setFilteredVideos([]);
    setSearchTerm('');
    setSelectedMontadora('');
    setSelectedTag('');
  };

  // Download do vídeo
  const downloadVideo = async (video: CloudinaryVideo) => {
    setDownloadingVideos(prev => {
      const newSet = new Set(prev);
      newSet.add(video.public_id);
      return newSet;
    });

    try {
      const fileName = `${video.context?.custom?.title || video.display_name}.${video.format}`;
      
      console.log('📥 Iniciando download:', fileName);
      
      // Tentar primeiro com fetch + blob
      try {
        const response = await fetch(video.secure_url);
        if (!response.ok) throw new Error('Erro ao baixar');
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const tempLink = document.createElement('a');
        tempLink.href = blobUrl;
        tempLink.download = fileName;
        tempLink.style.display = 'none';
        
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        
        console.log('✅ Download concluído via blob');
        return;
        
      } catch (blobError) {
        console.log('⚠️ Método blob falhou, tentando fallback...');
      }
      
      // Fallback: link direto
      console.log('📥 Usando método de fallback...');
      
      const fallbackLink = document.createElement('a');
      fallbackLink.href = video.secure_url;
      fallbackLink.download = fileName;
      fallbackLink.setAttribute('target', '_self');
      fallbackLink.style.display = 'none';
      
      document.body.appendChild(fallbackLink);
      fallbackLink.click();
      document.body.removeChild(fallbackLink);
      
      console.log('✅ Download via link direto iniciado');
      
    } catch (error) {
      console.error('❌ Erro no download:', error);
      
      // Abrir em nova aba como último recurso
      window.open(video.secure_url, '_blank');
      
    } finally {
      setTimeout(() => {
        setDownloadingVideos(prev => {
          const newSet = new Set(prev);
          newSet.delete(video.public_id);
          return newSet;
        });
      }, 2000);
    }
  };

  // Se não estiver logado, mostrar apenas tela de login
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-5">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md mx-5">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">CARBON Content</h1>
            <p className="text-gray-600">Biblioteca de Vídeos</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="seu@empresa.com"
                required
                disabled={isLoggingIn}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Sua senha"
                required
                disabled={isLoggingIn}
                minLength={6}
              />
            </div>
            
            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{authError}</p>
                    {authError.includes('senha incorretos') && (
                      <div className="mt-2">
                        <p className="text-xs text-red-600">
                          <strong>Dicas:</strong>
                        </p>
                        <ul className="text-xs text-red-600 mt-1 ml-4 list-disc">
                          <li>Verifique se o Caps Lock está desligado</li>
                          <li>Certifique-se de estar usando o email corporativo correto</li>
                          <li>Se esqueceu a senha, entre em contato com o administrador</li>
                        </ul>
                      </div>
                    )}
                    {authError.includes('Usuário não encontrado') && (
                      <div className="mt-2">
                        <p className="text-xs text-red-600">
                          Entre em contato com o administrador para criar sua conta de acesso.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? (
                <span className="flex items-center justify-center">
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Entrando...
                </span>
              ) : (
                'Acessar'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-xs text-gray-500">
                <strong>Acesso restrito a colaboradores autorizados.</strong> <br/>
                Não possui acesso? Entre em contato com o administrador.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Interface principal para usuários logados
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">CARBON Content</h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleLogout}
              className="bg-blue-700 px-4 py-2 rounded hover:bg-blue-800 transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {/* Busca de Vídeos */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Search className="w-5 h-5 mr-2" />
            Buscar e Filtrar Vídeos
          </h2>
         
         <div className="space-y-4">
           {/* Filtros */}
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {/* Busca por texto */}
             <div>
               <label className="block text-sm font-medium mb-2">
                 Buscar por palavras-chave
               </label>
               <div className="relative">
                 <input
                   type="text"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                   placeholder="Digite palavras-chave, título, tags..."
                 />
                 {searchTerm && (
                   <button
                     onClick={() => setSearchTerm('')}
                     className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                   >
                     <X className="w-5 h-5" />
                   </button>
                 )}
               </div>
             </div>

             {/* Filtro por Montadora */}
             <div>
               <label className="block text-sm font-medium mb-2">
                 Filtrar por Montadora
               </label>
               <select
                 value={selectedMontadora}
                 onChange={(e) => setSelectedMontadora(e.target.value)}
                 className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
               >
                 <option value="">Todas as montadoras</option>
                 <option value="chevrolet">Chevrolet</option>
                 <option value="fiat">Fiat</option>
                 <option value="ford">Ford</option>
                 <option value="honda">Honda</option>
                 <option value="hyundai">Hyundai</option>
                 <option value="nissan">Nissan</option>
                 <option value="toyota">Toyota</option>
                 <option value="volkswagen">Volkswagen</option>
               </select>
             </div>

             {/* Filtro por Tag */}
             <div>
               <label className="block text-sm font-medium mb-2">
                 Filtrar por Tag
               </label>
               <select
                 value={selectedTag}
                 onChange={(e) => setSelectedTag(e.target.value)}
                 className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
               >
                 <option value="">Todas as tags</option>
                 {[...new Set(videos.flatMap(v => v.tags))].sort().map(tag => (
                   <option key={tag} value={tag}>{tag}</option>
                 ))}
               </select>
             </div>
           </div>

           {/* Botões de Ação */}
           <div className="flex gap-2 flex-wrap">
             <button
               onClick={loadAllVideos}
               className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
               disabled={loading}
             >
               {loading ? (
                 <>
                   <Loader2 className="animate-spin h-4 w-4" />
                   Carregando...
                 </>
               ) : (
                 <>
                   <Library className="w-4 h-4" />
                   Recarregar Biblioteca
                 </>
               )}
             </button>
             
             {(searchTerm || selectedMontadora || selectedTag) && (
               <button
                 onClick={clearAllFilters}
                 className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
                 title="Limpar todos os filtros"
               >
                 <X className="w-4 h-4" />
                 Limpar Filtros
               </button>
             )}
           </div>

           {/* Resumo dos filtros ativos */}
           <div className="text-sm text-gray-600">
             {searchTerm && (
               <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full mr-2">
                 Busca: "{searchTerm}"
               </span>
             )}
             {selectedMontadora && (
               <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full mr-2">
                 Montadora: {selectedMontadora.toUpperCase()}
               </span>
             )}
             {selectedTag && (
               <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full mr-2">
                 Tag: {selectedTag}
               </span>
             )}
             {!searchTerm && !selectedMontadora && !selectedTag && (
               <span className="text-gray-500">Nenhum filtro ativo</span>
             )}
           </div>
         </div>
        </div>

        {/* Lista de Vídeos */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="mb-4">
            <div className="flex items-center mb-2 md:mb-0">
              <Library className="w-5 h-5 mr-2" />
              <h2 className="text-xl font-bold">Biblioteca de Vídeos</h2>
            </div>
            <div className="text-base font-normal text-gray-600 md:ml-7">
              {filteredVideos.length} {filteredVideos.length === 1 ? 'vídeo' : 'vídeos'}
              {filteredVideos.length !== videos.length && (
                <span className="text-gray-500"> de {videos.length} total</span>
              )}
            </div>
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <Loader2 className="animate-spin h-16 w-16 text-blue-600 mx-auto" />
              <p className="mt-4 text-lg">
                {searchTerm ? `Buscando "${searchTerm}"...` : 'Carregando biblioteca de vídeos...'}
              </p>
              <p className="text-sm text-gray-500 mt-2">CARBON Content</p>
            </div>
          ) : filteredVideos.length === 0 && videos.length > 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Nenhum vídeo encontrado com os filtros selecionados.</p>
              <button
                onClick={clearAllFilters}
                className="mt-4 text-blue-600 hover:text-blue-800 underline"
              >
                Limpar todos os filtros
              </button>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Nenhum vídeo disponível.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVideos.map((video) => (
                <div key={video.public_id} className="bg-gray-50 rounded-lg overflow-hidden shadow hover:shadow-lg transition-shadow">
                  {/* Thumbnail do vídeo */}
                  <div 
                    className="relative cursor-pointer group"
                    onClick={() => setSelectedVideo(video)}
                  >
                    <video
                      className="w-full h-48 object-cover"
                      poster={video.secure_url.replace('.mp4', '.jpg')}
                      muted
                    >
                      <source src={video.secure_url} type={`video/${video.format}`} />
                    </video>
                    <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="w-12 h-12 text-white" />
                    </div>
                    <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-sm">
                      {formatDuration(video.duration)}
                    </div>
                  </div>
                  
                  {/* Informações do vídeo */}
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-800 mb-2 truncate">
                      {video.context?.custom?.title || video.display_name}
                    </h3>
                    
                    {video.metadata?.legenda && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {video.metadata.legenda}
                      </p>
                    )}
                    
                    {/* Tags */}
                    {video.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {video.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            {tag}
                          </span>
                        ))}
                        {video.tags.length > 3 && (
                          <span className="text-xs text-gray-500">+{video.tags.length - 3}</span>
                        )}
                      </div>
                    )}
                    
                    {/* Metadados */}
                    <div className="flex items-center text-xs text-gray-500 space-x-3 mb-3">
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(video.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      <span className="flex items-center">
                        <Hash className="w-3 h-3 mr-1" />
                        {formatFileSize(video.bytes)}
                      </span>
                    </div>
                    
                    {/* Botões de ação */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => downloadVideo(video)}
                        disabled={downloadingVideos.has(video.public_id)}
                        className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {downloadingVideos.has(video.public_id) ? (
                          <>
                            <Loader2 className="animate-spin h-4 w-4" />
                            Baixando...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            Baixar
                          </>
                        )}
                      </button>
                      
                      <button
                        onClick={() => shareVideo(video)}
                        className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                        style={{ backgroundColor: '#25D366' }}
                        title="Compartilhar via WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal do Player de Vídeo */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg md:text-xl font-bold pr-4 truncate">
                  {selectedVideo.context?.custom?.title || selectedVideo.display_name}
                </h2>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="text-gray-500 hover:text-gray-700 transition-colors p-2 -m-2 flex-shrink-0"
                  aria-label="Fechar modal"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              {/* Player de Vídeo HTML5 */}
              <div className="mb-4">
                <video
                  className="w-full max-h-60 md:max-h-96 rounded"
                  controls
                  autoPlay
                >
                  <source src={selectedVideo.secure_url} type={`video/${selectedVideo.format}`} />
                  Seu navegador não suporta o elemento de vídeo.
                </video>
              </div>
              
              {/* Informações detalhadas */}
              <div className="space-y-4">
                {selectedVideo.metadata?.legenda && (
                  <div>
                    <h3 className="font-semibold mb-1">Legenda</h3>
                    <p className="text-gray-600">{selectedVideo.metadata.legenda}</p>
                  </div>
                )}
                
                {selectedVideo.tags.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-1">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedVideo.tags.map((tag, index) => (
                        <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Duração:</span>
                    <p className="font-medium">{formatDuration(selectedVideo.duration)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Tamanho:</span>
                    <p className="font-medium">{formatFileSize(selectedVideo.bytes)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Formato:</span>
                    <p className="font-medium">{selectedVideo.format.toUpperCase()}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Data:</span>
                    <p className="font-medium">{new Date(selectedVideo.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                </div>
                
                {/* Botões de ação no modal */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => downloadVideo(selectedVideo)}
                    disabled={downloadingVideos.has(selectedVideo.public_id)}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingVideos.has(selectedVideo.public_id) ? (
                      <>
                        <Loader2 className="animate-spin h-4 w-4" />
                        Baixando...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        Baixar Vídeo
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => shareVideo(selectedVideo)}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#25D366' }}
                    title="Compartilhar via WhatsApp"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Compartilhar no WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;