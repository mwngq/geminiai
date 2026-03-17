import { useState, useMemo, useEffect } from 'react';
import Layout from '../../components/Layout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Download, TrendingUp, AlertTriangle, Lightbulb, Target, Award, Loader2 } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

type ClassId = 'all' | string;
type AssignmentId = 'all' | string;

const COLORS = ['#818cf8', '#f472b6', '#fbbf24', '#34d399'];

export default function Analytics() {
  const [selectedClass, setSelectedClass] = useState<ClassId>('all');
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentId>('all');
  
  const [classes, setClasses] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const classesQuery = query(collection(db, 'classes'), where('teacherId', '==', auth.currentUser?.uid));
        const assignmentsQuery = query(collection(db, 'assignments'), where('authorId', '==', auth.currentUser?.uid));
        const [classesSnap, assignmentsSnap, submissionsSnap] = await Promise.all([
          getDocs(classesQuery),
          getDocs(assignmentsQuery),
          getDocs(collection(db, 'submissions'))
        ]);

        setClasses(classesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setAssignments(assignmentsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setSubmissions(submissionsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'analytics_data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter assignments based on selected class
  const filteredAssignments = useMemo(() => {
    if (selectedClass === 'all') return assignments;
    return assignments.filter(a => {
      if (!a.classes) return false;
      return a.classes.includes(selectedClass);
    });
  }, [selectedClass, assignments]);

  // Reset assignment selection if the current assignment is not in the filtered list
  useEffect(() => {
    if (selectedAssignment !== 'all' && !filteredAssignments.find(a => a.id.toString() === selectedAssignment)) {
      setSelectedAssignment('all');
    }
  }, [filteredAssignments, selectedAssignment]);

  const currentData = useMemo(() => {
    // Filter submissions based on selected class and assignment
    const assignmentIds = new Set(filteredAssignments.map(a => a.id));
    let relevantSubmissions = submissions.filter(s => s.assignmentId && assignmentIds.has(s.assignmentId));
    
    if (selectedAssignment !== 'all') {
      relevantSubmissions = relevantSubmissions.filter(s => s.assignmentId === selectedAssignment);
    } else if (selectedClass !== 'all') {
      // If only class is selected, filter submissions for assignments belonging to that class
      // This is a simplification. Ideally, we'd filter by student's class.
      const classAssignmentIds = filteredAssignments.map(a => a.id);
      relevantSubmissions = relevantSubmissions.filter(s => classAssignmentIds.includes(s.assignmentId));
    }

    // Calculate real stats
    const scores = relevantSubmissions.map(s => s.score || 0);
    const totalSubmissions = scores.length;
    
    let avg = 0;
    let max = 0;
    let maxCount = 0;
    let passCount = 0;
    let stdDev = 0;

    if (totalSubmissions > 0) {
      avg = scores.reduce((a, b) => a + b, 0) / totalSubmissions;
      max = Math.max(...scores);
      maxCount = scores.filter(s => s === max).length;
      passCount = scores.filter(s => s >= 60).length;
      
      const variance = scores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / totalSubmissions;
      stdDev = Math.sqrt(variance);
    }

    const passRate = totalSubmissions > 0 ? ((passCount / totalSubmissions) * 100).toFixed(1) : '0.0';

    // Calculate score distribution
    const dist = [
      { range: '0-59', count: scores.filter(s => s < 60).length },
      { range: '60-69', count: scores.filter(s => s >= 60 && s < 70).length },
      { range: '70-79', count: scores.filter(s => s >= 70 && s < 80).length },
      { range: '80-89', count: scores.filter(s => s >= 80 && s < 90).length },
      { range: '90-100', count: scores.filter(s => s >= 90).length }
    ];

    // Calculate trend (average score per assignment)
    const trendMap = new Map();
    relevantSubmissions.forEach(s => {
      if (s.assignmentId) {
        if (!trendMap.has(s.assignmentId)) {
          trendMap.set(s.assignmentId, { total: 0, count: 0, max: 0 });
        }
        const data = trendMap.get(s.assignmentId);
        data.total += (s.score || 0);
        data.count += 1;
        data.max = Math.max(data.max, s.score || 0);
      }
    });

    const trend = Array.from(trendMap.entries()).map(([assignId, data]) => {
      const assign = assignments.find(a => a.id === assignId);
      return {
        assignment: assign ? assign.title : '未知作业',
        average: Math.round(data.total / data.count),
        max: data.max
      };
    }).slice(0, 5); // Show up to 5 assignments

    if (trend.length === 0) {
      trend.push({ assignment: '暂无数据', average: 0, max: 0 });
    }

    // Calculate error types and common errors from submissions
    const errorTypesMap = new Map<string, number>();
    const commonErrorsMap = new Map<string, { count: number, students: Set<string> }>();

    relevantSubmissions.forEach(s => {
      if (s.score < 100) {
        let errorType = '解答错误 (WA)';
        let description = '输出结果与预期不符';
        
        if (s.score === 0 && s.feedback?.includes('time')) {
          errorType = '超出时间限制 (TLE)';
          description = '算法复杂度过高，未能在规定时间内运行完毕';
        } else if (s.score === 0 && s.feedback?.includes('runtime')) {
          errorType = '运行错误 (RE)';
          description = '程序在运行过程中发生崩溃（如数组越界、除零等）';
        } else if (s.score === 0 && s.feedback?.includes('compile')) {
          errorType = '编译错误 (CE)';
          description = '代码存在语法错误，无法通过编译';
        }

        // Aggregate error types for pie chart
        errorTypesMap.set(errorType, (errorTypesMap.get(errorType) || 0) + 1);

        // Aggregate common errors for table
        if (!commonErrorsMap.has(errorType)) {
          commonErrorsMap.set(errorType, { count: 0, students: new Set() });
        }
        const errorData = commonErrorsMap.get(errorType)!;
        errorData.count++;
        if (s.studentId) errorData.students.add(s.studentId);
      }
    });

    const errorTypes = Array.from(errorTypesMap.entries()).map(([name, value]) => ({ name, value }));
    if (errorTypes.length === 0) {
      errorTypes.push({ name: '无错误', value: 1 }); // Placeholder if no errors
    }

    const commonErrors = Array.from(commonErrorsMap.entries())
      .map(([type, data], index) => {
        let description = '输出结果与预期不符';
        if (type === '超出时间限制 (TLE)') description = '算法复杂度过高，未能在规定时间内运行完毕';
        if (type === '运行错误 (RE)') description = '程序在运行过程中发生崩溃（如数组越界、除零等）';
        if (type === '编译错误 (CE)') description = '代码存在语法错误，无法通过编译';

        return {
          id: index + 1,
          type,
          description,
          frequency: data.count > 10 ? '高' : (data.count > 5 ? '中' : '低'),
          affected: data.students.size
        };
      })
      .sort((a, b) => b.affected - a.affected)
      .slice(0, 5); // Top 5 errors

    // Generate dynamic suggestions based on errors
    const suggestions: string[] = [];
    const focus: string[] = [];
    let homework = '继续完成当前布置的练习。';

    if (commonErrors.length > 0) {
      const topError = commonErrors[0];
      if (topError.type === '超出时间限制 (TLE)') {
        suggestions.push(`部分学生在处理数据时出现超时，建议引入“时间复杂度”的概念，引导学生优化算法。`);
        focus.push('算法复杂度初探', '性能优化');
        homework = '布置 1 道需要优化时间复杂度的综合算法题。';
      } else if (topError.type === '运行错误 (RE)') {
        suggestions.push(`发现较多运行错误，建议加强对边界条件的测试和异常处理的讲解。`);
        focus.push('边界条件测试', '异常处理');
        homework = '布置包含多种边界情况的练习题。';
      } else if (topError.type === '编译错误 (CE)') {
        suggestions.push(`部分学生存在基础语法问题，建议复习相关语言的基础语法规范。`);
        focus.push('基础语法复习', '代码规范');
        homework = '布置基础语法巩固练习。';
      } else {
        suggestions.push(`学生在逻辑实现上存在困难，建议通过画图或伪代码辅助讲解复杂逻辑。`);
        focus.push('综合逻辑应用', '问题拆解');
        homework = '布置需要多步逻辑推理的题目。';
      }
    } else {
      suggestions.push('当前班级表现良好，继续保持。');
      focus.push('巩固提升');
    }

    return {
      summary: { 
        average: avg.toFixed(1), 
        diff: '+0.0', // Mock diff
        stdDev: stdDev.toFixed(1), 
        max: max, 
        maxCount: maxCount, 
        passRate: `${passRate}%`, 
        passDiff: '+0.0%' // Mock diff
      },
      scoreDistribution: dist,
      trend: trend,
      errorTypes: errorTypes,
      commonErrors: commonErrors,
      suggestions: suggestions,
      focus: focus,
      homework: homework
    };
  }, [selectedClass, selectedAssignment, classes, assignments, submissions, filteredAssignments]);

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8,Range,Count\n" 
      + currentData.scoreDistribution.map(e => `${e.range},${e.count}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${selectedClass}_${selectedAssignment}_analytics.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <Layout role="teacher">
        <div className="flex justify-center items-center h-full min-h-[50vh]">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="teacher">
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-indigo-600" />
              学情分析报表
            </h1>
            <p className="text-slate-500 mt-1">全面掌握班级与作业的学习动态，精准定位教学难点</p>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value as ClassId)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[200px] truncate"
            >
              <option value="all">所有班级</option>
              {classes.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <select 
              value={selectedAssignment}
              onChange={(e) => setSelectedAssignment(e.target.value as AssignmentId)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[200px] truncate"
            >
              <option value="all">所有作业</option>
              {filteredAssignments.map(a => (
                <option key={a.id} value={a.id.toString()}>{a.title}</option>
              ))}
            </select>
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors shrink-0"
            >
              <Download className="w-4 h-4" />
              数据导出
            </button>
          </div>
        </div>

        {/* 4.1 班级成绩分布 */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-600" />
            成绩分布与趋势
          </h2>
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-sm font-medium text-slate-500 mb-1">平均分计算</div>
              <div className="text-3xl font-bold text-slate-900">{currentData.summary.average}</div>
              <div className="text-sm text-emerald-600 flex items-center gap-1 mt-2">
                <TrendingUp className="w-4 h-4" />
                较基准 {currentData.summary.diff}
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-sm font-medium text-slate-500 mb-1">标准差分析</div>
              <div className="text-3xl font-bold text-slate-900">{currentData.summary.stdDev}</div>
              <div className="text-sm text-slate-500 mt-2">
                成绩离散程度适中
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-sm font-medium text-slate-500 mb-1">最高分</div>
              <div className="text-3xl font-bold text-slate-900">{currentData.summary.max}</div>
              <div className="text-sm text-slate-500 mt-2">
                共 {currentData.summary.maxCount} 人满分
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-sm font-medium text-slate-500 mb-1">及格率</div>
              <div className="text-3xl font-bold text-slate-900">{currentData.summary.passRate}</div>
              <div className="text-sm text-emerald-600 flex items-center gap-1 mt-2">
                <TrendingUp className="w-4 h-4" />
                较基准 {currentData.summary.passDiff}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 分数段统计 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">分数段统计</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={currentData.scoreDistribution} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                    <Tooltip 
                      cursor={{ fill: '#f1f5f9' }}
                      contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="count" fill="#818cf8" radius={[4, 4, 0, 0]} name="人数" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 趋势变化图 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-6">历史趋势变化</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={currentData.trend} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="assignment" axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} domain={['auto', 'auto']} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend iconType="circle" />
                    <Line type="monotone" dataKey="average" stroke="#818cf8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="平均分" />
                    <Line type="monotone" dataKey="max" stroke="#34d399" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} name="最高分" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>

        {/* 4.2 典型错误分析 */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-indigo-600" />
            典型错误分析
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 错误模式分类 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-1">
              <h3 className="text-lg font-bold text-slate-900 mb-6">错误模式分类</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={currentData.errorTypes}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {currentData.errorTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '0.5rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 共性错误识别 */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm lg:col-span-2">
              <h3 className="text-lg font-bold text-slate-900 mb-6">共性错误识别</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="pb-3 font-semibold text-slate-500 text-sm">错误类型</th>
                      <th className="pb-3 font-semibold text-slate-500 text-sm">具体描述</th>
                      <th className="pb-3 font-semibold text-slate-500 text-sm">发生频率</th>
                      <th className="pb-3 font-semibold text-slate-500 text-sm">影响人数</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentData.commonErrors.map((error) => (
                      <tr key={error.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            error.type.includes('WA') ? 'bg-pink-100 text-pink-800' :
                            error.type.includes('CE') ? 'bg-indigo-100 text-indigo-800' :
                            error.type.includes('TLE') ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {error.type}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-slate-700">{error.description}</td>
                        <td className="py-4">
                          <span className={`text-sm font-medium ${
                            error.frequency === '高' ? 'text-rose-600' : 'text-amber-600'
                          }`}>
                            {error.frequency}
                          </span>
                        </td>
                        <td className="py-4 text-sm text-slate-600">{error.affected} 人</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 改进建议生成 */}
            <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
              <h3 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-indigo-600" />
                改进建议生成 (AI 洞察)
              </h3>
              <ul className="space-y-3">
                {currentData.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-3 text-indigo-800 text-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0"></span>
                    <span>{suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 教学重点调整 */}
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
              <h3 className="text-lg font-bold text-emerald-900 mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-emerald-600" />
                教学重点调整
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-medium text-emerald-800 mb-1">下周教学重点：</div>
                  <div className="flex flex-wrap gap-2">
                    {currentData.focus.map((item, index) => (
                      <span key={index} className="px-3 py-1 bg-white text-emerald-700 text-xs font-medium rounded-lg border border-emerald-200">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-emerald-800 mb-1">建议布置作业：</div>
                  <p className="text-sm text-emerald-700">
                    {currentData.homework}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
