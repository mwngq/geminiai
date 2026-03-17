import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, CheckCircle, AlertCircle, User, ChevronRight, FileText, Loader2 } from 'lucide-react';
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
  deadline: string;
  isUrgent: boolean;
  studentStatus: string;
  description?: string;
}

export default function Assignments() {
  const [filter, setFilter] = useState('all');
  const [assignmentsData, setAssignmentsData] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'assignments'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      try {
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
          const isPastDue = hoursLeft < 0;

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

          const studentStatus = isPastDue ? 'past_due' : (completed === total && total > 0 ? 'completed' : 'pending');

          return {
            id: docSnapshot.id,
            title: data.title,
            description: data.description,
            teacher: teacherName,
            total: total,
            completed: completed,
            deadline: data.dueDate,
            isUrgent: isUrgent,
            studentStatus: studentStatus
          };
        });

        const resolvedAssignments = await Promise.all(assignmentsPromises);
        // Sort by deadline
        resolvedAssignments.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());
        setAssignmentsData(resolvedAssignments);
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'assignments');
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'assignments');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredAssignments = assignmentsData.filter(assignment => {
    if (filter === 'all') return true;
    if (filter === 'pending') return assignment.studentStatus !== 'completed';
    if (filter === 'completed') return assignment.studentStatus === 'completed';
    return true;
  });

  return (
    <Layout role="student">
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <header className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">我的作业</h1>
            <p className="text-slate-500 mt-2">查看并完成老师布置的作业任务。</p>
          </div>
        </header>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'all', label: '全部作业' },
            { id: 'pending', label: '待完成' },
            { id: 'completed', label: '已完成' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === f.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Assignments List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssignments.map((assignment) => {
              const progress = assignment.total > 0 ? Math.round((assignment.completed / assignment.total) * 100) : 0;
              const isFinished = assignment.studentStatus === 'completed';
              const isPastDue = assignment.studentStatus === 'past_due';
            
            return (
              <div key={assignment.id} className={`bg-white p-6 rounded-2xl shadow-sm border transition-all hover:shadow-md flex flex-col ${
                assignment.isUrgent ? 'border-rose-200' : 'border-slate-200'
              }`}>
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl ${isFinished ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                      {isFinished ? <CheckCircle className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg leading-tight line-clamp-1">
                        {assignment.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                        <User className="w-4 h-4" />
                        <span>{assignment.teacher}</span>
                      </div>
                    </div>
                  </div>
                  {assignment.isUrgent && !isFinished && !isPastDue && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                      紧急
                    </span>
                  )}
                  {isPastDue && !isFinished && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                      已截止
                    </span>
                  )}
                </div>

                {assignment.description && (
                  <p className="text-sm text-slate-600 mb-4 line-clamp-2 flex-1">
                    {assignment.description}
                  </p>
                )}

                <div className="mt-auto space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className={`font-medium flex items-center gap-1.5 ${
                      assignment.isUrgent && !isFinished && !isPastDue ? 'text-rose-600' : 
                      isPastDue ? 'text-slate-500' : 'text-slate-500'
                    }`}>
                      {assignment.isUrgent && !isFinished && !isPastDue ? <AlertCircle className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                      {new Date(assignment.deadline).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 截止
                    </span>
                    <span className="text-slate-500 font-medium">
                      {assignment.completed} / {assignment.total} 题
                    </span>
                  </div>
                  
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${isFinished ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <span className={`text-sm font-medium ${isFinished ? 'text-emerald-600' : 'text-slate-600'}`}>
                      {isFinished ? '已完成' : `进度 ${progress}%`}
                    </span>
                    
                    <Link 
                      to={`/student/problems?assignment=${assignment.id}`} 
                      className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors ${
                        isFinished 
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' 
                          : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      {isFinished ? '查看详情' : '去完成'} <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
          
            {filteredAssignments.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 border-dashed">
                <CheckCircle className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p className="text-lg font-medium text-slate-900">太棒了！</p>
                <p>当前没有需要完成的作业。</p>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
