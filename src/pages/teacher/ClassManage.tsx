import React, { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Users, BookOpen, Plus, Search, Edit2, Trash2, Calendar, Settings, CheckSquare, MoreHorizontal, Upload, Download, Loader2, X, ChevronLeft } from 'lucide-react';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

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

function ClassManageView({ classes, onClassesChange }: { classes: any[], onClassesChange: () => void }) {
  const [newClassName, setNewClassName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, id: string | null }>({ isOpen: false, id: null });

  const handleAdd = async () => {
    if (!newClassName.trim() || !auth.currentUser) return;
    try {
      await addDoc(collection(db, 'classes'), { 
        name: newClassName.trim(),
        teacherId: auth.currentUser.uid
      });
      setNewClassName('');
      onClassesChange();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'classes');
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    try {
      const oldClass = classes.find(c => c.id === id);
      await updateDoc(doc(db, 'classes', id), { name: editName.trim() });
      
      // Update all students in this class
      if (oldClass && oldClass.name !== editName.trim()) {
        const q = query(collection(db, 'users'), where('class', '==', oldClass.name));
        const snapshot = await getDocs(q);
        for (const docSnap of snapshot.docs) {
          await updateDoc(doc(db, 'users', docSnap.id), { class: editName.trim() });
        }
      }

      setEditingId(null);
      onClassesChange();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `classes/${id}`);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (confirmDialog.id !== null) {
      try {
        await deleteDoc(doc(db, 'classes', confirmDialog.id));
        onClassesChange();
        setConfirmDialog({ isOpen: false, id: null });
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `classes/${confirmDialog.id}`);
      }
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-slate-900">班级列表</h3>
      </div>
      
      <div className="flex gap-2 mb-6 max-w-md">
        <input 
          type="text" 
          value={newClassName}
          onChange={e => setNewClassName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="输入新班级名称..."
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
        />
        <button onClick={handleAdd} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
          添加班级
        </button>
      </div>

      <div className="space-y-2">
        {classes.map(c => (
          <div key={c.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            {editingId === c.id ? (
              <div className="flex items-center gap-2 flex-1 mr-2">
                <input 
                  type="text" 
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <button onClick={() => handleSaveEdit(c.id)} className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">保存</button>
                <button onClick={() => setEditingId(null)} className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
              </div>
            ) : (
              <>
                <span className="text-sm font-medium text-slate-700">{c.name}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingId(c.id); setEditName(c.name); }} className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(c.id)} className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {classes.length === 0 && (
          <div className="text-center py-8 text-sm text-slate-500">暂无班级数据</div>
        )}
      </div>
      {confirmDialog.isOpen && (
        <ConfirmModal
          title="删除班级"
          message="确定要删除该班级吗？"
          onConfirm={confirmDelete}
          onClose={() => setConfirmDialog({ isOpen: false, id: null })}
        />
      )}
    </div>
  );
}

function StudentModal({ student, classes, onClose, onSave }: { student?: any, classes: any[], onClose: () => void, onSave: (data: any) => void }) {
  const [formData, setFormData] = useState(student || { studentId: '', name: '', class: classes[0]?.name || '' });

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-900">{student ? '编辑学生' : '添加学生'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">学号</label>
            <input type="text" value={formData.studentId} onChange={e => setFormData({...formData, studentId: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" disabled={!!student} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">姓名</label>
            <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">班级</label>
            <select value={formData.class} onChange={e => setFormData({...formData, class: e.target.value})} className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
              {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-8 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">取消</button>
          <button onClick={() => onSave(formData)} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">保存</button>
        </div>
      </div>
    </div>
  );
}

function ImportStudentModal({ onClose, onImport }: { onClose: () => void, onImport: (data: any[]) => void }) {
  const [text, setText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const handleImport = async () => {
    if (!text.trim()) {
      setMessage({ type: 'error', text: '请输入学生数据' });
      return;
    }
    setIsImporting(true);
    setMessage({ type: '', text: '' });
    const lines = text.split('\n').filter(l => l.trim());
    const students = lines.map(l => {
      const parts = l.split(/[,，\s\t]+/);
      return {
        studentId: parts[0] || '',
        name: parts[1] || '未知姓名',
        class: parts[2] || '计算机科学2024级1班',
        role: 'student',
        email: `${parts[0]}@example.com`,
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
        status: 'active'
      };
    }).filter(s => s.studentId);

    if (students.length === 0) {
      setMessage({ type: 'error', text: '未能解析出有效的学生数据，请检查格式' });
      setIsImporting(false);
      return;
    }

    try {
      // In a real app, we would use a batch write here
      for (const student of students) {
        await addDoc(collection(db, 'users'), student);
      }
      setIsImporting(false);
      setMessage({ type: 'success', text: `成功导入 ${students.length} 名学生` });
      setTimeout(() => {
        onImport(students);
      }, 1500);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'users');
      setIsImporting(false);
      setMessage({ type: 'error', text: '导入失败，请重试' });
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-900">批量导入学生</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        {message.text && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.type === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            {message.text}
          </div>
        )}
        <div className="space-y-4">
          <div className="bg-indigo-50 text-indigo-800 p-4 rounded-lg text-sm">
            <p className="font-medium mb-1">支持的格式说明：</p>
            <p>请将 Excel 或 CSV 数据直接粘贴到下方文本框中。每行代表一名学生，字段之间用空格、逗号或制表符分隔。</p>
            <p className="mt-2 font-mono text-xs bg-white/50 p-2 rounded">
              示例：<br />
              2024005 张三 计算机科学2024级1班<br />
              2024006 李四 软件工程2024级2班
            </p>
          </div>
          <div>
            <textarea 
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="在此粘贴学生数据..."
              className="w-full h-64 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm resize-none"
            ></textarea>
          </div>
        </div>
        <div className="mt-8 flex justify-end gap-3">
          <button onClick={onClose} disabled={isImporting} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg disabled:opacity-50">取消</button>
          <button onClick={handleImport} disabled={isImporting} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50">
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {isImporting ? '导入中...' : '确认导入'}
          </button>
        </div>
      </div>
    </div>
  );
}


function StudentList({ classes, onClassesChange }: { classes: any[], onClassesChange: () => void }) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isBatchClassModalOpen, setIsBatchClassModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'student'));
      const snapshot = await getDocs(q);
      const studentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStudents(studentData);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const filteredStudents = students.filter(s => {
    const matchClass = selectedClass === 'all' || s.class === selectedClass;
    const matchSearch = s.name?.includes(searchTerm) || s.studentId?.includes(searchTerm);
    return matchClass && matchSearch;
  });

  const toggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedStudents(filteredStudents.map(s => s.id));
    } else {
      setSelectedStudents([]);
    }
  };

  const toggleStudent = (id: string) => {
    if (selectedStudents.includes(id)) {
      setSelectedStudents(selectedStudents.filter(sId => sId !== id));
    } else {
      setSelectedStudents([...selectedStudents, id]);
    }
  };

  const handleBatchChangeClass = async (newClass: string) => {
    if (selectedStudents.length === 0 || !newClass) return;
    try {
      for (const id of selectedStudents) {
        await updateDoc(doc(db, 'users', id), { class: newClass });
      }
      setIsBatchClassModalOpen(false);
      setSelectedStudents([]);
      fetchStudents();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleSaveStudent = async (data: any) => {
    try {
      const studentData = { ...data };
      delete studentData.id; // Remove id before saving to Firestore
      
      if (editingStudent) {
        await updateDoc(doc(db, 'users', editingStudent.id), studentData);
      } else {
        await addDoc(collection(db, 'users'), {
          ...studentData,
          role: 'student',
          email: `${studentData.studentId}@example.com`,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
          status: 'active'
        });
      }
      setIsModalOpen(false);
      setEditingStudent(null);
      fetchStudents();
    } catch (error) {
      handleFirestoreError(error, editingStudent ? OperationType.UPDATE : OperationType.CREATE, 'users');
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: '删除学生',
      message: '确定要删除该学生吗？此操作无法撤销。',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', id));
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          fetchStudents();
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
        }
      }
    });
  };

  const handleBatchDelete = () => {
    if (selectedStudents.length === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: '批量删除',
      message: `确认删除选中的 ${selectedStudents.length} 名学生吗？此操作无法撤销。`,
      onConfirm: async () => {
        try {
          // In a real app, use a batch write
          for (const id of selectedStudents) {
            await deleteDoc(doc(db, 'users', id));
          }
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          setSelectedStudents([]);
          fetchStudents();
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'users');
        }
      }
    });
  };

  const openEditModal = (student: any) => {
    setEditingStudent(student);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingStudent(null);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* 2.2.1 分班管理功能 */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <select 
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">所有班级</option>
            {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        
        <div className="flex gap-3 items-center">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜索学号或姓名..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button onClick={() => setIsImportModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
            <Upload className="w-4 h-4" />
            导入
          </button>
          <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" />
            添加学生
          </button>
        </div>
      </div>

      {/* 批量操作栏 */}
      {selectedStudents.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 flex justify-between items-center">
          <span className="text-sm text-indigo-800 font-medium">已选择 {selectedStudents.length} 名学生</span>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsBatchClassModalOpen(true)}
              className="px-3 py-1.5 text-sm bg-white border border-slate-200 text-slate-700 rounded hover:bg-slate-50 transition-colors"
            >
              调整班级
            </button>
            <button onClick={handleBatchDelete} className="px-3 py-1.5 text-sm bg-rose-50 border border-rose-200 text-rose-700 rounded hover:bg-rose-100 transition-colors">
              批量删除
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 w-12">
                  <input 
                    type="checkbox" 
                    checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                    onChange={toggleAll}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">学号</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">姓名</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">所属班级</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      checked={selectedStudents.includes(s.id)}
                      onChange={() => toggleStudent(s.id)}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">{s.studentId}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">{s.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                      {s.class}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEditModal(s)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    未找到学生记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      
      {isModalOpen && (
        <StudentModal 
          student={editingStudent} 
          classes={classes}
          onClose={() => setIsModalOpen(false)} 
          onSave={handleSaveStudent} 
        />
      )}

      {isImportModalOpen && (
        <ImportStudentModal 
          onClose={() => setIsImportModalOpen(false)}
          onImport={() => {
            setIsImportModalOpen(false);
            fetchStudents();
          }}
        />
      )}

      {isBatchClassModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900">批量调整班级</h3>
              <button onClick={() => setIsBatchClassModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">选择新班级</label>
                <select 
                  id="batch-class-select"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setIsBatchClassModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">取消</button>
              <button 
                onClick={() => {
                  const select = document.getElementById('batch-class-select') as HTMLSelectElement;
                  handleBatchChangeClass(select.value);
                }} 
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              >
                确认调整
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog.isOpen && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
}

export default function ClassManage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'students' | 'classes'>('students');

  const fetchClasses = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(collection(db, 'classes'), where('teacherId', '==', auth.currentUser.uid));
      const snapshot = await getDocs(q);
      const classData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setClasses(classData);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'classes');
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  return (
    <Layout role="teacher">
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <header className="mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">班级与学生管理</h1>
            <p className="text-slate-500 mt-2">管理班级分类及学生名单。</p>
          </div>
        </header>

        <div className="flex border-b border-slate-200 mb-6">
          <button 
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'students' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('students')}
          >
            学生管理
          </button>
          <button 
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'classes' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('classes')}
          >
            班级管理
          </button>
        </div>

        {activeTab === 'students' ? (
          <StudentList classes={classes} onClassesChange={() => {
            fetchClasses();
          }} />
        ) : (
          <ClassManageView classes={classes} onClassesChange={() => {
            fetchClasses();
          }} />
        )}
      </div>
    </Layout>
  );
}
