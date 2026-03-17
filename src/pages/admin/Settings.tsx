import { useState, useEffect } from 'react';
import { Save, Shield, Mail, Globe, Database, Bot, AlertCircle, CheckCircle2, Play } from 'lucide-react';
import Layout from '../../components/Layout';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import { callAI } from '../../services/aiService';

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);

  const [settings, setSettings] = useState({
    siteName: 'CodeEdu 编程教育平台',
    allowRegistration: true,
    defaultRole: 'student',
    maintenanceMode: false,
    aiEnabled: true,
    aiModel: 'gemini-3.1-pro-preview',
    apiKey: '',
    apiBaseUrl: '',
    maxTokensPerUser: 100000,
    emailNotifications: true,
    smtpServer: 'smtp.example.com',
    smtpPort: 587,
    sessionTimeout: 120,
    requireEmailVerification: false
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'global');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(prev => ({ ...prev, ...docSnap.data() }));
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'settings/global');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), settings);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleTestApi = async () => {
    setIsTestingApi(true);
    setTestResult(null);
    
    // Save settings first so callAI uses the latest ones
    try {
      await setDoc(doc(db, 'settings', 'global'), settings);
      
      const response = await callAI("Respond with 'API Connection Successful!' if you receive this message.");
      setTestResult({ success: true, message: response });
    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error occurred during API test' 
      });
    } finally {
      setIsTestingApi(false);
    }
  };

  return (
    <Layout role="admin">
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">系统设置</h1>
            <p className="text-slate-500 mt-2">管理平台的全局配置、安全策略和 AI 服务。</p>
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-70"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            保存更改
          </button>
        </header>

        {showSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-700 animate-in fade-in slide-in-from-top-4">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">设置已成功保存</span>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8">
          {/* Settings Navigation */}
          <div className="w-full md:w-64 shrink-0">
            <nav className="space-y-1">
              {[
                { id: 'general', label: '常规设置', icon: Globe },
                { id: 'security', label: '安全策略', icon: Shield },
                { id: 'ai', label: 'AI 助教配置', icon: Bot },
                { id: 'email', label: '邮件通知', icon: Mail },
                { id: 'database', label: '数据与备份', icon: Database },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Settings Content */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {activeTab === 'general' && (
              <div className="p-8 space-y-8 animate-in fade-in">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-4">基本信息</h2>
                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">平台名称</label>
                      <input
                        type="text"
                        value={settings.siteName}
                        onChange={(e) => handleChange('siteName', e.target.value)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-slate-100" />

                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-4">注册与访问</h2>
                  <div className="space-y-6">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center mt-0.5">
                        <input
                          type="checkbox"
                          checked={settings.allowRegistration}
                          onChange={(e) => handleChange('allowRegistration', e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </div>
                      <div>
                        <span className="block text-sm font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">允许开放注册</span>
                        <span className="block text-sm text-slate-500 mt-0.5">开启后，用户可以自行注册账号。关闭后仅能由管理员导入。</span>
                      </div>
                    </label>

                    {settings.allowRegistration && (
                      <div className="max-w-xs pl-14">
                        <label className="block text-sm font-medium text-slate-700 mb-1">默认注册角色</label>
                        <select
                          value={settings.defaultRole}
                          onChange={(e) => handleChange('defaultRole', e.target.value)}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="student">学生</option>
                          <option value="teacher">教师</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <hr className="border-slate-100" />

                <div>
                  <h2 className="text-lg font-bold text-rose-600 mb-4">危险操作</h2>
                  <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-rose-900">维护模式</h3>
                      <p className="text-sm text-rose-700 mt-1">开启维护模式后，除管理员外的所有用户将无法访问系统。</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                      <input
                        type="checkbox"
                        checked={settings.maintenanceMode}
                        onChange={(e) => handleChange('maintenanceMode', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-rose-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-rose-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="p-8 space-y-8 animate-in fade-in">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-4">AI 服务状态</h2>
                  <div className="space-y-6">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center mt-0.5">
                        <input
                          type="checkbox"
                          checked={settings.aiEnabled}
                          onChange={(e) => handleChange('aiEnabled', e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </div>
                      <div>
                        <span className="block text-sm font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">启用全局 AI 助教</span>
                        <span className="block text-sm text-slate-500 mt-0.5">关闭后，平台所有 AI 功能（代码补全、智能答疑、自动批改）将被禁用。</span>
                      </div>
                    </label>
                  </div>
                </div>

                <hr className="border-slate-100" />

                <div className={!settings.aiEnabled ? 'opacity-50 pointer-events-none' : ''}>
                  <h2 className="text-lg font-bold text-slate-900 mb-4">模型配置</h2>
                  <div className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">默认大语言模型</label>
                      <input
                        type="text"
                        value={settings.aiModel}
                        onChange={(e) => handleChange('aiModel', e.target.value)}
                        placeholder="例如: gemini-3.1-pro-preview 或 gpt-4"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">输入模型名称，如使用默认 Gemini 请填入 gemini-3.1-pro-preview。</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">API Key</label>
                      <input
                        type="password"
                        value={settings.apiKey}
                        onChange={(e) => handleChange('apiKey', e.target.value)}
                        placeholder="留空则使用系统环境变量中的默认 Key"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">如果配置了自定义 API Key，将优先使用此 Key。</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">API Base URL</label>
                      <input
                        type="text"
                        value={settings.apiBaseUrl}
                        onChange={(e) => handleChange('apiBaseUrl', e.target.value)}
                        placeholder="例如: https://api.openai.com/v1"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">如果使用代理或兼容 API，请填写 Base URL。留空则使用官方默认地址。</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">用户月度 Token 限制</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={settings.maxTokensPerUser}
                          onChange={(e) => handleChange('maxTokensPerUser', Number(e.target.value))}
                          className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">Tokens</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">限制单个用户每月的 AI 调用量，防止成本失控。</p>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                      <button
                        onClick={handleTestApi}
                        disabled={isTestingApi || !settings.aiEnabled}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50"
                      >
                        {isTestingApi ? (
                          <div className="w-4 h-4 border-2 border-slate-400 border-t-slate-700 rounded-full animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                        测试 API 连接
                      </button>
                      
                      {testResult && (
                        <div className={`mt-3 p-3 rounded-lg text-sm ${testResult.success ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                          <div className="flex items-start gap-2">
                            {testResult.success ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                            <span className="break-all">{testResult.message}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="p-8 space-y-8 animate-in fade-in">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 mb-4">会话与认证</h2>
                  <div className="space-y-6">
                    <div className="max-w-md">
                      <label className="block text-sm font-medium text-slate-700 mb-1">会话超时时间 (分钟)</label>
                      <input
                        type="number"
                        value={settings.sessionTimeout}
                        onChange={(e) => handleChange('sessionTimeout', Number(e.target.value))}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      />
                      <p className="text-xs text-slate-500 mt-1">用户无操作超过此时间后将自动登出。</p>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center mt-0.5">
                        <input
                          type="checkbox"
                          checked={settings.requireEmailVerification}
                          onChange={(e) => handleChange('requireEmailVerification', e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </div>
                      <div>
                        <span className="block text-sm font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">强制邮箱验证</span>
                        <span className="block text-sm text-slate-500 mt-0.5">新注册用户必须验证邮箱后才能登录系统。</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Placeholders for other tabs */}
            {(activeTab === 'email' || activeTab === 'database') && (
              <div className="p-12 flex flex-col items-center justify-center text-center animate-in fade-in h-64">
                <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-900">该功能正在开发中</h3>
                <p className="text-slate-500 mt-2 max-w-sm">
                  {activeTab === 'email' ? '邮件服务器配置模块即将上线。' : '数据库备份与恢复功能即将上线。'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
