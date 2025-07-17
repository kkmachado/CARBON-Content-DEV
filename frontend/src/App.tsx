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
  MessageCircle, // ✅ NOVO ÍCONE PARA WHATSAPP
  Share2,        // ✅ ÍCONE ALTERNATIVO
  ExternalLink   // ✅ ÍCONE PARA LINK EXTERNO
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

// ✅ FUNÇÕES PARA WHATSAPP
const generateWhatsAppMessage = (video: CloudinaryVideo): string => {
  const title = video.context?.custom?.title || video.display_name || 'Vídeo CARBON';
  const montadora = video.metadata?.montadora ? video.metadata.montadora.toUpperCase() : '';
  const legenda = video.metadata?.legenda || video.context?.custom?.caption || '';
  const tags = video.tags && video.tags.length > 0 ? video.tags.join(', ') : '';
  
  let message = `🎬 *${title}*\n\n`;
  
  if (montadora) {
    message += `🚗 *Montadora:* ${montadora}\n\n`;
  }
  
  if (legenda) {
    message += `📝 *Descrição:* ${legenda}\n\n`;
  }
  
  if (tags) {
    message += `🏷️ *Tags:* ${tags}\n\n`;
  }
  
  message += `🔗 *Assistir:* ${video.secure_url}\n\n`;
  message += `📅 *Compartilhado via CARBON Content*`;
  
  return encodeURIComponent(message);
};

