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
      text: '你好，我是职途智航助手。支持咨询技术技能准备（如“如何补齐 Docker 缺口”、项目与简历准备）与高校毕业生就业政策。智能建议仅供准备参考，不构成录用、资格或期限承诺；涉及关键决策、资格认定或疑难诉求，请通过下方【转人工教师】入口联系老师确认。',
    },
  ])
  const [inputVal, setInputVal] = useState('')
  const [consultationType, setConsultationType] = useState<'career' | 'policy'>('career')
  const [loading, setLoading] = useState(false)

  const createMessageId = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const handleSend = async (text: string) => {
    const q = text.trim()
    if (!q || loading) return

    const userMsg: Message = { id: createMessageId('u'), sender: 'user', text: q }
    setMessages((prev) => [...prev, userMsg])
    setInputVal('')
    setLoading(true)
    try {
      const response = await api.queryAssistant(token, consultationType, q)
      setMessages((prev) => [
        ...prev,
        { id: createMessageId('b'), sender: 'bot', text: response.answer, response },
      ])
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        showToast('会话已失效', '请退出后重新选择角色进入。', 'warning')
      } else {
        const errorMsg = error instanceof ApiError ? error.message : '请稍后重试。'
        showToast('咨询服务暂不可用', errorMsg, 'warning')
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId('b-err'),
            sender: 'bot',
            text: '智能咨询服务暂不可用（服务连接异常或上游无响应）。涉及求职技能准备或政策咨询，请通过下方【转人工教师】联系就业指导老师人工确认。',
            response: {
              answer: '智能咨询服务暂不可用（服务连接异常或上游无响应）。涉及求职技能准备或政策咨询，请通过下方【转人工教师】联系就业指导老师人工确认。',
              sources: [],
              disclaimer: '服务连接异常，已转为人工指引。',
              handoff_recommended: true,
              mode: 'unavailable',
            },
          },
        ])
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
        id: createMessageId('b-handoff'),
        sender: 'bot',
        text: '建议联系授权就业指导教师确认。教师仅应看到脱敏摘要，不会看到完整隐私字段。',
      },
    ])
  }

  const renderModeTag = (mode?: string) => {
    if (!mode) return null
    if (mode === 'sf_fastgpt') {
      return <span className="mode-tag mode-sf">SF-FastGPT</span>
    }
    if (mode === 'unavailable') {
      return <span className="mode-tag mode-unavailable">服务暂不可用</span>
    }
    if (mode === 'mock') {
      return <span className="mode-tag mode-mock">模拟模式</span>
    }
    return <span className="mode-tag">{mode}</span>
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
                    {renderModeTag(m.response.mode)}
                    {m.response.handoff_recommended && (
                      <span className="mode-tag mode-handoff">建议人工确认</span>
                    )}
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
                {m.response?.mode === 'unavailable' && (
                  <div className="chat-unavailable-notice">
                    <span>提示：上游服务异常或暂不可用，建议转人工教师核实。</span>
                    <button
                      type="button"
                      className="btn btn-warn btn-sm"
                      onClick={handleHumanHandoff}
                    >
                      转人工教师
                    </button>
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
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void handleSend(inputVal)
                }
              }}
              placeholder={
                consultationType === 'career'
                  ? '输入职业技能或求职准备问题（如“如何补齐 Docker 缺口”、“什么是 Docker”）…'
                  : '输入高校毕业生就业政策或办事咨询问题…'
              }
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
              {consultationType === 'career' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void handleSend('如何补齐 Docker 缺口？')}
                    disabled={loading}
                  >
                    如何补齐 Docker 缺口？
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void handleSend('什么是 Docker？')}
                    disabled={loading}
                  >
                    什么是 Docker？
                  </button>
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
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void handleSend('校内就业指导服务的咨询渠道有哪些？')}
                    disabled={loading}
                  >
                    校内咨询渠道有哪些？
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void handleSend('高校毕业生就业办事与档案去向如何办理？')}
                    disabled={loading}
                  >
                    办事与档案去向？
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void handleSend('基层就业项目与求职补贴政策有哪些？')}
                    disabled={loading}
                  >
                    基层项目与补贴政策？
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void handleSend('如何核验求职与招聘风险防范？')}
                    disabled={loading}
                  >
                    求职风险防范？
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
