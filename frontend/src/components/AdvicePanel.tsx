import { useState } from 'react'
import { ApiError, api, AssistantResponse } from '../api/client'
import { useToast } from './Toast'

interface Message {
  id: string
  sender: 'bot' | 'user'
  text: string
  response?: AssistantResponse
}

export function AdvicePanel({ token }: { token: string }) {
  const { showToast } = useToast()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm-init',
      sender: 'bot',
      text: '你好，我是职途智航助手。可以问我：如何补齐 Docker 缺口、本周优先做什么、或如何改项目摘要。',
    },
  ])
  const [inputVal, setInputVal] = useState('')
  const [consultationType, setConsultationType] = useState<'career' | 'policy'>('career')
  const [loading, setLoading] = useState(false)

  const handleSend = async (text: string) => {
    const q = text.trim()
    if (!q || loading) return

    const userMsg: Message = { id: `u-${Date.now()}`, sender: 'user', text: q }
    setMessages((prev) => [...prev, userMsg])
    setInputVal('')
    setLoading(true)
    try {
      const response = await api.queryAssistant(token, consultationType, q)
      setMessages((prev) => [
        ...prev,
        { id: `b-${Date.now()}`, sender: 'bot', text: response.answer, response },
      ])
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        showToast('会话已失效', '请退出后重新选择角色进入。', 'warning')
      } else {
        showToast('咨询暂时不可用', error instanceof ApiError ? error.message : '请稍后重试。', 'warning')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleHumanHandoff = () => {
    showToast('建议转人工', '请联系授权就业指导教师进一步确认；当前页面不会伪造提交状态。', 'info')
    setMessages((prev) => [
      ...prev,
      {
        id: `b-handoff-${Date.now()}`,
        sender: 'bot',
        text: '建议联系授权就业指导教师确认。教师仅应看到脱敏摘要，不会看到完整隐私字段。',
      },
    ])
  }

  return (
    <section data-panel="consult">
      <div className="page-head">
        <div>
          <h1>就业咨询</h1>
          <p className="desc">智能建议基于画像与推荐上下文。复杂问题可转人工教师。</p>
        </div>
      </div>

      <div className="consult-layout">
        <div className="panel">
          <h3 className="panel-title">对话</h3>
          <div className="segmented" role="group" aria-label="咨询类型">
            <button
              type="button"
              className={consultationType === 'career' ? 'is-active' : ''}
              onClick={() => setConsultationType('career')}
              disabled={loading}
            >
              职业准备
            </button>
            <button
              type="button"
              className={consultationType === 'policy' ? 'is-active' : ''}
              onClick={() => setConsultationType('policy')}
              disabled={loading}
            >
              就业政策
            </button>
          </div>
          <div className="chat-box" id="chat-box">
            {messages.map((m) => (
              <div key={m.id}>
                <div className={`bubble ${m.sender}`}>
                  {m.text}
                </div>
                {m.response && (
                  <div className="chat-meta">
                    <span>{m.response.mode === 'sf_fastgpt' ? 'SF-FastGPT' : '模拟模式'}</span>
                    {m.response.handoff_recommended && <span>建议人工确认</span>}
                    {m.response.sources.map((source) =>
                      source.url ? (
                        <a key={`${m.id}-${source.title}`} href={source.url} target="_blank" rel="noreferrer">
                          来源：{source.title}
                        </a>
                      ) : (
                        <span key={`${m.id}-${source.title}`}>来源：{source.title}</span>
                      )
                    )}
                    <small>{m.response.disclaimer}</small>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="chat-input-row">
            <input
              id="chat-input"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleSend(inputVal)
                }
              }}
              placeholder="输入你的问题…"
            />
            <button
              type="button"
              className="btn btn-primary"
              id="btn-chat-send"
              onClick={() => void handleSend(inputVal)}
              disabled={loading}
            >
              {loading ? '查询中…' : '发送'}
            </button>
          </div>

          <div className="alert alert-warning" style={{ marginTop: '12px' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 4.3 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
            </svg>
            <div className="alert-body">
              <div className="alert-title">需要人工时</div>
              涉及简历原文批改、心理压力或政策认定，请转教师。
              <div className="alert-actions" style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-warn"
                  id="btn-human"
                  onClick={handleHumanHandoff}
                >
                  转人工教师
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <h3 className="panel-title">建议上下文</h3>
            <dl className="kv">
              <dt>画像</dt>
              <dd>已保存 · 软件工程</dd>
              <dt>推荐</dt>
              <dd>3 条未过期岗位</dd>
              <dt>计划</dt>
              <dd>3 项任务</dd>
            </dl>
          </div>

          <div className="panel">
            <h3 className="panel-title">快捷问题</h3>
            <div className="stack" style={{ gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void handleSend('本周我应该优先补哪个缺口？')}
                disabled={loading}
              >
                本周优先缺口？
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void handleSend('项目摘要怎么写更匹配目标岗位？')}
                disabled={loading}
              >
                项目摘要怎么写？
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void handleSend('本地岗位投递顺序怎么排？')}
                disabled={loading}
              >
                投递顺序？
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
