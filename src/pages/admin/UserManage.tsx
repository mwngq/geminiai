import { useState, useRef, useEffect } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, X, Search, Edit2, Shield, Clock, Activity, MoreVertical, ChevronDown, Filter } from 'lucide-react';
import Layout from '../../components/Layout';
import { collection, onSnapshot, query, doc, updateDoc, setDoc, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

export default function UserManage() {
  const [activeTab, setActiveTab] = useState<'import' | 'manage'>('import');
  
  // Import State
  const [file, setFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'validating' | 'preview' | 'importing' | 'success' | 'error'>('idle');
  const [validationResults, setValidationResults] = useState<{ valid: any[], invalid: any[] }>({ valid: [], invalid: [] });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manage State
  const [users, setUsers] = useState<any[]>([]);
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [modalType, setModalType] = useState<'permission' | 'loginLogs' | 'auditLogs' | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedUser && modalType === 'loginLogs') {
      const q = query(collection(db, 'loginLogs'), where('userId', '==', selectedUser.uid), orderBy('time', 'desc'), limit(50));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setLoginLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'loginLogs');
      });
      return () => unsubscribe();
    }
  }, [selectedUser, modalType]);

  useEffect(() => {
    if (selectedUser && modalType === 'auditLogs') {
      const q = query(collection(db, 'auditLogs'), where('userId', '==', selectedUser.uid), orderBy('time', 'desc'), limit(50));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setAuditLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'auditLogs');
      });
      return () => unsubscribe();
    }
  }, [selectedUser, modalType]);

  // --- Import Handlers ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setImportStatus('validating');
      
      // Simulate validation
      setTimeout(() => {
        setValidationResults({
          valid: [
            { id: 1, name: '新学生1', email: 'new1@test.com', role: 'student' },
            { id: 2, name: '新学生2', email: 'new2@test.com', role: 'student' },
            { id: 3, name: '新教师1', email: 'teacher1@test.com', role: 'teacher' },
          ],
          invalid: [
            { id: 4, name: '错误用户', email: 'invalid-email', role: 'student', error: '邮箱格式不正确' },
            { id: 5, name: '', email: 'empty@test.com', role: 'student', error: '姓名不能为空' },
          ]
        });
        setImportStatus('preview');
      }, 1500);
    }
  };

  const handleImport = async () => {
    setImportStatus('importing');
    try {
      for (const user of validationResults.valid) {
        const uid = `imported_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        await setDoc(doc(db, 'users', uid), {
          uid: uid,
          name: user.name,
          email: user.email,
          role: user.role,
          status: 'active',
          createdAt: new Date().toISOString()
        });
      }
      setImportStatus('success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
      setImportStatus('error');
    }
  };

  const resetImport = () => {
    setFile(null);
    setImportStatus('idle');
    setValidationResults({ valid: [], invalid: [] });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Manage Handlers ---
  const openModal = (user: any, type: 'permission' | 'loginLogs' | 'auditLogs') => {
    setSelectedUser(user);
    setModalType(type);
  };

  const closeModal = () => {
    setSelectedUser(null);
    setModalType(null);
  };

  const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value;
    try {
      await updateDoc(doc(db, 'users', selectedUser.uid), { role: newRole });
      setSelectedUser({ ...selectedUser, role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${selectedUser.uid}`);
    }
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStatus = e.target.value;
    try {
      await updateDoc(doc(db, 'users', selectedUser.uid), { status: newStatus });
      setSelectedUser({ ...selectedUser, status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${selectedUser.uid}`);
    }
  };

  return (
    <Layout role="admin">
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">用户管理</h1>
            <p className="text-slate-500 mt-2">批量导入用户、管理账号权限及查看审计日志。</p>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('import')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'import' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            批量导入用户
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'manage' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            账号管理
          </button>
        </div>

        {/* Tab Content: Import */}
        {activeTab === 'import' && (
          <div className="space-y-6">
            {importStatus === 'idle' && (
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 text-center">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">上传用户数据文件</h3>
                  <p className="text-sm text-slate-500 mb-6">
                    支持 CSV 或 Excel 格式。请确保包含姓名、邮箱、角色等必填字段。
                    <a href="data:text/csv;charset=utf-8,姓名,邮箱,角色%0A张三,zhangsan@example.com,student%0A李四,lisi@example.com,teacher" download="用户导入模板.csv" className="text-indigo-600 hover:underline ml-1">下载模板</a>
                  </p>
                  
                  <input 
                    type="file" 
                    accept=".csv, .xlsx, .xls" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                  >
                    选择文件
                  </button>
                </div>
              </div>
            )}

            {importStatus === 'validating' && (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 text-center">
                <div className="animate-spin w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-4"></div>
                <h3 className="text-lg font-medium text-slate-900">正在验证数据...</h3>
                <p className="text-sm text-slate-500 mt-2">正在检查数据格式、必填项及重复记录</p>
              </div>
            )}

            {importStatus === 'preview' && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">数据验证结果</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      共解析 {validationResults.valid.length + validationResults.invalid.length} 条数据，
                      <span className="text-emerald-600 font-medium mx-1">{validationResults.valid.length} 条有效</span>，
                      <span className="text-rose-600 font-medium mx-1">{validationResults.invalid.length} 条异常</span>。
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={resetImport} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                      重新上传
                    </button>
                    <button 
                      onClick={handleImport}
                      disabled={validationResults.valid.length === 0}
                      className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      确认导入有效数据
                    </button>
                  </div>
                </div>
                
                {validationResults.invalid.length > 0 && (
                  <div className="p-6 border-b border-slate-100">
                    <h4 className="text-sm font-medium text-rose-800 flex items-center gap-2 mb-4">
                      <AlertCircle className="w-4 h-4" />
                      异常数据 ({validationResults.invalid.length})
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 bg-slate-50 uppercase">
                          <tr>
                            <th className="px-4 py-3 rounded-l-lg">姓名</th>
                            <th className="px-4 py-3">邮箱</th>
                            <th className="px-4 py-3">角色</th>
                            <th className="px-4 py-3 rounded-r-lg">错误原因</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validationResults.invalid.map((row, idx) => (
                            <tr key={idx} className="border-b border-slate-50 last:border-0">
                              <td className="px-4 py-3 font-medium text-slate-900">{row.name || '-'}</td>
                              <td className="px-4 py-3 text-slate-600">{row.email}</td>
                              <td className="px-4 py-3 text-slate-600">{row.role}</td>
                              <td className="px-4 py-3 text-rose-600 font-medium">{row.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="p-6">
                  <h4 className="text-sm font-medium text-emerald-800 flex items-center gap-2 mb-4">
                    <CheckCircle className="w-4 h-4" />
                    有效数据预览 ({validationResults.valid.length})
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 bg-slate-50 uppercase">
                        <tr>
                          <th className="px-4 py-3 rounded-l-lg">姓名</th>
                          <th className="px-4 py-3">邮箱</th>
                          <th className="px-4 py-3 rounded-r-lg">角色</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationResults.valid.map((row, idx) => (
                          <tr key={idx} className="border-b border-slate-50 last:border-0">
                            <td className="px-4 py-3 font-medium text-slate-900">{row.name}</td>
                            <td className="px-4 py-3 text-slate-600">{row.email}</td>
                            <td className="px-4 py-3 text-slate-600">
                              <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                                row.role === 'student' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                              }`}>
                                {row.role === 'student' ? '学生' : '教师'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {importStatus === 'importing' && (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 text-center">
                <div className="animate-spin w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-4"></div>
                <h3 className="text-lg font-medium text-slate-900">正在导入数据...</h3>
                <div className="w-64 h-2 bg-slate-100 rounded-full mx-auto mt-4 overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                </div>
              </div>
            )}

            {importStatus === 'success' && (
              <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 text-center">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">导入成功</h3>
                <p className="text-slate-500 mb-6">成功导入 {validationResults.valid.length} 个用户账号，初始密码已发送至用户邮箱。</p>
                <div className="flex justify-center gap-4">
                  <button onClick={() => setActiveTab('manage')} className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors">
                    前往账号管理
                  </button>
                  <button onClick={resetImport} className="px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                    继续导入
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: Manage */}
        {activeTab === 'manage' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
              <div className="relative w-full sm:w-96">
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="搜索姓名、邮箱或 ID..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">
                  <Filter className="w-4 h-4" />
                  筛选
                </button>
                <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
                  添加用户
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4">用户信息</th>
                      <th className="px-6 py-4">角色权限</th>
                      <th className="px-6 py-4">状态</th>
                      <th className="px-6 py-4">最后登录</th>
                      <th className="px-6 py-4 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.filter(u => u.name?.includes(searchQuery) || u.email?.includes(searchQuery) || u.uid?.includes(searchQuery)).map((user) => (
                      <tr key={user.uid || user.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                              {user.name[0]}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">{user.name}</div>
                              <div className="text-slate-500 text-xs">{user.email}</div>
                              <div className="text-slate-400 text-[10px] mt-0.5">ID: {user.uid || user.id}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                            user.role === 'admin' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            user.role === 'teacher' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                            {user.role === 'admin' ? '管理员' : user.role === 'teacher' ? '教师' : '学生'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`flex items-center gap-1.5 text-xs font-medium ${
                            user.status === 'active' ? 'text-emerald-600' : 'text-slate-500'
                          }`}>
                            <span className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                            {user.status === 'active' ? '正常' : '已禁用'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs">
                          {user.lastLogin}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => openModal(user, 'permission')}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="修改权限"
                            >
                              <Shield className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => openModal(user, 'loginLogs')}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="登录日志"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => openModal(user, 'auditLogs')}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="操作审计"
                            >
                              <Activity className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
                <div>显示 1 - 4 条，共 4 条</div>
                <div className="flex gap-1">
                  <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50">上一页</button>
                  <button className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50">下一页</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        {modalType && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  {modalType === 'permission' && <><Shield className="w-5 h-5 text-indigo-600" /> 权限修改</>}
                  {modalType === 'loginLogs' && <><Clock className="w-5 h-5 text-indigo-600" /> 登录日志</>}
                  {modalType === 'auditLogs' && <><Activity className="w-5 h-5 text-indigo-600" /> 操作审计</>}
                  <span className="text-sm font-normal text-slate-500 ml-2">- {selectedUser?.name}</span>
                </h2>
                <button onClick={closeModal} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                {modalType === 'permission' && (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">系统角色</label>
                      <select 
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" 
                        value={selectedUser?.role}
                        onChange={handleRoleChange}
                      >
                        <option value="student">学生 (基础权限，提交作业，查看成绩)</option>
                        <option value="teacher">教师 (管理班级，发布作业，查看分析)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">账号状态</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="status" 
                            value="active"
                            checked={selectedUser?.status === 'active'} 
                            onChange={handleStatusChange}
                            className="text-indigo-600 focus:ring-indigo-500" 
                          />
                          <span className="text-sm text-slate-700">正常</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="status" 
                            value="disabled"
                            checked={selectedUser?.status === 'disabled'} 
                            onChange={handleStatusChange}
                            className="text-rose-600 focus:ring-rose-500" 
                          />
                          <span className="text-sm text-slate-700">禁用 (禁止登录)</span>
                        </label>
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                      <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">关闭</button>
                    </div>
                  </div>
                )}

                {modalType === 'loginLogs' && (
                  <div className="space-y-4">
                    {loginLogs.length === 0 ? <p className="text-slate-500 text-sm">暂无登录日志</p> : loginLogs.map(log => (
                      <div key={log.id} className="flex items-start gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50/50">
                        <div className={`p-2 rounded-lg ${log.status === 'success' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {log.status === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div className="font-medium text-slate-900 text-sm">{log.ip}</div>
                            <div className="text-xs text-slate-500">{log.time}</div>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">{log.device}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {modalType === 'auditLogs' && (
                  <div className="space-y-4">
                    <div className="relative border-l-2 border-slate-200 ml-3 space-y-6 pb-4">
                      {auditLogs.length === 0 ? <p className="text-slate-500 text-sm ml-4">暂无审计日志</p> : auditLogs.map(log => (
                        <div key={log.id} className="relative pl-6">
                          <div className="absolute w-3 h-3 bg-indigo-600 rounded-full -left-[7px] top-1.5 ring-4 ring-white"></div>
                          <div className="bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-medium text-slate-900 text-sm">{log.action}</span>
                              <span className="text-xs text-slate-500">{log.time}</span>
                            </div>
                            <div className="text-xs text-indigo-600 font-medium mb-2">资源: {log.resource}</div>
                            <p className="text-sm text-slate-600">{log.details}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
