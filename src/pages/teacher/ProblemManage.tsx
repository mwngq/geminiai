import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import Layout from '../../components/Layout';
import ProblemEditor from './ProblemEditor';
import { collection, onSnapshot, query, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

export default function ProblemManage() {
  const [problems, setProblems] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingProblem, setEditingProblem] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, 'problems'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const problemsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProblems(problemsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'problems');
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm('确定要删除这个题目吗？')) {
      try {
        await deleteDoc(doc(db, 'problems', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `problems/${id}`);
      }
    }
  };

  const handleEdit = (problem: any) => {
    setEditingProblem(problem);
    setIsEditing(true);
  };

  const handleCreateNew = () => {
    setEditingProblem(null);
    setIsEditing(true);
  };

  return (
    <Layout role="teacher">
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {isEditing ? (
          <ProblemEditor 
            onBack={() => setIsEditing(false)} 
            initialData={editingProblem} 
          />
        ) : (
          <>
            <header className="flex justify-between items-end mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">题库管理</h1>
                <p className="text-slate-500 mt-2">创建、编辑和组织编程题目。</p>
              </div>
              <button 
                onClick={handleCreateNew}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                新建题目
              </button>
            </header>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索题目..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">标题</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">难度</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {problems.filter((p: any) => p.title?.toLowerCase().includes(searchTerm.toLowerCase())).map((problem: any) => (
                    <tr key={problem.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-500">{problem.id}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{problem.title}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          problem.difficulty === '简单' || problem.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-800' :
                          problem.difficulty === '中等' || problem.difficulty === 'Medium' ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {problem.difficulty === 'Easy' ? '简单' : problem.difficulty === 'Medium' ? '中等' : problem.difficulty === 'Hard' ? '困难' : problem.difficulty}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleEdit(problem)}
                            className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(problem.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {problems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                        暂无题目，请点击右上角新建题目
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
