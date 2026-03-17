import { useState, useEffect } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Clock, Code2, Target, ListFilter, Calendar, FolderTree, Eye, X, AlertCircle, TrendingUp, BookOpen, GitCommit, Loader2 } from 'lucide-react';
import Layout from '../../components/Layout';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

export default function Profile() {
  const [activeTab, setActiveTab] = useState<'history' | 'errors'>('history');
  const [historyViewMode, setHistoryViewMode] = useState<'time' | 'problem'>('time');
  const [selectedCode, setSelectedCode] = useState<{problem: string, code: string} | null>(null);
  const [errorTypeFilter, setErrorTypeFilter] = useState<string>('all');
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [userInfo, setUserInfo] = useState({ name: '加载中...', email: '', initials: 'U' });
  const [radarData, setRadarData] = useState<any[]>([]);
  const [mistakeRadarData, setMistakeRadarData] = useState<any[]>([]);
  const [mistakesData, setMistakesData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalSubmissions: 0,
    passRate: 0,
    codingHours: 0
  });

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!auth.currentUser) return;
      try {
        // Fetch user info
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserInfo({
            name: data.name || '未知用户',
            email: data.email || '',
            initials: (data.name || 'U').substring(0, 2).toUpperCase()
          });
        }

        // Fetch submissions
        const q = query(
          collection(db, 'submissions'),
          where('studentId', '==', auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        
        // Fetch problem details to get titles and tags
        const problemsSnapshot = await getDocs(collection(db, 'problems'));
        const problemsMap = new Map();
        problemsSnapshot.docs.forEach(doc => {
          problemsMap.set(doc.id, { id: doc.id, ...doc.data() });
        });

        let passedCount = 0;
        const tagPassCount: Record<string, number> = {};
        const tagFailCount: Record<string, number> = {};
        const problemLatestFail: Record<string, any> = {};
        const problemPassed: Set<string> = new Set();

        const submissions = snapshot.docs.map(doc => {
          const data = doc.data();
          const problem = problemsMap.get(data.problemId);
          const problemTitle = problem?.title || '未知题目';
          const problemTags = problem?.tags || [];
          
          const isPassed = data.passed !== undefined ? data.passed : data.score >= 80;
          
          if (isPassed) {
            passedCount++;
            problemPassed.add(data.problemId);
            problemTags.forEach((tag: string) => {
              tagPassCount[tag] = (tagPassCount[tag] || 0) + 1;
            });
          } else {
            problemTags.forEach((tag: string) => {
              tagFailCount[tag] = (tagFailCount[tag] || 0) + 1;
            });
            
            // Track the latest failed submission for the mistake collection
            if (!problemLatestFail[data.problemId] || new Date(data.submitTime) > new Date(problemLatestFail[data.problemId].submitTime)) {
              problemLatestFail[data.problemId] = {
                id: doc.id,
                problemId: data.problemId,
                problem: problemTitle,
                errorType: '解答错误', // Default since we don't have detailed error types
                testcase: '未知',
                code: data.code,
                tags: problemTags,
                submitTime: data.submitTime,
                language: data.language
              };
            }
          }

          return {
            id: doc.id,
            time: new Date(data.submitTime).toLocaleString(),
            problem: problemTitle,
            status: isPassed ? '通过' : '解答错误',
            language: data.language,
            code: data.code
          };
        });
        
        // Sort by time descending
        submissions.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        setHistoryData(submissions);
        
        setStats({
          totalSubmissions: submissions.length,
          passRate: submissions.length > 0 ? Math.round((passedCount / submissions.length) * 100) : 0,
          codingHours: Math.round(submissions.length * 0.5) // Estimate 0.5 hours per submission
        });

        // Build Ability Radar Data
        const defaultTags = ['算法', '数据结构', '问题解决', '代码质量', '效率优化', '调试能力'];
        const topTags = Object.entries(tagPassCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(entry => entry[0]);
        
        const radarTags = topTags.length >= 3 ? topTags : defaultTags;
        const newRadarData = radarTags.map(tag => ({
          subject: tag,
          A: (tagPassCount[tag] || 0) * 20 + 20, // Base 20, +20 per pass, max 150
          fullMark: 150
        })).map(item => ({ ...item, A: Math.min(item.A, item.fullMark) }));
        setRadarData(newRadarData);

        // Build Mistake Radar Data
        const topFailTags = Object.entries(tagFailCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(entry => entry[0]);
        
        const mistakeTags = topFailTags.length >= 3 ? topFailTags : defaultTags;
        const newMistakeRadarData = mistakeTags.map(tag => ({
          subject: tag,
          mistakes: tagFailCount[tag] || 0,
          fullMark: Math.max(10, (tagFailCount[tag] || 0) + 5)
        }));
        setMistakeRadarData(newMistakeRadarData);

        // Build Mistakes Data
        const newMistakesData = Object.values(problemLatestFail).map((fail: any) => {
          // Find similar problems (same tags)
          const similar = Array.from(problemsMap.values())
            .filter((p: any) => p.id !== fail.problemId && p.tags?.some((t: string) => fail.tags.includes(t)))
            .slice(0, 2)
            .map((p: any) => p.title);

          return {
            id: fail.id,
            problem: fail.problem,
            errorType: fail.errorType,
            testcase: fail.testcase,
            code: fail.code,
            tags: fail.tags,
            similarProblems: similar.length > 0 ? similar : ['无相似题目'],
            mastery: problemPassed.has(fail.problemId) ? 100 : 40 // If they passed it later, mastery is 100
          };
        });
        setMistakesData(newMistakesData);

      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'submissions/problems/users');
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  const filteredMistakes = errorTypeFilter === 'all' 
    ? mistakesData 
    : mistakesData.filter(m => m.errorType === errorTypeFilter);

  const groupedHistory = historyData.reduce((acc, curr) => {
    if (!acc[curr.problem]) {
      acc[curr.problem] = [];
    }
    acc[curr.problem].push(curr);
    return acc;
  }, {} as Record<string, typeof historyData>);

  if (loading) {
    return (
      <Layout role="student">
        <div className="flex justify-center items-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="student">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <header className="flex items-center gap-6 mb-8">
          <div className="w-24 h-24 rounded-full bg-indigo-100 flex items-center justify-center text-3xl font-bold text-indigo-600 border-4 border-white shadow-sm">
            {userInfo.initials}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{userInfo.name}</h1>
            <p className="text-slate-500 mt-1">{userInfo.email}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Stats & Radar */}
          <div className="space-y-8">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900 mb-6">能力雷达图</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 150]} tick={false} axisLine={false} />
                    <Radar name="Student" dataKey="A" stroke="#6366f1" fill="#818cf8" fillOpacity={0.5} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900 mb-6">快速统计</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <Code2 className="w-5 h-5 text-indigo-500" />
                    <span className="text-sm font-medium text-slate-700">总提交数</span>
                  </div>
                  <span className="font-bold text-slate-900">{stats.totalSubmissions}</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-emerald-500" />
                    <span className="text-sm font-medium text-slate-700">通过率</span>
                  </div>
                  <span className="font-bold text-slate-900">{stats.passRate}%</span>
                </div>
                <div className="flex justify-between items-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-500" />
                    <span className="text-sm font-medium text-slate-700">预估编程时长</span>
                  </div>
                  <span className="font-bold text-slate-900">{stats.codingHours}h</span>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Tabs (History/Errors) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex gap-4 border-b border-slate-200">
              <button
                onClick={() => setActiveTab('history')}
                className={`pb-4 text-sm font-medium transition-colors relative ${
                  activeTab === 'history' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                提交历史记录
                {activeTab === 'history' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('errors')}
                className={`pb-4 text-sm font-medium transition-colors relative ${
                  activeTab === 'errors' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                错题集 (复习)
                {activeTab === 'errors' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></span>
                )}
              </button>
            </div>

            {activeTab === 'history' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setHistoryViewMode('time')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        historyViewMode === 'time' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Calendar className="w-4 h-4" /> 按时间排序
                    </button>
                    <button
                      onClick={() => setHistoryViewMode('problem')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        historyViewMode === 'problem' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <FolderTree className="w-4 h-4" /> 按题目分类
                    </button>
                  </div>
                </div>

                {historyViewMode === 'time' ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">时间</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">题目</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">状态</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">语言</th>
                          <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {historyData.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-slate-500">暂无提交记录</td>
                          </tr>
                        ) : historyData.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{item.time}</td>
                            <td className="px-6 py-4 text-sm font-medium text-slate-900">{item.problem}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                item.status === '通过' ? 'bg-emerald-100 text-emerald-800' : 
                                item.status === '解答错误' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {item.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{item.language}</td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <button 
                                onClick={() => setSelectedCode({problem: item.problem, code: item.code})}
                                className="text-indigo-600 hover:text-indigo-900 text-sm font-medium flex items-center justify-end gap-1 ml-auto"
                              >
                                <Eye className="w-4 h-4" /> 代码快照
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.keys(groupedHistory).length === 0 ? (
                      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center text-slate-500">
                        暂无提交记录
                      </div>
                    ) : Object.entries(groupedHistory).map(([problemName, submissions]) => (
                      <div key={problemName} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center justify-between">
                          <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-indigo-500" /> {problemName}
                          </h3>
                          <span className="text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200">
                            {(submissions as any[]).length} 次提交
                          </span>
                        </div>
                        <table className="w-full text-left border-collapse">
                          <tbody className="divide-y divide-slate-100">
                            {(submissions as any[]).map((item) => (
                              <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-3 text-sm text-slate-500 whitespace-nowrap w-48">{item.time}</td>
                                <td className="px-6 py-3 whitespace-nowrap w-32">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    item.status === '通过' ? 'bg-emerald-100 text-emerald-800' : 
                                    item.status === '解答错误' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                  }`}>
                                    {item.status}
                                  </span>
                                </td>
                                <td className="px-6 py-3 text-sm text-slate-500 whitespace-nowrap">{item.language}</td>
                                <td className="px-6 py-3 text-right whitespace-nowrap">
                                  <button 
                                    onClick={() => setSelectedCode({problem: item.problem, code: item.code})}
                                    className="text-indigo-600 hover:text-indigo-900 text-sm font-medium flex items-center justify-end gap-1 ml-auto"
                                  >
                                    <Eye className="w-4 h-4" /> 代码快照
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'errors' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <ListFilter className="w-5 h-5 text-slate-400" />
                    <div className="flex flex-wrap gap-2">
                      {['all', '解答错误', '超出时间限制', '运行错误'].map(type => (
                        <button
                          key={type}
                          onClick={() => setErrorTypeFilter(type)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                            errorTypeFilter === type 
                              ? 'bg-slate-800 text-white' 
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {type === 'all' ? '全部错误类型' : type}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Target className="w-3.5 h-3.5" /> 知识点雷达图 (错题分布)
                    </h3>
                    <div className="h-32 -mx-4">
                      {mistakeRadarData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={mistakeRadarData}>
                            <PolarGrid stroke="#f1f5f9" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 9 }} />
                            <Radar name="Mistakes" dataKey="mistakes" stroke="#f43f5e" fill="#fb7185" fillOpacity={0.4} />
                          </RadarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-xs text-slate-400">暂无错题数据</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {filteredMistakes.map((mistake) => (
                    <div key={mistake.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{mistake.problem}</h3>
                          <div className="flex items-center gap-3 mt-2">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              mistake.errorType === '解答错误' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {mistake.errorType}
                            </span>
                            <span className="text-sm text-slate-500">测试用例 {mistake.testcase} 失败</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" /> 掌握程度评估
                          </span>
                          <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                mistake.mastery >= 80 ? 'bg-emerald-500' : 
                                mistake.mastery >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                              }`} 
                              style={{ width: `${mistake.mastery}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-bold mt-1 text-slate-700">{mistake.mastery}%</span>
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-sm text-slate-700 mb-4 relative group">
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => setSelectedCode({problem: mistake.problem, code: mistake.code})}
                            className="p-1.5 bg-white rounded-md shadow-sm border border-slate-200 text-slate-500 hover:text-indigo-600"
                            title="查看完整代码快照"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-slate-400 mb-2">// 错误代码快照</p>
                        <pre className="whitespace-pre-wrap">{mistake.code}</pre>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex flex-wrap gap-2">
                          {mistake.tags.map((tag: string) => (
                            <span key={tag} className="text-xs px-2 py-1 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                              {tag}
                            </span>
                          ))}
                        </div>
                        
                        <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <GitCommit className="w-3.5 h-3.5" /> 相似题目推荐:
                          </div>
                          <div className="flex flex-wrap gap-2 justify-end">
                            {mistake.similarProblems.map((sim: string) => (
                              <button key={sim} className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors border border-indigo-100">
                                {sim}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                        <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                          复习并重试
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {filteredMistakes.length === 0 && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
                      <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <h3 className="text-slate-900 font-medium">没有找到相关错题</h3>
                      <p className="text-slate-500 text-sm mt-1">尝试切换其他错误类型分类或者去多做几道题吧！</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Code Snapshot Modal */}
      {selectedCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Code2 className="w-5 h-5 text-indigo-500" />
                代码快照: {selectedCode.problem}
              </h3>
              <button 
                onClick={() => setSelectedCode(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-slate-900 text-slate-50 font-mono text-sm leading-relaxed">
              <pre><code>{selectedCode.code}</code></pre>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedCode(null)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