const shareOnWhatsApp = (video: CloudinaryVideo, phoneNumber?: string) => {
  const message = generateWhatsAppMessage(video);
  
  if (phoneNumber) {
    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  } else {
    const whatsappUrl = `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, '_blank');
  }
};

const downloadAndShareVideo = async (video: CloudinaryVideo, onError?: () => void) => {
  try {
    console.log('📥 Baixando vídeo para compartilhar...');
    
    const videoSizeMB = video.bytes ? (video.bytes / (1024 * 1024)) : 0;
    
    if (videoSizeMB > 16) {
      // Usar callback para mostrar modal personalizado ao invés de alert
      if (onError) {
        onError();
      }
      shareOnWhatsApp(video);
      return;
    }
    
    const response = await fetch(video.secure_url);
    if (!response.ok) throw new Error('Erro ao baixar vídeo');
    
    const blob = await response.blob();
    
    if (navigator.share && navigator.canShare) {
      const fileName = `${video.context?.custom?.title || video.display_name}.${video.format}`;
      const file = new File([blob], fileName, { type: `video/${video.format}` });
      
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: video.context?.custom?.title || video.display_name,
            text: `${video.context?.custom?.caption || 'nada'}`,
            files: [file]
          });
          console.log('✅ Vídeo compartilhado com sucesso');
          return;
        } catch (shareError) {
          console.log('ℹ️ Usuário cancelou compartilhamento ou erro:', shareError);
        }
      }
    }
    
    const blobUrl = URL.createObjectURL(blob);
    const tempLink = document.createElement('a');
    tempLink.href = blobUrl;
    tempLink.download = `${video.context?.custom?.title || video.display_name}.${video.format}`;
    tempLink.click();
    
    // Não usar alert, apenas log para o desenvolvedor
    console.log('📱 Vídeo baixado com sucesso! Arquivo salvo na pasta Downloads.');
    
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    
  } catch (error) {
    console.error('❌ Erro ao baixar vídeo:', error);
    
    // Chamar callback de erro ao invés de usar confirm
    if (onError) {
      onError();
    }
  }
};

// ✅ COMPONENTE DE MODAL PARA CONFIRMAÇÕES
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Sim',
  cancelText = 'Cancelar'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <AlertCircle className="w-6 h-6 text-orange-500 mr-3" />
            <h3 className="text-lg font-bold text-gray-800">{title}</h3>
          </div>
          
          <p className="text-gray-600 mb-6 whitespace-pre-line">{message}</p>
          
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
interface WhatsAppShareOptionsProps {
  video: CloudinaryVideo;
  size?: 'small' | 'medium' | 'large';
}

// ✅ COMPONENTE COM OPÇÕES DE COMPARTILHAMENTO
interface WhatsAppShareOptionsProps {
  video: CloudinaryVideo;
  size?: 'small' | 'medium' | 'large';
}

const WhatsAppShareOptions: React.FC<WhatsAppShareOptionsProps> = ({ video, size = 'medium' }) => {
  const [showOptions, setShowOptions] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalProps, setConfirmModalProps] = useState({
    title: '',
    message: '',
    onConfirm: () => {}
  });
  
  const videoSizeMB = video.bytes ? (video.bytes / (1024 * 1024)) : 0;
  
  const showErrorModal = (title: string, message: string, onConfirm?: () => void) => {
    setConfirmModalProps({
      title,
      message,
      onConfirm: onConfirm || (() => {})
    });
    setShowConfirmModal(true);
  };
  
  const handleDownloadAndShare = async () => {
    setDownloading(true);
    try {
      await downloadAndShareVideo(video, () => {
        // Callback de erro - mostrar modal ao invés de confirm
        showErrorModal(
          'Erro no Download',
          'Não foi possível baixar o vídeo para compartilhar.\n\nDeseja enviar o link do vídeo pelo WhatsApp?',
          () => shareOnWhatsApp(video)
        );
      });
    } finally {
      setDownloading(false);
      setShowOptions(false);
    }
  };
  
  const handleShareLink = () => {
    shareOnWhatsApp(video);
    setShowOptions(false);
  };
  
  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowOptions(!showOptions)}
          className={`
            ${size === 'small' ? 'px-2 py-1 text-xs' : size === 'large' ? 'px-4 py-3 text-base' : 'px-3 py-2 text-sm'}
            bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2
          `}
          title="Opções de compartilhamento WhatsApp"
        >
          <MessageCircle className={size === 'small' ? 'w-3 h-3' : size === 'large' ? 'w-5 h-5' : 'w-4 h-4'} />
          {size !== 'small' && 'WhatsApp'}
          {showOptions ? (
            <X className="w-3 h-3" />
          ) : (
            <ExternalLink className="w-3 h-3" />
          )}
        </button>
        
        {showOptions && (
          <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-48">
            <div className="p-2">
              <div className="text-xs text-gray-500 mb-2 px-2">
                Tamanho: {videoSizeMB > 0 ? `${videoSizeMB.toFixed(1)}MB` : 'Desconhecido'}
              </div>
              
              {videoSizeMB <= 16 && videoSizeMB > 0 && (
                <button
                  onClick={handleDownloadAndShare}
                  disabled={downloading}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded flex items-center gap-2 text-sm disabled:opacity-50"
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-green-600" />
                  ) : (
                    <Download className="w-4 h-4 text-green-600" />
                  )}
                  <div>
                    <div className="font-medium">Compartilhar arquivo</div>
                    <div className="text-xs text-gray-500">Baixa e compartilha o vídeo</div>
                  </div>
                </button>
              )}
              
              {videoSizeMB > 16 && (
                <div className="px-3 py-2 text-xs text-orange-600 bg-orange-50 rounded mb-2">
                  ⚠️ Arquivo muito grande para WhatsApp (limite: 16MB)
                </div>
              )}
              
              <button
                onClick={handleShareLink}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded flex items-center gap-2 text-sm"
              >
                <Share2 className="w-4 h-4 text-green-600" />
                <div>
                  <div className="font-medium">Compartilhar link</div>
                  <div className="text-xs text-gray-500">Envia URL para assistir online</div>
                </div>
              </button>
            </div>
          </div>
        )}
        
        {showOptions && (
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowOptions(false)}
          />
        )}
      </div>

      {/* Modal de confirmação personalizado */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={confirmModalProps.onConfirm}
        title={confirmModalProps.title}
        message={confirmModalProps.message}
        confirmText="Enviar Link"
        cancelText="Cancelar"
      />
    </>
  );
};

// ✅ COMPONENTE SIMPLES DE WHATSAPP
interface WhatsAppButtonProps {
  video: CloudinaryVideo;
  size?: 'small' | 'medium' | 'large';
  variant?: 'primary' | 'secondary' | 'minimal';
}

const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({ 
  video, 
  size = 'medium', 
  variant = 'secondary'
}) => {
  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    medium: 'px-3 py-2 text-sm',
    large: 'px-4 py-3 text-base'
  };

  const variantClasses = {
    primary: 'bg-green-600 text-white hover:bg-green-700',
    secondary: 'bg-white text-green-600 border border-green-600 hover:bg-green-50',
    minimal: 'text-green-600 hover:text-green-700 hover:bg-green-50'
  };

  const iconSize = {
    small: 'w-3 h-3',
    medium: 'w-4 h-4',
    large: 'w-5 h-5'
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        shareOnWhatsApp(video);
      }}
      className={`
        ${sizeClasses[size]} 
        ${variantClasses[variant]}
        rounded transition-colors flex items-center justify-center gap-2
        ${variant === 'minimal' ? 'p-2' : ''}
      `}
      title="Compartilhar no WhatsApp"
    >
      <MessageCircle className={iconSize[size]} />
      {variant !== 'minimal' && (size === 'large' ? 'Compartilhar no WhatsApp' : 'WhatsApp')}
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
        console.warn('⚠️ Backend não está rodando!');
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
  const getFilteredVideos = (): CloudinaryVideo[] => {
    let filtered = videos;
    
    filtered = filterVideosBySearchTerm(filtered, searchTerm);
    filtered = filterVideosByMontadora(filtered, selectedMontadora);
    filtered = filterVideosByTag(filtered, selectedTag);
    
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

  // Carregar todos os vídeos
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

  // Buscar vídeos por termo
  const searchVideos = async (term: string) => {
    if (!user) return;

    try {
      setLoading(true);
      console.log(`🔍 Buscando vídeos com termo: "${term}"`);
      
      if (!term.trim()) {
        await loadAllVideos();
        return;
      }
      
      const cloudinaryVideos = await cloudinary.current.searchVideos(term);
      console.log('✅ Vídeos encontrados:', cloudinaryVideos);
      setVideos(cloudinaryVideos);
    } catch (error: any) {
      console.error('❌ Erro ao buscar vídeos:', error);
      
      if (error.message.includes('Backend não está rodando')) {
        alert('⚠️ Backend não está rodando!\n\nPara resolver:\n1. Abra um novo terminal\n2. cd backend\n3. npm install\n4. npm run dev');
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

           {/* Ações dos filtros */}
           <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
             <div className="flex items-center gap-4">
               <button
                 onClick={() => searchVideos(searchTerm)}
                 className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                 disabled={loading}
               >
                 <Search className="w-4 h-4" />
                 Buscar
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
                  onClick={() => loadAllVideos()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Recarregar Biblioteca
               </button>
             </div>
           </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {filteredVideos.map((video) => (
               <div key={video.public_id} className="border rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-300">
                 <VideoThumbnail 
                   video={video} 
                   onClick={() => setSelectedVideo(video)} 
                 />
                 
                 {/* Informações do vídeo */}
                 <div className="p-4">
                   {/* Montadora */}
                   {video.metadata?.montadora && (
                     <div className="flex flex-wrap gap-1 mb-3">
                       <span 
                         className="text-green-600 text-sm flex items-center gap-1 w-fit cursor-pointer hover:text-green-800 hover:underline"
                         onClick={(e) => {
                           e.stopPropagation();
                           if (video.metadata?.montadora) {
                             setSelectedMontadora(video.metadata.montadora);
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
                           className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full flex items-center gap-1 cursor-pointer hover:bg-purple-200 transition-colors"
                           onClick={(e) => {
                             e.stopPropagation();
                             setSelectedTag(tag);
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
                   <div className="text-xs text-gray-500 mb-3 flex items-center gap-3">
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
                       className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                         const videoSizeMB = video.bytes ? (video.bytes / (1024 * 1024)) : 0;
                         
                         // Se arquivo é pequeno (≤16MB), tenta compartilhar arquivo, senão envia link
                         if (videoSizeMB > 0 && videoSizeMB <= 16) {
                           downloadAndShareVideo(video, () => {
                             // Se falhar, envia link como fallback
                             shareOnWhatsApp(video);
                           });
                         } else {
                           // Arquivo muito grande ou tamanho desconhecido - envia link
                           shareOnWhatsApp(video);
                         }
                       }}
                       className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                       title={video.bytes && (video.bytes / (1024 * 1024)) <= 16 
                         ? "Compartilhar arquivo no WhatsApp" 
                         : "Compartilhar link no WhatsApp"
                       }
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
                     className="text-green-600 text-sm flex items-center gap-1 w-fit cursor-pointer hover:text-green-800 hover:underline"
                     onClick={() => {
                       if (selectedVideo.metadata?.montadora) {
                         setSelectedMontadora(selectedVideo.metadata.montadora);
                         setSelectedVideo(null);
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
                         className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm flex items-center gap-1 cursor-pointer hover:bg-purple-200 transition-colors"
                         onClick={() => {
                           setSelectedTag(tag);
                           setSelectedVideo(null);
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
                     className="bg-blue-600 text-white px-4 py-3 rounded hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
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
                       const videoSizeMB = selectedVideo.bytes ? (selectedVideo.bytes / (1024 * 1024)) : 0;
                       
                       // Se arquivo é pequeno (≤16MB), tenta compartilhar arquivo, senão envia link
                       if (videoSizeMB > 0 && videoSizeMB <= 16) {
                         downloadAndShareVideo(selectedVideo, () => {
                           // Se falhar, envia link como fallback
                           shareOnWhatsApp(selectedVideo);
                         });
                       } else {
                         // Arquivo muito grande ou tamanho desconhecido - envia link
                         shareOnWhatsApp(selectedVideo);
                       }
                     }}
                     className="bg-green-600 text-white px-4 py-3 rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                     title={selectedVideo.bytes && (selectedVideo.bytes / (1024 * 1024)) <= 16 
                       ? "Compartilhar arquivo no WhatsApp" 
                       : "Compartilhar link no WhatsApp"
                     }
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
   </div>
 );
};

export default VideoApp;