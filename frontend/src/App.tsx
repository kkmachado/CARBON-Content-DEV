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
  MessageCircle,
  KeyRound,
  Mail,
  ArrowLeft,
  CheckCircle,
  Users,
  PlusCircle,
  Trash2,
  Edit,
  Send,
} from 'lucide-react';

// --- CONFIGURAÇÕES GLOBAIS ---
// Define as constantes usadas em toda a aplicação para a conexão com as APIs.
const SUPABASE_URL = 'https://sfkxgmxchziyfvdeybdl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNma3hnbXhjaHppeWZ2ZGV5YmRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4OTEyMTAsImV4cCI6MjA2NzQ2NzIxMH0.F744lM-ovsBKDANBSzmGb3iMUCYWy4mrcGNDzuZs51E';
const CLOUDINARY_CLOUD_NAME = 'carboncars';

// --- INTERFACES TYPESCRIPT ---
// Define a estrutura (o "molde") dos objetos de dados para garantir consistência.
interface User {
  id: string;
  email: string;
  user_metadata?: {
    name?: string;
    role?: string;
  };
}

interface AdminUser extends User {
    last_sign_in_at: string;
    created_at: string;
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
  context?: { alt?: string; custom?: { caption?: string; title?: string; }; [key: string]: any; };
  metadata?: { validade?: string; acesso_grupo_iesa?: string; legenda?: string; montadora?: string; [key: string]: any; };
}

// --- CLASSE DE API PARA O SUPABASE ---
// Agrupa todas as funções que se comunicam com a API do Supabase.
class SupabaseClient {
  private url: string;
  private key: string;
  private token: string | null;
  private backendUrl: string;

  constructor() {
    this.url = SUPABASE_URL;
    this.key = SUPABASE_ANON_KEY;
    this.token = localStorage.getItem('supabase_token');
    this.backendUrl = window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://api.carboncontent.carlosmachado.tech';
  }

  // Monta os cabeçalhos padrão para as requisições.
  private getHeaders(includeAuth: boolean = true): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'apikey': this.key, 'Authorization': `Bearer ${this.key}` };
    if (includeAuth && this.token) { headers['Authorization'] = `Bearer ${this.token}`; }
    return headers;
  }

  // Trata respostas de erro da API de forma padronizada.
  private async handleResponseError(response: Response): Promise<Error> {
    try {
        const errorData = await response.json();
        const errorMessage = errorData.error || 'Erro desconhecido';
        const errorDetails = errorData.details || 'Não há mais detalhes.';
        return new Error(`${errorMessage} - ${errorDetails}`);
    } catch (e) {
        return new Error(`Falha na requisição com status: ${response.status}`);
    }
  }

  // Autentica um usuário.
  async signIn(email: string, password: string): Promise<{ user: User, access_token: string }> {
    const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, { method: 'POST', headers: this.getHeaders(false), body: JSON.stringify({ email, password }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || 'Erro de autenticação');
    this.token = data.access_token;
    localStorage.setItem('supabase_token', this.token!);
    localStorage.setItem('supabase_user', JSON.stringify(data.user));
    return { user: data.user, access_token: this.token! };
  }

  // Desloga o usuário.
  async signOut(): Promise<void> {
    await fetch(`${this.url}/auth/v1/logout`, { method: 'POST', headers: this.getHeaders(true) });
    this.token = null;
    localStorage.removeItem('supabase_token');
    localStorage.removeItem('supabase_user');
  }

  // Envia e-mail de recuperação de senha.
  async sendPasswordResetEmail(email: string): Promise<void> {
    const response = await fetch(`${this.url}/auth/v1/recover`, { method: 'POST', headers: this.getHeaders(false), body: JSON.stringify({ email }) });
    if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Falha ao enviar email.'); }
  }

  // Atualiza a senha do usuário a partir de um token de recuperação.
  async updateUserPassword(accessToken: string, password: string): Promise<void> {
    const response = await fetch(`${this.url}/auth/v1/user`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'apikey': this.key, 'Authorization': `Bearer ${accessToken}` }, body: JSON.stringify({ password }) });
    if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.message || 'Falha ao atualizar a senha.'); }
  }

  // Obtém os dados do usuário logado do localStorage.
  getUser(): User | null {
    try {
      const user = localStorage.getItem('supabase_user');
      return user ? JSON.parse(user) : null;
    } catch (error) {
      localStorage.clear();
      return null;
    }
  }

  // --- MÉTODOS DE ADMIN (comunicação com o backend) ---
  async adminGetUsers(): Promise<AdminUser[]> {
      const response = await fetch(`${this.backendUrl}/api/admin/users`, { headers: this.getHeaders() });
      if (!response.ok) throw await this.handleResponseError(response);
      const data = await response.json();
      return data.users;
  }

  async adminInviteUsers(emails: string[]): Promise<{ successful: string[], failed: { email: string, reason: string }[] }> {
      const response = await fetch(`${this.backendUrl}/api/admin/invite`, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ emails }) });
      if (!response.ok) throw await this.handleResponseError(response);
      return await response.json();
  }

  async adminUpdateUserRole(userId: string, role: 'admin' | 'normal'): Promise<any> {
      const response = await fetch(`${this.backendUrl}/api/admin/users/${userId}`, { method: 'PUT', headers: this.getHeaders(), body: JSON.stringify({ role }) });
      if (!response.ok) throw await this.handleResponseError(response);
      return await response.json();
  }

  async adminDeleteUser(userId: string): Promise<void> {
      const response = await fetch(`${this.backendUrl}/api/admin/users/${userId}`, { method: 'DELETE', headers: this.getHeaders() });
      if (!response.ok) throw await this.handleResponseError(response);
  }

  async adminSendRecovery(email: string): Promise<any> {
      const response = await fetch(`${this.backendUrl}/api/admin/recover`, { method: 'POST', headers: this.getHeaders(), body: JSON.stringify({ email }) });
      if (!response.ok) throw await this.handleResponseError(response);
      return await response.json();
  }
}

