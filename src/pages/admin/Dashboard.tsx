import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { Server, Activity, Users, DollarSign, AlertTriangle, TrendingUp, Bell, BookOpen, FileText, CheckSquare, GraduationCap } from 'lucide-react';
import Layout from '../../components/Layout';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

export default function AdminDashboard() {
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [budgetThreshold, setBudgetThreshold] = useState(100);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalProblems, setTotalProblems] = useState(0);
  const [totalAssignments, setTotalAssignments] = useState(0);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [totalClasses, setTotalClasses] = useState(0);
  const [submissionData, setSubmissionData] = useState<{name: string, count: number}[]>([]);
  const [submissionStatus, setSubmissionStatus] = useState<{name: string, value: number}[]>([]);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), 
      (snapshot) => setTotalUsers(snapshot.size),
      (error) => handleFirestoreError(error, OperationType.GET, 'users')
    );
    const unsubProblems = onSnapshot(collection(db, 'problems'), 
      (snapshot) => setTotalProblems(snapshot.size),
      (error) => handleFirestoreError(error, OperationType.GET, 'problems')
    );
    const unsubAssignments = onSnapshot(collection(db, 'assignments'), 
      (snapshot) => setTotalAssignments(snapshot.size),
      (error) => handleFirestoreError(error, OperationType.GET, 'assignments')
    );
    const unsubSubmissions = onSnapshot(collection(db, 'submissions'), 
      (snapshot) => {
        setTotalSubmissions(snapshot.size);
        
        // Process submission data for charts
        const now = new Date();
        const last7Days = Array.from({length: 7}, (_, i) => {
          const d = new Date(now);
          d.setDate(d.getDate() - (6 - i));
          return d.toLocaleDateString('en-US', { weekday: 'short' });
        });
        
        const counts = new Array(7).fill(0);
        let successCount = 0;
        let failCount = 0;

        snapshot.forEach(doc => {
          const data = doc.data();
          const isPassed = data.passed !== undefined ? data.passed : data.score >= 80;
          if (isPassed) successCount++;
          else failCount++;

          if (data.submitTime) {
            const submitDate = new Date(data.submitTime);
            const diffTime = Math.abs(now.getTime() - submitDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) {
              const index = 7 - diffDays;
              if (index >= 0 && index < 7) {
                counts[index]++;
              }
            }
          }
        });

        setSubmissionData(last7Days.map((name, i) => ({ name, count: counts[i] })));
        
        const total = successCount + failCount;
        if (total > 0) {
          setSubmissionStatus([
            { name: '通过 (100分)', value: Math.round((successCount / total) * 100) },
            { name: '未通过', value: Math.round((failCount / total) * 100) }
          ]);
        } else {
          setSubmissionStatus([
            { name: '通过 (100分)', value: 0 },
            { name: '未通过', value: 0 }
          ]);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, 'submissions')
    );
    const unsubClasses = onSnapshot(collection(db, 'classes'), 
      (snapshot) => setTotalClasses(snapshot.size),
      (error) => handleFirestoreError(error, OperationType.GET, 'classes')
    );

    return () => {
      unsubUsers();
      unsubProblems();
      unsubAssignments();
      unsubSubmissions();
      unsubClasses();
    };
  }, []);

  return (
    <Layout role="admin">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">系统管理</h1>
          <p className="text-slate-500 mt-2">监控平台健康状况和 AI 使用成本。</p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">总用户数</p>
              <p className="text-2xl font-bold text-slate-900">{totalUsers}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">题库总数</p>
              <p className="text-2xl font-bold text-slate-900">{totalProblems}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">作业总数</p>
              <p className="text-2xl font-bold text-slate-900">{totalAssignments}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-xl">
              <CheckSquare className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">提交总数</p>
              <p className="text-2xl font-bold text-slate-900">{totalSubmissions}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-cyan-100 text-cyan-600 rounded-xl">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">班级总数</p>
              <p className="text-2xl font-bold text-slate-900">{totalClasses}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            {/* API Usage Chart */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">提交量统计 (7 天)</h2>
                  <p className="text-sm text-slate-500 mt-1">总计提交: {totalSubmissions} 次</p>
                </div>
                <span className="text-xs font-medium px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">正常</span>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={submissionData}>
                    <defs>
                      <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                    <Tooltip 
                      cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }} 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: number) => [`${value.toLocaleString()} 次`, '提交量']}
                    />
                    <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorTokens)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Cost Prediction Analysis */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900 mb-6">提交状态分析</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 mb-2">
                    <CheckSquare className="w-4 h-4" />
                    <span className="text-sm font-medium">总提交次数</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{totalSubmissions}</div>
                  <div className="text-xs text-slate-500 mt-2">截至今日</div>
                </div>
                <div className="p-5 rounded-xl bg-indigo-50 border border-indigo-100">
                  <div className="flex items-center gap-2 text-indigo-600 mb-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-medium">平均通过率</span>
                  </div>
                  <div className="text-2xl font-bold text-indigo-700">
                    {submissionStatus.find(s => s.name === '通过 (100分)')?.value || 0}%
                  </div>
                  <div className="text-xs text-indigo-500 mt-2">基于所有历史提交</div>
                </div>
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2 text-slate-500 mb-2">
                    <Activity className="w-4 h-4" />
                    <span className="text-sm font-medium">状态分布</span>
                  </div>
                  <div className="space-y-2 mt-3">
                    {submissionStatus.map(item => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${item.name.includes('通过') ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${item.value}%` }}></div>
                          </div>
                          <span className="text-slate-900 font-medium w-6 text-right">{item.value}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* User Management Quick Actions */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900 mb-6">用户管理</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link to="/admin/users" className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer bg-slate-50 block">
                  <h3 className="font-medium text-slate-900 mb-1">批量导入用户</h3>
                  <p className="text-xs text-slate-500 mb-3">上传 CSV 创建学生/教师账号。</p>
                  <span className="text-sm font-medium text-indigo-600 hover:text-indigo-700">上传 CSV</span>
                </Link>
                <Link to="/admin/users" className="p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer bg-slate-50 block">
                  <h3 className="font-medium text-slate-900 mb-1">审计日志</h3>
                  <p className="text-xs text-slate-500 mb-3">查看最近的系统更改和登录。</p>
                  <span className="text-sm font-medium text-indigo-600 hover:text-indigo-700">查看日志</span>
                </Link>
              </div>
            </section>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-8">
            {/* System Alerts */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900 mb-6">系统警报</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-amber-900">高 API 延迟</h3>
                    <p className="text-xs text-amber-700 mt-1">过去一小时内 Gemini API 平均响应时间超过 2 秒。</p>
                    <span className="text-[10px] text-amber-600/70 mt-2 block">10 分钟前</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <Server className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-slate-900">数据库备份完成</h3>
                    <p className="text-xs text-slate-500 mt-1">每日自动备份成功完成。</p>
                    <span className="text-[10px] text-slate-400 mt-2 block">3 小时前</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Cost Controls */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900">成本控制与阈值</h2>
                <Bell className="w-5 h-5 text-slate-400" />
              </div>
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">本月预算使用率</span>
                    <span className="text-slate-500">${budgetThreshold.toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-1">
                    <div className={`h-2 rounded-full ${45.20 / budgetThreshold > 0.8 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, (45.20 / budgetThreshold) * 100)}%` }}></div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>已用 $45.20</span>
                    <span>{((45.20 / budgetThreshold) * 100).toFixed(1)}%</span>
                  </div>
                </div>
                
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">超出阈值警报</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                  <p className="text-xs text-slate-500">当预估费用超过设定的月度预算时，将向管理员发送邮件警报。</p>
                </div>

                <div className="pt-2">
                  <button 
                    onClick={() => setShowThresholdModal(true)}
                    className="w-full py-2 bg-white text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors border border-slate-200 shadow-sm"
                  >
                    调整警报阈值
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Threshold Modal */}
        {showThresholdModal && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900">设置预算阈值</h2>
                <button onClick={() => setShowThresholdModal(false)} className="text-slate-400 hover:text-slate-600">
                  <AlertTriangle className="w-5 h-5 hidden" /> {/* Just for spacing if needed, using X below */}
                  <span className="text-2xl leading-none">&times;</span>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">月度预算上限 (USD)</label>
                  <div className="relative">
                    <DollarSign className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input 
                      type="number" 
                      value={budgetThreshold}
                      onChange={(e) => setBudgetThreshold(Number(e.target.value))}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">当本月实际或预估费用超过此金额时，系统将触发警报。</p>
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button onClick={() => setShowThresholdModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">取消</button>
                  <button onClick={() => setShowThresholdModal(false)} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">保存设置</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
