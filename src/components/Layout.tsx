import { Link, useLocation } from 'react-router-dom';
import { BookOpen, Code, User, LayoutDashboard, Settings, Users, FileText, Bot, TrendingUp, Calendar } from 'lucide-react';

export default function Layout({ children, role }: { children: React.ReactNode, role: 'student' | 'teacher' | 'admin' }) {
  const location = useLocation();

  const navItems = {
    student: [
      { name: '首页/仪表盘', path: '/student', icon: LayoutDashboard },
      { name: '题目大厅', path: '/student/problems', icon: BookOpen },
      { name: '我的作业', path: '/student/assignments', icon: FileText },
      { name: '个人中心', path: '/student/profile', icon: User },
    ],
    teacher: [
      { name: '首页/仪表盘', path: '/teacher', icon: LayoutDashboard },
      { name: '题目管理', path: '/teacher/problems', icon: Code },
      { name: '作业管理', path: '/teacher/assignments', icon: Calendar },
      { name: '班级管理', path: '/teacher/classes', icon: Users },
      { name: '学情分析报表', path: '/teacher/analytics', icon: TrendingUp },
      { name: 'AI 助教配置', path: '/teacher/ai-assistant', icon: Bot },
    ],
    admin: [
      { name: '监控中心', path: '/admin', icon: LayoutDashboard },
      { name: '用户管理', path: '/admin/users', icon: Users },
      { name: '系统设置', path: '/admin/settings', icon: Settings },
    ]
  };

  const items = navItems[role];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
            <Code className="w-6 h-6" />
            CodeEdu
          </h1>
          <div className="mt-2 text-xs font-medium text-slate-500 uppercase tracking-wider">
            {role === 'student' ? '学生端' : role === 'teacher' ? '教师端' : '管理员端'}
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          {items.map((item) => {
            const isActive = location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== `/${role}`);
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-700' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon className={`w-5 h-5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        {/* Role Switcher for Demo Purposes */}
        <div className="p-4 border-t border-slate-200">
          <div className="text-xs font-medium text-slate-500 mb-2">切换角色 (演示)</div>
          <div className="flex gap-2">
            <Link to="/student" className="text-xs px-2 py-1 bg-slate-100 rounded hover:bg-slate-200">学生</Link>
            <Link to="/teacher" className="text-xs px-2 py-1 bg-slate-100 rounded hover:bg-slate-200">教师</Link>
            <Link to="/admin" className="text-xs px-2 py-1 bg-slate-100 rounded hover:bg-slate-200">管理员</Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