// --- CLASSE DE API PARA O CLOUDINARY ---
// Agrupa todas as funções que se comunicam com a API do Cloudinary (através do nosso backend).
class CloudinaryClient {
  private backendUrl: string;

  constructor() {
    this.backendUrl = window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://api.carboncontent.carlosmachado.tech';
  }

  async searchVideos(searchTerm: string): Promise<CloudinaryVideo[]> {
    const response = await fetch(`${this.backendUrl}/api/videos/search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ searchTerm }) });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro na busca');
    }
    const data = await response.json();
    return this.formatCloudinaryVideos(data.resources || []);
  }

  async getAllVideos(): Promise<CloudinaryVideo[]> {
    const response = await fetch(`${this.backendUrl}/api/videos`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao carregar vídeos');
    }
    const data = await response.json();
    return this.formatCloudinaryVideos(data.resources || []);
  }

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
// Componentes visuais para as telas de login, recuperação de senha, etc.

type AuthView = 'login' | 'forgot_password' | 'update_password' | 'password_recovery_sent';

// Container visual padrão para as telas de autenticação.
const AuthContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen bg-black flex items-center justify-center p-5 relative">
    <img src="/bg_carbon.avif" alt="Fundo" className="absolute inset-0 w-full h-full object-cover z-0" style={{ pointerEvents: 'none', userSelect: 'none' }} />
    <div className="bg-white rounded-lg shadow-xl p-4 md:p-8 w-full max-w-md mx-5 z-20 relative">
      <div className="text-center mb-10 mt-5">
        <img src="/logo_carbon_content_b.png" alt="Logo Carbon Content" className="w-2/3 mx-auto mb-4" />
      </div>
      {children}
    </div>
  </div>
);

// Componente que lida com o redirecionamento do link de e-mail.
const ActionConfirmationView: React.FC = () => {
  const [message, setMessage] = useState('Redirecionando para a confirmação...');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const confirmationUrl = params.get('confirmation_url');
    if (confirmationUrl) {
      window.location.href = confirmationUrl;
    } else {
      setMessage('Link de confirmação inválido ou ausente.');
      setIsError(true);
    }
  }, []);

  return (
    <AuthContainer>
      <div className="text-center">
        {isError ? <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" /> : <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />}
        <p className="text-lg text-gray-700">{message}</p>
      </div>
    </AuthContainer>
  );
};

// Componente da tela de Login.
const LoginView: React.FC<{ onLogin: (email: string, pass: string) => Promise<void>; isLoggingIn: boolean; authError: string; setAuthView: (view: AuthView) => void; }> = ({ onLogin, isLoggingIn, authError, setAuthView }) => {
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
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 pl-10 border border-gray-300 rounded-lg" placeholder="seu-email@carbon.cars" required disabled={isLoggingIn} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Senha</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <KeyRound className="h-5 w-5 text-gray-400" />
            </div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 pl-10 border border-gray-300 rounded-lg" placeholder="Sua senha" required disabled={isLoggingIn} minLength={6} />
          </div>
        </div>
        {authError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <p className="text-sm text-red-700">{authError}</p>
              </div>
            </div>
          </div>
        )}
        <button type="submit" disabled={isLoggingIn} className="w-full bg-gray-700 text-white py-3 px-4 rounded-lg font-medium disabled:opacity-50">
          {isLoggingIn ? <span className="flex items-center justify-center"><Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />Entrando...</span> : 'Acessar'}
        </button>
      </form>
      <div className="mt-6 text-center">
        <button onClick={() => setAuthView('forgot_password')} className="text-sm text-gray-600 hover:underline">
          Esqueceu sua senha?
        </button>
      </div>
    </AuthContainer>
  );
};

// Componente da tela "Esqueci minha senha".
const ForgotPasswordView: React.FC<{ onRecover: (email: string) => Promise<void>; isLoggingIn: boolean; authError: string; setAuthView: (view: AuthView) => void; }> = ({ onRecover, isLoggingIn, authError, setAuthView }) => {
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
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Mail className="h-5 w-5 text-gray-400" />
          </div>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full p-3 pl-10 border border-gray-300 rounded-lg" placeholder="seu-email@carbon.cars" required disabled={isLoggingIn} />
        </div>
        {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
        <button type="submit" disabled={isLoggingIn} className="w-full bg-gray-700 text-white py-3 rounded-lg font-medium disabled:opacity-50">
          {isLoggingIn ? <Loader2 className="animate-spin mx-auto" /> : 'Enviar Link'}
        </button>
      </form>
      <button onClick={() => setAuthView('login')} className="mt-4 text-sm text-gray-600 hover:underline flex items-center justify-center w-full">
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar para o Login
      </button>
    </AuthContainer>
  );
};

// Componente que mostra a mensagem de sucesso após pedir recuperação de senha.
const PasswordRecoverySentView: React.FC<{ email: string; setAuthView: (view: AuthView) => void; }> = ({ email, setAuthView }) => (
  <AuthContainer>
    <div className="text-center">
      <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-gray-800 mb-2">Verifique seu Email</h3>
      <p className="text-gray-600 mb-6">
        Se uma conta com o email <span className="font-bold">{email}</span> existir, enviamos um link para você redefinir sua senha.
      </p>
      <button onClick={() => setAuthView('login')} className="w-full bg-gray-700 text-white py-3 rounded-lg font-medium">
        Voltar para o Login
      </button>
    </div>
  </AuthContainer>
);

// Componente para o usuário criar uma nova senha.
const UpdatePasswordView: React.FC<{ onUpdate: (password: string) => Promise<void>; isLoggingIn: boolean; authError: string; }> = ({ onUpdate, isLoggingIn, authError }) => {
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
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <KeyRound className="h-5 w-5 text-gray-400" />
          </div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full p-3 pl-10 border border-gray-300 rounded-lg" placeholder="Digite a nova senha" required disabled={isLoggingIn} minLength={6} />
        </div>
        {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
        <button type="submit" disabled={isLoggingIn} className="w-full bg-gray-700 text-white py-3 rounded-lg font-medium disabled:opacity-50">
          {isLoggingIn ? <Loader2 className="animate-spin mx-auto" /> : 'Salvar Nova Senha'}
        </button>
      </form>
    </AuthContainer>
  );
};

// --- COMPONENTE DE GERENCIAMENTO DE USUÁRIOS ---
// Tela de CRUD de usuários, visível apenas para administradores.
const UserManagement = () => {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState<AdminUser | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState<AdminUser | null>(null);
    const [showRecoveryModal, setShowRecoveryModal] = useState<AdminUser | null>(null);
    const supabase = useRef(new SupabaseClient());

    // Função para buscar a lista de usuários do backend.
    const fetchUsers = async () => {
        setIsLoading(true);
        setError('');
        try {
            const userList = await supabase.current.adminGetUsers();
            setUsers(userList);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Busca os usuários quando o componente é montado.
    useEffect(() => {
        fetchUsers();
    }, []);

    // Função para lidar com o convite de novos usuários.
    const handleInvite = async (emails: string[]): Promise<{ successful: string[], failed: any[] }> => {
        const results = await supabase.current.adminInviteUsers(emails);
        if (results.successful.length > 0) {
            fetchUsers(); // Atualiza a lista se algum convite teve sucesso.
        }
        return results;
    };

    // Função para atualizar o perfil de um usuário.
    const handleUpdateRole = async (userId: string, role: 'admin' | 'normal') => {
        try {
            await supabase.current.adminUpdateUserRole(userId, role);
            setShowEditModal(null);
            fetchUsers();
        } catch (e: any) {
            alert(`Erro ao atualizar perfil: ${e.message}`);
        }
    };
    
    // Função para deletar um usuário.
    const handleDelete = async (userId: string) => {
        try {
            await supabase.current.adminDeleteUser(userId);
            setShowDeleteModal(null);
            fetchUsers();
        } catch (e: any) {
            alert(`Erro ao deletar usuário: ${e.message}`);
        }
    };

    // Função para enviar o link de recuperação de senha.
    const handleSendRecovery = async (email: string) => {
        await supabase.current.adminSendRecovery(email);
        setShowRecoveryModal(null);
        alert('Link de recuperação de senha enviado com sucesso!');
    };

    return (
        <div className="bg-white md:rounded-lg md:shadow-md p-6 mt-10">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center">
                    <Users className="w-5 h-5 mr-2" />
                    Gerenciamento de Usuários
                </h2>
                <button 
                    onClick={() => setShowInviteModal(true)} 
                    className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800 flex items-center gap-2 transition-all"
                >
                    <PlusCircle className="w-5 h-5" />
                    Convidar Usuário
                </button>
            </div>

            {isLoading && (
                <div className="text-center py-12">
                    <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto" />
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                    <h3 className="font-bold text-red-800">Ocorreu um erro</h3>
                    <p className="text-red-700 text-sm">{error}</p>
                </div>
            )}
            
            {!isLoading && !error && (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="text-left py-3 px-4 font-semibold text-sm">Email</th>
                                <th className="text-left py-3 px-4 font-semibold text-sm">Perfil</th>
                                <th className="text-left py-3 px-4 font-semibold text-sm">Último Login</th>
                                <th className="text-left py-3 px-4 font-semibold text-sm">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => {
                                const role = user.user_metadata?.role || 'normal';
                                return (
                                    <tr key={user.id} className="border-b hover:bg-gray-50">
                                        <td className="py-3 px-4">{user.email}</td>
                                        <td className="py-3 px-4">
                                            <span className={`px-2 py-1 text-xs rounded-full ${role === 'admin' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-800'}`}>
                                                {role === 'admin' ? 'Admin' : 'Normal'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca'}</td>
                                        <td className="py-3 px-4 flex gap-3">
                                            <div className="relative group">
                                                <button onClick={() => setShowRecoveryModal(user)} className="text-gray-600 hover:text-gray-800"><Send className="w-5 h-5" /></button>
                                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Enviar Recuperação</span>
                                            </div>
                                            <div className="relative group">
                                                <button onClick={() => setShowEditModal(user)} className="text-gray-600 hover:text-gray-800"><Edit className="w-5 h-5" /></button>
                                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Editar Perfil</span>
                                            </div>
                                            <div className="relative group">
                                                <button onClick={() => setShowDeleteModal(user)} className="text-red-600 hover:text-red-800"><Trash2 className="w-5 h-5" /></button>
                                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-700 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">Excluir Usuário</span>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {showInviteModal && <InviteUserModal onInvite={handleInvite} onClose={() => setShowInviteModal(false)} />}
            {showEditModal && <EditUserModal user={showEditModal} onUpdateRole={handleUpdateRole} onClose={() => setShowEditModal(null)} />}
            {showDeleteModal && <DeleteUserModal user={showDeleteModal} onDelete={handleDelete} onClose={() => setShowDeleteModal(null)} />}
            {showRecoveryModal && <RecoveryUserModal user={showRecoveryModal} onSend={handleSendRecovery} onClose={() => setShowRecoveryModal(null)} />}
        </div>
    );
};

// --- COMPONENTES DE MODAL ---
// Modais para as ações de CRUD de usuários.

// Modal para convidar um ou mais usuários.
const InviteUserModal = ({ onInvite, onClose }: { onInvite: (emails: string[]) => Promise<{ successful: string[], failed: any[] }>, onClose: () => void }) => {
    const [emails, setEmails] = useState('');
    const [isInviting, setIsInviting] = useState(false);
    const [results, setResults] = useState<{ successful: string[], failed: any[] } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsInviting(true);
        setResults(null);
        const emailList = emails.split(/[\n,;]+/).map(e => e.trim()).filter(Boolean);
        if (emailList.length === 0) {
            alert("Por favor, insira pelo menos um e-mail.");
            setIsInviting(false);
            return;
        }
        try {
            const res = await onInvite(emailList);
            setResults(res);
        } catch (e: any) {
            alert(`Erro ao processar a requisição: ${e.message}`);
        } finally {
            setIsInviting(false);
        }
    };

    const handleClose = () => {
        setResults(null);
        setEmails('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">Convidar Novos Usuários</h3>
                <form onSubmit={handleSubmit}>
                    {!results ? (
                        <>
                            <label htmlFor="emails-textarea" className="block text-sm font-medium text-gray-700 mb-2">
                                E-mails dos usuários
                            </label>
                            <textarea
                                id="emails-textarea"
                                value={emails}
                                onChange={e => setEmails(e.target.value)}
                                className="w-full p-2 border rounded mb-4 h-40"
                                placeholder="Digite um ou mais e-mails, separados por linha, vírgula ou ponto e vírgula."
                                required
                                disabled={isInviting}
                            />
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={handleClose} className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded transition-colors" disabled={isInviting}>Cancelar</button>
                                <button type="submit" className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded w-36 flex justify-center items-center transition-colors" disabled={isInviting}>
                                    {isInviting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar Convites'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <h4 className="font-bold mb-2 text-lg">Resultados do Envio</h4>
                            {results.successful.length > 0 && (
                                <div className="mb-4">
                                    <h5 className="text-green-600 font-semibold">{results.successful.length} Convites Enviados com Sucesso:</h5>
                                    <ul className="list-disc list-inside text-sm text-gray-600 max-h-24 overflow-y-auto bg-gray-50 p-2 rounded">
                                        {results.successful.map(email => <li key={email}>{email}</li>)}
                                    </ul>
                                </div>
                            )}
                            {results.failed.length > 0 && (
                                <div>
                                    <h5 className="text-red-600 font-semibold">{results.failed.length} Falhas:</h5>
                                    <ul className="list-disc list-inside text-sm text-gray-600 max-h-24 overflow-y-auto bg-gray-50 p-2 rounded">
                                        {results.failed.map(({ email, reason }) => <li key={email}><strong>{email}:</strong> {reason}</li>)}
                                    </ul>
                                </div>
                            )}
                            <div className="flex justify-end mt-4">
                                <button type="button" onClick={handleClose} className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded transition-colors">Fechar</button>
                            </div>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
};

// Modal para editar o perfil de um usuário.
const EditUserModal = ({ user, onUpdateRole, onClose }: { user: AdminUser, onUpdateRole: (userId: string, role: 'admin' | 'normal') => void, onClose: () => void }) => {
    const [role, setRole] = useState(user.user_metadata?.role || 'normal');
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onUpdateRole(user.id, role as 'admin' | 'normal'); };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">Editar Perfil de {user.email}</h3>
                <form onSubmit={handleSubmit}>
                    <select value={role} onChange={e => setRole(e.target.value)} className="w-full p-2 border rounded mb-4">
                        <option value="normal">Normal</option>
                        <option value="admin">Admin</option>
                    </select>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded transition-colors">Cancelar</button>
                        <button type="submit" className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded transition-colors">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Modal de confirmação para deletar um usuário.
const DeleteUserModal = ({ user, onDelete, onClose }: { user: AdminUser, onDelete: (userId: string) => void, onClose: () => void }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6 w-full max-w-md text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-2">Confirmar Exclusão</h3>
            <p className="mb-4">Você tem certeza que deseja excluir o usuário <strong>{user.email}</strong>? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-center gap-4">
                <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 transition-colors px-6 py-2 rounded">Cancelar</button>
                <button onClick={() => onDelete(user.id)} className="bg-red-700 hover:bg-red-800 transition-colors text-white px-6 py-2 rounded">Excluir</button>
            </div>
        </div>
    </div>
);

// Modal de confirmação para enviar link de recuperação.
const RecoveryUserModal = ({ user, onSend, onClose }: { user: AdminUser, onSend: (email: string) => Promise<void>, onClose: () => void }) => {
    const [isSending, setIsSending] = useState(false);

    const handleSendClick = async () => {
        setIsSending(true);
        try {
            await onSend(user.email);
        } catch (e: any) {
            console.error(e);
            alert(`Erro ao enviar link: ${e.message}`);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md text-center">
                <Send className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-2">Recuperação de Senha</h3>
                <p className="mb-4">Deseja enviar um link de recuperação de senha para <strong>{user.email}</strong>?</p>
                <div className="flex justify-center gap-4">
                    <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 transition-colors px-6 py-2 rounded" disabled={isSending}>Cancelar</button>
                    <button onClick={handleSendClick} className="bg-gray-700 hover:bg-gray-800 transition-colors text-white px-6 py-2 rounded w-32 flex justify-center items-center" disabled={isSending}>
                        {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar'}
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- COMPONENTES DA APLICAÇÃO PRINCIPAL ---

// Componente para exibir a miniatura de um vídeo.
const VideoThumbnail: React.FC<{ video: CloudinaryVideo; onClick: () => void }> = ({ video, onClick }) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const getThumbnailUrl = (width: number = 400, height: number = 225) => { return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/w_${width},h_${height},c_fill,q_auto,f_auto,so_0/${video.public_id}.jpg`; };
  const thumbnailUrl = getThumbnailUrl(400, 225);
  const fallbackUrl = getThumbnailUrl(400, 225).replace('so_0', 'so_1');
  const lowQualityUrl = getThumbnailUrl(200, 113);
  const handleImageLoad = () => setImageLoading(false);
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => { const target = e.target as HTMLImageElement; if (!imageError) { setImageError(true); target.src = fallbackUrl; } else { setImageLoading(false); } };

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

// Componente principal que gerencia o estado da aplicação.
const MainApp = () => {
  // --- ESTADOS (States) ---
  const [user, setUser] = useState<User | null>(null);
  const [videos, setVideos] = useState<CloudinaryVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<CloudinaryVideo | null>(null);
  const [downloadingVideos, setDownloadingVideos] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMontadora, setSelectedMontadora] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [appliedSearchTerm, setAppliedSearchTerm] = useState('');
  const [appliedSelectedMontadora, setAppliedSelectedMontadora] = useState('');
  const [appliedSelectedTag, setAppliedSelectedTag] = useState('');
  const [availableMontadoras, setAvailableMontadoras] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const supabase = useRef(new SupabaseClient());
  const cloudinary = useRef(new CloudinaryClient());
  const [authView, setAuthView] = useState<AuthView>('login');
  const [authError, setAuthError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [currentView, setCurrentView] = useState<'library' | 'users'>('library');

  // --- EFEITOS (UseEffects) ---
  useEffect(() => {
    const storedUser = supabase.current.getUser();
    if (storedUser) {
      setUser(storedUser);
      return;
    }
    const handleAuthRedirect = () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const type = hashParams.get('type');
      const errorDescription = hashParams.get('error_description');
      if (accessToken && (type === 'recovery' || type === 'invite')) {
        setRecoveryToken(accessToken);
        setAuthView('update_password');
        window.history.replaceState(null, '', window.location.pathname);
      } else if (errorDescription) {
        const friendlyError = errorDescription.replace(/\+/g, ' ');
        setAuthError(`Erro: ${friendlyError}.`);
        window.history.replaceState(null, '', window.location.pathname);
      }
    };
    handleAuthRedirect();
    window.addEventListener('hashchange', handleAuthRedirect);
    return () => {
      window.removeEventListener('hashchange', handleAuthRedirect);
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadAllVideos();
    }
  }, [user]);

  useEffect(() => {
    setAvailableMontadoras(extractMontadoras(videos));
    setAvailableTags(extractTags(videos));
  }, [videos]);

  useEffect(() => {
    if (user) executeSearch();
  }, [user, appliedSearchTerm, appliedSelectedMontadora, appliedSelectedTag]);

  // --- FUNÇÕES DE LÓGICA ---
  const extractMontadoras = (videos: CloudinaryVideo[]): string[] => { const montadoras = new Set<string>(); videos.forEach(video => { const montadora = video.metadata?.montadora; if (montadora && montadora.trim()) montadoras.add(montadora.trim()); }); return Array.from(montadoras).sort(); };
  const extractTags = (videos: CloudinaryVideo[]): string[] => { const tags = new Set<string>(); videos.forEach(video => { if (Array.isArray(video.tags)) { video.tags.forEach(tag => { if (tag && tag.trim()) tags.add(tag.trim()); }); } }); return Array.from(tags).sort(); };
  const filterVideosByMontadora = (videos: CloudinaryVideo[], montadora: string): CloudinaryVideo[] => { if (!montadora) return videos; return videos.filter(video => video.metadata?.montadora?.toLowerCase().includes(montadora.toLowerCase())); };
  const filterVideosByTag = (videos: CloudinaryVideo[], tag: string): CloudinaryVideo[] => { if (!tag) return videos; return videos.filter(video => Array.isArray(video.tags) && video.tags.some(videoTag => videoTag.toLowerCase().includes(tag.toLowerCase()))); };
  const filterVideosBySearchTerm = (videos: CloudinaryVideo[], searchTerm: string): CloudinaryVideo[] => { if (!searchTerm) return videos; const term = searchTerm.toLowerCase(); return videos.filter(video => (video.context?.custom?.title || video.display_name || '').toLowerCase().includes(term) || (video.metadata?.legenda || video.context?.custom?.caption || '').toLowerCase().includes(term) || (Array.isArray(video.tags) && video.tags.some(tag => tag.toLowerCase().includes(term))) || (video.metadata?.montadora || '').toLowerCase().includes(term) ); };
  const getFilteredVideos = (): CloudinaryVideo[] => { let filtered = videos; filtered = filterVideosBySearchTerm(filtered, appliedSearchTerm); filtered = filterVideosByMontadora(filtered, appliedSelectedMontadora); filtered = filterVideosByTag(filtered, appliedSelectedTag); return filtered; };
  const filteredVideos = getFilteredVideos();
  const loadAllVideos = async () => { if (!user) return; setLoading(true); try { const cloudinaryVideos = await cloudinary.current.getAllVideos(); setVideos(cloudinaryVideos); } catch (error: any) { console.error("Erro ao carregar biblioteca:", error); setVideos([]); } finally { setLoading(false); } };
  const executeSearch = async () => { if (!user) return; setLoading(true); try { if (!appliedSearchTerm.trim() && !appliedSelectedMontadora && !appliedSelectedTag) { await loadAllVideos(); return; } const cloudinaryVideos = await cloudinary.current.searchVideos(appliedSearchTerm); let filteredResults = filterVideosByMontadora(cloudinaryVideos, appliedSelectedMontadora); filteredResults = filterVideosByTag(filteredResults, appliedSelectedTag); setVideos(filteredResults); } catch (error: any) { console.error("Erro na busca:", error); setVideos([]); } finally { setLoading(false); } };
  const handleSearchButtonClick = () => setAppliedSearchTerm(searchTerm);
  const handleSearchInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') handleSearchButtonClick(); };
  const clearAllFilters = () => { setSearchTerm(''); setSelectedMontadora(''); setSelectedTag(''); setAppliedSearchTerm(''); setAppliedSelectedMontadora(''); setAppliedSelectedTag(''); };
  const handleLogin = async (email: string, pass: string) => { setAuthError(''); setIsLoggingIn(true); try { const { user } = await supabase.current.signIn(email, pass); setUser(user); } catch (error: any) { let errorMessage = 'Erro de autenticação'; if (error && error.message) { const msg = error.message.toLowerCase(); if (msg.includes('invalid login credentials')) errorMessage = 'Email ou senha incorretos.'; else if (msg.includes('user not found')) errorMessage = 'Usuário não encontrado.'; else if (msg.includes('rate limit')) errorMessage = 'Muitas tentativas.'; else errorMessage = error.message; } setAuthError(errorMessage); } finally { setIsLoggingIn(false); } };
  const handleLogout = async () => { await supabase.current.signOut(); setUser(null); setVideos([]); window.history.replaceState(null, '', window.location.pathname); };
  const handlePasswordRecovery = async (email: string) => { setAuthError(''); setIsLoggingIn(true); try { await supabase.current.sendPasswordResetEmail(email); setRecoveryEmail(email); setAuthView('password_recovery_sent'); } catch (error: any) { setAuthError(error.message || 'Não foi possível enviar o email.'); } finally { setIsLoggingIn(false); } };
  const handleUpdatePassword = async (password: string) => { if (!recoveryToken) { setAuthError("Token inválido."); return; } if (password.length < 6) { setAuthError("A senha deve ter no mínimo 6 caracteres."); return; } setAuthError(''); setIsLoggingIn(true); try { await supabase.current.updateUserPassword(recoveryToken, password); alert("Senha definida com sucesso! Agora você pode fazer o login."); setAuthView('login'); window.history.replaceState(null, '', window.location.pathname); } catch (error: any) { setAuthError(error.message || 'Não foi possível atualizar a senha.'); } finally { setIsLoggingIn(false); } };
  const handleDownload = async (video: CloudinaryVideo) => { setDownloadingVideos(prev => new Set(prev).add(video.public_id)); try { const cleanTitle = (video.context?.custom?.title || video.display_name || video.public_id).replace(/[^a-zA-Z0-9\s\-_]/g, ''); const fileName = `${cleanTitle}.${video.format}`; const response = await fetch(video.secure_url); const blob = await response.blob(); const blobUrl = window.URL.createObjectURL(blob); const link = document.createElement('a'); link.href = blobUrl; link.download = fileName; document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(blobUrl); } catch (error) { console.error('Erro no download:', error); window.open(video.secure_url, '_blank'); } finally { setTimeout(() => { setDownloadingVideos(prev => { const newSet = new Set(prev); newSet.delete(video.public_id); return newSet; }); }, 2000); } };
  const shareVideoViaWebShare = async (video: CloudinaryVideo) => { try { const response = await fetch(video.secure_url); if (!response.ok) throw new Error('Erro ao baixar vídeo'); const blob = await response.blob(); const fileName = `${video.display_name}.${video.format}`; const file = new File([blob], fileName, { type: `video/${video.format}` }); if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ title: video.display_name, text: video.context?.alt || '', files: [file] }); } } catch (error) { /* Falha silenciosa */ } };
  
  const isAdmin = user?.user_metadata?.role === 'admin';

  // Se não houver usuário logado, mostra as telas de autenticação.
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

  // Se houver usuário logado, renderiza a aplicação principal.
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-black text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-6xl mx-auto py-4 px-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold">CARBON Content</h1>
          <div className="flex items-center gap-4">
              {isAdmin && currentView === 'library' && (
                  <button onClick={() => setCurrentView('users')} className="bg-gray-700 px-4 py-2 rounded hover:bg-gray-800 transition-colors flex items-center gap-2"><Users className="w-4 h-4" />Gerenciar</button>
              )}
              {isAdmin && currentView === 'users' && (
                  <button onClick={() => setCurrentView('library')} className="bg-gray-700 px-4 py-2 rounded hover:bg-gray-800 transition-colors flex items-center gap-2"><Library className="w-4 h-4" />Biblioteca</button>
              )}
            <button onClick={handleLogout} className="bg-red-600 px-4 py-2 rounded hover:bg-red-700 transition-colors flex items-center gap-2"><LogOut className="w-4 h-4" />Sair</button>
          </div>
        </div>
      </header>
      
      <main className="flex-grow">
        <div className="max-w-6xl mx-auto md:p-6">
            {currentView === 'library' ? (
                <>
                    {isAdmin && <div className="bg-green-100 border border-green-200 text-green-800 p-4 rounded-lg m-6 md:m-0 md:mb-6 flex items-center"><AlertCircle className="w-5 h-5 mr-3" />Você está logado como Administrador.</div>}
                    <div className="bg-white md:rounded-lg md:shadow-md p-6 md:mb-6">
                        <h2 className="text-xl font-bold mb-4 flex items-center"><Search className="w-5 h-5 mr-2" />Buscar vídeos</h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">Buscar por palavras-chave</label>
                                    <div className="relative">
                                        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={handleSearchInputKeyPress} className="w-full p-3 pr-10 border border-gray-300 rounded-md" placeholder="Digite palavras-chave..." />
                                        {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>}
                                    </div>
                                </div>
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
                            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t">
                                <div className="flex items-center gap-4">
                                    <button onClick={handleSearchButtonClick} className="bg-gray-700 text-white px-6 py-2 rounded-md hover:bg-gray-800 flex items-center gap-2 transition-colors" disabled={loading}><Search className="w-4 h-4" />Buscar</button>
                                    {(appliedSearchTerm || appliedSelectedMontadora || appliedSelectedTag) && <button onClick={clearAllFilters} className="bg-red-100 text-red-600 px-4 py-2 rounded-md hover:bg-red-200 flex items-center gap-2"><X className="w-4 h-4" />Limpar Filtros</button>}
                                </div>
                                <div className="text-sm text-gray-600">
                                    {appliedSearchTerm && <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full mr-2">Busca: "{appliedSearchTerm}"</span>}
                                    {appliedSelectedMontadora && <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full mr-2">Montadora: {appliedSelectedMontadora.toUpperCase()}</span>}
                                    {appliedSelectedTag && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full mr-2">Tag: {appliedSelectedTag}</span>}
                                    {!appliedSearchTerm && !appliedSelectedMontadora && !appliedSelectedTag && <span className="text-gray-500">Nenhum filtro ativo</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white md:rounded-lg md:shadow-md p-6 mt-10">
                        <div className="mb-4">
                            <div className="flex items-center mb-2 md:mb-0"><Library className="w-5 h-5 mr-2" /><h2 className="text-xl font-bold">Biblioteca de Vídeos</h2></div>
                            <div className="text-base font-normal text-gray-600 md:ml-7">{filteredVideos.length} {filteredVideos.length === 1 ? 'vídeo' : 'vídeos'}{filteredVideos.length !== videos.length && <span className="text-gray-500"> de {videos.length} total</span>}</div>
                        </div>
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
                                            {video.tags && video.tags.length > 0 && <div className="flex flex-wrap gap-1 mb-3">{video.tags.slice(0, 3).map((tag: string, index: number) => <span key={index} className="bg-yellow-100 text-yellow-700 text-xs px-2 py-1 rounded-full flex items-center gap-1 cursor-pointer hover:bg-yellow-200 transition-colors" onClick={(e) => { e.stopPropagation(); setSelectedTag(tag); setAppliedSelectedTag(tag); }}><Hash className="w-2 h-2" />{tag}</span>)}{video.tags.length > 3 && <span className="text-gray-500 text-xs py-1">+{video.tags.length - 3} mais</span>}</div>}
                                            <div className="text-xs text-gray-500 mb-3 flex items-center gap-3 grow mt-auto">
                                                {video.format && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(video.created_at).toLocaleDateString('pt-BR')}</span>}
                                                {video.duration && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{Math.floor(video.duration / 60).toString().padStart(2, '0')}:{Math.floor(video.duration % 60).toString().padStart(2, '0')}</span>}
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleDownload(video)} disabled={downloadingVideos.has(video.public_id)} className="hidden md:flex flex-1 bg-gray-300 text-black px-3 py-2 rounded text-sm hover:bg-gray-400 items-center justify-center gap-2 disabled:opacity-50 transition-colors">{downloadingVideos.has(video.public_id) ? <><Loader2 className="w-4 h-4 animate-spin" />Baixando...</> : <><Download className="w-4 h-4" />Baixar</>}</button>
                                                <button onClick={(e) => { e.stopPropagation(); shareVideoViaWebShare(video); }} className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 flex items-center justify-center gap-2 transition-colors"><MessageCircle className="w-4 h-4" />WhatsApp</button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <UserManagement />
            )}
        </div>
      </main>
      
      {selectedVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 md:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg md:text-xl font-bold pr-4 truncate">{selectedVideo.context?.custom?.title || selectedVideo.display_name}</h2>
                <button onClick={() => setSelectedVideo(null)} className="text-gray-500 hover:text-gray-700 p-2 -m-2"><X className="w-6 h-6" /></button>
              </div>
              <div className="mb-4">
                <video className="w-full max-h-60 md:max-h-96 rounded" controls autoPlay>
                  <source src={selectedVideo.secure_url} type={`video/${selectedVideo.format}`} />
                  Seu navegador não suporta o elemento de vídeo.
                </video>
              </div>
              <div className="space-y-3">
                {selectedVideo.metadata?.montadora && <div className="flex flex-wrap gap-1 mb-3"><span className="text-gray-400 text-sm flex items-center gap-1 w-fit cursor-pointer hover:text-gray-600" onClick={() => { if (selectedVideo.metadata?.montadora) { setSelectedMontadora(selectedVideo.metadata.montadora); setAppliedSelectedMontadora(selectedVideo.metadata.montadora); setSelectedVideo(null); } }}>{selectedVideo.metadata.montadora.toUpperCase()}</span></div>}
                {(selectedVideo.context?.alt || selectedVideo.metadata?.legenda) && <div><p className="text-gray-600 text-sm md:text-base">{selectedVideo.context?.alt || selectedVideo.metadata?.legenda}</p></div>}
                {selectedVideo.tags && selectedVideo.tags.length > 0 && <div><div className="flex flex-wrap gap-2">{selectedVideo.tags.map((tag: string, index: number) => <span key={index} className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm flex items-center gap-1 cursor-pointer hover:bg-yellow-200 transition-colors" onClick={() => { setSelectedTag(tag); setAppliedSelectedTag(tag); setSelectedVideo(null); }}><Hash className="w-3 h-3" />{tag}</span>)}</div></div>}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-4 border-t">
                  <div className="text-sm text-gray-500 flex items-center gap-1"><Calendar className="w-4 h-4" />Adicionado em {new Date(selectedVideo.created_at).toLocaleDateString('pt-BR')}</div>
                  <div className="flex gap-2">
                    <button onClick={() => handleDownload(selectedVideo)} disabled={downloadingVideos.has(selectedVideo.public_id)} className="hidden md:flex bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400 items-center justify-center gap-2 disabled:opacity-50 min-h-[44px] transition-colors">{downloadingVideos.has(selectedVideo.public_id) ? <><Loader2 className="w-4 h-4 animate-spin" />Baixando...</> : <><Download className="w-4 h-4" />Baixar</>}</button>
                    <button onClick={() => { shareVideoViaWebShare(selectedVideo); }} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center justify-center gap-2 min-h-[44px] transition-colors"><MessageCircle className="w-4 h-4" />WhatsApp</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <footer className="text-gray-500 text-xs px-6 pb-6 mt-auto text-center">
        <div className="max-w-6xl mx-auto">
          <p>Logado como: <span className="font-semibold text-gray-500">{user?.email}</span></p>
        </div>
      </footer>
    </div>
  );
};

// Componente "roteador" de topo. Decide qual tela mostrar.
const App = () => {
  if (window.location.pathname === '/confirm') {
    return <ActionConfirmationView />;
  }
  return <MainApp />;
};

export default App;
