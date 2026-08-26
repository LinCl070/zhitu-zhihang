import { useState } from 'react'
import { useToast } from './Toast'

interface Message {
  id: string
  sender: 'bot' | 'user'
  text: string
}

export function AdvicePanel() {
  const { showToast } = useToast()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm-init',
      sender: 'bot',
      text: '你好，我是职途智航助手。可以问我：如何补齐 Docker 缺口、本周优先做什么、或如何改项目摘要。',
    },
  ])
  const [inputVal, setInputVal] = useState('')

  const handleSend = (text: string) => {
    const q = text.trim()
    if (!q) return

    const userMsg: Message = { id: `u-${Date.now()}`, sender: 'user', text: q }
    setMessages((prev) => [...prev, userMsg])
    setInputVal('')

    setTimeout(() => {
      let reply = '建议本周优先补齐 Redis/Docker 中更贴近目标岗的一项，并在项目摘要中写清你做过的接口与状态流转。投递时先本地后端实习，再扩到同城 Java 助理岗。'
      if (q.includes('摘要') || q.includes('项目')) {
        reply = '项目摘要可按「场景 → 职责 → 技术 → 结果」四句写，避免堆砌课程名；鉴权与状态机是后端实习官的加分点。'
      } else if (q.includes('投递') || q.includes('顺序')) {
        reply = '顺序建议：匹配分 ≥80 的本地后端实习 → 同城 Java 助理 → 可迁移测试岗作为保底体验。'
      }

      setMessages((prev) => [...prev, { id: `b-${Date.now()}`, sender: 'bot', text: reply }])
    }, 350)
  }

  const handleHumanHandoff = () => {
    showToast('已申请转人工', '将在授权教师工作台生成待回复摘要（演示）。', 'info')
    setMessages((prev) => [
      ...prev,
      {
        id: `b-handoff-${Date.now()}`,
        sender: 'bot',
        text: '已记录转人工请求。教师仅会看到脱敏摘要与你的问题概要，不会看到完整隐私字段。',
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
          <div className="chat-box" id="chat-box">
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.sender}`}>
                {m.text}
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
                  handleSend(inputVal)
                }
              }}
              placeholder="输入你的问题…"
            />
            <button
              type="button"
              className="btn btn-primary"
              id="btn-chat-send"
              onClick={() => handleSend(inputVal)}
            >
              发送
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
                onClick={() => handleSend('本周我应该优先补哪个缺口？')}
              >
                本周优先缺口？
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSend('项目摘要怎么写更匹配后端实习？')}
              >
                项目摘要怎么写？
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSend('本地后端实习投递顺序怎么排？')}
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
