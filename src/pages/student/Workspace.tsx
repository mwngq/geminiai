import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import { Play, Send, RotateCcw, ChevronLeft, Terminal, AlertTriangle, CheckCircle2, Sparkles, Target, BookOpen, MessageSquare, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import Layout from '../../components/Layout';
import { doc, getDoc, collection, addDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import { callAI } from '../../services/aiService';

export default function Workspace() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const assignmentId = searchParams.get('assignment');
  const [problem, setProblem] = useState<any>(null);
  const [code, setCode] = useState('// 在这里编写你的代码\nfunction solution() {\n  \n}');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'result' | 'diagnosis' | 'scoring' | 'qa'>('result');
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'ai', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [teacherAiConfig, setTeacherAiConfig] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  useEffect(() => {
    const fetchProblem = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'problems', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProblem({ id: docSnap.id, ...data });
          
          // Fetch teacher's AI config
          if (data.authorId) {
            try {
              const aiConfigSnap = await getDoc(doc(db, 'settings', `ai_config_${data.authorId}`));
              if (aiConfigSnap.exists()) {
                setTeacherAiConfig(aiConfigSnap.data());
              }
            } catch (err) {
              console.error('Failed to fetch teacher AI config', err);
            }
          }
        } else {
          console.error('Problem not found');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `problems/${id}`);
      }
    };
    fetchProblem();
  }, [id]);

  const handleRun = async () => {
    setIsSubmitting(true);
    setOutput(null);
    setActiveTab('result');
    setChatMessages([]);
    try {
      // Generate AI evaluation and execution simulation
      let data: any = {};
      let isSuccess = false;
      
      try {
        let teacherPrompt = '';
        if (teacherAiConfig) {
          teacherPrompt = `
            请注意以下教师配置的评分标准：
            - 代码规范检查：${teacherAiConfig.codeStyle ? '需要' : '不需要'}
            - 复杂度分析：${teacherAiConfig.complexity ? '需要' : '不需要'}
            
            教师自定义指令：${teacherAiConfig.customPrompt || '无'}
          `;
        }

        let languageSpecificPrompt = '';
        switch (language) {
          case 'javascript':
            languageSpecificPrompt = `
            针对 JavaScript 语言的特别评测提示：
            - 关注 ES6+ 语法的合理使用（如 let/const, 箭头函数, 解构赋值等）。
            - 检查是否存在潜在的异步操作问题。
            - 关注变量作用域、闭包使用是否正确。
            - 检查是否合理使用了内置的高阶函数（如 map, filter, reduce）。`;
            break;
          case 'python':
            languageSpecificPrompt = `
            针对 Python 语言的特别评测提示：
            - 关注代码是否符合 PEP 8 规范（Pythonic 风格）。
            - 检查是否合理使用了列表推导式、生成器等 Python 特性来优化性能。
            - 关注时间复杂度，因为 Python 执行速度相对较慢，低效的算法会导致严重超时。
            - 检查数据结构（如 set, dict）的合理使用以降低时间复杂度。`;
            break;
          case 'java':
            languageSpecificPrompt = `
            针对 Java 语言的特别评测提示：
            - 关注面向对象设计是否合理，类和方法的命名是否符合 Java 规范。
            - 检查是否合理使用了 Java 集合框架（Collections Framework）。
            - 关注内存开销，检查是否存在不必要的对象创建（如在循环中 new 对象）。
            - 检查异常处理是否规范，是否存在未处理的边界情况。`;
            break;
          case 'cpp':
            languageSpecificPrompt = `
            针对 C++ 语言的特别评测提示：
            - 关注内存管理，检查是否存在内存泄漏（未释放的 new）或野指针。
            - 检查是否合理使用了 STL 容器（如 vector, map, unordered_map）及其性能影响。
            - 关注指针和引用的使用是否安全、规范。
            - 检查时间复杂度和空间复杂度，C++ 对性能要求极高，应尽量给出最优解。`;
            break;
        }

        const evalPrompt = `
          你是一个专业的编程老师和代码执行引擎。请对以下学生的编程提交进行评估，并模拟代码的真实执行结果。
          题目：${problem?.title}
          描述：${problem?.description}
          学生代码 (${language})：
          \`\`\`
          ${code}
          \`\`\`

          ${teacherPrompt}
          ${languageSpecificPrompt}

          请返回如下格式的 JSON（不要包含 markdown 代码块标记，直接返回 JSON 字符串）：
          {
            "execution": {
              "success": true 或 false (代码逻辑是否完全正确并能通过所有隐含的测试用例),
              "output": "运行结果的输出文本，例如 'All test cases passed!' 或 'Test case 3 failed: Expected 5, got 4' 或具体的报错信息",
              "time": "执行时间，例如 '12ms' 或 '150ms' (请根据代码复杂度给出合理的估算)",
              "memory": "内存消耗，例如 '18MB' 或 '32MB' (请根据代码复杂度给出合理的估算)"
            },
            "diagnosis": {
              "errorInterpretation": "对报错或运行结果的通俗解释",
              "logicalLoophole": "代码中存在的逻辑漏洞或潜在问题"
            },
            "scoring": {
              "overall": 85,
              "radar": [
                { "subject": "正确性", "score": 90 },
                { "subject": "时间复杂度", "score": 80 },
                { "subject": "空间复杂度", "score": 85 },
                { "subject": "代码规范", "score": 75 },
                { "subject": "鲁棒性", "score": 80 }
              ],
              "details": {
                "deductions": ["扣分项1", "扣分项2"],
                "strengths": ["优点1", "优点2"],
                "suggestions": ["建议1", "建议2"]
              }
            },
            "knowledgeCards": [
              { "title": "知识点标题", "description": "知识点简要说明" }
            ]
          }
        `;
        
        const evalResponse = await callAI(evalPrompt, "你是一个专业的编程老师和代码执行引擎，负责评估学生的代码并模拟运行。请严格按照要求的 JSON 格式返回。");
        
        // Clean up markdown code block if present
        let jsonStr = evalResponse.trim();
        if (jsonStr.startsWith('\`\`\`json')) {
          jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
        } else if (jsonStr.startsWith('\`\`\`')) {
          jsonStr = jsonStr.substring(3, jsonStr.length - 3).trim();
        }
        
        const parsedResponse = JSON.parse(jsonStr);
        
        isSuccess = parsedResponse.execution.success;
        data = {
          success: isSuccess,
          output: parsedResponse.execution.output,
          time: parsedResponse.execution.time,
          memory: parsedResponse.execution.memory,
          evaluation: {
            diagnosis: parsedResponse.diagnosis,
            scoring: parsedResponse.scoring,
            knowledgeCards: parsedResponse.knowledgeCards
          }
        };
      } catch (aiError) {
        console.error('Failed to generate AI evaluation:', aiError);
        // Fallback evaluation if AI fails
        isSuccess = false;
        data = {
          success: false,
          output: 'Code execution simulation failed due to AI service error.',
          time: 'N/A',
          memory: 'N/A',
          evaluation: {
            diagnosis: {
              errorInterpretation: "无法连接到 AI 引擎进行代码评估。",
              logicalLoophole: "暂无 AI 诊断信息。"
            },
            scoring: {
              overall: 0,
              radar: [
                { subject: "正确性", score: 0 },
                { subject: "时间复杂度", score: 0 },
                { subject: "空间复杂度", score: 0 },
                { subject: "代码规范", score: 0 },
                { subject: "鲁棒性", score: 0 }
              ],
              details: {
                deductions: ["无法评估"],
                strengths: [],
                suggestions: ["请稍后重试或联系管理员检查 AI 配置"]
              }
            },
            knowledgeCards: []
          }
        };
      }

      setOutput(data);
      if (!data.success) {
        setActiveTab('diagnosis');
      } else {
        setActiveTab('scoring');
      }

      // Save submission to Firestore
      if (auth.currentUser) {
        await addDoc(collection(db, 'submissions'), {
          studentId: auth.currentUser.uid,
          problemId: id,
          assignmentId: assignmentId || null,
          code,
          language,
          status: 'submitted',
          passed: isSuccess,
          score: data.evaluation?.scoring?.overall || (isSuccess ? 100 : 0),
          submitTime: new Date().toISOString()
        });
      }
    } catch (error) {
      setOutput({ error: 'Failed to execute code' });
      handleFirestoreError(error, OperationType.CREATE, 'submissions');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isAiTyping) return;
    
    const userMessage = chatInput;
    const newMessages = [...chatMessages, { role: 'user' as const, content: userMessage }];
    setChatMessages(newMessages);
    setChatInput('');
    setIsAiTyping(true);
    
    try {
      let teacherPrompt = '';
      if (teacherAiConfig) {
        teacherPrompt = `
          教师配置的助教风格：${teacherAiConfig.assistantStyle === 'direct' ? '直接给出反馈' : teacherAiConfig.assistantStyle === 'strict' ? '严格要求，指出所有问题' : '自定义风格'}
          是否使用引导式提问：${teacherAiConfig.guidedPrompts ? '是，不要直接给出完整代码答案，而是指出问题所在并给出提示' : '否'}
          教师自定义指令：${teacherAiConfig.customPrompt || '无'}
        `;
      }

      let languageSpecificPrompt = '';
      switch (language) {
        case 'javascript':
          languageSpecificPrompt = `请在解答时，多引导学生使用 ES6+ 语法，并注意变量作用域和异步处理等 JavaScript 特性。`;
          break;
        case 'python':
          languageSpecificPrompt = `请在解答时，多引导学生编写符合 PEP 8 规范的 Pythonic 代码，并关注时间复杂度。`;
          break;
        case 'java':
          languageSpecificPrompt = `请在解答时，多引导学生注意 Java 的面向对象设计、集合框架的合理使用以及内存开销。`;
          break;
        case 'cpp':
          languageSpecificPrompt = `请在解答时，多引导学生注意 C++ 的内存管理（避免泄漏）、指针安全以及 STL 容器的性能。`;
          break;
      }

      const prompt = `
        题目：${problem?.title}
        描述：${problem?.description}
        学生代码：
        \`\`\`${language}
        ${code}
        \`\`\`
        评测结果：${output?.output || '未运行'}
        
        学生问题：${userMessage}
        
        ${teacherPrompt}
        ${languageSpecificPrompt}
      `;
      
      const response = await callAI(prompt, "你是一个友好的编程助教。请根据题目、学生的代码和评测结果，回答学生的问题。");
      
      setChatMessages([...newMessages, { 
        role: 'ai', 
        content: response 
      }]);
    } catch (error: any) {
      console.error('AI Error:', error);
      setChatMessages([...newMessages, { 
        role: 'ai', 
        content: `抱歉，AI 助教暂时无法响应你的请求。错误信息：${error.message}` 
      }]);
    } finally {
      setIsAiTyping(false);
    }
  };

  if (!problem) return <div className="p-8 text-center text-slate-500">正在加载题目...</div>;

  return (
    <Layout role="student">
      <div className="h-full flex flex-col bg-slate-50">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
          <div className="flex items-center gap-4">
            <Link to="/student/problems" className="p-2 -ml-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{problem.id}. {problem.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                  problem.difficulty === '简单' ? 'bg-emerald-100 text-emerald-700' :
                  problem.difficulty === '中等' ? 'bg-amber-100 text-amber-700' :
                  'bg-rose-100 text-rose-700'
                }`}>
                  {problem.difficulty}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select 
              value={language} 
              onChange={(e) => setLanguage(e.target.value)}
              className="text-sm border-slate-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
            <button 
              onClick={() => setCode('// 在这里编写你的代码\nfunction solution() {\n  \n}')}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              title="重置代码"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button 
              onClick={handleRun}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {isSubmitting ? '评测中...' : '提交评测'}
            </button>
          </div>
        </header>

        {/* Workspace Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Problem Description */}
          <div className="w-1/3 border-r border-slate-200 bg-white overflow-y-auto p-6">
            <div className="prose prose-slate prose-sm max-w-none">
              <ReactMarkdown>{problem.description}</ReactMarkdown>
              
              <h3 className="text-sm font-semibold text-slate-900 mt-8 mb-4">输入输出样例</h3>
              <div className="bg-slate-50 rounded-lg p-4 font-mono text-xs text-slate-700 border border-slate-100">
                <div className="mb-2"><span className="font-semibold text-slate-900">输入:</span> nums = [2,7,11,15], target = 9</div>
                <div><span className="font-semibold text-slate-900">输出:</span> [0,1]</div>
              </div>

              <h3 className="text-sm font-semibold text-slate-900 mt-8 mb-4">约束条件</h3>
              <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                <li><code>2 &lt;= nums.length &lt;= 10^4</code></li>
                <li><code>-10^9 &lt;= nums[i] &lt;= 10^9</code></li>
                <li><code>-10^9 &lt;= target &lt;= 10^9</code></li>
                <li>只会存在一个有效答案。</li>
              </ul>
            </div>
          </div>

          {/* Right Panel: Editor & Console */}
          <div className="w-2/3 flex flex-col">
            {/* Editor */}
            <div className="flex-1 relative">
              <Editor
                height="100%"
                language={language}
                value={code}
                onChange={(value) => setCode(value || '')}
                theme="vs-light"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineHeight: 24,
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                  cursorSmoothCaretAnimation: "on",
                  formatOnPaste: true,
                }}
              />
            </div>

            {/* Console / Output Area */}
            <div className="h-80 border-t border-slate-200 bg-white flex flex-col">
              <div className="flex items-center border-b border-slate-100 bg-slate-50/50 px-2">
                <button 
                  onClick={() => setActiveTab('result')}
                  className={`flex items-center px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'result' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'}`}
                >
                  <Terminal className="w-4 h-4 mr-2" />
                  运行结果
                </button>
                {output && output.evaluation && (
                  <>
                    <button 
                      onClick={() => setActiveTab('diagnosis')}
                      className={`flex items-center px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'diagnosis' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'}`}
                    >
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      智能诊断
                    </button>
                    <button 
                      onClick={() => setActiveTab('scoring')}
                      className={`flex items-center px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'scoring' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'}`}
                    >
                      <Target className="w-4 h-4 mr-2" />
                      多维评分
                    </button>
                    <button 
                      onClick={() => setActiveTab('qa')}
                      className={`flex items-center px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'qa' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50'}`}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      交互式问答
                    </button>
                  </>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-4">
                {!output && !isSubmitting && (
                  <div className="text-slate-400 text-center mt-8 font-mono text-sm">运行代码以在此处查看输出。</div>
                )}
                {isSubmitting && (
                  <div className="text-indigo-500 flex items-center justify-center gap-3 h-full font-mono text-sm">
                    <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    代码执行与 AI 分析中...
                  </div>
                )}
                
                {output && !isSubmitting && activeTab === 'result' && (
                  <div className="space-y-4 font-mono text-sm">
                    <div className={`flex items-center gap-2 font-bold text-lg ${output.success ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {output.success ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                      {output.output}
                    </div>
                    <div className="flex gap-8 text-slate-600 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div><span className="font-semibold text-slate-900 block mb-1">执行时间</span> {output.time}</div>
                      <div><span className="font-semibold text-slate-900 block mb-1">内存消耗</span> {output.memory}</div>
                    </div>
                  </div>
                )}

                {output && !isSubmitting && activeTab === 'diagnosis' && output.evaluation && (
                  <div className="space-y-6">
                    <div className="bg-rose-50 border border-rose-100 rounded-xl p-5">
                      <h4 className="flex items-center gap-2 font-bold text-rose-900 mb-3">
                        <AlertTriangle className="w-5 h-5" />
                        报错语义化解读
                      </h4>
                      <p className="text-sm text-rose-800 leading-relaxed">
                        {output.evaluation.diagnosis.errorInterpretation || '代码未抛出运行时异常。'}
                      </p>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-5">
                      <h4 className="flex items-center gap-2 font-bold text-amber-900 mb-3">
                        <Sparkles className="w-5 h-5" />
                        逻辑漏洞定位
                      </h4>
                      <p className="text-sm text-amber-800 leading-relaxed">
                        {output.evaluation.diagnosis.logicalLoophole || '未发现明显的逻辑漏洞。'}
                      </p>
                    </div>
                  </div>
                )}

                {output && !isSubmitting && activeTab === 'scoring' && output.evaluation && (
                  <div className="flex gap-6 h-full">
                    <div className="w-1/3 flex flex-col items-center justify-center bg-slate-50 rounded-xl border border-slate-100 p-4">
                      <div className="text-sm font-medium text-slate-500 mb-2">综合得分</div>
                      <div className={`text-5xl font-black ${output.evaluation.scoring.overall >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {output.evaluation.scoring.overall}
                      </div>
                      <div className="w-full h-40 mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={output.evaluation.scoring.radar}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar name="得分" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.4} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="w-2/3 space-y-4 overflow-y-auto pr-2">
                      {output.evaluation.scoring.details.deductions.length > 0 && (
                        <div>
                          <h4 className="text-sm font-bold text-rose-700 mb-2 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> 扣分项详情
                          </h4>
                          <ul className="space-y-1">
                            {output.evaluation.scoring.details.deductions.map((item: string, i: number) => (
                              <li key={i} className="text-sm text-slate-600 bg-rose-50/50 px-3 py-2 rounded-lg border border-rose-100/50">{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div>
                        <h4 className="text-sm font-bold text-emerald-700 mb-2 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> 代码优点
                        </h4>
                        <ul className="space-y-1">
                          {output.evaluation.scoring.details.strengths.map((item: string, i: number) => (
                            <li key={i} className="text-sm text-slate-600 bg-emerald-50/50 px-3 py-2 rounded-lg border border-emerald-100/50">{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-indigo-700 mb-2 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> 改进建议
                        </h4>
                        <ul className="space-y-1">
                          {output.evaluation.scoring.details.suggestions.map((item: string, i: number) => (
                            <li key={i} className="text-sm text-slate-600 bg-indigo-50/50 px-3 py-2 rounded-lg border border-indigo-100/50">{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {output && !isSubmitting && activeTab === 'qa' && output.evaluation && (
                  <div className="flex gap-6 h-full">
                    <div className="w-1/2 flex flex-col h-full border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-sm font-medium text-slate-700 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        追问 AI
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
                        <div className="flex gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none text-sm text-slate-700">
                            针对刚才的评测结果，你有什么疑问吗？你可以问我关于报错原因、优化思路或相关知识点的问题。
                          </div>
                        </div>
                        {chatMessages.map((msg, i) => (
                          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-800' : 'bg-indigo-100'}`}>
                              {msg.role === 'user' ? <span className="text-white text-xs font-bold">ME</span> : <Sparkles className="w-4 h-4 text-indigo-600" />}
                            </div>
                            <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-700 rounded-tl-none'}`}>
                            <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-slate-50">
                              <ReactMarkdown>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                            </div>
                          </div>
                        ))}
                        {isAiTyping && (
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                              <Sparkles className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div className="bg-slate-100 p-3 rounded-2xl rounded-tl-none text-sm text-slate-700 flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                              <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>
                      <div className="p-3 bg-slate-50 border-t border-slate-200">
                        <div className="relative">
                          <input 
                            type="text" 
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="输入你的问题..."
                            className="w-full pl-4 pr-10 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                          />
                          <button 
                            onClick={handleSendMessage}
                            disabled={isAiTyping}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="w-1/2 space-y-4 overflow-y-auto pr-2">
                      <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
                        <BookOpen className="w-4 h-4 text-indigo-500" />
                        推荐知识点卡片
                      </h4>
                      {output.evaluation.knowledgeCards.map((card: any, i: number) => (
                        <div key={i} className="bg-white border border-slate-200 p-4 rounded-xl hover:shadow-md transition-shadow cursor-pointer group">
                          <div className="flex justify-between items-center mb-2">
                            <h5 className="font-bold text-indigo-700 text-sm">{card.title}</h5>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{card.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
