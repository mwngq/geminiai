import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, Search, Check, AlertCircle, Plus, Trash2, Calendar, Users, BookOpen, Loader2, FileText } from 'lucide-react';
import { collection, onSnapshot, query, doc, setDoc, updateDoc, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

export default function AssignmentEditor({ onBack, initialData }: { onBack: () => void, initialData?: any }) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [dueDate, setDueDate] = useState(initialData?.dueDate ? new Date(initialData.dueDate).toISOString().slice(0, 16) : '');
  const [selectedProblems, setSelectedProblems] = useState<string[]>(initialData?.problems || []);
  const [selectedClasses, setSelectedClasses] = useState<string[]>(initialData?.classes || []);
  
  const [problems, setProblems] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Fetch problems and classes
  useEffect(() => {
    if (!auth.currentUser) return;

    const qProblems = query(collection(db, 'problems'));
    const unsubProblems = onSnapshot(qProblems, (snapshot) => {
      setProblems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'problems'));

    const qClasses = query(collection(db, 'classes'));
    const unsubClasses = onSnapshot(qClasses, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'classes'));

    return () => {
      unsubProblems();
      unsubClasses();
    };
  }, []);

  const validateForm = () => {
    if (!title.trim()) {
      setValidationError('作业标题不能为空');
      return false;
    }
    if (!dueDate) {
      setValidationError('请设置截止时间');
      return false;
    }
    if (selectedProblems.length === 0) {
      setValidationError('请至少选择一道题目');
      return false;
    }
    if (selectedClasses.length === 0) {
      setValidationError('请至少选择一个班级');
      return false;
    }
    setValidationError('');
    return true;
  };

  const handleSave = async () => {
    if (validateForm()) {
      setIsSaving(true);
      try {
        const assignmentData = {
          title,
          description,
          dueDate: new Date(dueDate).toISOString(),
          problems: selectedProblems,
          classes: selectedClasses,
          authorId: auth.currentUser?.uid,
        };

        if (initialData?.id) {
          await updateDoc(doc(db, 'assignments', initialData.id), assignmentData);
        } else {
          const newId = `A${Date.now()}`;
          await setDoc(doc(db, 'assignments', newId), {
            ...assignmentData,
            id: newId,
            createdAt: new Date().toISOString()
          });
        }
        setIsSaving(false);
        onBack();
      } catch (error) {
        setIsSaving(false);
        handleFirestoreError(error, initialData?.id ? OperationType.UPDATE : OperationType.CREATE, 'assignments');
      }
    }
  };

  const toggleProblem = (id: string) => {
    if (selectedProblems.includes(id)) {
      setSelectedProblems(selectedProblems.filter(pId => pId !== id));
    } else {
      setSelectedProblems([...selectedProblems, id]);
    }
  };

  const toggleClass = (id: string) => {
    if (selectedClasses.includes(id)) {
      setSelectedClasses(selectedClasses.filter(cId => cId !== id));
    } else {
      setSelectedClasses([...selectedClasses, id]);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-slate-900">
            {initialData ? '编辑作业' : '发布新作业'}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? '保存中...' : '发布作业'}
          </button>
        </div>
      </div>

      {validationError && (
        <div className="mx-6 mt-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <p className="text-sm text-rose-600">{validationError}</p>
        </div>
      )}

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Basic Info & Classes */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                基本信息
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">作业标题 <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例如：第一周课后练习"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">截止时间 <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">作业描述 (可选)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="添加一些关于作业的说明或提示..."
                  rows={3}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  分配班级 <span className="text-rose-500">*</span>
                </h3>
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                  已选 {selectedClasses.length}
                </span>
              </div>
              
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {classes.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">暂无班级，请先在班级管理中创建</p>
                ) : (
                  classes.map(c => (
                    <label 
                      key={c.id} 
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedClasses.includes(c.id) 
                          ? 'bg-indigo-50 border-indigo-200' 
                          : 'bg-white border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                        selectedClasses.includes(c.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                      }`}>
                        {selectedClasses.includes(c.id) && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{c.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Problem Selection */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" />
                选择题目 <span className="text-rose-500">*</span>
              </h3>
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                  已选 {selectedProblems.length}
                </span>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="搜索题目..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 w-12 text-center"></th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">标题</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">难度</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto block w-full" style={{ display: 'table-row-group' }}>
                  {problems.filter(p => p.title?.toLowerCase().includes(searchTerm.toLowerCase())).map(problem => (
                    <tr 
                      key={problem.id} 
                      onClick={() => toggleProblem(problem.id)}
                      className={`cursor-pointer transition-colors ${
                        selectedProblems.includes(problem.id) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-4 py-3 text-center">
                        <div className={`w-5 h-5 rounded border inline-flex items-center justify-center ${
                          selectedProblems.includes(problem.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
                        }`}>
                          {selectedProblems.includes(problem.id) && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 text-sm">{problem.title}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          problem.difficulty === '简单' || problem.difficulty === 'Easy' ? 'bg-emerald-100 text-emerald-800' :
                          problem.difficulty === '中等' || problem.difficulty === 'Medium' ? 'bg-amber-100 text-amber-800' :
                          'bg-rose-100 text-rose-800'
                        }`}>
                          {problem.difficulty === 'Easy' ? '简单' : problem.difficulty === 'Medium' ? '中等' : problem.difficulty === 'Hard' ? '困难' : problem.difficulty}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {problems.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-slate-500 text-sm">
                        暂无题目，请先在题库管理中创建
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
