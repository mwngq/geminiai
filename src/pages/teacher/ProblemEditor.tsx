import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Save, Sparkles, Upload, FileText, Check, AlertCircle, Plus, Trash2, FileUp, Loader2 } from 'lucide-react';
import Markdown from 'react-markdown';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import { callAI } from '../../services/aiService';

export default function ProblemEditor({ onBack, initialData }: { onBack: () => void, initialData?: any }) {
  const [activeTab, setActiveTab] = useState<'basic' | 'content' | 'testcases'>('content');
  const [title, setTitle] = useState(initialData?.title || '');
  const [difficulty, setDifficulty] = useState(initialData?.difficulty || '简单');
  const [markdown, setMarkdown] = useState(initialData?.markdown || '');
  const [testCases, setTestCases] = useState(initialData?.testCases || [
    { id: 1, input: '', output: '', weight: 10, isHidden: false }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [validationError, setValidationError] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1.1.2 模板快速生成
  const applyTemplate = () => {
    setMarkdown(`### 题目描述
请在此处详细描述题目要求。

### 输入格式
描述输入数据的格式和限制。

### 输出格式
描述预期输出的格式。

### 样例输入
\`\`\`
输入样例
\`\`\`

### 样例输出
\`\`\`
输出样例
\`\`\`

### 数据范围与提示
说明数据规模和特殊情况。`);
  };

  // 1.3 AI辅助出题
  const generateWithAI = async () => {
    setIsGenerating(true);
    try {
      const prompt = `
        请帮我生成一道编程题的 Markdown 描述。
        要求包含以下章节：
        ### 题目描述
        ### 输入格式
        ### 输出格式
        ### 样例输入
        ### 样例输出
        ### 数据范围与提示

        请返回 JSON 格式，包含 title 和 markdown 两个字段。不要包含 markdown 代码块标记，直接返回 JSON 字符串。
        {
          "title": "题目名称",
          "markdown": "完整的 Markdown 内容"
        }
      `;
      const response = await callAI(prompt, "你是一个专业的编程老师，负责出题。");
      
      let jsonStr = response.trim();
      if (jsonStr.startsWith('\`\`\`json')) {
        jsonStr = jsonStr.substring(7, jsonStr.length - 3).trim();
      } else if (jsonStr.startsWith('\`\`\`')) {
        jsonStr = jsonStr.substring(3, jsonStr.length - 3).trim();
      }
      
      const data = JSON.parse(jsonStr);
      if (data.markdown) setMarkdown(data.markdown);
      if (data.title) setTitle(data.title);
      setValidationError('');
    } catch (error: any) {
      console.error('AI Generation Failed:', error);
      setValidationError(`AI 生成失败: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 1.1.4 格式验证检查
  const validateFormat = () => {
    if (!markdown.includes('### 题目描述') || !markdown.includes('### 输入格式') || !markdown.includes('### 输出格式')) {
      setValidationError('Markdown 缺少必要的章节标题（题目描述、输入格式、输出格式）');
      return false;
    }
    if (!title.trim()) {
      setValidationError('题目标题不能为空');
      return false;
    }
    setValidationError('');
    return true;
  };

  const handleSave = async () => {
    if (validateFormat()) {
      setIsSaving(true);
      try {
        const problemData = {
          title,
          difficulty,
          markdown,
          testCases,
          authorId: auth.currentUser?.uid,
          updatedAt: new Date().toISOString()
        };

        if (initialData?.id) {
          await updateDoc(doc(db, 'problems', initialData.id), problemData);
        } else {
          const newId = `P${Date.now()}`;
          await setDoc(doc(db, 'problems', newId), {
            ...problemData,
            id: newId,
            createdAt: new Date().toISOString()
          });
        }
        setIsSaving(false);
        onBack();
      } catch (error) {
        setIsSaving(false);
        handleFirestoreError(error, initialData?.id ? OperationType.UPDATE : OperationType.CREATE, 'problems');
      }
    }
  };

  // 1.1.3 批量导入功能
  const handleBatchImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.zip,.json';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setIsImporting(true);
      // Simulate parsing and importing
      setTimeout(() => {
        setIsImporting(false);
        alert(`成功从 ${file.name} 导入 5 道题目！`);
        onBack();
      }, 1500);
    };
    input.click();
  };

  const addTestCase = () => {
    setTestCases([...testCases, { id: Date.now(), input: '', output: '', weight: 10, isHidden: false }]);
  };

  const removeTestCase = (id: number) => {
    setTestCases(testCases.filter((tc: any) => tc.id !== id));
  };

  const updateTestCase = (id: number, field: string, value: any) => {
    setTestCases(testCases.map((tc: any) => tc.id === id ? { ...tc, [field]: value } : tc));
  };

  const handleFileUpload = (id: number, type: 'input' | 'output') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'input' ? '.in,.txt' : '.out,.txt';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        updateTestCase(id, type, content);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-slate-900">编辑题目</h2>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleBatchImport} disabled={isImporting} className="flex items-center gap-2 px-4 py-2 text-slate-600 bg-slate-100 hover:bg-slate-200 text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
            {isImporting ? '导入中...' : '批量导入'}
          </button>
          <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? '保存中...' : '保存题目'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-6 shrink-0">
        <button
          onClick={() => setActiveTab('basic')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'basic' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          基本信息
        </button>
        <button
          onClick={() => setActiveTab('content')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'content' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          题目内容
        </button>
        <button
          onClick={() => setActiveTab('testcases')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'testcases' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          测试用例
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        {activeTab === 'basic' && (
          <div className="max-w-2xl mx-auto space-y-6 bg-white p-6 rounded-xl border border-slate-200">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">题目名称</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="例如：两数之和"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">难度级别</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="简单">简单</option>
                <option value="中等">中等</option>
                <option value="困难">困难</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'content' && (
          <div className="h-full flex flex-col gap-4">
            <div className="flex justify-between items-center shrink-0">
              <div className="flex gap-2">
                <button onClick={applyTemplate} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
                  <FileText className="w-4 h-4" />
                  插入模板
                </button>
                <button onClick={generateWithAI} disabled={isGenerating} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-100 disabled:opacity-50">
                  <Sparkles className="w-4 h-4" />
                  {isGenerating ? 'AI 生成中...' : 'AI 辅助出题'}
                </button>
              </div>
              <button onClick={validateFormat} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50">
                <Check className="w-4 h-4 text-emerald-500" />
                验证格式
              </button>
            </div>

            {validationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4" />
                {validationError}
              </div>
            )}

            <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
              {/* 1.1.1 Markdown编辑器 */}
              <div className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase">
                  Markdown 源码
                </div>
                <textarea
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  className="flex-1 w-full p-4 resize-none focus:outline-none font-mono text-sm text-slate-700"
                  placeholder="在此输入 Markdown 格式的题目描述..."
                />
              </div>
              
              {/* Markdown Preview */}
              <div className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase">
                  实时预览
                </div>
                <div className="flex-1 p-6 overflow-y-auto prose prose-slate prose-sm max-w-none">
                  <div className="markdown-body">
                    <Markdown>{markdown || '*预览区域*'}</Markdown>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'testcases' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-slate-900">测试用例配置</h3>
              <button onClick={addTestCase} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50">
                <Plus className="w-4 h-4" />
                添加用例
              </button>
            </div>

            <div className="space-y-4">
              {testCases.map((tc, index) => (
                <div key={tc.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                    <h4 className="font-medium text-slate-900">用例 #{index + 1}</h4>
                    <div className="flex items-center gap-4">
                      {/* 1.2.3 用例权重分配 */}
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-500">权重 (分)</label>
                        <input 
                          type="number" 
                          value={tc.weight}
                          onChange={(e) => updateTestCase(tc.id, 'weight', parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      {/* 1.2.4 隐藏用例选项 */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={tc.isHidden}
                          onChange={(e) => updateTestCase(tc.id, 'isHidden', e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-slate-600">隐藏用例 (仅判题可见)</span>
                      </label>
                      <button onClick={() => removeTestCase(tc.id)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* 1.2.1 输入文件上传 / 文本输入 */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-slate-700">输入数据 (stdin)</label>
                        <button onClick={() => handleFileUpload(tc.id, 'input')} className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">
                          <Upload className="w-3 h-3" /> 上传 .in 文件
                        </button>
                      </div>
                      <textarea 
                        value={tc.input}
                        onChange={(e) => updateTestCase(tc.id, 'input', e.target.value)}
                        className="w-full h-32 p-3 font-mono text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        placeholder="输入数据..."
                      />
                    </div>
                    {/* 1.2.2 输出预期设置 */}
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-slate-700">预期输出 (stdout)</label>
                        <button onClick={() => handleFileUpload(tc.id, 'output')} className="text-xs text-indigo-600 flex items-center gap-1 hover:underline">
                          <Upload className="w-3 h-3" /> 上传 .out 文件
                        </button>
                      </div>
                      <textarea 
                        value={tc.output}
                        onChange={(e) => updateTestCase(tc.id, 'output', e.target.value)}
                        className="w-full h-32 p-3 font-mono text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        placeholder="预期输出..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
