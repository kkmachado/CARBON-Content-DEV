import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Download, 
  Play, 
  Clock, 
  HardDrive, 
  Film, 
  X, 
  Calendar,
  AlertCircle,
  Loader2,
  User,
  LogOut,
  Video,
  Library,
  Hash,
  Car,
  Tag,
  Filter,
  MessageCircle, // ✅ ÍCONE PARA WHATSAPP
  Share2,
  ExternalLink
} from 'lucide-react';

// Configuração do Supabase (usando REST API)
const SUPABASE_URL = 'https://sfkxgmxchziyfvdeybdl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNma3hnbXhjaHppeWZ2ZGV5YmRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4OTEyMTAsImV4cCI6MjA2NzQ2NzIxMH0.F744lM-ovsBKDANBSzmGb3iMUCYWy4mrcGNDzuZs51E';

// Configuração do Cloudinary
const CLOUDINARY_CLOUD_NAME = 'carboncars';

// Interfaces TypeScript
interface User {
  id: string;
  email: string;
  user_metadata?: {
    name?: string;
  };
}

interface CloudinaryVideo {
  public_id: string;
  display_name: string;
  format: string;
  duration: number;
  bytes: number;
  secure_url: string;
  created_at: string;
  tags: string[];
  context?: {
    custom?: {
      caption?: string;
      title?: string;
    };
  };
  metadata?: {
    validade?: string;
    acesso_grupo_iesa?: string;
    legenda?: string;
    montadora?: string;
    [key: string]: any;
  };
}

interface ApiResponse<T> {
  data: T | null;
  error: any;
}

// ✅ FUNÇÃO SIMPLIFICADA PARA WHATSAPP
const shareVideoOnWhatsApp = async (video: CloudinaryVideo) => {
  try {
    // Verificar se Web Share API está disponível corretamente
    if (
      typeof navigator === 'undefined' ||
      typeof navigator.share !== 'function' ||
      typeof navigator.canShare !== 'function'
    ) {
      console.log('❌ Web Share API não disponível neste navegador');
      return;
    }
    
    // Baixar o vídeo como blob
    const response = await fetch(video.secure_url);
    if (!response.ok) throw new Error('Erro ao carregar vídeo');
    
    const blob = await response.blob();
    const fileName = `${video.context?.custom?.title || video.display_name}.${video.format}`;
    const file = new File([blob], fileName, { type: `video/${video.format}` });
    
    // Verificar se pode compartilhar arquivos
    if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
      console.log('❌ Compartilhamento de arquivos não suportado');
      return;
    }
    
    // Compartilhar via Web Share API (só o arquivo, sem mensagem)
    await navigator.share({
      files: [file]
    });
    
    console.log('✅ Vídeo compartilhado com sucesso');
    
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'AbortError') {
      console.log('ℹ️ Usuário cancelou o compartilhamento');
    } else {
      console.error('❌ Erro ao compartilhar vídeo:', error);
    }
  }
};

// ✅ COMPONENTE BOTÃO WHATSAPP SIMPLIFICADO
interface WhatsAppButtonProps {
  video: CloudinaryVideo;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'minimal';
  className?: string;
}

