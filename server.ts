import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Mock Data
  const problems = [
    { id: 1, title: '两数之和', difficulty: '简单', tags: ['数组', '哈希表'], description: '给定一个整数数组 `nums` 和一个整数目标值 `target`，请你在该数组中找出和为目标值 `target` 的那两个整数，并返回它们的数组下标。' },
    { id: 2, title: '两数相加', difficulty: '中等', tags: ['链表', '数学'], description: '给你两个非空的链表，表示两个非负的整数。它们每位数字都是按照逆序的方式存储的，并且每个节点只能存储一位数字。' },
    { id: 3, title: '无重复字符的最长子串', difficulty: '中等', tags: ['哈希表', '字符串', '滑动窗口'], description: '给定一个字符串 `s` ，请你找出其中不含有重复字符的最长子串的长度。' },
  ];

  let assignments = [
    { id: 1, title: '第一周：基础数据结构', teacher: '张老师', class: '计算机科学2024级1班', deadline: '2026-03-20 23:59', status: '进行中', submissions: '32/45', total: 5, completed: 2, isUrgent: true, studentStatus: 'in-progress', problems: [1, 2] },
    { id: 2, title: '第二周：排序算法', teacher: '李老师', class: '计算机科学2024级1班', deadline: '2026-03-27 23:59', status: '未开始', submissions: '0/45', total: 3, completed: 0, isUrgent: false, studentStatus: 'pending', problems: [3] },
    { id: 3, title: '期中测试模拟', teacher: '王老师', class: '软件工程2024级2班', deadline: '2026-03-10 23:59', status: '已结束', submissions: '40/40', total: 4, completed: 4, isUrgent: false, studentStatus: 'completed', problems: [1, 2, 3] },
  ];

  let classes = [
    { id: 1, name: '计算机科学2024级1班' },
    { id: 2, name: '软件工程2024级2班' },
    { id: 3, name: '人工智能2024级1班' }
  ];

  app.get('/api/classes', (req, res) => {
    res.json(classes);
  });

  app.post('/api/classes', (req, res) => {
    const newClass = {
      id: classes.length > 0 ? Math.max(...classes.map(c => c.id)) + 1 : 1,
      name: req.body.name
    };
    classes.push(newClass);
    res.json(newClass);
  });

  app.put('/api/classes/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = classes.findIndex(c => c.id === id);
    if (index !== -1) {
      const oldName = classes[index].name;
      const newName = req.body.name;
      classes[index].name = newName;
      
      assignments = assignments.map(a => 
        a.class === oldName ? { ...a, class: newName } : a
      );
      
      students = students.map(s => 
        s.class === oldName ? { ...s, class: newName } : s
      );

      Object.keys(submissionsStore).forEach(key => {
        const aId = parseInt(key);
        submissionsStore[aId] = submissionsStore[aId].map(sub => 
          sub.class === oldName ? { ...sub, class: newName } : sub
        );
      });

      res.json(classes[index]);
    } else {
      res.status(404).json({ error: 'Class not found' });
    }
  });

  app.delete('/api/classes/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const classObj = classes.find(c => c.id === id);
    if (classObj) {
      const className = classObj.name;
      classes = classes.filter(c => c.id !== id);
      
      assignments = assignments.filter(a => a.class !== className);
      students = students.filter(s => s.class !== className);

      const remainingAssignmentIds = new Set(assignments.map(a => a.id));
      Object.keys(submissionsStore).forEach(key => {
        const aId = parseInt(key);
        if (!remainingAssignmentIds.has(aId)) {
          delete submissionsStore[aId];
        } else {
          submissionsStore[aId] = submissionsStore[aId].filter(sub => sub.class !== className);
        }
      });
    }
    res.json({ success: true });
  });

  let aiConfig = {
    criteria: {
      codeStyle: true,
      complexity: true,
      guidedPrompts: false,
    },
    assistantStyle: 'direct',
    customPrompt: ''
  };

  app.get('/api/ai-config', (req, res) => {
    res.json(aiConfig);
  });

  app.put('/api/ai-config', (req, res) => {
    aiConfig = {
      ...aiConfig,
      ...req.body
    };
    res.json(aiConfig);
  });

  let students = [
    { id: 1, studentId: '2024001', name: '张三', class: '计算机科学2024级1班', score: 95 },
    { id: 2, studentId: '2024002', name: '李四', class: '计算机科学2024级1班', score: 88 },
    { id: 3, studentId: '2024003', name: '王五', class: '软件工程2024级2班', score: 92 },
    { id: 4, studentId: '2024004', name: '赵六', class: '人工智能2024级1班', score: 76 },
  ];

  app.get('/api/students', (req, res) => {
    res.json(students);
  });

  app.post('/api/students', (req, res) => {
    const newStudent = {
      id: students.length > 0 ? Math.max(...students.map(s => s.id)) + 1 : 1,
      ...req.body,
      score: req.body.score || 0
    };
    students.unshift(newStudent);
    res.json(newStudent);
  });

  app.put('/api/students/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = students.findIndex(s => s.id === id);
    if (index !== -1) {
      students[index] = { ...students[index], ...req.body };
      res.json(students[index]);
    } else {
      res.status(404).json({ error: 'Student not found' });
    }
  });

  app.delete('/api/students/:id', (req, res) => {
    const id = parseInt(req.params.id);
    students = students.filter(s => s.id !== id);
    res.json({ success: true });
  });

  app.post('/api/students/batch-delete', (req, res) => {
    const { ids } = req.body;
    students = students.filter(s => !ids.includes(s.id));
    res.json({ success: true });
  });

  app.post('/api/students/batch-import', (req, res) => {
    const { students: newStudents } = req.body;
    let maxId = students.length > 0 ? Math.max(...students.map(s => s.id)) : 0;
    const imported = newStudents.map((s: any, i: number) => ({
      id: maxId + i + 1,
      studentId: s.studentId,
      name: s.name,
      class: s.class,
      score: s.score || 0
    }));
    students = [...imported, ...students];
    res.json({ success: true, count: imported.length });
  });

  app.get('/api/problems', (req, res) => {
    res.json(problems);
  });

  app.get('/api/assignments', (req, res) => {
    res.json(assignments);
  });

  app.get('/api/assignments/:id', (req, res) => {
    const assignment = assignments.find(a => a.id === parseInt(req.params.id));
    if (assignment) {
      res.json(assignment);
    } else {
      res.status(404).json({ error: 'Assignment not found' });
    }
  });

  const submissionsStore: Record<number, any[]> = {};

  app.get('/api/assignments/:id/submissions', (req, res) => {
    const assignmentId = parseInt(req.params.id);
    const assignment = assignments.find(a => a.id === assignmentId);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (!submissionsStore[assignmentId]) {
      let targetStudents = students;
      if (assignment.class !== '所有班级') {
        targetStudents = students.filter(s => s.class === assignment.class);
      }

      submissionsStore[assignmentId] = targetStudents.map((s) => {
        // Mock deterministic submission data
        const isSubmitted = (s.id + assignmentId) % 3 !== 0;
        const isGraded = isSubmitted && (s.id + assignmentId) % 2 === 0;
        
        // Generate a pseudo-random recent time
        const now = new Date();
        const minutesAgo = (s.id * 17 + assignmentId * 23) % 1440; // up to 24 hours ago
        const submitDate = new Date(now.getTime() - minutesAgo * 60000);
        
        return {
          id: s.id,
          studentId: s.studentId,
          name: s.name,
          class: s.class,
          status: isGraded ? 'graded' : (isSubmitted ? 'submitted' : 'pending'),
          score: isGraded ? 70 + ((s.id * 7) % 30) : null,
          feedback: isGraded ? '做得不错，继续保持！' : '',
          submitTime: isSubmitted ? submitDate.toISOString().replace('T', ' ').substring(0, 16) : null
        };
      });
    }

    res.json(submissionsStore[assignmentId]);
  });

  app.put('/api/assignments/:id/submissions/:studentId', (req, res) => {
    const assignmentId = parseInt(req.params.id);
    const studentId = parseInt(req.params.studentId);
    const { score, feedback } = req.body;

    if (submissionsStore[assignmentId]) {
      const sub = submissionsStore[assignmentId].find(s => s.id === studentId);
      if (sub) {
        sub.score = score;
        sub.feedback = feedback;
        sub.status = 'graded';
        return res.json(sub);
      }
    }
    res.status(404).json({ error: 'Submission not found' });
  });

  app.post('/api/assignments', (req, res) => {
    const { title, deadline, problems: selectedProblems, class: targetClass } = req.body;
    const newAssignment = {
      id: assignments.length > 0 ? Math.max(...assignments.map(a => a.id)) + 1 : 1,
      title: title || '未命名作业',
      teacher: '张老师', // Mock teacher
      class: targetClass === 'all' ? '所有班级' : (targetClass || '计算机科学2024级1班'),
      deadline: deadline ? deadline.replace('T', ' ') : '2026-12-31 23:59',
      status: '进行中',
      submissions: '0/45',
      total: selectedProblems?.length || 0,
      completed: 0,
      isUrgent: false,
      studentStatus: 'pending',
      problems: selectedProblems || []
    };
    assignments.unshift(newAssignment);
    res.json(newAssignment);
  });

  app.put('/api/assignments/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const index = assignments.findIndex(a => a.id === id);
    if (index !== -1) {
      const { title, deadline, problems: selectedProblems, class: targetClass } = req.body;
      assignments[index] = {
        ...assignments[index],
        title: title || assignments[index].title,
        class: targetClass === 'all' ? '所有班级' : (targetClass || assignments[index].class),
        deadline: deadline ? deadline.replace('T', ' ') : assignments[index].deadline,
        total: selectedProblems?.length || assignments[index].total,
        problems: selectedProblems || assignments[index].problems
      };
      res.json(assignments[index]);
    } else {
      res.status(404).json({ error: 'Assignment not found' });
    }
  });

  app.get('/api/problems/:id', (req, res) => {
    const problem = problems.find(p => p.id === parseInt(req.params.id));
    if (problem) {
      res.json(problem);
    } else {
      res.status(404).json({ error: 'Problem not found' });
    }
  });

  app.post('/api/submit', (req, res) => {
    const { code, problemId, language } = req.body;
    // Mock code execution
    setTimeout(() => {
      const isSuccess = Math.random() > 0.3;
      res.json({
        success: isSuccess,
        output: isSuccess ? '通过 (Accepted)' : '解答错误 (Wrong Answer)',
        time: Math.floor(Math.random() * 100) + 'ms',
        memory: (Math.random() * 10 + 20).toFixed(1) + 'MB',
        evaluation: {
          diagnosis: {
            errorInterpretation: isSuccess ? null : '数组越界异常 (Index Out of Bounds)：在循环访问 `nums[i+1]` 时，当 `i` 达到数组末尾，`i+1` 超出了数组的有效索引范围。',
            logicalLoophole: isSuccess ? null : '未处理边界情况：当输入数组为空或长度为 1 时，代码会抛出异常，未能正确返回预期结果。'
          },
          scoring: {
            overall: isSuccess ? 95 : 65,
            radar: [
              { subject: '正确性', score: isSuccess ? 100 : 40, fullMark: 100 },
              { subject: '语法规范', score: 90, fullMark: 100 },
              { subject: '逻辑完整', score: isSuccess ? 95 : 60, fullMark: 100 },
              { subject: '效率优化', score: 85, fullMark: 100 }
            ],
            details: {
              deductions: isSuccess ? [] : ['未处理空数组边界条件 (-15分)', '循环条件错误导致越界风险 (-20分)'],
              strengths: ['变量命名规范清晰', '尝试使用了哈希表优化查找效率'],
              suggestions: ['在函数开头添加对输入数组长度的防御性校验', '检查 for 循环的终止条件，确保索引不会越界']
            }
          },
          knowledgeCards: [
            { title: '哈希表 (Hash Table)', description: '一种通过哈希函数将键映射到存储位置的数据结构，可实现 O(1) 的平均查找时间，常用于优化两层嵌套循环。' },
            { title: '边界条件处理', description: '在编写算法时，必须优先考虑输入为空、极值或异常格式等特殊情况，这是保证代码健壮性的关键。' }
          ]
        }
      });
    }, 1500);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
