import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { Bot, Settings2, Sliders, MessageSquare, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';

export default function AIAssistant() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // 评分标准设置
  const [criteria, setCriteria] = useState({
    codeStyle: true,
    complexity: true,
    guidedPrompts: false,
  });

  // 助教风格选择
  const [assistantStyle, setAssistantStyle] = useState('direct'); // 'direct', 'strict', 'custom'
  const [customPrompt, setCustomPrompt] = useState('');

  useEffect(() => {
    const fetchConfig = async () => {
      if (!auth.currentUser) return;
      try {
        const docRef = doc(db, 'settings', `ai_config_${auth.currentUser.uid}`);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCriteria({
            codeStyle: data.codeStyle ?? true,
            complexity: data.complexity ?? true,
            guidedPrompts: data.guidedPrompts ?? false,
          });
          setAssistantStyle(data.assistantStyle || 'direct');
          setCustomPrompt(data.customPrompt || '');
        }
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch AI config:', err);
        handleFirestoreError(err, OperationType.GET, 'settings');
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', `ai_config_${auth.currentUser.uid}`), {
        ...criteria,
        assistantStyle,
        customPrompt,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save AI config:', err);
      handleFirestoreError(err, OperationType.WRITE, 'settings');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout role="teacher">
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="teacher">
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Bot className="w-8 h-8 text-indigo-600" />
              AI 助教配置
            </h1>
            <p className="text-slate-500 mt-1">自定义 AI 助教的评分标准与反馈风格，打造专属的教学助手</p>
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>

        {showSuccess && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">配置已成功保存！</span>
          </div>
        )}

        <div className="space-y-8">
          {/* 评分标准设置 */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-indigo-600" />
                评分标准设置
              </h2>
              <p className="text-sm text-slate-500 mt-1">配置 AI 在自动批改作业时需要关注的维度</p>
            </div>
            <div className="p-6 space-y-6">
              {/* 代码风格评估 */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-medium text-slate-900">代码风格评估</h3>
                  <p className="text-sm text-slate-500 mt-1">AI 将检查变量命名、缩进、注释等代码规范问题</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={criteria.codeStyle}
                    onChange={(e) => setCriteria({...criteria, codeStyle: e.target.checked})}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="h-px bg-slate-100"></div>

              {/* 复杂度分析 */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-medium text-slate-900">复杂度分析</h3>
                  <p className="text-sm text-slate-500 mt-1">AI 将评估代码的时间复杂度和空间复杂度，并给出优化建议</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={criteria.complexity}
                    onChange={(e) => setCriteria({...criteria, complexity: e.target.checked})}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="h-px bg-slate-100"></div>

              {/* 引导式提示 */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-medium text-slate-900">引导式提示</h3>
                  <p className="text-sm text-slate-500 mt-1">当学生代码出错时，AI 不直接给出正确答案，而是通过提问引导学生思考</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={criteria.guidedPrompts}
                    onChange={(e) => setCriteria({...criteria, guidedPrompts: e.target.checked})}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          </section>

          {/* 助教风格选择 */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                助教风格选择
              </h2>
              <p className="text-sm text-slate-500 mt-1">选择 AI 助教与学生沟通时的语气和反馈方式</p>
            </div>
            <div className="p-6 space-y-4">
              {/* 直接式反馈 */}
              <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${assistantStyle === 'direct' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300'}`}>
                <div className="flex items-center h-6">
                  <input 
                    type="radio" 
                    name="assistantStyle" 
                    value="direct"
                    checked={assistantStyle === 'direct'}
                    onChange={(e) => setAssistantStyle(e.target.value)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <h3 className="text-base font-medium text-slate-900">直接式反馈</h3>
                  <p className="text-sm text-slate-500 mt-1">客观、清晰地指出代码中的错误，并直接提供修正方案和解释。适合需要快速解决问题的场景。</p>
                </div>
              </label>

              {/* 严厉式评价 */}
              <label className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${assistantStyle === 'strict' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300'}`}>
                <div className="flex items-center h-6">
                  <input 
                    type="radio" 
                    name="assistantStyle" 
                    value="strict"
                    checked={assistantStyle === 'strict'}
                    onChange={(e) => setAssistantStyle(e.target.value)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <h3 className="text-base font-medium text-slate-900">严厉式评价</h3>
                  <p className="text-sm text-slate-500 mt-1">对代码规范和性能要求极高，语气严肃。任何不规范的写法都会被指出并扣分。适合进阶课程或竞赛训练。</p>
                </div>
              </label>

              {/* 自定义风格 */}
              <div className={`rounded-xl border-2 transition-all ${assistantStyle === 'custom' ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-200 hover:border-indigo-300'}`}>
                <label className="flex items-start gap-4 p-4 cursor-pointer">
                  <div className="flex items-center h-6">
                    <input 
                      type="radio" 
                      name="assistantStyle" 
                      value="custom"
                      checked={assistantStyle === 'custom'}
                      onChange={(e) => setAssistantStyle(e.target.value)}
                      className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-600"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-medium text-slate-900">自定义风格</h3>
                    <p className="text-sm text-slate-500 mt-1">通过 Prompt 自定义 AI 助教的性格、语气和特定要求。</p>
                  </div>
                </label>
                
                {assistantStyle === 'custom' && (
                  <div className="px-4 pb-4 pl-12">
                    <div className="relative">
                      <div className="absolute top-3 left-3">
                        <MessageSquare className="w-5 h-5 text-slate-400" />
                      </div>
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="例如：你是一位幽默风趣的编程老师，喜欢用生活中的比喻来解释复杂的算法概念。在指出错误时，总是先给予鼓励..."
                        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm text-slate-700 bg-white shadow-sm"
                        rows={5}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      提示：您可以输入具体的行为指令，例如“只给出提示，不要直接写出代码”、“用中文回复，并附带英文专业术语”等。
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
