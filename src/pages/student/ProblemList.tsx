import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Filter, ChevronLeft, ChevronRight, Tag, X, Loader2 } from 'lucide-react';
import Layout from '../../components/Layout';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

export default function ProblemList() {
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignment');

  const [problems, setProblems] = useState<any[]>([]);
  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('All');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch problems
        const problemsSnapshot = await getDocs(collection(db, 'problems'));
        const problemsData = problemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProblems(problemsData);

        // Fetch assignment if assignmentId is present
        if (assignmentId) {
          const assignmentDoc = await getDoc(doc(db, 'assignments', assignmentId));
          if (assignmentDoc.exists()) {
            const data = assignmentDoc.data();
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
            setAssignment({ 
              id: assignmentDoc.id, 
              ...data,
              deadline: data.dueDate,
              teacher: teacherName
            });
          } else {
            console.error('Assignment not found');
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'problems/assignments');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [assignmentId]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    problems.forEach(p => {
      if (p.tags) {
        p.tags.forEach((t: string) => tags.add(t));
      }
    });
    return Array.from(tags).sort();
  }, [problems]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const filteredProblems = useMemo(() => {
    let baseProblems = problems;
    if (assignment && assignment.problems) {
      baseProblems = problems.filter(p => assignment.problems.includes(p.id));
    }

    return baseProblems.filter((p: any) => {
      const searchLower = searchTerm.toLowerCase();
      const title = p.title || '';
      const matchesSearch = title.toLowerCase().includes(searchLower) || 
                            (p.tags && p.tags.some((t: string) => t.toLowerCase().includes(searchLower)));
      const matchesDifficulty = difficultyFilter === 'All' || p.difficulty === difficultyFilter;
      const matchesTags = selectedTags.length === 0 || selectedTags.every(tag => p.tags && p.tags.includes(tag));
      return matchesSearch && matchesDifficulty && matchesTags;
    });
  }, [problems, assignment, searchTerm, difficultyFilter, selectedTags]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, difficultyFilter, selectedTags]);

  const totalPages = Math.max(1, Math.ceil(filteredProblems.length / pageSize));
  const paginatedProblems = filteredProblems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <Layout role="student">
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <header className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {assignment ? `作业：${assignment.title}` : '题目大厅'}
            </h1>
            <p className="text-slate-500 mt-2">
              {assignment ? `截止时间：${assignment.deadline} | 教师：${assignment.teacher}` : '探索并解决编程挑战。'}
            </p>
          </div>
          {assignment && (
            <Link to="/student/assignments" className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              返回我的作业
            </Link>
          )}
        </header>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <>
            {/* Filters and Search */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="搜索题目名称或标签..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
              {['All', '简单', '中等', '困难'].map(diff => (
                <button
                  key={diff}
                  onClick={() => setDifficultyFilter(diff)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    difficultyFilter === diff
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {diff === 'All' ? '全部难度' : diff}
                </button>
              ))}
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">标签筛选</span>
                {selectedTags.length > 0 && (
                  <button 
                    onClick={() => setSelectedTags([])}
                    className="ml-auto text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> 清除已选
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                        isSelected 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Problem Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">题目</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">难度</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">标签</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedProblems.map((problem: any) => (
                <tr key={problem.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="w-2 h-2 rounded-full bg-slate-200"></div>
                  </td>
                  <td className="px-6 py-4">
                    <Link to={`/student/workspace/${problem.id}`} className="text-sm font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {problem.id}. {problem.title}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      problem.difficulty === '简单' ? 'bg-emerald-100 text-emerald-800' :
                      problem.difficulty === '中等' ? 'bg-amber-100 text-amber-800' :
                      'bg-rose-100 text-rose-800'
                    }`}>
                      {problem.difficulty}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2 flex-wrap">
                      {(problem.tags || []).map((tag: string) => (
                        <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <Link
                      to={`/student/workspace/${problem.id}`}
                      className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    >
                      解答
                    </Link>
                  </td>
                </tr>
              ))}
              {filteredProblems.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    未找到符合条件的题目。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          
            {/* Pagination */}
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="text-sm text-slate-500">
                显示 <span className="font-medium">{filteredProblems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> 到 <span className="font-medium">{Math.min(currentPage * pageSize, filteredProblems.length)}</span> 条，共 <span className="font-medium">{filteredProblems.length}</span> 条结果
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-500">
                  第 {currentPage} / {totalPages} 页
                </span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          </>
        )}
      </div>
    </Layout>
  );
}
