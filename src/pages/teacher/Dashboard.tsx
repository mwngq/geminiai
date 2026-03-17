import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, FileText, CheckSquare, AlertTriangle, ArrowRight, Activity, BookOpen, Loader2, Settings } from 'lucide-react';
import Layout from '../../components/Layout';
import { collection, getDocs, query, where, doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

export default function TeacherDashboard() {
  const [stats, setStats] = useState({
    totalStudents: 0,
    ongoingAssignments: 0,
    pendingGrading: 0,
    atRiskStudents: 0
  });
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [typicalErrors, setTypicalErrors] = useState<any[]>([]);
  const [aiConfig, setAiConfig] = useState({
    codeStyle: true,
    complexity: true,
    guidedPrompts: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch students
        const studentsQuery = query(collection(db, 'users'), where('role', '==', 'student'));
        const studentsSnapshot = await getDocs(studentsQuery);
        const studentsCount = studentsSnapshot.size;

        // Create a map of student IDs to names
        const studentMap = new Map();
        studentsSnapshot.docs.forEach(doc => {
          studentMap.set(doc.id, doc.data().name || '未知学生');
        });

        // Fetch assignments
        const assignmentsQuery = query(collection(db, 'assignments'), where('authorId', '==', auth.currentUser?.uid));
        const assignmentsSnapshot = await getDocs(assignmentsQuery);
        const assignments = assignmentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        
        // Fetch submissions
        const submissionsSnapshot = await getDocs(collection(db, 'submissions'));
        const allSubmissions = submissionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        
        const assignmentIds = new Set(assignments.map(a => a.id));
        
        let pendingCount = 0;
        let validSubmissions: any[] = [];
        
        // Error tracking for typical errors
        const errorCounts: Record<string, { count: number, problems: Set<string>, students: Set<string> }> = {};
        
        allSubmissions.forEach((sub: any) => {
          if (!sub.assignmentId || !assignmentIds.has(sub.assignmentId)) return; // Only process submissions for this teacher's assignments

          if (sub.status === 'submitted') pendingCount++;
          if (sub.status !== 'pending') {
            const assignment = assignments.find(a => a.id === sub.assignmentId);
            validSubmissions.push({
              ...sub,
              studentName: studentMap.get(sub.studentId) || '未知学生',
              assignmentTitle: assignment ? assignment.title : '未知作业'
            });
          }
          
          // Track errors (score < 100)
          if (sub.score < 100) {
            let errorType = '解答错误 (WA)';
            if (sub.score === 0 && sub.feedback?.includes('time')) errorType = '超出时间限制 (TLE)';
            if (sub.score === 0 && sub.feedback?.includes('runtime')) errorType = '运行错误 (RE)';
            if (sub.score === 0 && sub.feedback?.includes('compile')) errorType = '编译错误 (CE)';
            
            if (!errorCounts[errorType]) {
              errorCounts[errorType] = { count: 0, problems: new Set(), students: new Set() };
            }
            errorCounts[errorType].count++;
            if (sub.problemId) errorCounts[errorType].problems.add(sub.problemId);
            if (sub.studentId) errorCounts[errorType].students.add(sub.studentId);
          }
        });

        // Sort by submitTime descending
        validSubmissions.sort((a, b) => {
          if (!a.submitTime) return 1;
          if (!b.submitTime) return -1;
          return new Date(b.submitTime).getTime() - new Date(a.submitTime).getTime();
        });

        // Format times for display
        const now = new Date();
        const formattedSubmissions = validSubmissions.slice(0, 5).map(sub => {
          let timeDisplay = '刚刚';
          if (sub.submitTime) {
            const submitDate = new Date(sub.submitTime);
            const diffMs = now.getTime() - submitDate.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            if (diffMins < 60) {
              timeDisplay = `${diffMins} 分钟前`;
            } else if (diffMins < 1440) {
              timeDisplay = `${Math.floor(diffMins / 60)} 小时前`;
            } else {
              timeDisplay = sub.submitTime.substring(5, 16); // MM-DD HH:mm
            }
          }
          return { ...sub, timeDisplay };
        });

        const ongoingAssignments = assignments.filter((a: any) => {
          if (!a.dueDate) return true;
          return new Date(a.dueDate).getTime() > new Date().getTime();
        }).length;

        // Calculate at-risk students (average score < 60)
        const studentScores: Record<string, { total: number, count: number }> = {};
        allSubmissions.forEach(sub => {
          if (!sub.assignmentId || !assignmentIds.has(sub.assignmentId)) return; // Only consider teacher's assignments
          if (sub.studentId) {
            if (!studentScores[sub.studentId]) {
              studentScores[sub.studentId] = { total: 0, count: 0 };
            }
            studentScores[sub.studentId].total += (sub.score || 0);
            studentScores[sub.studentId].count++;
          }
        });
        
        let atRiskCount = 0;
        Object.values(studentScores).forEach(s => {
          if (s.count > 0 && (s.total / s.count) < 60) {
            atRiskCount++;
          }
        });

        setStats({
          totalStudents: studentsCount,
          ongoingAssignments: ongoingAssignments,
          pendingGrading: pendingCount,
          atRiskStudents: atRiskCount
        });

        setRecentSubmissions(formattedSubmissions);

        // Process typical errors
        const processedErrors = Object.entries(errorCounts)
          .map(([type, data]) => ({
            type,
            count: data.count,
            studentCount: data.students.size,
            problemCount: data.problems.size,
            severity: data.count > 10 ? 'high' : (data.count > 5 ? 'medium' : 'low')
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3); // Top 3 errors
          
        setTypicalErrors(processedErrors);

        // Generate trend data from assignments
        const generatedTrend = assignments.slice(0, 6).reverse().map((a: any) => {
          const assignmentSubmissions = allSubmissions.filter(sub => sub.assignmentId === a.id);
          const totalProblems = a.problems?.length || 0;
          const totalStudents = a.classes?.length ? studentsCount : 0; // Assuming all students are in the class for now
          
          let avgScore = 0;
          let completion = 0;

          if (assignmentSubmissions.length > 0) {
            const totalScore = assignmentSubmissions.reduce((sum, sub) => sum + (sub.score || 0), 0);
            avgScore = Math.round(totalScore / assignmentSubmissions.length);
            
            // Calculate completion rate based on unique students who submitted
            const uniqueStudents = new Set(assignmentSubmissions.map(sub => sub.studentId));
            completion = totalStudents > 0 ? Math.round((uniqueStudents.size / totalStudents) * 100) : 0;
          }

          return {
            name: a.title?.length > 6 ? a.title.substring(0, 6) + '...' : (a.title || '无标题'),
            avgScore: avgScore,
            completion: completion > 100 ? 100 : completion
          };
        });
        
        setTrendData(generatedTrend.length > 0 ? generatedTrend : [
          { name: '暂无作业', avgScore: 0, completion: 0 }
        ]);

        // Fetch AI Config
        if (auth.currentUser) {
          try {
            const aiDoc = await getDoc(doc(db, 'settings', `ai_config_${auth.currentUser.uid}`));
            if (aiDoc.exists()) {
              setAiConfig(aiDoc.data() as any);
            }
          } catch (e) {
            console.error("Failed to fetch AI config", e);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
        handleFirestoreError(error, OperationType.GET, 'dashboard_data');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleToggleAiConfig = async (key: keyof typeof aiConfig) => {
    if (!auth.currentUser) return;
    
    const newConfig = { ...aiConfig, [key]: !aiConfig[key] };
    setAiConfig(newConfig); // Optimistic update
    
    try {
      await setDoc(doc(db, 'settings', `ai_config_${auth.currentUser.uid}`), {
        [key]: newConfig[key],
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error('Failed to update AI config:', error);
      setAiConfig(aiConfig); // Revert on error
      handleFirestoreError(error, OperationType.WRITE, 'settings');
    }
  };

  if (loading) {
    return (
      <Layout role="teacher">
        <div className="flex justify-center items-center h-full min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="teacher">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <header className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">教师仪表盘</h1>
            <p className="text-slate-500 mt-2">欢迎回来，这里是您的班级和作业概览。</p>
          </div>
          <div className="text-sm text-slate-500 flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
            <Activity className="w-4 h-4 text-emerald-500" />
            系统运行正常
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">学生总数</p>
              <p className="text-3xl font-bold text-slate-900">{stats.totalStudents}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">进行中的作业</p>
              <p className="text-3xl font-bold text-slate-900">{stats.ongoingAssignments}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl">
              <CheckSquare className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">待批改</p>
              <p className="text-3xl font-bold text-slate-900">{stats.pendingGrading}</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
            <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">学业预警学生</p>
              <p className="text-3xl font-bold text-slate-900">{stats.atRiskStudents}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            {/* Class Performance Chart */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900">近期作业表现趋势</h2>
                <a href="/teacher/analytics" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                  详细分析 <ArrowRight className="w-4 h-4" />
                </a>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, 100]} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} domain={[0, 100]} />
                    <Tooltip 
                      cursor={{ stroke: '#e2e8f0', strokeWidth: 2 }} 
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                    <Line yAxisId="left" type="monotone" dataKey="avgScore" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name="平均分" />
                    <Line yAxisId="right" type="monotone" dataKey="completion" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name="完成率 %" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Recent Submissions */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900">最近提交</h2>
                <a href="/teacher/classes" className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                  去批改 <ArrowRight className="w-4 h-4" />
                </a>
              </div>
              <div className="space-y-3">
                {recentSubmissions.length > 0 ? recentSubmissions.map((sub, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-700">
                        {sub.studentName ? sub.studentName.charAt(0).toUpperCase() : 'S'}
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-900">{sub.studentName}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">提交了 "{sub.assignmentTitle}" · {sub.timeDisplay}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                        sub.status === 'graded' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {sub.status === 'graded' ? `已批改: ${sub.score}分` : '需人工复核'}
                      </span>
                      <button className="text-slate-400 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100">
                        <FileText className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    暂无最近提交的作业
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-8">
            {/* Common Errors Analysis */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900">典型错误预警</h2>
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="space-y-4">
                {typicalErrors.length > 0 ? typicalErrors.map((error, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border transition-colors ${
                    error.severity === 'high' ? 'border-rose-100 bg-rose-50/50 hover:bg-rose-50' : 
                    error.severity === 'medium' ? 'border-amber-100 bg-amber-50/50 hover:bg-amber-50' : 
                    'border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`font-medium text-sm ${
                        error.severity === 'high' ? 'text-rose-900' : 
                        error.severity === 'medium' ? 'text-amber-900' : 'text-indigo-900'
                      }`}>{error.type}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        error.severity === 'high' ? 'text-rose-700 bg-rose-100' : 
                        error.severity === 'medium' ? 'text-amber-700 bg-amber-100' : 'text-indigo-700 bg-indigo-100'
                      }`}>
                        {error.severity === 'high' ? '高发' : error.severity === 'medium' ? '中等' : '低发'}
                      </span>
                    </div>
                    <p className={`text-xs mb-3 ${
                      error.severity === 'high' ? 'text-rose-700/80' : 
                      error.severity === 'medium' ? 'text-amber-700/80' : 'text-indigo-700/80'
                    }`}>
                      在最近的提交中，有 {error.studentCount} 名学生在 {error.problemCount} 道题目中出现了此类错误（共 {error.count} 次）。
                    </p>
                    <a href="/teacher/analytics" className={`text-xs font-medium flex items-center gap-1 ${
                      error.severity === 'high' ? 'text-rose-700 hover:text-rose-800' : 
                      error.severity === 'medium' ? 'text-amber-700 hover:text-amber-800' : 'text-indigo-700 hover:text-indigo-800'
                    }`}>
                      查看详细分析 <ArrowRight className="w-3 h-3" />
                    </a>
                  </div>
                )) : (
                  <div className="text-center py-6 text-slate-500 text-sm">
                    近期没有发现典型错误
                  </div>
                )}
              </div>
            </section>

            {/* AI Assistant Configuration */}
            <section className="bg-indigo-50 p-6 rounded-2xl shadow-sm border border-indigo-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-indigo-900">AI 助教状态</h2>
                <Settings className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-900">代码规范检查</p>
                    <p className="text-xs text-indigo-700/70 mt-0.5">{aiConfig.codeStyle ? '已开启，正在检查命名与缩进' : '已关闭'}</p>
                  </div>
                  <button 
                    onClick={() => handleToggleAiConfig('codeStyle')}
                    className={`w-10 h-6 rounded-full relative shadow-inner transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-indigo-50 ${aiConfig.codeStyle ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${aiConfig.codeStyle ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-900">复杂度评估</p>
                    <p className="text-xs text-indigo-700/70 mt-0.5">{aiConfig.complexity ? '已开启，正在评估时空复杂度' : '已关闭'}</p>
                  </div>
                  <button 
                    onClick={() => handleToggleAiConfig('complexity')}
                    className={`w-10 h-6 rounded-full relative shadow-inner transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-indigo-50 ${aiConfig.complexity ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${aiConfig.complexity ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-900">引导式提示</p>
                    <p className="text-xs text-indigo-700/70 mt-0.5">{aiConfig.guidedPrompts ? '已开启，引导思考而不是直接给答案' : '已关闭'}</p>
                  </div>
                  <button 
                    onClick={() => handleToggleAiConfig('guidedPrompts')}
                    className={`w-10 h-6 rounded-full relative shadow-inner transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 focus:ring-offset-indigo-50 ${aiConfig.guidedPrompts ? 'bg-indigo-600' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${aiConfig.guidedPrompts ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
                <div className="pt-4 border-t border-indigo-200/50">
                  <Link to="/teacher/ai-assistant" className="w-full flex items-center justify-center gap-2 py-2.5 bg-white text-indigo-600 text-sm font-medium rounded-xl hover:bg-indigo-50 transition-colors shadow-sm">
                    前往配置 AI 助教
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
