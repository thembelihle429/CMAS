import React, { useState, useEffect } from "react";
import "./App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Auth Context
const AuthContext = React.createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUserInfo();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUserInfo = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    }
    setLoading(false);
  };

  const login = async (username, password) => {
    try {
      const response = await axios.post(`${API}/auth/login`, { username, password });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('token', access_token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      setUser(userData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.detail || 'Login failed' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Components
const LoginForm = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(username, password);
    if (!result.success) {
      setError(result.error);
    }
    setLoading(false);
  };

  const initializeAdmin = async () => {
    try {
      await axios.post(`${API}/init/admin`);
      alert('Admin user created! Username: admin, Password: admin123');
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to create admin user');
    }
  };

  return (
    <div className="min-h-screen healthcare-bg flex items-center justify-center relative">
      <div className="glass-card p-8 rounded-2xl shadow-2xl w-full max-w-md fade-in">
        <div className="text-center mb-8">
          <div className="medical-accent w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent glass-card-light"
              placeholder="Enter your username"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">🔐 Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent glass-card-light"
              placeholder="Enter your password"
              required
            />
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg glass-card">
              ⚠️ {error}
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading}
            className="w-full medical-accent text-white py-3 px-4 rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all transform hover:scale-[1.02]"
          >
            {loading ? '🔄 Signing in...' : '🚀 Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={initializeAdmin}
            className="w-full text-sm text-blue-600 hover:text-blue-800 hover:underline transition-colors"
          >
            🛠️ First time setup? Initialize Admin User
          </button>
        </div>
        
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            © 2025 University of Mpumalanga | Secure Healthcare Management
          </p>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const { user, logout } = useAuth();

  useEffect(() => {
    fetchDashboardData();
    fetchMedications();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(`${API}/dashboard`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  const fetchMedications = async () => {
    try {
      const response = await axios.get(`${API}/medications`);
      setMedications(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch medications:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="bg-blue-600 w-8 h-8 rounded-lg flex items-center justify-center mr-3">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 008 10.172V5L8 4z" />
                </svg>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">CMAS</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user?.username} ({user?.role})
              </span>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('medications')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'medications'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Medications
            </button>
            <button
              onClick={() => setActiveTab('usage')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'usage'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Usage Log
            </button>
            {user?.role === 'admin' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'admin'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                Admin
              </button>
            )}
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'dashboard' && (
          <DashboardContent stats={stats} medications={medications} fetchData={fetchDashboardData} />
        )}
        {activeTab === 'medications' && (
          <MedicationsContent medications={medications} fetchMedications={fetchMedications} />
        )}
        {activeTab === 'usage' && <UsageContent />}
        {activeTab === 'admin' && user?.role === 'admin' && <AdminContent fetchMedications={fetchMedications} />}
      </div>
    </div>
  );
};

const DashboardContent = ({ stats, medications, fetchData }) => {
  const lowStockMeds = medications.filter(med => med.current_stock <= med.minimum_threshold);
  const criticalStockMeds = medications.filter(med => med.current_stock === 0);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="flex items-center">
            <div className="bg-blue-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 008 10.172V5L8 4z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Medications</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.total_medications || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="flex items-center">
            <div className="bg-yellow-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Low Stock</p>
              <p className="text-2xl font-semibold text-yellow-600">{stats?.low_stock_count || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="flex items-center">
            <div className="bg-red-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Critical Stock</p>
              <p className="text-2xl font-semibold text-red-600">{stats?.critical_stock_count || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <div className="flex items-center">
            <div className="bg-green-100 p-3 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a7.81 7.81 0 006-2.08A7.81 7.81 0 0015 17z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Alerts Sent</p>
              <p className="text-2xl font-semibold text-green-600">{stats?.recent_alerts?.length || 0}</p>
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

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Usage</h3>
          <div className="space-y-3">
            {stats?.recent_usage?.slice(0, 5).map(usage => (
              <div key={usage.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">{usage.medication_name}</p>
                  <p className="text-sm text-gray-600">by {usage.user_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">-{usage.quantity_used}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(usage.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            )) || <p className="text-gray-500 text-sm">No recent usage</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Alerts</h3>
          <div className="space-y-3">
            {stats?.recent_alerts?.slice(0, 5).map(alert => (
              <div key={alert.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-800">{alert.medication_name}</p>
                <p className="text-xs text-red-600">
                  Stock: {alert.current_stock} (Min: {alert.minimum_threshold})
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(alert.sent_at).toLocaleString()}
                </p>
              </div>
            )) || <p className="text-gray-500 text-sm">No recent alerts</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

const MedicationsContent = ({ medications, fetchMedications }) => {
  const [usageForm, setUsageForm] = useState({
    medicationId: '',
    quantity: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  const handleUsageSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/medications/${usageForm.medicationId}/use`, {
        quantity_used: parseInt(usageForm.quantity),
        notes: usageForm.notes
      });

      alert('Usage logged successfully!');
      setUsageForm({ medicationId: '', quantity: '', notes: '' });
      fetchMedications();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to log usage');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Usage Form */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Log Medication Usage</h3>
        <form onSubmit={handleUsageSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Medication</label>
            <select
              value={usageForm.medicationId}
              onChange={(e) => setUsageForm({...usageForm, medicationId: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select medication</option>
              {medications.filter(med => med.current_stock > 0).map(med => (
                <option key={med.id} value={med.id}>
                  {med.name} (Stock: {med.current_stock})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quantity Used</label>
            <input
              type="number"
              value={usageForm.quantity}
              onChange={(e) => setUsageForm({...usageForm, quantity: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="1"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
            <input
              type="text"
              value={usageForm.notes}
              onChange={(e) => setUsageForm({...usageForm, notes: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Patient ID, reason, etc."
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Logging...' : 'Log Usage'}
            </button>
          </div>
        </form>
      </div>

      {/* Medications List */}
      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">All Medications</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {medications.map(med => {
            const isLowStock = med.current_stock <= med.minimum_threshold;
            const isCritical = med.current_stock === 0;
            
            return (
              <div key={med.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h4 className="text-lg font-medium text-gray-900">{med.name}</h4>
                      {isCritical && (
                        <span className="ml-2 px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          OUT OF STOCK
                        </span>
                      )}
                      {isLowStock && !isCritical && (
                        <span className="ml-2 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                          LOW STOCK
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mt-1">{med.description}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Unit: {med.unit} | Minimum threshold: {med.minimum_threshold}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${
                      isCritical ? 'text-red-600' : 
                      isLowStock ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {med.current_stock}
                    </p>
                    <p className="text-sm text-gray-500">in stock</p>
                  </div>
                </div>
              </div>
            );
          })}
          {medications.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              No medications found. Add some medications in the Admin panel.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const UsageContent = () => {
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const response = await axios.get(`${API}/usage`);
      setUsage(response.data);
    } catch (error) {
      console.error('Failed to fetch usage:', error);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-8">Loading usage history...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Medication Usage History</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {usage.map(record => (
          <div key={record.id} className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-gray-900">{record.medication_name}</h4>
                <p className="text-sm text-gray-600">Used by: {record.user_name}</p>
                {record.notes && (
                  <p className="text-sm text-gray-500 mt-1">Notes: {record.notes}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-medium text-red-600">-{record.quantity_used}</p>
                <p className="text-sm text-gray-500">
                  {new Date(record.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
        {usage.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            No usage records found.
          </div>
        )}
      </div>
    </div>
  );
};

const AdminContent = ({ fetchMedications }) => {
  const [newMed, setNewMed] = useState({
    name: '',
    current_stock: '',
    minimum_threshold: '',
    unit: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/medications`, {
        name: newMed.name,
        current_stock: parseInt(newMed.current_stock),
        minimum_threshold: parseInt(newMed.minimum_threshold),
        unit: newMed.unit,
        description: newMed.description
      });

      alert('Medication added successfully!');
      setNewMed({
        name: '',
        current_stock: '',
        minimum_threshold: '',
        unit: '',
        description: ''
      });
      fetchMedications();
    } catch (error) {
      alert(error.response?.data?.detail || 'Failed to add medication');
    }
    setLoading(false);
  };

  const testSMS = async () => {
    try {
      const response = await axios.post(`${API}/alerts/test`);
      alert('Test SMS sent successfully!');
    } catch (error) {
      alert('Failed to send test SMS: ' + (error.response?.data?.detail || 'Unknown error'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Add Medication Form */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Medication</h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Medication Name</label>
            <input
              type="text"
              value={newMed.name}
              onChange={(e) => setNewMed({...newMed, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Stock</label>
            <input
              type="number"
              value={newMed.current_stock}
              onChange={(e) => setNewMed({...newMed, current_stock: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="0"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Threshold</label>
            <input
              type="number"
              value={newMed.minimum_threshold}
              onChange={(e) => setNewMed({...newMed, minimum_threshold: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="0"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
            <input
              type="text"
              value={newMed.unit}
              onChange={(e) => setNewMed({...newMed, unit: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., tablets, bottles, doses"
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              value={newMed.description}
              onChange={(e) => setNewMed({...newMed, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows="3"
              placeholder="Brief description of the medication"
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white py-2 px-6 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Add Medication'}
            </button>
          </div>
        </form>
      </div>

      {/* Test SMS */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Test SMS Alerts</h3>
        <p className="text-gray-600 mb-4">
          Test the SMS alert system by sending a test message to your phone.
        </p>
        <button
          onClick={testSMS}
          className="bg-green-600 text-white py-2 px-6 rounded-lg hover:bg-green-700"
        >
          Send Test SMS
        </button>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <div className="App">
        <AuthContent />
      </div>
    </AuthProvider>
  );
}

const AuthContent = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <LoginForm />;
};

export default App;