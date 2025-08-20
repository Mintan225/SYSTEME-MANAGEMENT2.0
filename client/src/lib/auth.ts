interface User {
  id: number;
  username: string;
  role: string;
  permissions?: string[]; // Added permissions to the User interface
}

interface AuthResponse {
  token: string;
  user: User;
}

class AuthService {
  private token: string | null = null;
  private user: User | null = null;
  private isLoggingOut: boolean = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('auth_user');

        if (token && userData) {
          this.token = token;
          this.user = JSON.parse(userData);
        }
      } catch (error) {
        console.error('Error loading auth data from storage:', error);
        this.clearStorage();
      }
    }
  }

  private saveToStorage(token: string, user: User) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
      } catch (error) {
        console.error('Error saving auth data to storage:', error);
      }
    }
  }

  private clearStorage() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      } catch (error) {
        console.error('Error clearing auth storage:', error);
      }
    }
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    if (!username || !password) {
      throw new Error('Nom d\'utilisateur et mot de passe requis');
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: username.trim(),
          password: password
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Erreur de connexion';
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }

        // Dispatch custom error event for auth guard
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('apiError', {
            detail: { status: response.status, message: errorMessage }
          }));
        }

        throw new Error(errorMessage);
      }

      const data: AuthResponse = await response.json();

      if (!data.token || !data.user) {
        throw new Error('Réponse d\'authentification invalide');
      }

      this.token = data.token;
      this.user = data.user;
      this.saveToStorage(data.token, data.user);

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async register(username: string, password: string): Promise<AuthResponse> {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password, role: 'admin' }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    const data: AuthResponse = await response.json();
    this.token = data.token;
    this.user = data.user;
    this.saveToStorage(data.token, data.user);

    return data;
  }

  logout() {
    if (this.isLoggingOut) {
      return; // Prevent multiple simultaneous logouts
    }

    this.isLoggingOut = true;
    this.token = null;
    this.user = null;
    this.clearStorage();

    // Use setTimeout to prevent state update issues
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.isLoggingOut = false;
        window.location.href = '/login';
      }, 100);
    }
  }

  getToken(): string | null {
    return this.token;
  }

  getUser(): User | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return this.token !== null && this.user !== null;
  }

  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    if (!token) {
      // If no token, return headers without Authorization
      return {
        'Content-Type': 'application/json',
      };
    }

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  getAuthHeadersWithJson(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Method to check and refresh token if necessary
  async validateToken(): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    try {
      const response = await fetch('/api/auth/validate', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        this.logout();
        return false;
      }

      // Optionally, update user data if the API returns refreshed user info
      // const data = await response.json();
      // if (data.user) {
      //   this.user = data.user;
      //   this.saveToStorage(token, data.user);
      // }

      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      this.logout();
      return false;
    }
  }

  // Placeholder for hasPermission, assuming user.permissions is an array of strings
  hasPermission(permission: string): boolean {
    if (!this.user || !this.user.permissions) {
      return false;
    }
    return this.user.permissions.includes(permission);
  }
}

export default new AuthService();
export type { User, AuthResponse };