const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({ 
  video, 
  size = 'medium', 
  variant = 'primary',
  className = ''
}) => {
  const [isSharing, setIsSharing] = useState(false);

  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    medium: 'px-3 py-2 text-sm',
    large: 'px-4 py-3 text-base'
  };

  const variantClasses = {
    primary: 'bg-green-600 text-white hover:bg-green-700 disabled:bg-green-400',
    secondary: 'bg-white text-green-600 border border-green-600 hover:bg-green-50 disabled:bg-gray-50 disabled:text-green-400 disabled:border-green-400',
    minimal: 'text-green-600 hover:text-green-700 hover:bg-green-50 disabled:text-green-400'
  };

  const iconSize = {
    small: 'w-3 h-3',
    medium: 'w-4 h-4',
    large: 'w-5 h-5'
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    setIsSharing(true);
    try {
      await shareVideoOnWhatsApp(video);
    } finally {
      setIsSharing(false);
    }
  };

  // Corrija a checagem de suporte à Web Share API
  const isWebShareAvailable =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function';

  if (!isWebShareAvailable) {
    return null; // Não mostra o botão se não for suportado
  }

  return (
    <button
      onClick={handleShare}
      disabled={isSharing}
      className={`
        ${sizeClasses[size]} 
        ${variantClasses[variant]}
        rounded transition-colors flex items-center justify-center gap-2
        ${variant === 'minimal' ? 'p-2' : ''}
        disabled:cursor-not-allowed
        ${className}
      `}
      title="Compartilhar no WhatsApp"
    >
      {isSharing ? (
        <Loader2 className={`${iconSize[size]} animate-spin`} />
      ) : (
        <MessageCircle className={iconSize[size]} />
      )}
      {variant !== 'minimal' && !isSharing && (
        size === 'large' ? 'Compartilhar no WhatsApp' : 'WhatsApp'
      )}
      {isSharing && variant !== 'minimal' && 'Compartilhando...'}
    </button>
  );
};

// Classe para gerenciar autenticação
class SupabaseClient {
  private url: string;
  private key: string;
  private token: string | null;

  constructor() {
    this.url = SUPABASE_URL;
    this.key = SUPABASE_ANON_KEY;
    this.token = localStorage.getItem('supabase_token');
  }

