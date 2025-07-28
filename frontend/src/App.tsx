import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Download,
  Play,
  Clock,
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
  MessageCircle // ✅ NOVO ÍCONO PARA WHATSAPP
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
    // O 'role' em user_metadata não será mais usado diretamente para o tipo_perfil
    // mas pode permanecer se você o usar para outras coisas.
    role?: string;
  };
  // O tipo_perfil agora virá da tabela 'perfis'
  tipo_perfil?: string;
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
    alt?: string;
    custom?: {
      caption?: string;
      title?: string;
    };
    [key: string]: any;
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
  data: T;
  error: any;
}

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
      console.log('[DEBUG LOGIN] Tentando signIn com email:', email);
      const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      console.log('[DEBUG LOGIN] Resposta bruta da API Supabase (status:', response.status, '):', data);

      if (data.error) {
        console.error('[DEBUG LOGIN] Erro detalhado na resposta JSON do Supabase:', data.error);
        throw new Error(data.error.message || 'Erro de autenticação retornado pela API');
      }

      if (!response.ok) {
        console.error('[DEBUG LOGIN] Erro HTTP na resposta da API Supabase:', data.error || 'Erro desconhecido');
        throw new Error(data.error?.message || 'Erro de autenticação');
      }

      if (!data.access_token || !data.user) {
        console.error('[DEBUG LOGIN] Token de acesso ou objeto de usuário ausente na resposta:', { token: data.access_token, user: data.user });
        throw new Error('Dados de autenticação incompletos ou inválidos');
      }

      this.token = data.access_token;
      localStorage.setItem('supabase_token', this.token!);

      // ✅ NOVO: Buscar o perfil do usuário da tabela 'perfis'
      const profile = await this.fetchUserProfile(data.user.id);
      const userWithProfile: User = {
        ...data.user,
        tipo_perfil: profile?.tipo_perfil || 'normal' // Define 'normal' como padrão se não encontrar
      };

      localStorage.setItem('supabase_user', JSON.stringify(userWithProfile));
      console.log('[DEBUG LOGIN] Login bem-sucedido. Token e usuário com perfil salvos.');

      return { data: { user: userWithProfile, access_token: this.token! }, error: null };

    } catch (error: any) {
      console.error('[DEBUG LOGIN] Erro geral no signIn:', error);
      return { data: null as any, error };
    }
  }

  async signOut(): Promise<{error: any}> {
    try {
      console.log('[DEBUG LOGOUT] Tentando signOut...');
      const response = await fetch(`${this.url}/auth/v1/logout`, {
        method: 'POST',
        headers: this.getHeaders(true)
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('[DEBUG LOGOUT] Erro ao fazer logout:', errorData);
        throw new Error('Falha ao fazer logout');
      }

      this.token = null;
      localStorage.removeItem('supabase_token');
      localStorage.removeItem('supabase_user');
      console.log('[DEBUG LOGOUT] Logout bem-sucedido.');

      return { error: null };
    } catch (error: any) {
      console.error('[DEBUG LOGOUT] Erro geral no signOut:', error);
      return { error };
    }
  }

  // ✅ RE-ADICIONADO: Função para buscar o perfil do usuário da tabela 'perfis'
  async fetchUserProfile(userId: string): Promise<{ tipo_perfil: string } | null> {
    try {
      console.log('[DEBUG PROFILE] Buscando perfil para userId:', userId);
      const response = await fetch(`${this.url}/rest/v1/perfis?id=eq.${userId}&select=tipo_perfil`, {
        method: 'GET',
        headers: this.getHeaders(true) // Inclui o token de autenticação
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Erro ao buscar perfil (status:', response.status, '):', errorData);
        // Se o erro for 404 (não encontrado) ou 406 (Not Acceptable, pode ser RLS),
        // pode significar que o perfil ainda não existe ou o acesso foi negado.
        // Nesse caso, retornamos null para que o tipo_perfil seja 'normal' por padrão.
        if (response.status === 404 || response.status === 406) {
          console.warn('[DEBUG PROFILE] Perfil não encontrado ou acesso negado (RLS). Retornando null.');
          return null;
        }
        throw new Error(errorData.message || 'Erro ao buscar perfil');
      }

      const data = await response.json();
      console.log('[DEBUG PROFILE] Resposta do perfil:', data);

      if (data && data.length > 0) {
        return data[0];
      }
      console.log('[DEBUG PROFILE] Perfil encontrado, mas vazio ou sem dados.');
      return null;
    } catch (error) {
      console.error('❌ Erro em fetchUserProfile:', error);
      return null;
    }
  }

  getUser(): User | null {
    try {
      const user = localStorage.getItem('supabase_user');
      if (!user || user === 'undefined' || user === 'null') {
        return null;
      }
      const parsedUser: User = JSON.parse(user);
      // ✅ Garante que tipo_perfil exista, mesmo que seja 'normal' por padrão
      if (!parsedUser.tipo_perfil) {
        parsedUser.tipo_perfil = 'normal';
      }
      return parsedUser;
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
    this.backendUrl =
      window.location.hostname === 'localhost'
        ? 'http://localhost:5001'
        : 'https://api.carboncontent.carlosmachado.tech';
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
        alert('⚠️ Backend não está rodando!\n\nPara resolver:\n1. Abra um novo terminal\n2. cd backend\n3. npm install\n4. npm run dev');
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
        alert('⚠️ Backend não está rodando!\n\nPara resolver:\n1. Abra um novo terminal\n2. cd backend\n3. npm install\n4. npm run dev');
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
        context: resource.context || {},
        metadata: resource.metadata || {}
      };
    });
  }
}

// Componente de Thumbnail com Loading
interface VideoThumbnailProps {
  video: CloudinaryVideo;
  onClick: () => void;
}

const VideoThumbnail: React.FC<VideoThumbnailProps> = ({ video, onClick }) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const getThumbnailUrl = (width: number = 400, height: number = 225) => {
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/w_${width},h_${height},c_fill,q_auto,f_auto,so_0/${video.public_id}.jpg`;
  };

  const thumbnailUrl = getThumbnailUrl(400, 225);
  const fallbackUrl = getThumbnailUrl(400, 225).replace('so_0', 'so_1');
  const lowQualityUrl = getThumbnailUrl(200, 113);

  const handleImageLoad = () => {
    setImageLoading(false);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;

    if (!imageError) {
      console.log(`⚠️ Erro na thumbnail principal para ${video.public_id}, tentando fallback...`);
      setImageError(true);
      target.src = fallbackUrl;
    } else {
      console.log(`❌ Fallback também falhou para ${video.public_id}`);
      setImageLoading(false);
    }
  };

  return (
    <div className="relative cursor-pointer group" onClick={onClick}>
      {imageLoading && (
        <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center animate-pulse">
          <div className="text-center">
            <Film className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <div className="text-xs text-gray-500">Carregando...</div>
          </div>
        </div>
      )}

      <img
        src={lowQualityUrl}
        alt=""
        className={`absolute inset-0 w-full h-48 object-cover transition-opacity duration-300 ${
          imageLoading ? 'opacity-100' : 'opacity-0'
        }`}
        loading="lazy"
      />

      <img
        src={thumbnailUrl}
        alt={video.context?.custom?.title || video.display_name}
        className={`w-full h-48 object-cover transition-opacity duration-300 ${
          imageLoading ? 'opacity-0' : 'opacity-100'
        }`}
        loading="lazy"
        onLoad={handleImageLoad}
        onError={handleImageError}
      />

      {!imageLoading && imageError && (
        <div className="absolute inset-0 w-full h-48 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
          <div className="text-center">
            <Video className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <div className="text-xs text-blue-700 font-medium">Vídeo</div>
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 ease-in-out">
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-white bg-opacity-25 backdrop-blur-sm rounded-xl py-3 px-6 transform group-hover:scale-110 transition-all duration-300 shadow-lg">
          <Play className="text-white w-8 h-8 fill-current transform translate-x-0.5" />
        </div>
      </div>

      <div className="absolute top-3 right-3 bg-black/80 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full font-medium">
        {video.duration ? `${Math.floor(video.duration / 60).toString().padStart(2, '0')}:${Math.floor(video.duration % 60).toString().padStart(2, '0')}` : '--:--'}
      </div>

      <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-500/50 rounded-lg transition-colors duration-300 pointer-events-none"></div>
    </div>
  );
};

const VideoApp = () => {
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<CloudinaryVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<CloudinaryVideo | null>(null);

  // Estados para os valores dos inputs (o que o usuário digita)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMontadora, setSelectedMontadora] = useState('');
  const [selectedTag, setSelectedTag] = useState('');

  // Estados para os filtros APLICADOS (o que realmente filtra os vídeos)
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [appliedSelectedMontadora, setAppliedSelectedMontadora] = useState('');
  const [appliedSelectedTag, setAppliedSelectedTag] = useState('');

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
        console.log('✅ Usuário encontrado no localStorage:', storedUser.email, 'Perfil:', storedUser.tipo_perfil);
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
        console.warn('⚠️ Backend não está rodando!');
      }
    };

    checkBackend();
  }, []);

  // Carregar vídeos do Cloudinary quando usuário logar ou quando filtros aplicados mudarem
  useEffect(() => {
    if (user) {
      // Quando o componente carrega ou o usuário loga, carregamos todos os vídeos
      // A filtragem inicial será feita com os estados de filtro aplicados (que inicialmente são vazios)
      loadAllVideos();
    }
  }, [user]); // Depende apenas do usuário logado

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
  const getFilteredVideos = (): CloudinaryVideo[] => {
    let filtered = videos;

    // Agora usamos os estados 'applied' para a filtragem real
    filtered = filterVideosBySearchTerm(filtered, appliedSearchTerm);
    filtered = filterVideosByMontadora(filtered, appliedSelectedMontadora);
    filtered = filterVideosByTag(filtered, appliedSelectedTag);

    return filtered;
  };

  const filteredVideos = getFilteredVideos();

  // Extrair montadoras e tags quando vídeos mudarem
  useEffect(() => {
    const montadoras = extractMontadoras(videos);
    const tags = extractTags(videos);

    setAvailableMontadoras(montadoras);
    setAvailableTags(tags);

    console.log('🏭 Montadoras encontradas:', montadoras);
    console.log('🏷️ Tags encontradas:', tags);
  }, [videos]);

  // Carregar todos os vídeos (função base)
  const loadAllVideos = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('📚 Carregando biblioteca completa...');
      const cloudinaryVideos = await cloudinary.current.getAllVideos();
      console.log('✅ Biblioteca carregada:', cloudinaryVideos);
      setVideos(cloudinaryVideos);
    } catch (error: any) {
      console.error('❌ Erro ao carregar biblioteca:', error);

      if (error.message.includes('Backend não está rodando')) {
        alert('⚠️ Backend não está rodando!\n\nPara resolver:\n1. Abra um novo terminal\n2. cd backend\n3. npm install\n4. npm run dev');
      } else {
        alert(`Erro ao carregar biblioteca: ${error.message}`);
      }

      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  // Buscar vídeos por termo (agora usa os estados 'applied')
  const executeSearch = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log(`🔍 Buscando vídeos com termo: "${appliedSearchTerm}"`);

      if (!appliedSearchTerm.trim() && !appliedSelectedMontadora && !appliedSelectedTag) {
        // Se não houver nenhum termo de busca ou filtro aplicado, carrega todos os vídeos
        await loadAllVideos();
        return;
      }

      // Se houver termo de busca, usa a API de busca do Cloudinary
      const cloudinaryVideos = await cloudinary.current.searchVideos(appliedSearchTerm);

      // Aplica os filtros de montadora e tag localmente
      let filteredResults = filterVideosByMontadora(cloudinaryVideos, appliedSelectedMontadora);
      filteredResults = filterVideosByTag(filteredResults, appliedSelectedTag);

      console.log('✅ Vídeos encontrados e filtrados:', filteredResults);
      setVideos(filteredResults);
    } catch (error: any) {
      console.error('❌ Erro ao buscar vídeos:', error);

      if (error.message.includes('Failed to fetch')) {
        alert('⚠️ Backend não está rodando!\n\nPara resolver:\n1. Abra um novo terminal\n2. cd backend\n3. npm install\n4. npm run dev');
      } else {
        alert(`Erro na busca: ${error.message}`);
      }

      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  // Efeito para acionar a busca quando os *filtros aplicados* mudam
  // Isso garante que a lista de vídeos só é atualizada quando o botão é clicado
  useEffect(() => {
    if (user) {
      executeSearch();
    }
  }, [user, appliedSearchTerm, appliedSelectedMontadora, appliedSelectedTag]);


  // Função para acionar a busca ao clicar no botão
  const handleSearchButtonClick = () => {
    // Copia APENAS o valor do input de busca para o estado "aplicado"
    setAppliedSearchTerm(searchTerm);
    // Os filtros de montadora e tag já são atualizados nos seus respectivos onChanges
  };

  // Função para lidar com a tecla Enter no campo de busca
  const handleSearchInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchButtonClick();
    }
  };

  // Limpar todos os filtros
  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedMontadora('');
    setSelectedTag('');
    setAppliedSearchTerm(''); // Limpa também os filtros aplicados
    setAppliedSelectedMontadora('');
    setAppliedSelectedTag('');
    // A chamada para loadAllVideos() será feita pelo useEffect acima quando os estados aplicados ficarem vazios
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

      console.log('📝 Mensagem de erro final:', errorMessage);
      setAuthError(errorMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await supabase.current.signOut();
    setUser(null);
    setVideos([]);
  };

  // Download de vídeo forçado
  const handleDownload = async (video: CloudinaryVideo) => {
    try {
      setDownloadingVideos(prev => new Set(prev).add(video.public_id));

      console.log('📥 Iniciando download forçado:', video.display_name);

      const cleanTitle = video.context?.custom?.title || video.display_name || video.public_id;
      const fileName = `${cleanTitle.replace(/[^a-zA-Z0-9\s\-_]/g, '')}.${video.format}`;

      try {
        console.log('🔄 Tentando download via fetch...');

        const response = await fetch(video.secure_url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/octet-stream',
          }
        });

        if (response.ok) {
          const blob = await response.blob();

          const blobUrl = window.URL.createObjectURL(blob);

          const downloadLink = document.createElement('a');
          downloadLink.href = blobUrl;
          downloadLink.download = fileName;
          downloadLink.style.display = 'none';

          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);

          setTimeout(() => {
            window.URL.revokeObjectURL(blobUrl);
          }, 1000);

          console.log('✅ Download via fetch bem-sucedido');
          return;
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

      } catch (fetchError) {
        console.warn('⚠️ Fetch falhou, tentando método alternativo:', fetchError);
      }

      console.log('🔄 Usando método de fallback...');

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

  // ✅ FUNÇÕES PARA WHATSAPP
  const shareVideoViaWebShare = async (video: CloudinaryVideo) => {
    try {
      const response = await fetch(video.secure_url);
      if (!response.ok) throw new Error('Erro ao baixar vídeo');
      const blob = await response.blob();
      const fileName = `${video.display_name}.${video.format}`;
      const file = new File([blob], fileName, { type: `video/${video.format}` });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: video.display_name,
          text: video.context?.alt || '',
          files: [file]
        });
      }
    } catch (error) {
      // Não faz nada se falhar
    }
  };

  // ✅ NOVO: Verificar se o usuário é admin (agora lê de tipo_perfil)
  const isAdmin = user?.tipo_perfil === 'admin';

  // Se não estiver logado, mostrar apenas tela de login
  if (!user) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-5 relative">
        {/* Imagem de fundo */}
        <img
          src="/bg_carbon.avif"
          alt="Fundo login"
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        />
        {/* Formulário de login */}
        <div className="bg-white rounded-lg shadow-xl p-4 md:p-8 w-full max-w-md mx-5 z-20 relative">
          <div className="text-center mb-10 mt-5">
            <img
              src="/logo_carbon_content_b.png"
              alt="Logo Carbon Content"
              className="w-2/3 mx-auto mb-4"
            />
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:border-transparent"
                placeholder="seu-email@carbon.cars"
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
                className="w-full p-3 border border-gray-300 rounded-lg focus:border-transparent"
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
              className="w-full bg-gray-700 text-white py-3 px-4 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
      <header className="bg-black text-white shadow-lg">
        <div className="max-w-6xl mx-auto py-4 px-6 mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">CARBON Content</h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="bg-gray-700 px-4 py-2 rounded hover:bg-gray-800 transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto md:p-6">
        {/* ✅ NOVO: Mensagem de admin (agora de tipo_perfil) */}
        {isAdmin && (
          <div className="bg-green-100 border border-green-200 text-green-800 p-4 rounded-lg m-6 md:m-0 md:mb-6 flex items-center">
            <AlertCircle className="w-5 h-5 mr-3" />
            Você está logado como Administrador.
          </div>
        )}

        {/* Busca de Vídeos */}
        <div className="bg-white md:rounded-lg md:shadow-md p-6 md:mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center">
            <Search className="w-5 h-5 mr-2" />
            Buscar vídeos
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
                   onKeyDown={handleSearchInputKeyPress} // Adicionado: Aciona busca no Enter
                   className="w-full p-3 pr-10 border border-gray-300 rounded-md border-transparent focus:border-transparent"
                   placeholder="Digite palavras-chave, marca, modelo..."
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
                   onChange={(e) => {
                     setSelectedMontadora(e.target.value);
                     setAppliedSelectedMontadora(e.target.value); // Atualiza o filtro aplicado imediatamente
                   }}
                   className="w-full p-3 pr-10 border border-gray-300 rounded-md focus:border-transparent appearance-none bg-white"
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
                     onClick={() => {
                       setSelectedMontadora('');
                       setAppliedSelectedMontadora(''); // Limpa o filtro aplicado
                     }}
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
                   onChange={(e) => {
                     setSelectedTag(e.target.value);
                     setAppliedSelectedTag(e.target.value); // Atualiza o filtro aplicado imediatamente
                   }}
                   className="w-full p-3 pr-10 border border-gray-300 rounded-md focus:border-transparent appearance-none bg-white"
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
                     onClick={() => {
                       setSelectedTag('');
                       setAppliedSelectedTag(''); // Limpa o filtro aplicado
                     }}
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

           {/* Ações dos filtros */}
           <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
             <div className="flex items-center gap-4">
               <button
                 onClick={handleSearchButtonClick} // Chama a função que atualiza o termo de busca aplicado
                 className="bg-gray-700 text-white px-6 py-2 rounded-md hover:bg-gray-800 transition-colors flex items-center gap-2"
                 disabled={loading}
               >
                 <Search className="w-4 h-4" />
                 Buscar
               </button>

               {/* Botão "Limpar Filtros" aparece apenas com filtros aplicados */}
               {(appliedSearchTerm || appliedSelectedMontadora || appliedSelectedTag) && (
                 <button
                   onClick={clearAllFilters}
                   className="bg-red-100 text-red-600 px-4 py-2 rounded-md hover:bg-red-200 transition-colors flex items-center gap-2"
                   title="Limpar todos os filtros"
                 >
                   <X className="w-4 h-4" />
                   Limpar Filtros
                 </button>
               )}
             </div>

             {/* Resumo dos filtros ativos (agora usando os estados 'applied') */}
             <div className="text-sm text-gray-600">
               {appliedSearchTerm && (
                 <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full mr-2">
                   Busca: "{appliedSearchTerm}"
                 </span>
               )}
               {appliedSelectedMontadora && (
                 <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full mr-2">
                   Montadora: {appliedSelectedMontadora.toUpperCase()}
                 </span>
               )}
               {appliedSelectedTag && (
                 <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full mr-2">
                   Tag: {appliedSelectedTag}
                 </span>
               )}
               {!appliedSearchTerm && !appliedSelectedMontadora && !appliedSelectedTag && (
                 <span className="text-gray-500">Nenhum filtro ativo</span>
               )}
             </div>
           </div>
         </div>
        </div>

        {/* Lista de Vídeos */}
        <div className="bg-white md:rounded-lg md:shadow-md p-6 mt-10">
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
                {appliedSearchTerm ? `Buscando "${appliedSearchTerm}"...` : 'Carregando biblioteca de vídeos...'}
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
                  {appliedSearchTerm && <li>• Busca: "{appliedSearchTerm}"</li>}
                  {appliedSelectedMontadora && <li>• Montadora: {appliedSelectedMontadora.toUpperCase()}</li>}
                  {appliedSelectedTag && <li>• Tag: {appliedSelectedTag}</li>}
                  <li>• Tente remover alguns filtros para ver mais resultados</li>
                </ul>
              </div>
           </div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-12">
              <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                Nenhum vídeo encontrado na biblioteca
              </p>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-md mx-auto">
                <p className="text-sm text-blue-800">
                  <strong>Dicas para sua busca:</strong>
                </p>
                <ul className="text-xs text-blue-700 mt-2 text-left">
                  <li>• Tente palavras-chave diferentes</li>
                  <li>• Verifique a ortografia dos termos</li>
                  <li>• Use termos mais gerais</li>
                  <li>• Verifique se há vídeos na biblioteca</li>
                </ul>
              </div>
              <div className="mt-4 flex gap-2 justify-center">
                <button
                  onClick={clearAllFilters}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Recarregar Biblioteca
               </button>
             </div>
           </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {filteredVideos.map((video) => (
               <div key={video.public_id} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full">
                 <VideoThumbnail
                   video={video}
                   onClick={() => setSelectedVideo(video)}
                 />

                 {/* Informações do vídeo */}
                 <div className="p-4 flex flex-col flex-1">
                   {/* Montadora */}
                   {video.metadata?.montadora && (
                     <div className="flex flex-wrap gap-1 mb-3">
                       <span
                         className="text-gray-400 text-sm flex items-center gap-1 w-fit cursor-pointer hover:text-gray-600 transition-all"
                         onClick={(e) => {
                           e.stopPropagation();
                           if (video.metadata?.montadora) {
                             setSelectedMontadora(video.metadata.montadora);
                             setAppliedSelectedMontadora(video.metadata.montadora);
                           }
                         }}
                         title={`Filtrar por montadora: ${video.metadata.montadora.toUpperCase()}`}
                       >
                         {video.metadata.montadora.toUpperCase()}
                       </span>
                     </div>
                   )}

                   <h3 className="font-bold text-lg mb-2 truncate">
                     {video.context?.custom?.title || video.display_name}
                   </h3>

                   {/* Legenda apenas do alt ou fallback para legenda */}
                   {(video.context?.alt || video.metadata?.legenda) && (
                     <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                       {video.context?.alt || video.metadata?.legenda}
                     </p>
                   )}

                   {/* Tags */}
                   {video.tags && video.tags.length > 0 && (
                     <div className="flex flex-wrap gap-1 mb-3">
                       {video.tags.slice(0, 3).map((tag: string, index: number) => (
                         <span
                           key={index}
                           className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full flex items-center gap-1 cursor-pointer hover:bg-yellow-200 transition-colors"
                           onClick={(e) => {
                             e.stopPropagation();
                             setSelectedTag(tag);
                             setAppliedSelectedTag(tag);
                           }}
                           title={`Filtrar por tag: ${tag}`}
                         >
                           <Hash className="w-2 h-2" />
                           {tag}
                         </span>
                       ))}
                       {video.tags.length > 3 && (
                         <span className="text-gray-500 text-xs py-1">+{video.tags.length - 3} mais</span>
                       )}
                     </div>
                   )}

                   {/* Informações técnicas */}
                   <div className="text-xs text-gray-500 mb-3 flex items-center gap-3 grow mt-auto">
                    {video.format && (
                       <span className="flex items-center gap-1">
                         <Calendar className="w-3 h-3" />
                         {new Date(video.created_at).toLocaleDateString('pt-BR')}
                       </span>
                     )}
                     {video.duration && (
                       <span className="flex items-center gap-1">
                         <Clock className="w-3 h-3" />
                         {Math.floor(video.duration / 60).toString().padStart(2, '0')}:{Math.floor(video.duration % 60).toString().padStart(2, '0')}
                       </span>
                     )}
                   </div>

                   {/* ✅ BOTÕES DE AÇÃO SIMPLIFICADOS */}
                   <div className="flex gap-2">
                     {/* Botão de download */}
                     <button
                       onClick={() => handleDownload(video)}
                       disabled={downloadingVideos.has(video.public_id)}
                       className="hidden md:flex flex-1 bg-gray-300 text-black px-3 py-2 rounded text-sm hover:bg-gray-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       {downloadingVideos.has(video.public_id) ? (
                         <>
                           <Loader2 className="w-4 h-4 animate-spin" />
                           Baixando...
                         </>
                       ) : (
                         <>
                           <Download className="w-4 h-4" />
                           Baixar
                         </>
                       )}
                     </button>

                     {/* Botão WhatsApp inteligente */}
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         shareVideoViaWebShare(video);
                       }}
                       className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                       title="Compartilhar arquivo no WhatsApp"
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

             {/* Informações do vídeo */}
             <div className="space-y-3">
               {/* Montadora no modal */}
               {selectedVideo.metadata?.montadora && (
                 <div className="flex flex-wrap gap-1 mb-3">
                   <span
                     className="text-gray-400 text-sm flex items-center gap-1 w-fit cursor-pointer hover:text-gray-600 transition-all"
                     onClick={() => {
                       if (selectedVideo.metadata?.montadora) {
                         setSelectedMontadora(selectedVideo.metadata.montadora);
                         setAppliedSelectedMontadora(selectedVideo.metadata.montadora);
                         setSelectedVideo(null); // Fecha o modal
                       }
                     }}
                     title={`Filtrar por montadora: ${selectedVideo.metadata.montadora.toUpperCase()}`}
                   >
                     {selectedVideo.metadata.montadora.toUpperCase()}
                   </span>
                 </div>
               )}

               {/* Legenda do alt ou fallback para legenda */}
               {(selectedVideo.context?.alt || selectedVideo.metadata?.legenda) && (
                 <div>
                   <p className="text-gray-600 text-sm md:text-base">
                     {selectedVideo.context?.alt || selectedVideo.metadata?.legenda}
                   </p>
                 </div>
               )}

               {/* Tags no modal */}
               {selectedVideo.tags && selectedVideo.tags.length > 0 && (
                 <div>
                   <div className="flex flex-wrap gap-2">
                     {selectedVideo.tags.map((tag: string, index: number) => (
                       <span
                         key={index}
                         className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm flex items-center gap-1 cursor-pointer hover:bg-yellow-200 transition-colors"
                         onClick={() => {
                           setSelectedTag(tag);
                           setAppliedSelectedTag(tag);
                           setSelectedVideo(null); // Fecha o modal
                         }}
                         title={`Filtrar por tag: ${tag}`}
                       >
                         <Hash className="w-3 h-3" />
                         {tag}
                       </span>
                     ))}
                   </div>
                 </div>
               )}

               {/* ✅ BOTÕES DE AÇÃO NO MODAL SIMPLIFICADOS */}
               <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t">
                 <div className="text-sm text-gray-500 flex items-center gap-1">
                   <Calendar className="w-4 h-4" />
                   Adicionado em {new Date(selectedVideo.created_at).toLocaleDateString('pt-BR')}
                 </div>

                 <div className="flex gap-2">
                   {/* Botão de download */}
                   <button
                     onClick={() => handleDownload(selectedVideo)}
                     disabled={downloadingVideos.has(selectedVideo.public_id)}
                     className="hidden md:flex bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                   >
                     {downloadingVideos.has(selectedVideo.public_id) ? (
                       <>
                         <Loader2 className="w-4 h-4 animate-spin" />
                         Baixando...
                       </>
                     ) : (
                       <>
                         <Download className="w-4 h-4" />
                         Baixar
                       </>
                     )}
                   </button>

                   {/* Botão WhatsApp inteligente */}
                   <button
                     onClick={() => {
                       shareVideoViaWebShare(selectedVideo);
                     }}
                     className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                     title="Compartilhar arquivo no WhatsApp"
                   >
                     <MessageCircle className="w-4 h-4" />
                     WhatsApp
                   </button>
                 </div>
               </div>
             </div>
           </div>
         </div>
       </div>
     )}

     {/* ✅ NOVO: Rodapé com email do usuário */}
     {user && (
       <footer className="text-gray-500 text-xs px-6 pb-6 mt-auto text-center">
         <div className="max-w-6xl mx-auto">
           <p>Logado como: <span className="font-semibold text-gray-500">{user.email}</span></p>
         </div>
       </footer>
     )}
   </div>
 );
};

export default VideoApp;
