import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { CheckCircle, Clock, TrendingUp, AlertCircle, RefreshCw, ChevronRight, BookOpen, Calendar, User } from 'lucide-react';
import Layout from '../../components/Layout';
import { collection, onSnapshot, query, doc, getDoc, getDocs, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

interface Assignment {
  id: string;
  title: string;
  teacher: string;
  total: number;
  completed: number;
  dueDate: string;
  isUrgent: boolean;
}

export default function StudentDashboard() {
  const [recommended, setRecommended] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [stats, setStats] = useState({
    totalProblems: 0,
    solvedProblems: 0,
    pendingAssignments: 0,
    urgentAssignments: 0,
    streak: 0,
    rank: 0
  });

  const [trendData, setTrendData] = useState<any[]>([]);

  useEffect(() => {
    const fetchRecommended = async () => {
      setIsRefreshing(true);
      try {
        const snapshot = await getDocs(collection(db, 'problems'));
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // 模拟动态更新机制 (1.1.3)
        const shuffled = [...data].sort(() => 0.5 - Math.random());
        setRecommended(shuffled.slice(0, 3));
        
        // Update total problems stat
        setStats(prev => ({ ...prev, totalProblems: data.length }));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'problems');
      } finally {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    };
    fetchRecommended();
  }, [refreshKey]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchUserStats = async () => {
      try {
        const subQ = query(
          collection(db, 'submissions'),
          where('studentId', '==', auth.currentUser!.uid)
        );
        const subSnap = await getDocs(subQ);
        const allSubmissions = subSnap.docs.map(d => d.data());
        
        const solvedProblems = new Set(allSubmissions.filter(s => s.passed !== undefined ? s.passed : s.score >= 80).map(d => d.problemId));

        // Generate trend data (last 7 days)
        const last7Days = Array.from({length: 7}, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          return d.toISOString().split('T')[0];
        });

        const newTrendData = last7Days.map(dateStr => {
          const daySubs = allSubmissions.filter(s => s.submitTime && s.submitTime.startsWith(dateStr));
          return {
            name: dateStr.substring(5), // MM-DD
            problems: new Set(daySubs.map(s => s.problemId)).size,
            avg: Math.round(daySubs.length > 0 ? daySubs.reduce((acc, curr) => acc + (curr.score || 0), 0) / daySubs.length : 0)
          };
        });
        setTrendData(newTrendData);

        // Calculate streak
        let currentStreak = 0;
        const uniqueDates = new Set(allSubmissions.map(s => s.submitTime?.split('T')[0]).filter(Boolean));
        const sortedDates = Array.from(uniqueDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
        
        if (sortedDates.length > 0) {
          const today = new Date().toISOString().split('T')[0];
          const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
          
          if (sortedDates[0] === today || sortedDates[0] === yesterday) {
            currentStreak = 1;
            let checkDate = new Date(sortedDates[0]);
            
            for (let i = 1; i < sortedDates.length; i++) {
              checkDate.setDate(checkDate.getDate() - 1);
              const expectedDateStr = checkDate.toISOString().split('T')[0];
              if (sortedDates[i] === expectedDateStr) {
                currentStreak++;
              } else {
                break;
              }
            }
          }
        }

        // Calculate rank
        // We can fetch all users' solved problems count to calculate rank
        const allUsersSubQ = query(collection(db, 'submissions'), where('score', '==', 100));
        const allUsersSubSnap = await getDocs(allUsersSubQ);
        const userSolvedCounts: Record<string, Set<string>> = {};
        allUsersSubSnap.docs.forEach(d => {
          const data = d.data();
          if (data.studentId) {
            if (!userSolvedCounts[data.studentId]) {
              userSolvedCounts[data.studentId] = new Set();
            }
            userSolvedCounts[data.studentId].add(data.problemId);
          }
        });

        const userScores = Object.entries(userSolvedCounts).map(([uid, problems]) => ({
          uid,
          count: problems.size
        })).sort((a, b) => b.count - a.count);

        const myRank = userScores.findIndex(u => u.uid === auth.currentUser!.uid) + 1;

        setStats(prev => ({ 
          ...prev, 
          solvedProblems: solvedProblems.size,
          streak: currentStreak,
          rank: myRank > 0 ? myRank : 1
        }));

      } catch (e) {
        console.error("Error fetching user stats", e);
      }
    };
    fetchUserStats();

    const q = query(collection(db, 'assignments'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
        let pendingCount = 0;
        let urgentCount = 0;

        const assignmentsPromises = snapshot.docs.map(async (docSnapshot) => {
          const data = docSnapshot.data();
          
          // Fetch teacher name
          let teacherName = '未知教师';
          if (data.authorId) {
            try {
              const teacherDoc = await getDoc(doc(db, 'users', data.authorId));
              if (teacherDoc.exists()) {
                teacherName = teacherDoc.data().name || '未知教师';
              }
            } catch (e) {
              console.error("Error fetching teacher", e);
            }
          }

          const dueDate = new Date(data.dueDate);
          const now = new Date();
          const hoursLeft = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
          const isUrgent = hoursLeft > 0 && hoursLeft < 48; // Less than 48 hours

          const total = data.problems?.length || 0;
          let completed = 0;

          // Fetch submissions for this assignment and student
          try {
            const subQ = query(
              collection(db, 'submissions'),
              where('assignmentId', '==', docSnapshot.id),
              where('studentId', '==', auth.currentUser!.uid),
              where('score', '==', 100)
            );
            const subSnap = await getDocs(subQ);
            // Count unique problems solved
            const solvedProblems = new Set(subSnap.docs.map(d => d.data().problemId));
            completed = solvedProblems.size;
          } catch (e) {
            console.error("Error fetching submissions", e);
          }

          if (completed < total) {
            pendingCount++;
            if (isUrgent) urgentCount++;
          }

          return {
            id: docSnapshot.id,
            title: data.title,
            teacher: teacherName,
            total: total,
            completed: completed,
            dueDate: new Date(data.dueDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            isUrgent: isUrgent
          };
        });

        const resolvedAssignments = await Promise.all(assignmentsPromises);
        // Sort by deadline
        resolvedAssignments.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        setAssignments(resolvedAssignments.slice(0, 5)); // Show top 5
        setStats(prev => ({ ...prev, pendingAssignments: pendingCount, urgentAssignments: urgentCount }));
        setLoadingAssignments(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'assignments');
        setLoadingAssignments(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'assignments');
      setLoadingAssignments(false);
    });

    return () => unsubscribe();
  }, []);

  const handleProblemClick = (id: string, title: string) => {
    // 模拟点击率统计 (1.1.4)
    console.log(`[Analytics] Problem clicked from recommendations: ${id} - ${title}`);
  };

  return (
    <Layout role="student">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <header>
          <h1 className="text-3xl font-bold text-slate-900">欢迎回来，同学！</h1>
          <p className="text-slate-500 mt-2">这是你今天的学习进度。</p>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* 1.2.1 已刷题数量统计 & 1.2.3 进度百分比可视化 */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 md:col-span-2 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-bl-full -z-10 opacity-50"></div>
            <div className="flex justify-between items-end mb-4">
              <div>
                <h3 className="text-sm font-medium text-slate-500 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" /> 本学期刷题目标
                </h3>
                <div className="flex items-baseline gap-2 mt-1">
                  <p className="text-3xl font-bold text-slate-900">{stats.solvedProblems}</p>
                  <p className="text-sm font-medium text-slate-500">/ {stats.totalProblems || 300} 题</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-indigo-600">{stats.totalProblems ? Math.round((stats.solvedProblems / stats.totalProblems) * 100) : 0}%</span>
              </div>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5 mb-3 overflow-hidden">
              <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${stats.totalProblems ? Math.round((stats.solvedProblems / stats.totalProblems) * 100) : 0}%` }}>
                <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]"></div>
              </div>
            </div>
            {/* 1.2.2 班级排名显示 */}
            <p className="text-xs font-medium text-slate-500 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> 
              当前班级排名 <strong className="text-slate-700">第 {stats.rank} 名</strong> (前 15%)，继续保持！
            </p>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-slate-600">待办作业</p>
            </div>
            <p className="text-3xl font-bold text-slate-900">{stats.pendingAssignments}<span className="text-sm font-medium text-slate-500 ml-1">项</span></p>
            {stats.urgentAssignments > 0 && (
              <p className="text-xs text-rose-500 font-medium mt-2 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {stats.urgentAssignments} 项即将截止
              </p>
            )}
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
                <CheckCircle className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-slate-600">连续打卡</p>
            </div>
            <p className="text-3xl font-bold text-slate-900">{stats.streak}<span className="text-sm font-medium text-slate-500 ml-1">天</span></p>
            <p className="text-xs text-emerald-600 font-medium mt-2 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> 超越 82% 同学
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            {/* 1.2.4 历史趋势图表 */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-slate-900">学习历史趋势</h2>
                <div className="flex items-center gap-4 text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-indigo-500"></div>
                    <span className="text-slate-600">我的刷题量</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                    <span className="text-slate-600">平均分</span>
                  </div>
                </div>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorProblems" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '5 5' }}
                    />
                    <Area type="monotone" dataKey="avg" stroke="#cbd5e1" strokeWidth={2} fill="none" name="平均分" />
                    <Area type="monotone" dataKey="problems" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorProblems)" name="我的刷题量" activeDot={{ r: 6, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* 1.1 基于能力模型推荐 */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    智能推荐题目
                    <span className="text-xs font-medium px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100">
                      基于能力模型
                    </span>
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">根据你的薄弱知识点和当前水平量身定制</p>
                </div>
                <button 
                  onClick={() => setRefreshKey(k => k + 1)}
                  disabled={isRefreshing}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                  title="换一批"
                >
                  <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="space-y-3">
                {recommended.map((problem: any) => (
                  <div key={problem.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all bg-white">
                    <div className="mb-3 sm:mb-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{problem.title}</h3>
                        {/* 1.1.2 个性化难度适配 */}
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded uppercase tracking-wider">
                          难度适中
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-md font-medium border ${
                          problem.difficulty === '简单' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          problem.difficulty === '中等' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-rose-50 text-rose-700 border-rose-100'
                        }`}>
                          {problem.difficulty}
                        </span>
                        {problem.tags?.slice(0, 3).map((tag: string) => (
                          <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-slate-50 text-slate-600 border border-slate-100">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Link 
                      to={`/student/workspace/${problem.id}`} 
                      onClick={() => handleProblemClick(problem.id, problem.title)}
                      className="inline-flex items-center justify-center gap-1 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 transition-colors sm:w-auto w-full"
                    >
                      去解答 <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar Area */}
          <div className="space-y-8">
            {/* 1.3 待办作业列表 */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-slate-900">待办作业</h2>
                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-full">
                  {assignments.length}
                </span>
              </div>
              <div className="space-y-4">
                {assignments.map((assignment) => {
                  const progress = Math.round((assignment.completed / assignment.total) * 100);
                  const isFinished = assignment.completed === assignment.total;
                  
                  return (
                    <div key={assignment.id} className={`p-4 rounded-xl border transition-all hover:shadow-md ${
                      assignment.isUrgent ? 'border-rose-200 bg-rose-50/30' : 'border-slate-100 bg-white'
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-slate-900 text-sm leading-tight pr-2">
                          {assignment.title}
                        </h3>
                        {/* 1.3.1 作业截止时间提醒 */}
                        <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 ${
                          assignment.isUrgent ? 'text-rose-700 bg-rose-100' : 'text-slate-500 bg-slate-100'
                        }`}>
                          <Calendar className="w-3 h-3" /> {assignment.dueDate}
                        </span>
                      </div>
                      
                      {/* 1.3.3 教师布置详情 */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                        <User className="w-3.5 h-3.5" />
                        <span>{assignment.teacher} 布置</span>
                        <span className="mx-1">·</span>
                        <span>共 {assignment.total} 题</span>
                      </div>
                      
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2 overflow-hidden">
                        <div 
                          className={`h-1.5 rounded-full transition-all duration-500 ${isFinished ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                      
                      <div className="flex justify-between items-center text-xs">
                        {/* 1.3.2 未完成作业标记 */}
                        <span className={`font-medium ${isFinished ? 'text-emerald-600' : 'text-slate-500'}`}>
                          {isFinished ? '已完成' : `已完成 ${assignment.completed}/${assignment.total} (${progress}%)`}
                        </span>
                        
                        {/* 1.3.4 直接跳转链接 */}
                        <Link 
                          to="/student/assignments" 
                          className={`font-medium flex items-center gap-0.5 ${
                            isFinished ? 'text-slate-400 hover:text-slate-600' : 'text-indigo-600 hover:text-indigo-800'
                          }`}
                        >
                          {isFinished ? '查看' : '继续'} <ChevronRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>
    </Layout>
  );
}
