import { FileText, Sparkles } from 'lucide-react'
import { StrategyReport } from '../../api/client'
import { scenarioLabel } from './labels'

export function StrategyReportView({ report }: { report: StrategyReport }) {
  return (
    <div className="strategy-report">
      <div className="panel">
        <h3 className="panel-title">
          <FileText size={16} />
          策略对比结论
        </h3>
        <ol className="report-ranking">
          {report.ranking.map((item, index) => (
            <li key={item.scenario}>
              <span className="rank-num">{index + 1}</span>
              <span className="rank-label">{item.label || scenarioLabel(item.scenario)}</span>
              <span className="rank-value">{Math.round(item.matched_rate * 100)}%</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="panel">
        <h3 className="panel-title">发现</h3>
        <ul className="report-findings">
          {report.findings.map((finding, index) => (
            <li key={index}>{finding}</li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h3 className="panel-title">建议</h3>
        <p className="report-recommendation">{report.recommendation}</p>
      </div>

      {report.ai_narrative && (
        <div className="panel ai-narrative">
          <h3 className="panel-title">
            <Sparkles size={16} />
            AI 解读
          </h3>
          <p>{report.ai_narrative}</p>
          {report.requires_review && <div className="review-badge">AI 解读，需人工审核</div>}
        </div>
      )}

      <div className="panel">
        <h3 className="panel-title">免责说明</h3>
        <ul className="report-caveats">
          {report.caveats.map((caveat, index) => (
            <li key={index}>{caveat}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
