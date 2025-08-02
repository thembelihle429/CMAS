
import React, { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import './App.css';

// Authentication Context
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

  const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000/api';

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUserInfo();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUserInfo = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user info:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        username,
        password
      });
      
      const { access_token, user: userData } = response.data;
      setToken(access_token);
      setUser(userData);
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Login failed' 
      };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  const initializeAdmin = async () => {
    try {
      const response = await axios.post(`${API_BASE_URL}/init/admin`);
      return { success: true, data: response.data };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || 'Failed to initialize admin' 
      };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      initializeAdmin,
      API_BASE_URL
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Login Component
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
    <div className="min-h-screen healthcare-bg flex items-center justify-center relative">
      <div className="bg-white bg-opacity-95 backdrop-blur-sm p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 008 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🏥 CMAS</h1>
          <p className="text-blue-600 font-semibold mb-1">Clinic Medication Availability System</p>
          <p className="text-gray-600 text-sm">University of Mpumalanga Healthcare Solution</p>
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
  const [stats, setStats] = useState(null);
  const [medications, setMedications] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user, logout, API_BASE_URL } = useAuth();

  useEffect(() => {
    fetchDashboardData();
    fetchMedications();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/dashboard`);
      setStats(response.data);
    } catch (error) {
      setError('Failed to fetch dashboard data');
      console.error(error);
    }
  };

  const fetchMedications = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/medications`);
      setMedications(response.data);
    } catch (error) {
      setError('Failed to fetch medications');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const lowStockMeds = medications.filter(med => med.current_stock <= med.minimum_threshold);
  const criticalStockMeds = medications.filter(med => med.current_stock === 0);

  if (loading) {
    return (
      <div className="min-h-screen dashboard-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen dashboard-bg">
      {/* Header */}
      <header className="bg-white bg-opacity-95 backdrop-blur-sm shadow-lg border-b border-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="bg-blue-600 w-10 h-10 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 008 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">CMAS Dashboard</h1>
                <p className="text-sm text-gray-600">Clinic Medication Availability System</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.username}</p>
                <p className="text-xs text-gray-600 capitalize">{user?.role}</p>
              </div>
              <button
                onClick={logout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white bg-opacity-90 backdrop-blur-sm shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {['dashboard', 'medications', 'usage'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition duration-200 ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition duration-200 ${
                  activeTab === 'admin'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Admin Panel
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {activeTab === 'dashboard' && (
          <DashboardTab stats={stats} lowStockMeds={lowStockMeds} criticalStockMeds={criticalStockMeds} />
        )}
        
        {activeTab === 'medications' && (
          <MedicationsTab medications={medications} onRefresh={fetchMedications} />
        )}
        
        {activeTab === 'usage' && (
          <UsageTab medications={medications} onRefresh={fetchMedications} />
        )}
        
        {activeTab === 'admin' && user?.role === 'admin' && (
          <AdminTab onRefresh={fetchMedications} />
        )}
      </main>
    </div>
  );
};

// Dashboard Tab Component
const DashboardTab = ({ stats, lowStockMeds, criticalStockMeds }) => {
  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white bg-opacity-95 backdrop-blur-sm p-6 rounded-xl shadow-lg">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 008 10.172V5L8 4z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Medications</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.total_medications || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white bg-opacity-95 backdrop-blur-sm p-6 rounded-xl shadow-lg">
          <div className="flex items-center">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Low Stock</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.low_stock_count || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white bg-opacity-95 backdrop-blur-sm p-6 rounded-xl shadow-lg">
          <div className="flex items-center">
            <div className="bg-red-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Critical Stock</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.critical_stock_count || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white bg-opacity-95 backdrop-blur-sm p-6 rounded-xl shadow-lg">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Recent Alerts</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.recent_alerts?.length || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockMeds.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-4">⚠️ Low Stock Medications</h3>
          <div className="grid gap-4">
            {lowStockMeds.map(med => (
              <div key={med.id} className="bg-white p-4 rounded-lg border border-yellow-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium text-gray-900">{med.name}</h4>
                    <p className="text-sm text-gray-600">{med.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-yellow-600">
                      Stock: {med.current_stock} {med.unit}
                    </p>
                    <p className="text-xs text-gray-500">
                      Min: {med.minimum_threshold} {med.unit}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Medications Tab Component
const MedicationsTab = ({ medications, onRefresh }) => {
  const getStockStatus = (med) => {
    if (med.current_stock === 0) return { status: 'critical', color: 'red', text: 'Out of Stock' };
    if (med.current_stock <= med.minimum_threshold) return { status: 'low', color: 'yellow', text: 'Low Stock' };
    return { status: 'good', color: 'green', text: 'In Stock' };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Medications</h2>
        <button
          onClick={onRefresh}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition duration-200"
        >
          🔄 Refresh
        </button>
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
                  <p className="text-sm text-gray-500">Unit</p>
                  <p className="text-lg font-medium text-gray-900">{med.unit}</p>
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
const UsageTab = ({ medications, onRefresh }) => {
  const [selectedMedication, setSelectedMedication] = useState('');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [usageHistory, setUsageHistory] = useState([]);
  const { API_BASE_URL } = useAuth();

  useEffect(() => {
    fetchUsageHistory();
  }, []);

  const fetchUsageHistory = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/usage`);
      setUsageHistory(response.data);
    } catch (error) {
      console.error('Failed to fetch usage history:', error);
    }
  };

  const handleLogUsage = async (e) => {
    e.preventDefault();
    setIsLogging(true);

    try {
      await axios.post(`${API_BASE_URL}/medications/${selectedMedication}/use`, {
        quantity_used: parseInt(quantity),
        notes
      });

      setSelectedMedication('');
      setQuantity('');
      setNotes('');
      onRefresh();
      fetchUsageHistory();
      alert('Usage logged successfully!');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to log usage');
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

      {/* Usage History */}
      <div className="bg-white bg-opacity-95 backdrop-blur-sm p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Usage History</h3>
        
        <div className="space-y-4">
          {usageHistory.map(usage => (
            <div key={usage.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-900">{usage.medication_name}</h4>
                  <p className="text-sm text-gray-600">Used by: {usage.user_name}</p>
                  {usage.notes && <p className="text-sm text-gray-600 mt-1">Notes: {usage.notes}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">-{usage.quantity_used} units</p>
                  <p className="text-xs text-gray-500">
                    {new Date(usage.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Admin Tab Component
const AdminTab = ({ onRefresh }) => {
  const [newMedication, setNewMedication] = useState({
    name: '',
    current_stock: '',
    minimum_threshold: '',
    unit: '',
    description: ''
  });
  const [isAdding, setIsAdding] = useState(false);
  const [isTestingSMS, setIsTestingSMS] = useState(false);
  const { API_BASE_URL } = useAuth();

  const handleAddMedication = async (e) => {
    e.preventDefault();
    setIsAdding(true);

    try {
      await axios.post(`${API_BASE_URL}/medications`, {
        ...newMedication,
        current_stock: parseInt(newMedication.current_stock),
        minimum_threshold: parseInt(newMedication.minimum_threshold)
      });

      setNewMedication({
        name: '',
        current_stock: '',
        minimum_threshold: '',
        unit: '',
        description: ''
      });
      onRefresh();
      alert('Medication added successfully!');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to add medication');
    } finally {
      setIsAdding(false);
    }
  };

  const handleTestSMS = async () => {
    setIsTestingSMS(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/alerts/test`);
      alert(response.data.success ? 'Test SMS sent successfully!' : 'Failed to send test SMS');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to send test SMS');
    } finally {
      setIsTestingSMS(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Add Medication Form */}
      <div className="bg-white bg-opacity-95 backdrop-blur-sm p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Medication</h3>
        
        <form onSubmit={handleAddMedication} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Medication Name</label>
              <input
                type="text"
                value={newMedication.name}
                onChange={(e) => setNewMedication({ ...newMedication, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
              <input
                type="text"
                value={newMedication.unit}
                onChange={(e) => setNewMedication({ ...newMedication, unit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., tablets, bottles, doses"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Stock</label>
              <input
                type="number"
                value={newMedication.current_stock}
                onChange={(e) => setNewMedication({ ...newMedication, current_stock: e.target.value })}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Threshold</label>
              <input
                type="number"
                value={newMedication.minimum_threshold}
                onChange={(e) => setNewMedication({ ...newMedication, minimum_threshold: e.target.value })}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
            <textarea
              value={newMedication.description}
              onChange={(e) => setNewMedication({ ...newMedication, description: e.target.value })}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Medication description..."
            />
          </div>

          <button
            type="submit"
            disabled={isAdding}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition duration-200 disabled:opacity-50"
          >
            {isAdding ? 'Adding...' : 'Add Medication'}
          </button>
        </form>
      </div>

      {/* SMS Test */}
      <div className="bg-white bg-opacity-95 backdrop-blur-sm p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">SMS Alert Testing</h3>
        <p className="text-gray-600 mb-4">Test the SMS alert system by sending a test message to your phone.</p>
        
        <button
          onClick={handleTestSMS}
          disabled={isTestingSMS}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg transition duration-200 disabled:opacity-50"
        >
          {isTestingSMS ? 'Sending...' : '📱 Send Test SMS'}
        </button>
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
      <div className="min-h-screen healthcare-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-gray-600">Loading application...</p>
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <LoginForm />;
};

export default App;