  private getHeaders(includeAuth: boolean = true): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'apikey': this.key,
      'Authorization': `Bearer ${this.key}`
    };

    if (includeAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  async signIn(email: string, password: string): Promise<ApiResponse<{user: User, access_token: string}>> {
    try {
      const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      
      if (data.error) throw new Error(data.error.message);

      this.token = data.access_token;
      
      if (this.token) {
        localStorage.setItem('supabase_token', this.token);
        localStorage.setItem('supabase_user', JSON.stringify(data.user));
      }

      return { data: { user: data.user, access_token: data.access_token }, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  getUser(): User | null {
    try {
      const userStr = localStorage.getItem('supabase_user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  logout() {
    this.token = null;
    localStorage.removeItem('supabase_token');
    localStorage.removeItem('supabase_user');
  }
}

// Classe para comunicação com a API do backend
class CloudinaryClient {
  private baseURL: string;

  constructor() {
    // Corrija o uso de process.env.NODE_ENV para funcionar no frontend
    // Use uma variável de ambiente do React ou defina explicitamente
    // Exemplo usando REACT_APP_API_URL (configure no .env)
    this.baseURL =
      (typeof process !== 'undefined' && process.env.REACT_APP_API_URL)
        ? process.env.REACT_APP_API_URL
        : 'https://api.carboncontent.carlosmachado.tech/api';
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async getAllVideos(): Promise<CloudinaryVideo[]> {
    try {
      const response = await fetch(`${this.baseURL}/videos`);
      if (!response.ok) throw new Error('Erro ao buscar vídeos');
      
      const data = await response.json();
      return data.resources || [];
    } catch (error) {
      console.error('Erro ao carregar vídeos:', error);
      throw error;
    }
  }

  async searchVideos(searchTerm: string): Promise<CloudinaryVideo[]> {
    try {
      const response = await fetch(`${this.baseURL}/videos/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ searchTerm })
      });

      if (!response.ok) throw new Error('Erro na busca');
      
      const data = await response.json();
      return data.resources || [];
    } catch (error) {
      console.error('Erro ao buscar vídeos:', error);
      throw error;
    }
  }
}

// Função para formatar tamanho de arquivo
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Função para baixar arquivo
const downloadVideo = async (video: CloudinaryVideo, onStart?: () => void, onComplete?: () => void, onError?: (error: Error) => void) => {
  try {
    onStart?.();
    
    const response = await fetch(video.secure_url);
    if (!response.ok) throw new Error('Erro ao baixar o arquivo');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const fileName = `${video.context?.custom?.title || video.display_name}.${video.format}`;
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    onComplete?.();
  } catch (error) {
    console.error('Erro no download:', error);
    onError?.(error as Error);
  }
};

// Componente para card de vídeo individual
const VideoCard: React.FC<{ video: CloudinaryVideo; onPlay: (video: CloudinaryVideo) => void; downloadingVideos: Set<string>; onDownload: (video: CloudinaryVideo) => void }> = ({ 
  video, 
  onPlay, 
  downloadingVideos, 
  onDownload 
}) => {
  const isDownloading = downloadingVideos.has(video.public_id);
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow group">
      <div className="relative bg-gray-100 aspect-video flex items-center justify-center cursor-pointer group"
           onClick={() => onPlay(video)}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20"></div>
        <Play className="w-16 h-16 text-white opacity-80 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
        <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
          {video.duration ? 
            `${Math.floor(video.duration / 60).toString().padStart(2, '0')}:${Math.floor(video.duration % 60).toString().padStart(2, '0')}` : '--:--'}
        </div>
        
        <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-500/50 rounded-lg transition-colors duration-300 pointer-events-none"></div>
      </div>
      
      <div className="p-4">
        <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
          {video.context?.custom?.title || video.display_name}
        </h3>
        
        {video.metadata?.legenda && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {video.metadata.legenda}
          </p>
        )}
        
        <div className="flex flex-wrap gap-2 mb-3">
          {video.metadata?.montadora && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <Car className="w-3 h-3" />
              {video.metadata.montadora.toUpperCase()}
            </span>
          )}
          
          {video.tags && video.tags.slice(0, 2).map((tag, index) => (
            <span key={index} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              <Hash className="w-3 h-3" />
              {tag}
            </span>
          ))}
          
          {video.tags && video.tags.length > 2 && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              +{video.tags.length - 2}
            </span>
          )}
        </div>
        
        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(video.created_at).toLocaleDateString('pt-BR')}
            </span>
            <span className="flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              {formatFileSize(video.bytes)}
            </span>
            <span className="flex items-center gap-1">
              <Film className="w-3 h-3" />
              {video.format.toUpperCase()}
            </span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => onPlay(video)}
            className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Assistir
          </button>
          
          <button
            onClick={() => onDownload(video)}
            disabled={isDownloading}
            className="bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isDownloading ? 'Baixando...' : 'Download'}
          </button>
          
          {/* ✅ BOTÃO WHATSAPP SIMPLIFICADO */}
          <WhatsAppButton 
            video={video} 
            size="medium" 
            variant="primary"
          />
        </div>
      </div>
    </div>
  );
};

const VideoApp = () => {
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<CloudinaryVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<CloudinaryVideo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMontadora, setSelectedMontadora] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [availableMontadoras, setAvailableMontadoras] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const supabase = useRef(new SupabaseClient());
  const cloudinary = useRef(new CloudinaryClient());

  // Estados do formulário de login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Estado para controlar downloads em andamento
  const [downloadingVideos, setDownloadingVideos] = useState<Set<string>>(new Set());

  // Verificar usuário logado ao carregar
  useEffect(() => {
    try {
      const storedUser = supabase.current.getUser();
      if (storedUser) {
        console.log('✅ Usuário encontrado no localStorage:', storedUser.email);
        setUser(storedUser);
      } else {
        console.log('ℹ️ Nenhum usuário logado encontrado');
      }
    } catch (error) {
      console.error('❌ Erro ao verificar usuário logado:', error);
      localStorage.removeItem('supabase_user');
      localStorage.removeItem('supabase_token');
    }
  }, []);

  // Verificar conexão com backend ao carregar
  useEffect(() => {
    const checkBackend = async () => {
      const isConnected = await cloudinary.current.testConnection();
      if (!isConnected) {
        console.warn('⚠️ Backend não está rodando!\nAbra um novo terminal\n2. cd backend\n3. npm install\n4. npm run dev');
      } else {
        console.log('✅ Backend conectado com sucesso!');
      }
    };
    
    checkBackend();
  }, []);

  // Carregar vídeos do Cloudinary quando usuário logar
  useEffect(() => {
    if (user) {
      loadAllVideos();
    }
  }, [user]);

  // Funções para extrair montadoras e tags
  const extractMontadoras = (videos: CloudinaryVideo[]): string[] => {
    const montadoras = new Set<string>();
    
    videos.forEach(video => {
      const montadora = video.metadata?.montadora;
      if (montadora && montadora.trim()) {
        montadoras.add(montadora.trim());
      }
    });
    
    return Array.from(montadoras).sort();
  };

  const extractTags = (videos: CloudinaryVideo[]): string[] => {
    const tags = new Set<string>();
    
    videos.forEach(video => {
      if (Array.isArray(video.tags)) {
        video.tags.forEach(tag => {
          if (tag && tag.trim()) {
            tags.add(tag.trim());
          }
        });
      }
    });
    
    return Array.from(tags).sort();
  };

  // Funções de filtro
  const filterVideosByMontadora = (videos: CloudinaryVideo[], montadora: string): CloudinaryVideo[] => {
    if (!montadora) return videos;
    
    return videos.filter(video => {
      const videoMontadora = video.metadata?.montadora;
      return videoMontadora && videoMontadora.toLowerCase().includes(montadora.toLowerCase());
    });
  };

  const filterVideosByTag = (videos: CloudinaryVideo[], tag: string): CloudinaryVideo[] => {
    if (!tag) return videos;
    
    return videos.filter(video => {
      return Array.isArray(video.tags) && video.tags.some(videoTag => 
        videoTag.toLowerCase().includes(tag.toLowerCase())
      );
    });
  };

  const filterVideosBySearchTerm = (videos: CloudinaryVideo[], searchTerm: string): CloudinaryVideo[] => {
    if (!searchTerm) return videos;
    
    const term = searchTerm.toLowerCase();
    
    return videos.filter(video => {
      const title = video.context?.custom?.title || video.display_name || '';
      if (title.toLowerCase().includes(term)) return true;
      
      const legenda = video.metadata?.legenda || video.context?.custom?.caption || '';
      if (legenda.toLowerCase().includes(term)) return true;
      
      if (Array.isArray(video.tags)) {
        const hasMatchingTag = video.tags.some(tag => 
          tag.toLowerCase().includes(term)
        );
        if (hasMatchingTag) return true;
      }
      
      const montadora = video.metadata?.montadora || '';
      if (montadora.toLowerCase().includes(term)) return true;
      
      return false;
    });
  };

  // Aplicar todos os filtros combinados
  const filteredVideos = React.useMemo(() => {
    let filtered = [...videos];
    
    // Filtrar por termo de busca
    filtered = filterVideosBySearchTerm(filtered, searchTerm);
    
    // Filtrar por montadora
    filtered = filterVideosByMontadora(filtered, selectedMontadora);
    
    // Filtrar por tag
    filtered = filterVideosByTag(filtered, selectedTag);
    
    return filtered;
  }, [videos, searchTerm, selectedMontadora, selectedTag]);

  // Atualizar listas de montadoras e tags disponíveis
  useEffect(() => {
    setAvailableMontadoras(extractMontadoras(videos));
    setAvailableTags(extractTags(videos));
  }, [videos]);

  // Carregar todos os vídeos
  const loadAllVideos = async () => {
    setLoading(true);
    try {
      console.log('🔄 Carregando todos os vídeos...');
      const allVideos = await cloudinary.current.getAllVideos();
      console.log(`✅ ${allVideos.length} vídeos carregados`);
      setVideos(allVideos);
    } catch (error: any) {
      console.error('❌ Erro ao carregar vídeos:', error);
      
      if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
        alert('Erro de conexão com o servidor.\n\nVerifique se o backend está rodando:\n1. Abra um novo terminal\n2. cd backend\n3. npm install\n4. npm run dev');
      } else {
        alert(`Erro ao carregar vídeos: ${error.message}`);
      }
      
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  // Buscar vídeos por termo
  const searchVideos = async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      loadAllVideos();
      return;
    }

    setLoading(true);
    try {
      console.log(`🔍 Buscando por: "${searchTerm}"`);
      const searchResults = await cloudinary.current.searchVideos(searchTerm);
      console.log(`✅ ${searchResults.length} vídeos encontrados`);
      setVideos(searchResults);
    } catch (error: any) {
      console.error('❌ Erro na busca:', error);
      
      if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
        alert('Erro de conexão com o servidor.\n\nVerifique se o backend está rodando:\n1. Abra um novo terminal\n2. cd backend\n3. npm install\n4. npm run dev');
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
      const result = await supabase.current.signIn(email, password);
      
      console.log('📥 Resultado do login:', result);

      if (result.error) {
        console.error('❌ Erro retornado:', result.error);
        throw result.error;
      }

      console.log('✅ Login bem-sucedido');
      if (result.data) {
        setUser(result.data.user);
        setEmail('');
        setPassword('');
      }
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
  const handleLogout = () => {
    console.log('🚪 Fazendo logout...');
    supabase.current.logout();
    setUser(null);
    setVideos([]);
    setSelectedVideo(null);
    setSearchTerm('');
    setSelectedMontadora('');
    setSelectedTag('');
    setAuthError('');
    console.log('✅ Logout realizado com sucesso');
  };

  // Download de vídeo
  const handleDownload = (video: CloudinaryVideo) => {
    setDownloadingVideos(prev => new Set(prev).add(video.public_id));
    
    downloadVideo(
      video,
      () => console.log(`📥 Iniciando download: ${video.display_name}`),
      () => {
        console.log(`✅ Download concluído: ${video.display_name}`);
        setDownloadingVideos(prev => {
          const newSet = new Set(prev);
          newSet.delete(video.public_id);
          return newSet;
        });
      },
      (error) => {
        console.error(`❌ Erro no download: ${video.display_name}`, error);
        alert(`Erro ao baixar o vídeo: ${error.message}`);
        setDownloadingVideos(prev => {
          const newSet = new Set(prev);
          newSet.delete(video.public_id);
          return newSet;
        });
      }
    );
  };

  // Se não há usuário logado, mostrar tela de login
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="mx-auto h-16 w-16 bg-blue-600 rounded-full flex items-center justify-center mb-4">
              <Video className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">CARBON Content</h1>
            <p className="text-gray-600 mt-2">Sistema de Biblioteca de Vídeos</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email corporativo
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="seu.email@empresa.com"
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
                     className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                     title="Limpar busca"
                   >
                     <X className="w-5 h-5" />
                   </button>
                 )}
               </div>
             </div>

             {/* Filtro por montadora */}
             <div>
               <label className="block text-sm font-medium mb-2">
                 Filtrar por montadora
               </label>
               <div className="relative">
                 <select
                   value={selectedMontadora}
                   onChange={(e) => setSelectedMontadora(e.target.value)}
                   className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                 >
                   <option value="">Todas as montadoras</option>
                   {availableMontadoras.map((montadora) => (
                     <option key={montadora} value={montadora}>
                       {montadora.toUpperCase()}
                     </option>
                   ))}
                 </select>
                 {selectedMontadora && (
                   <button
                     onClick={() => setSelectedMontadora('')}
                     className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                     title="Limpar filtro de montadora"
                   >
                     <X className="w-4 h-4" />
                   </button>
                 )}
                 <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                   <Car className="w-4 h-4 text-gray-400" />
                 </div>
               </div>
             </div>

             {/* Filtro por tag */}
             <div>
               <label className="block text-sm font-medium mb-2">
                 Filtrar por tag
               </label>
               <div className="relative">
                 <select
                   value={selectedTag}
                   onChange={(e) => setSelectedTag(e.target.value)}
                   className="w-full p-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                 >
                   <option value="">Todas as tags</option>
                   {availableTags.map((tag) => (
                     <option key={tag} value={tag}>
                       {tag}
                     </option>
                   ))}
                 </select>
                 {selectedTag && (
                   <button
                     onClick={() => setSelectedTag('')}
                     className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                     title="Limpar filtro de tag"
                   >
                     <X className="w-4 h-4" />
                   </button>
                 )}
                 <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                   <Tag className="w-4 h-4 text-gray-400" />
                 </div>
               </div>
             </div>
           </div>

           {/* Ações */}
           <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
             <div className="flex gap-2">
               <button
                 onClick={() => searchTerm ? searchVideos(searchTerm) : loadAllVideos()}
                 className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                 disabled={loading}
               >
                 {loading ? (
                   <Loader2 className="w-4 h-4 animate-spin" />
                 ) : (
                   <Search className="w-4 h-4" />
                 )}
                 {loading ? 'Buscando...' : 'Buscar'}
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
              <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                Nenhum vídeo encontrado com os filtros aplicados
              </p>
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg max-w-md mx-auto">
                <p className="text-sm text-yellow-800">
                  <strong>Filtros ativos:</strong>
                </p>
                <ul className="text-xs text-yellow-700 mt-2 text-left">
                  {searchTerm && <li>• Busca: "{searchTerm}"</li>}
                  {selectedMontadora && <li>• Montadora: {selectedMontadora.toUpperCase()}</li>}
                  {selectedTag && <li>• Tag: {selectedTag}</li>}
                  <li>• Tente remover alguns filtros para ver mais resultados</li>
                </ul>
              </div>
              <div className="mt-4 flex gap-2 justify-center">
                <button
                  onClick={clearAllFilters}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
                >
                  Limpar Todos os Filtros
                </button>
                <button
                  onClick={() => searchVideos(searchTerm)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Tentar Novamente
               </button>
             </div>
           </div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-12">
              <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Nenhum vídeo disponível</p>
              <p className="text-sm text-gray-400 mt-2">
                Verifique se o backend está funcionando corretamente
              </p>
              <button
                onClick={loadAllVideos}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Recarregar
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVideos.map((video) => (
                <VideoCard
                  key={video.public_id}
                  video={video}
                  onPlay={setSelectedVideo}
                  downloadingVideos={downloadingVideos}
                  onDownload={handleDownload}
                />
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

              {/* Informações do vídeo */}
              <div className="space-y-4">
                {selectedVideo.metadata?.legenda && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Descrição</h3>
                    <p className="text-gray-900">{selectedVideo.metadata.legenda}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {selectedVideo.metadata?.montadora && (
                    <div>
                      <span className="text-gray-500">Montadora:</span>
                      <p className="font-medium">{selectedVideo.metadata.montadora.toUpperCase()}</p>
                    </div>
                  )}
                  
                  <div>
                    <span className="text-gray-500">Duração:</span>
                    <p className="font-medium">
                      {selectedVideo.duration ? 
                        `${Math.floor(selectedVideo.duration / 60).toString().padStart(2, '0')}:${Math.floor(selectedVideo.duration % 60).toString().padStart(2, '0')}` : '--:--'}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-gray-500">Tamanho:</span>
                    <p className="font-medium">{formatFileSize(selectedVideo.bytes)}</p>
                  </div>
                  
                  <div>
                    <span className="text-gray-500">Formato:</span>
                    <p className="font-medium">{selectedVideo.format.toUpperCase()}</p>
                  </div>
                </div>

                {selectedVideo.tags && selectedVideo.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedVideo.tags.map((tag, index) => (
                        <span key={index} className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                          <Hash className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ações do modal */}
                <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleDownload(selectedVideo)}
                    disabled={downloadingVideos.has(selectedVideo.public_id)}
                    className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingVideos.has(selectedVideo.public_id) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    {downloadingVideos.has(selectedVideo.public_id) ? 'Baixando...' : 'Download'}
                  </button>
                  
                  {/* ✅ BOTÃO WHATSAPP NO MODAL */}
                  <WhatsAppButton 
                    video={selectedVideo} 
                    size="medium" 
                    variant="primary"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoApp;