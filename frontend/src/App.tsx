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
  LogOut,
  Video,
  Library,
  Hash,
  Car,
  Tag,
  MessageCircle, // ÍCONE PARA WHATSAPP
  KeyRound,      // ÍCONE PARA SENHA
  Mail,          // ÍCONE PARA EMAIL
  ArrowLeft,     // ÍCONE PARA VOLTAR
  CheckCircle,   // ÍCONE DE SUCESSO
} from 'lucide-react';

// --- CONFIGURAÇÕES GLOBAIS ---
const SUPABASE_URL = 'https://sfkxgmxchziyfvdeybdl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNma3hnbXhjaHppeWZ2ZGV5YmRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4OTEyMTAsImV4cCI6MjA2NzQ2NzIxMH0.F744lM-ovsBKDANBSzmGb3iMUCYWy4mrcGNDzuZs51E';
const CLOUDINARY_CLOUD_NAME = 'carboncars';

// --- INTERFACES TYPESCRIPT (Define a estrutura dos dados) ---
interface User {
  id: string;
  email: string;
  user_metadata?: {
    name?: string;
    role?: string;
  };
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

// --- CLASSE DE API PARA O SUPABASE ---
// Gerencia todas as interações de autenticação com o Supabase.
class SupabaseClient {
  private url: string;
  private key: string;
  private token: string | null;

  constructor() {
    this.url = SUPABASE_URL;
    this.key = SUPABASE_ANON_KEY;
    this.token = localStorage.getItem('supabase_token');
  }

  // Monta os cabeçalhos padrão para as requisições
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

  // Autentica o usuário
  async signIn(email: string, password: string): Promise<ApiResponse<{ user: User, access_token: string }>> {
    try {
      const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error_description || 'Erro de autenticação');

      this.token = data.access_token;
      localStorage.setItem('supabase_token', this.token!);

      const profile = await this.fetchUserProfile(data.user.id);
      const userWithProfile: User = { ...data.user, tipo_perfil: profile?.tipo_perfil || 'normal' };
      localStorage.setItem('supabase_user', JSON.stringify(userWithProfile));

      return { data: { user: userWithProfile, access_token: this.token! }, error: null };
    } catch (error: any) {
      return { data: null as any, error };
    }
  }

  // Desconecta o usuário
  async signOut(): Promise<{ error: any }> {
    try {
      await fetch(`${this.url}/auth/v1/logout`, { method: 'POST', headers: this.getHeaders(true) });
      this.token = null;
      localStorage.removeItem('supabase_token');
      localStorage.removeItem('supabase_user');
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }

  // Envia email de recuperação de senha
  async sendPasswordResetEmail(email: string): Promise<{ error: any }> {
    try {
      const response = await fetch(`${this.url}/auth/v1/recover`, {
        method: 'POST',
        headers: this.getHeaders(false),
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao enviar email de recuperação.');
      }
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  // Atualiza a senha do usuário usando um token de acesso
  async updateUserPassword(accessToken: string, password: string): Promise<{ error: any }> {
    try {
      const response = await fetch(`${this.url}/auth/v1/user`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.key,
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Falha ao atualizar a senha.');
      }
      return { error: null };
    } catch (error) {
      return { error };
    }
  }

  // Busca o perfil do usuário na tabela 'perfis'
  async fetchUserProfile(userId: string): Promise<{ tipo_perfil: string } | null> {
    try {
      const response = await fetch(`${this.url}/rest/v1/perfis?id=eq.${userId}&select=tipo_perfil`, {
        method: 'GET',
        headers: this.getHeaders(true)
      });
      if (!response.ok) return null;
      const data = await response.json();
      return (data && data.length > 0) ? data[0] : null;
    } catch (error) {
      return null;
    }
  }

  // Obtém o usuário do localStorage
  getUser(): User | null {
    try {
      const user = localStorage.getItem('supabase_user');
      if (!user || user === 'undefined' || user === 'null') return null;
      const parsedUser: User = JSON.parse(user);
      if (!parsedUser.tipo_perfil) parsedUser.tipo_perfil = 'normal';
      return parsedUser;
    } catch (error) {
      localStorage.removeItem('supabase_user');
      localStorage.removeItem('supabase_token');
      return null;
    }
  }
}

// --- CLASSE DE API PARA O CLOUDINARY ---
// Gerencia a busca de vídeos no backend que se comunica com o Cloudinary.
class CloudinaryClient {
  private backendUrl: string;

  constructor() {
    this.backendUrl =
      window.location.hostname === 'localhost'
        ? 'http://localhost:5001'
        : 'https://api.carboncontent.carlosmachado.tech';
  }

  // Busca vídeos por um termo
  async searchVideos(searchTerm: string): Promise<CloudinaryVideo[]> {
    try {
      const response = await fetch(`${this.backendUrl}/api/videos/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searchTerm })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro na busca');
      }
      const data = await response.json();
      return this.formatCloudinaryVideos(data.resources || []);
    } catch (error: any) {
      if (error.message.includes('Failed to fetch')) {
        alert('⚠️ Backend não está rodando!');
      }
      throw error;
    }
  }

  // Busca todos os vídeos
  async getAllVideos(): Promise<CloudinaryVideo[]> {
    try {
      const response = await fetch(`${this.backendUrl}/api/videos`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao carregar vídeos');
      }
      const data = await response.json();
      return this.formatCloudinaryVideos(data.resources || []);
    } catch (error: any) {
      if (error.message.includes('Failed to fetch')) {
        alert('⚠️ Backend não está rodando!');
      }
      throw error;
    }
  }

  // Formata a resposta da API do Cloudinary para o nosso modelo
  private formatCloudinaryVideos(resources: any[]): CloudinaryVideo[] {
    return resources.map(resource => ({
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
    }));
  }
}

// --- COMPONENTES DE AUTENTICAÇÃO ---

// Define qual tela de autenticação será exibida
type AuthView = 'login' | 'forgot_password' | 'update_password' | 'password_recovery_sent';

// Componente de contêiner de autenticação (fundo e logo)
const AuthContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-black flex items-center justify-center p-5 relative">
    <img src="/bg_carbon.avif" alt="Fundo" className="absolute inset-0 w-full h-full object-cover z-0" style={{ pointerEvents: 'none', userSelect: 'none' }} />
    <div className="bg-white rounded-lg shadow-xl p-4 md:p-8 w-full max-w-md mx-5 z-20 relative">
      <div className="text-center mb-10 mt-5"><img src="/logo_carbon_content_b.png" alt="Logo Carbon Content" className="w-2/3 mx-auto mb-4" /></div>
      {children}
    </div>
  </div>
);

// Componente para a tela de Login
const LoginView: React.FC<{
  onLogin: (email: string, pass: string) => Promise<void>;
  isLoggingIn: boolean;
  authError: string;
  setAuthView: (view: AuthView) => void;
}> = ({ onLogin, isLoggingIn, authError, setAuthView }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <AuthContainer>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <div className="relative">
            {/* CORREÇÃO: Contêiner para centralizar o ícone */}
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 pl-10 border border-gray-300 rounded-lg" placeholder="seu-email@carbon.cars" required disabled={isLoggingIn} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
          <div className="relative">
            {/* CORREÇÃO: Contêiner para centralizar o ícone */}
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <KeyRound className="h-5 w-5 text-gray-400" />
            </div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 pl-10 border border-gray-300 rounded-lg" placeholder="Sua senha" required disabled={isLoggingIn} minLength={6} />
          </div>
        </div>
        {authError && <div className="bg-red-50 border border-red-200 rounded-lg p-4"><div className="flex items-start"><div className="flex-shrink-0"><AlertCircle className="h-5 w-5 text-red-400" /></div><div className="ml-3"><p className="text-sm text-red-700">{authError}</p></div></div></div>}
        <button type="submit" disabled={isLoggingIn} className="w-full bg-gray-700 text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50">{isLoggingIn ? <span className="flex items-center justify-center"><Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />Entrando...</span> : 'Acessar'}</button>
      </form>
      <div className="mt-6 text-center">
        <button onClick={() => setAuthView('forgot_password')} className="text-sm text-gray-600 hover:underline">Esqueceu sua senha?</button>
      </div>
    </AuthContainer>
  );
};

// Componente para a tela de Recuperação de Senha
const ForgotPasswordView: React.FC<{
  onRecover: (email: string) => Promise<void>;
  isLoggingIn: boolean;
  authError: string;
  setAuthView: (view: AuthView) => void;
}> = ({ onRecover, isLoggingIn, authError, setAuthView }) => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRecover(email);
  };

  return (
    <AuthContainer>
      <h3 className="text-center text-xl font-semibold text-gray-800 mb-2">Recuperar Senha</h3>
      <p className="text-center text-gray-500 text-sm mb-6">Digite seu email para receber o link.</p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="relative">
          {/* CORREÇÃO: Contêiner para centralizar o ícone */}
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Mail className="h-5 w-5 text-gray-400" />
          </div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 pl-10 border border-gray-300 rounded-lg" placeholder="seu-email@carbon.cars" required disabled={isLoggingIn} />
        </div>
        {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
        <button type="submit" disabled={isLoggingIn} className="w-full bg-gray-700 text-white py-3 rounded-lg font-medium disabled:opacity-50">{isLoggingIn ? <Loader2 className="animate-spin mx-auto" /> : 'Enviar Link'}</button>
      </form>
      <button onClick={() => setAuthView('login')} className="mt-4 text-sm text-gray-600 hover:underline flex items-center justify-center w-full"><ArrowLeft className="w-4 h-4 mr-1" /> Voltar para o Login</button>
    </AuthContainer>
  );
};

// Componente para a tela de Email Enviado
const PasswordRecoverySentView: React.FC<{
  email: string;
  setAuthView: (view: AuthView) => void;
}> = ({ email, setAuthView }) => (
  <AuthContainer>
    <div className="text-center">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-gray-800 mb-2">Verifique seu Email</h3>
      <p className="text-gray-600 mb-6">Se uma conta com o email <span className="font-bold">{email}</span> existir, enviamos um link para você redefinir sua senha.</p>
      <button onClick={() => setAuthView('login')} className="w-full bg-gray-700 text-white py-3 rounded-lg font-medium">Voltar para o Login</button>
    </div>
  </AuthContainer>
);

// Componente para a tela de Atualizar Senha
const UpdatePasswordView: React.FC<{
  onUpdate: (password: string) => Promise<void>;
  isLoggingIn: boolean;
  authError: string;
}> = ({ onUpdate, isLoggingIn, authError }) => {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate(password);
  };

  return (
    <AuthContainer>
      <h3 className="text-center text-xl font-semibold text-gray-800 mb-2">Crie sua Nova Senha</h3>
      <p className="text-center text-gray-500 text-sm mb-6">Sua senha deve ter no mínimo 6 caracteres.</p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="relative">
          {/* CORREÇÃO: Contêiner para centralizar o ícone */}
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <KeyRound className="h-5 w-5 text-gray-400" />
          </div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 pl-10 border border-gray-300 rounded-lg" placeholder="Digite a nova senha" required disabled={isLoggingIn} minLength={6} />
        </div>
        {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
        <button type="submit" disabled={isLoggingIn} className="w-full bg-gray-700 text-white py-3 rounded-lg font-medium disabled:opacity-50">{isLoggingIn ? <Loader2 className="animate-spin mx-auto" /> : 'Salvar Nova Senha'}</button>
      </form>
    </AuthContainer>
  );
};

// --- COMPONENTES DA APLICAÇÃO PRINCIPAL ---

// Componente para exibir a miniatura (thumbnail) do vídeo
const VideoThumbnail: React.FC<{ video: CloudinaryVideo; onClick: () => void }> = ({ video, onClick }) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const getThumbnailUrl = (width: number = 400, height: number = 225) => {
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/w_${width},h_${height},c_fill,q_auto,f_auto,so_0/${video.public_id}.jpg`;
  };

  const thumbnailUrl = getThumbnailUrl(400, 225);
  const fallbackUrl = getThumbnailUrl(400, 225).replace('so_0', 'so_1');
  const lowQualityUrl = getThumbnailUrl(200, 113);

  const handleImageLoad = () => setImageLoading(false);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    if (!imageError) {
      setImageError(true);
      target.src = fallbackUrl;
    } else {
      setImageLoading(false);
    }
  };

  return (
    <div className="relative cursor-pointer group" onClick={onClick}>
      {imageLoading && (
        <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center animate-pulse">
          <Film className="w-8 h-8 text-gray-400" />
        </div>
      )}
      <img src={lowQualityUrl} alt="" className={`absolute inset-0 w-full h-48 object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-100' : 'opacity-0'}`} loading="lazy" />
      <img src={thumbnailUrl} alt={video.context?.custom?.title || video.display_name} className={`w-full h-48 object-cover transition-opacity duration-300 ${imageLoading ? 'opacity-0' : 'opacity-100'}`} loading="lazy" onLoad={handleImageLoad} onError={handleImageError} />
      {!imageLoading && imageError && (
        <div className="absolute inset-0 w-full h-48 bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
          <Video className="w-8 h-8 text-blue-600" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 ease-in-out"></div>
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

// Componente principal da aplicação
const VideoApp = () => {
  // --- ESTADOS (States) ---
  // Estados do usuário e da aplicação
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<CloudinaryVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<CloudinaryVideo | null>(null);
  const [downloadingVideos, setDownloadingVideos] = useState<Set<string>>(new Set());

  // Estados dos filtros (o que o usuário digita/seleciona)
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMontadora, setSelectedMontadora] = useState('');
  const [selectedTag, setSelectedTag] = useState('');

  // Estados dos filtros aplicados (o que realmente filtra a lista)
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [appliedSelectedMontadora, setAppliedSelectedMontadora] = useState('');
  const [appliedSelectedTag, setAppliedSelectedTag] = useState('');
  
  // Estados para listas de filtros disponíveis
  const [availableMontadoras, setAvailableMontadoras] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Instâncias das classes de API
  const supabase = useRef(new SupabaseClient());
  const cloudinary = useRef(new CloudinaryClient());

  // Estados para o fluxo de autenticação
  const [authView, setAuthView] = useState<AuthView>('login');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState('');

  // --- EFEITOS (UseEffects) ---
  // Roda uma vez quando o componente é montado
  useEffect(() => {
    // Verifica se já existe um usuário no localStorage
    const storedUser = supabase.current.getUser();
    if (storedUser) {
      setUser(storedUser);
    } else {
      // Verifica se a URL contém um token de recuperação de senha
      const hash = window.location.hash;
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      if (accessToken) {
        setRecoveryToken(accessToken);
        setAuthView('update_password');
      }
    }
  }, []);

  // Roda sempre que o estado 'user' muda
  useEffect(() => {
    if (user) {
      loadAllVideos();
    }
  }, [user]);
  
  // Roda quando a lista de vídeos é atualizada para extrair os filtros
  useEffect(() => {
    setAvailableMontadoras(extractMontadoras(videos));
    setAvailableTags(extractTags(videos));
  }, [videos]);
  
  // Roda a busca sempre que um dos filtros aplicados muda
  useEffect(() => {
    if (user) executeSearch();
  }, [user, appliedSearchTerm, appliedSelectedMontadora, appliedSelectedTag]);

  // --- FUNÇÕES DE LÓGICA ---
  // Extrai montadoras únicas da lista de vídeos
  const extractMontadoras = (videos: CloudinaryVideo[]): string[] => {
    const montadoras = new Set<string>();
    videos.forEach(video => {
      const montadora = video.metadata?.montadora;
      if (montadora && montadora.trim()) montadoras.add(montadora.trim());
    });
    return Array.from(montadoras).sort();
  };

  // Extrai tags únicas da lista de vídeos
  const extractTags = (videos: CloudinaryVideo[]): string[] => {
    const tags = new Set<string>();
    videos.forEach(video => {
      if (Array.isArray(video.tags)) {
        video.tags.forEach(tag => {
          if (tag && tag.trim()) tags.add(tag.trim());
        });
      }
    });
    return Array.from(tags).sort();
  };

  // Filtra vídeos pela montadora
  const filterVideosByMontadora = (videos: CloudinaryVideo[], montadora: string): CloudinaryVideo[] => {
    if (!montadora) return videos;
    return videos.filter(video => video.metadata?.montadora?.toLowerCase().includes(montadora.toLowerCase()));
  };

  // Filtra vídeos pela tag
  const filterVideosByTag = (videos: CloudinaryVideo[], tag: string): CloudinaryVideo[] => {
    if (!tag) return videos;
    return videos.filter(video => Array.isArray(video.tags) && video.tags.some(videoTag => videoTag.toLowerCase().includes(tag.toLowerCase())));
  };

  // Filtra vídeos pelo termo de busca em vários campos
  const filterVideosBySearchTerm = (videos: CloudinaryVideo[], searchTerm: string): CloudinaryVideo[] => {
    if (!searchTerm) return videos;
    const term = searchTerm.toLowerCase();
    return videos.filter(video =>
      (video.context?.custom?.title || video.display_name || '').toLowerCase().includes(term) ||
      (video.metadata?.legenda || video.context?.custom?.caption || '').toLowerCase().includes(term) ||
      (Array.isArray(video.tags) && video.tags.some(tag => tag.toLowerCase().includes(term))) ||
      (video.metadata?.montadora || '').toLowerCase().includes(term)
    );
  };

  // Retorna a lista de vídeos após aplicar todos os filtros
  const getFilteredVideos = (): CloudinaryVideo[] => {
    let filtered = videos;
    filtered = filterVideosBySearchTerm(filtered, appliedSearchTerm);
    filtered = filterVideosByMontadora(filtered, appliedSelectedMontadora);
    filtered = filterVideosByTag(filtered, appliedSelectedTag);
    return filtered;
  };

  const filteredVideos = getFilteredVideos();

  // Carrega todos os vídeos da biblioteca
  const loadAllVideos = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const cloudinaryVideos = await cloudinary.current.getAllVideos();
      setVideos(cloudinaryVideos);
    } catch (error: any) {
      alert(`Erro ao carregar biblioteca: ${error.message}`);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  // Executa uma busca com base nos filtros aplicados
  const executeSearch = async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (!appliedSearchTerm.trim() && !appliedSelectedMontadora && !appliedSelectedTag) {
        await loadAllVideos();
        return;
      }
      const cloudinaryVideos = await cloudinary.current.searchVideos(appliedSearchTerm);
      let filteredResults = filterVideosByMontadora(cloudinaryVideos, appliedSelectedMontadora);
      filteredResults = filterVideosByTag(filteredResults, appliedSelectedTag);
      setVideos(filteredResults);
    } catch (error: any) {
      alert(`Erro na busca: ${error.message}`);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  // --- FUNÇÕES DE EVENTO (Handlers) ---
  // Define o termo de busca a ser aplicado
  const handleSearchButtonClick = () => setAppliedSearchTerm(searchTerm);
  
  // Permite buscar com a tecla Enter
  const handleSearchInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearchButtonClick();
  };

  // Limpa todos os filtros
  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedMontadora('');
    setSelectedTag('');
    setAppliedSearchTerm('');
    setAppliedSelectedMontadora('');
    setAppliedSelectedTag('');
  };

  // Lida com o processo de login
  const handleLogin = async (email: string, pass: string) => {
    setAuthError('');
    setIsLoggingIn(true);
    try {
      const result = await supabase.current.signIn(email, pass);
      if (result.error) throw result.error;
      setUser(result.data.user);
    } catch (error: any) {
      let errorMessage = 'Erro de autenticação';
      if (error && error.message) {
        const msg = error.message.toLowerCase();
        if (msg.includes('invalid login credentials')) errorMessage = 'Email ou senha incorretos.';
        else if (msg.includes('user not found')) errorMessage = 'Usuário não encontrado.';
        else if (msg.includes('rate limit')) errorMessage = 'Muitas tentativas. Tente mais tarde.';
        else errorMessage = error.message;
      }
      setAuthError(errorMessage);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Lida com o logout
  const handleLogout = async () => {
    await supabase.current.signOut();
    setUser(null);
    setVideos([]);
    window.history.replaceState(null, '', window.location.pathname);
  };

  // Lida com o pedido de recuperação de senha
  const handlePasswordRecovery = async (email: string) => {
    setAuthError('');
    setIsLoggingIn(true);
    try {
      const { error } = await supabase.current.sendPasswordResetEmail(email);
      if (error) throw error;
      setRecoveryEmail(email);
      setAuthView('password_recovery_sent');
    } catch (error: any) {
      setAuthError(error.message || 'Não foi possível enviar o email.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Lida com a atualização da senha
  const handleUpdatePassword = async (password: string) => {
    if (!recoveryToken) {
      setAuthError("Token de recuperação inválido ou expirado.");
      return;
    }
    if (password.length < 6) {
      setAuthError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }
    setAuthError('');
    setIsLoggingIn(true);
    try {
      const { error } = await supabase.current.updateUserPassword(recoveryToken, password);
      if (error) throw error;
      alert("Senha atualizada com sucesso! Você será redirecionado para o login.");
      setAuthView('login');
      window.history.replaceState(null, '', window.location.pathname);
    } catch (error: any) {
      setAuthError(error.message || 'Não foi possível atualizar a senha.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Lida com o download do vídeo
  const handleDownload = async (video: CloudinaryVideo) => {
    setDownloadingVideos(prev => new Set(prev).add(video.public_id));
    try {
      const cleanTitle = (video.context?.custom?.title || video.display_name || video.public_id).replace(/[^a-zA-Z0-9\s\-_]/g, '');
      const fileName = `${cleanTitle}.${video.format}`;
      const response = await fetch(video.secure_url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Erro no download:', error);
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

  // Compartilha o vídeo usando a API nativa do navegador
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
      // Falha silenciosa
    }
  };

  // --- RENDERIZAÇÃO ---
  const isAdmin = user?.tipo_perfil === 'admin';

  // Se não houver usuário logado, renderiza uma das telas de autenticação
  if (!user) {
    switch (authView) {
      case 'forgot_password':
        return <ForgotPasswordView onRecover={handlePasswordRecovery} isLoggingIn={isLoggingIn} authError={authError} setAuthView={setAuthView} />;
      case 'password_recovery_sent':
        return <PasswordRecoverySentView email={recoveryEmail} setAuthView={setAuthView} />;
      case 'update_password':
        return <UpdatePasswordView onUpdate={handleUpdatePassword} isLoggingIn={isLoggingIn} authError={authError} />;
      default:
        return <LoginView onLogin={handleLogin} isLoggingIn={isLoggingIn} authError={authError} setAuthView={setAuthView} />;
    }
  }

  // Se houver usuário logado, renderiza a aplicação principal
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cabeçalho */}
      <header className="bg-black text-white shadow-lg">
        <div className="max-w-6xl mx-auto py-4 px-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">CARBON Content</h1>
          <div className="flex items-center gap-4">
            <button onClick={handleLogout} className="bg-gray-700 px-4 py-2 rounded hover:bg-gray-800 transition-colors flex items-center gap-2"><LogOut className="w-4 h-4" />Sair</button>
          </div>
        </div>
      </header>
      
      {/* Conteúdo Principal */}
      <div className="max-w-6xl mx-auto md:p-6">
        {isAdmin && <div className="bg-green-100 border border-green-200 text-green-800 p-4 rounded-lg m-6 md:m-0 md:mb-6 flex items-center"><AlertCircle className="w-5 h-5 mr-3" />Você está logado como Administrador.</div>}
        
        {/* Seção de Busca e Filtros */}
        <div className="bg-white md:rounded-lg md:shadow-md p-6 md:mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center"><Search className="w-5 h-5 mr-2" />Buscar vídeos</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Input de busca por texto */}
              <div>
                <label className="block text-sm font-medium mb-2">Buscar por palavras-chave</label>
                <div className="relative">
                  <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={handleSearchInputKeyPress} className="w-full p-3 pr-10 border border-gray-300 rounded-md" placeholder="Digite palavras-chave..." />
                  {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>}
                </div>
              </div>
              {/* Dropdown de filtro por montadora */}
              <div>
                <label className="block text-sm font-medium mb-2">Filtrar por montadora</label>
                <div className="relative">
                  <select value={selectedMontadora} onChange={(e) => { setSelectedMontadora(e.target.value); setAppliedSelectedMontadora(e.target.value); }} className="w-full p-3 pr-10 border border-gray-300 rounded-md appearance-none bg-white">
                    <option value="">Todas as montadoras</option>
                    {availableMontadoras.map((montadora) => <option key={montadora} value={montadora}>{montadora.toUpperCase()}</option>)}
                  </select>
                  {selectedMontadora && <button onClick={() => { setSelectedMontadora(''); setAppliedSelectedMontadora(''); }} className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none"><Car className="w-4 h-4 text-gray-400" /></div>
                </div>
              </div>
              {/* Dropdown de filtro por tag */}
              <div>
                <label className="block text-sm font-medium mb-2">Filtrar por tag</label>
                <div className="relative">
                  <select value={selectedTag} onChange={(e) => { setSelectedTag(e.target.value); setAppliedSelectedTag(e.target.value); }} className="w-full p-3 pr-10 border border-gray-300 rounded-md appearance-none bg-white">
                    <option value="">Todas as tags</option>
                    {availableTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                  {selectedTag && <button onClick={() => { setSelectedTag(''); setAppliedSelectedTag(''); }} className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>}
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none"><Tag className="w-4 h-4 text-gray-400" /></div>
                </div>
              </div>
            </div>
            {/* Botões de ação dos filtros */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
              <div className="flex items-center gap-4">
                <button onClick={handleSearchButtonClick} className="bg-gray-700 text-white px-6 py-2 rounded-md hover:bg-gray-800 flex items-center gap-2" disabled={loading}><Search className="w-4 h-4" />Buscar</button>
                {(appliedSearchTerm || appliedSelectedMontadora || appliedSelectedTag) && <button onClick={clearAllFilters} className="bg-red-100 text-red-600 px-4 py-2 rounded-md hover:bg-red-200 flex items-center gap-2"><X className="w-4 h-4" />Limpar Filtros</button>}
              </div>
              {/* Exibição dos filtros ativos */}
              <div className="text-sm text-gray-600">
                {appliedSearchTerm && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full mr-2">Busca: "{appliedSearchTerm}"</span>}
                {appliedSelectedMontadora && <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full mr-2">Montadora: {appliedSelectedMontadora.toUpperCase()}</span>}
                {appliedSelectedTag && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full mr-2">Tag: {appliedSelectedTag}</span>}
                {!appliedSearchTerm && !appliedSelectedMontadora && !appliedSelectedTag && <span className="text-gray-500">Nenhum filtro ativo</span>}
              </div>
            </div>
          </div>
        </div>
        
        {/* Seção da Biblioteca de Vídeos */}
        <div className="bg-white md:rounded-lg md:shadow-md p-6 mt-10">
          <div className="mb-4">
            <div className="flex items-center mb-2 md:mb-0"><Library className="w-5 h-5 mr-2" /><h2 className="text-xl font-bold">Biblioteca de Vídeos</h2></div>
            <div className="text-base font-normal text-gray-600 md:ml-7">{filteredVideos.length} {filteredVideos.length === 1 ? 'vídeo' : 'vídeos'}{filteredVideos.length !== videos.length && <span className="text-gray-500"> de {videos.length} total</span>}</div>
          </div>
          {/* Exibição condicional: loading, sem resultados ou lista de vídeos */}
          {loading ? (
            <div className="text-center py-12"><Loader2 className="animate-spin h-16 w-16 text-blue-600 mx-auto" /><p className="mt-4 text-lg">{appliedSearchTerm ? `Buscando "${appliedSearchTerm}"...` : 'Carregando...'}</p></div>
          ) : filteredVideos.length === 0 ? (
            <div className="text-center py-12"><Video className="w-16 h-16 text-gray-400 mx-auto mb-4" /><p className="text-gray-500 text-lg">Nenhum vídeo encontrado</p><button onClick={clearAllFilters} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Limpar filtros e recarregar</button></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredVideos.map((video) => (
                <div key={video.public_id} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full">
                  <VideoThumbnail video={video} onClick={() => setSelectedVideo(video)} />
                  <div className="p-4 flex flex-col flex-1">
                    {video.metadata?.montadora && <div className="flex flex-wrap gap-1 mb-3"><span className="text-gray-400 text-sm flex items-center gap-1 w-fit cursor-pointer hover:text-gray-600" onClick={(e) => { e.stopPropagation(); if (video.metadata?.montadora) { setSelectedMontadora(video.metadata.montadora); setAppliedSelectedMontadora(video.metadata.montadora); } }}>{video.metadata.montadora.toUpperCase()}</span></div>}
                    <h3 className="font-bold text-lg mb-2 truncate">{video.context?.custom?.title || video.display_name}</h3>
                    {(video.context?.alt || video.metadata?.legenda) && <p className="text-gray-600 text-sm mb-3 line-clamp-2">{video.context?.alt || video.metadata?.legenda}</p>}
                    {video.tags && video.tags.length > 0 && <div className="flex flex-wrap gap-1 mb-3">{video.tags.slice(0, 3).map((tag: string, index: number) => <span key={index} className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full flex items-center gap-1 cursor-pointer hover:bg-yellow-200" onClick={(e) => { e.stopPropagation(); setSelectedTag(tag); setAppliedSelectedTag(tag); }}><Hash className="w-2 h-2" />{tag}</span>)}{video.tags.length > 3 && <span className="text-gray-500 text-xs py-1">+{video.tags.length - 3} mais</span>}</div>}
                    <div className="text-xs text-gray-500 mb-3 flex items-center gap-3 grow mt-auto">
                      {video.format && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(video.created_at).toLocaleDateString('pt-BR')}</span>}
                      {video.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{Math.floor(video.duration / 60).toString().padStart(2, '0')}:{Math.floor(video.duration % 60).toString().padStart(2, '0')}</span>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleDownload(video)} disabled={downloadingVideos.has(video.public_id)} className="hidden md:flex flex-1 bg-gray-300 text-black px-3 py-2 rounded text-sm hover:bg-gray-400 flex items-center justify-center gap-2 disabled:opacity-50">{downloadingVideos.has(video.public_id) ? <><Loader2 className="w-4 h-4 animate-spin" />Baixando...</> : <><Download className="w-4 h-4" />Baixar</>}</button>
                      <button onClick={(e) => { e.stopPropagation(); shareVideoViaWebShare(video); }} className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 flex items-center justify-center gap-2"><MessageCircle className="w-4 h-4" />WhatsApp</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Modal para o Player de Vídeo */}
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
                  className="text-gray-500 hover:text-gray-700 p-2 -m-2"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
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
              <div className="space-y-3">
                {selectedVideo.metadata?.montadora && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    <span
                      className="text-gray-400 text-sm flex items-center gap-1 w-fit cursor-pointer hover:text-gray-600"
                      onClick={() => {
                        if (selectedVideo.metadata?.montadora) {
                          setSelectedMontadora(selectedVideo.metadata.montadora);
                          setAppliedSelectedMontadora(selectedVideo.metadata.montadora);
                          setSelectedVideo(null);
                        }
                      }}
                    >
                      {selectedVideo.metadata.montadora.toUpperCase()}
                    </span>
                  </div>
                )}
                {(selectedVideo.context?.alt || selectedVideo.metadata?.legenda) && (
                  <div>
                    <p className="text-gray-600 text-sm md:text-base">
                      {selectedVideo.context?.alt || selectedVideo.metadata?.legenda}
                    </p>
                  </div>
                )}
                {selectedVideo.tags && selectedVideo.tags.length > 0 && (
                  <div>
                    <div className="flex flex-wrap gap-2">
                      {selectedVideo.tags.map((tag: string, index: number) => (
                        <span
                          key={index}
                          className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm flex items-center gap-1 cursor-pointer hover:bg-yellow-200"
                          onClick={() => {
                            setSelectedTag(tag);
                            setAppliedSelectedTag(tag);
                            setSelectedVideo(null);
                          }}
                        >
                          <Hash className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t">
                  <div className="text-sm text-gray-500 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Adicionado em {new Date(selectedVideo.created_at).toLocaleDateString('pt-BR')}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownload(selectedVideo)}
                      disabled={downloadingVideos.has(selectedVideo.public_id)}
                      className="hidden md:flex bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400 flex items-center justify-center gap-2 disabled:opacity-50 min-h-[44px]"
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
                    <button
                      onClick={() => { shareVideoViaWebShare(selectedVideo); }}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center justify-center gap-2 min-h-[44px]"
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
      
      {/* Rodapé */}
      {user && <footer className="text-gray-500 text-xs px-6 pb-6 mt-auto text-center"><div className="max-w-6xl mx-auto"><p>Logado como: <span className="font-semibold text-gray-500">{user.email}</span></p></div></footer>}
    </div>
  );
};

export default VideoApp;
