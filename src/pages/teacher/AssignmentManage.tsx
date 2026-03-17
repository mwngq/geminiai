import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Calendar, Users, BookOpen, Clock, X } from 'lucide-react';
import Layout from '../../components/Layout';
import { collection, onSnapshot, query, doc, deleteDoc, where } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import AssignmentEditor from './AssignmentEditor';

function ConfirmModal({ title, message, onConfirm, onClose }: { title: string, message: string, onConfirm: () => void, onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">取消</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg">确认</button>
        </div>
      </div>
    </div>
  );
}

export default function AssignmentManage() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'assignments'), where('authorId', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const assignmentsData = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      // Sort by creation date descending
      assignmentsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAssignments(assignmentsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'assignments');
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = (id: string) => {
    setConfirmDialog({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (confirmDialog.id !== null) {
      try {
        await deleteDoc(doc(db, 'assignments', confirmDialog.id));
        setConfirmDialog({ isOpen: false, id: null });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `assignments/${confirmDialog.id}`);
      }
    }
  };

  const handleEdit = (assignment: any) => {
    setEditingAssignment(assignment);
    setIsEditing(true);
  };

  const handleCreateNew = () => {
    setEditingAssignment(null);
    setIsEditing(true);
  };

  const isPastDue = (dueDate: string) => {
    return new Date(dueDate).getTime() < new Date().getTime();
  };

  return (
    <Layout role="teacher">
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        {isEditing ? (
          <AssignmentEditor 
            onBack={() => setIsEditing(false)} 
            initialData={editingAssignment} 
          />
        ) : (
          <>
            <header className="flex justify-between items-end mb-8">
              <div>
                <h1 className="text-3xl font-bold text-slate-900">作业管理</h1>
                <p className="text-slate-500 mt-2">发布作业、分配班级并设置截止时间。</p>
              </div>
              <button 
                onClick={handleCreateNew}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" />
                发布作业
              </button>
            </header>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜索作业名称..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignments.filter((a: any) => a.title?.toLowerCase().includes(searchTerm.toLowerCase())).map((assignment: any) => (
                <div key={assignment.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                  <div className="p-6 flex-1">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-lg font-bold text-slate-900 line-clamp-2">{assignment.title}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isPastDue(assignment.dueDate) ? 'bg-slate-100 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {isPastDue(assignment.dueDate) ? '已截止' : '进行中'}
                      </span>
                    </div>
                    
                    {assignment.description && (
                      <p className="text-sm text-slate-500 mb-6 line-clamp-2">{assignment.description}</p>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-slate-600">
                        <BookOpen className="w-4 h-4 mr-2 text-slate-400" />
                        包含 {assignment.problems?.length || 0} 道题目
                      </div>
                      <div className="flex items-center text-sm text-slate-600">
                        <Users className="w-4 h-4 mr-2 text-slate-400" />
                        分配给 {assignment.classes?.length || 0} 个班级
                      </div>
                      <div className="flex items-center text-sm text-slate-600">
                        <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                        截止: {new Date(assignment.dueDate).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <div className="text-xs text-slate-400 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      发布于 {new Date(assignment.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleEdit(assignment)}
                        className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                        title="编辑作业"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(assignment.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="删除作业"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {assignments.length === 0 && (
                <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 border-dashed">
                  暂无作业，请点击右上角发布作业
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {confirmDialog.isOpen && (
        <ConfirmModal
          title="删除作业"
          message="确定要删除这个作业吗？此操作不可恢复。"
          onConfirm={confirmDelete}
          onClose={() => setConfirmDialog({ isOpen: false, id: null })}
        />
      )}
    </Layout>
  );
}
