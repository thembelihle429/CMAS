import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000/api';

// Auth Context
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      // Verify token and get user info
      fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setUser(data);
        } else {
          localStorage.removeItem('token');
          setToken(null);
        }
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.access_token);
        setUser(data.user);
        localStorage.setItem('token', data.access_token);
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.detail };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  const initializeAdmin = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/init/admin`, {
        method: 'POST'
      });

      if (response.ok) {
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.detail };
      }
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, initializeAdmin, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Login Form Component
const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showInitAdmin, setShowInitAdmin] = useState(false);
  const { login, initializeAdmin } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const result = await login(username, password);

    if (!result.success) {
      setError(result.error);
      if (result.error.includes('User not found') || result.error.includes('Invalid credentials')) {
        setShowInitAdmin(true);
      }
    }

    setIsLoading(false);
  };

  const handleInitAdmin = async () => {
    setIsLoading(true);
    const result = await initializeAdmin();

    if (result.success) {
      setUsername('admin');
      setPassword('admin123');
      setError('');
      setShowInitAdmin(false);
      alert('Admin user created! Username: admin, Password: admin123');
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="bg-white bg-opacity-95 backdrop-blur-sm p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🏥 CMAS</h1>
          <p className="text-gray-600">Clinic Medication Availability System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">👤 Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
              placeholder="Enter your username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">🔒 Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition duration-200 font-medium disabled:opacity-50"
          >
            {isLoading ? '🔄 Signing in...' : '🚀 Sign In'}
          </button>

          {showInitAdmin && (
            <button
              type="button"
              onClick={handleInitAdmin}
              disabled={isLoading}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition duration-200 font-medium disabled:opacity-50"
            >
              {isLoading ? '🔄 Creating Admin...' : '👨‍⚕️ Initialize Admin User'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

// Dashboard Component
const Dashboard = () => {
  const { user, logout, token } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchDashboardData();
    fetchMedications();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const fetchMedications = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/medications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMedications(data);
      }
    } catch (error) {
      console.error('Failed to fetch medications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStockStatus = (medication) => {
    if (medication.current_stock === 0) {
      return { text: '❌ Out of Stock', color: 'red' };
    } else if (medication.current_stock <= medication.minimum_threshold) {
      return { text: '⚠️ Low Stock', color: 'yellow' };
    } else {
      return { text: '✅ In Stock', color: 'green' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white bg-opacity-95 backdrop-blur-sm shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">🏥 CMAS Dashboard</h1>
              <p className="text-gray-600">Welcome back, {user.username}!</p>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Role: {user.role}</span>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white bg-opacity-95 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {['overview', 'medications', 'usage'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab === 'overview' && '📊'} {tab === 'medications' && '💊'} {tab === 'usage' && '📋'} {tab}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <OverviewTab dashboardData={dashboardData} />}
        {activeTab === 'medications' && <MedicationsTab medications={medications} fetchMedications={fetchMedications} />}
        {activeTab === 'usage' && <UsageTab medications={medications} />}
      </main>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ dashboardData }) => {
  if (!dashboardData) return <div>Loading overview...</div>;

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white bg-opacity-95 backdrop-blur-sm p-6 rounded-xl shadow-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">💊</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Medications</p>
              <p className="text-2xl font-semibold text-gray-900">{dashboardData.total_medications}</p>
            </div>
          </div>
        </div>

        <div className="bg-white bg-opacity-95 backdrop-blur-sm p-6 rounded-xl shadow-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">⚠️</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Low Stock Items</p>
              <p className="text-2xl font-semibold text-gray-900">{dashboardData.low_stock_count}</p>
            </div>
          </div>
        </div>

        <div className="bg-white bg-opacity-95 backdrop-blur-sm p-6 rounded-xl shadow-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm">❌</span>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Critical Stock</p>
              <p className="text-2xl font-semibold text-gray-900">{dashboardData.critical_stock_count}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="bg-white bg-opacity-95 backdrop-blur-sm p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🚨 Recent Alerts</h3>
        {dashboardData.recent_alerts.length > 0 ? (
          <div className="space-y-3">
            {dashboardData.recent_alerts.map((alert, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div>
                  <p className="font-medium text-red-800">{alert.medication_name}</p>
                  <p className="text-sm text-red-600">Stock: {alert.current_stock} (Min: {alert.minimum_threshold})</p>
                </div>
                <span className="text-xs text-red-500">{new Date(alert.sent_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No recent alerts</p>
        )}
      </div>
    </div>
  );
};

// Medications Tab Component
const MedicationsTab = ({ medications, fetchMedications }) => {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';

  const getStockStatus = (medication) => {
    if (medication.current_stock === 0) {
      return { text: '❌ Out of Stock', color: 'red' };
    } else if (medication.current_stock <= medication.minimum_threshold) {
      return { text: '⚠️ Low Stock', color: 'yellow' };
    } else {
      return { text: '✅ In Stock', color: 'green' };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">💊 Medications</h2>
        {isAdmin && (
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition duration-200">
            + Add Medication
          </button>
        )}
      </div>

      <div className="grid gap-6">
        {medications.map(med => {
          const stockInfo = getStockStatus(med);
          return (
            <div key={med.id} className="bg-white bg-opacity-95 backdrop-blur-sm p-6 rounded-xl shadow-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">{med.name}</h3>
                  <p className="text-gray-600 mt-1">{med.description}</p>
                </div>
                <div className="text-right">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    stockInfo.color === 'red' ? 'bg-red-100 text-red-800' :
                    stockInfo.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {stockInfo.text}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Current Stock</p>
                  <p className="text-lg font-medium text-gray-900">{med.current_stock} {med.unit}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Minimum Threshold</p>
                  <p className="text-lg font-medium text-gray-900">{med.minimum_threshold} {med.unit}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Last Updated</p>
                  <p className="text-lg font-medium text-gray-900">{new Date(med.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Usage Tab Component
const UsageTab = ({ medications }) => {
  const { token } = useAuth();
  const [selectedMedication, setSelectedMedication] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [isLogging, setIsLogging] = useState(false);

  const handleLogUsage = async (e) => {
    e.preventDefault();
    setIsLogging(true);

    try {
      const response = await fetch(`${API_BASE_URL}/medications/${selectedMedication}/use`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          medication_id: selectedMedication,
          quantity_used: parseInt(quantity),
          notes
        })
      });

      if (response.ok) {
        alert('Usage logged successfully!');
        setSelectedMedication('');
        setQuantity('');
        setNotes('');
      } else {
        const error = await response.json();
        alert(`Error: ${error.detail}`);
      }
    } catch (error) {
      alert('Network error occurred');
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Usage Logging Form */}
      <div className="bg-white bg-opacity-95 backdrop-blur-sm p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Log Medication Usage</h3>

        <form onSubmit={handleLogUsage} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Medication</label>
            <select
              value={selectedMedication}
              onChange={(e) => setSelectedMedication(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              <option value="">Select a medication</option>
              {medications.map(med => (
                <option key={med.id} value={med.id}>
                  {med.name} (Available: {med.current_stock} {med.unit})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity Used</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Any additional notes..."
            />
          </div>

          <button
            type="submit"
            disabled={isLogging}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {isLogging ? 'Logging...' : 'Log Usage'}
          </button>
        </form>
      </div>
    </div>
  );
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const AppContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <LoginForm />;
};

export default App;