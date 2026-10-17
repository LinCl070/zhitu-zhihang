// Defense deck for 中国仿真创新应用大赛 · 智能社会治理赛道 (plan: docs/specs/defense-ppt-revision-plan.md).
// Every simulation number is read from docs/deliverables/simulation-sensitivity.json.
import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspace = "D:/基于大模型的教育管理应用创新赛";
const outPath = path.join(workspace, "output/pptx/职途智航-仿真大赛答辩.pptx");
const previewDir = path.join(workspace, ".ppt-build/defense-previews");
const fig = (name) => path.join(workspace, "docs/deliverables/figures", name);
const shotPath = (name) => path.join(workspace, "output/playwright/governance", name);
await fs.mkdir(previewDir, { recursive: true });

const data = JSON.parse(await fs.readFile(path.join(workspace, "docs/deliverables/simulation-sensitivity.json"), "utf8"));
const S = data.four_scenarios;
const P = data.base_params;
const week0 = S.baseline.weekly[0];
const pct = (v) => `${v.mean.toFixed(1)}%`;
const ci = (v) => `${v.ci_low.toFixed(1)}–${v.ci_high.toFixed(1)}`;
const num = (v) => v.mean.toFixed(1);
const pp = (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;
const supply = data.sweeps.supply_ratio;

const FONT = "Microsoft YaHei";
const NAVY = "#173568", BLUE = "#2457D6", CYAN = "#13A6C6", GREEN = "#16836D";
const ORANGE = "#E18B2C", RED = "#C94D5C", LIGHT = "#EEF4FF", PALE = "#F6F9FF";
const TEXT = "#24344E", MUTED = "#60718A", BORDER = "#D9E4F5";
const NONE_LINE = { style: "solid", fill: "none", width: 0 };
const EVENT = "中国仿真创新应用大赛";
const TRACK = "智能社会治理赛道";
const FOOTNOTE = "结果基于合成群体与规则模型，用于策略相对比较，不代表真实就业预测";

const p = Presentation.create({ slideSize: { width: 1280, height: 720 } });
const notes = [];

function box(slide, x, y, w, h, text, opts = {}) {
  const shape = slide.shapes.add({
    geometry: opts.geometry ?? "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: opts.fill ?? "none",
    line: opts.line ?? NONE_LINE,
    borderRadius: opts.borderRadius,
  });
  shape.text = text;
  shape.text.style = {
    typeface: FONT, fontSize: opts.size ?? 20, bold: opts.bold ?? false, color: opts.color ?? TEXT,
    alignment: opts.align ?? "left", verticalAlignment: opts.valign ?? "top",
    autoFit: "shrinkText", wrap: "square", lineSpacing: opts.lineSpacing ?? 1.15,
    insets: opts.insets ?? { left: 8, right: 8, top: 6, bottom: 6 },
  };
  return shape;
}

const card = (slide, x, y, w, h, text, opts = {}) => box(slide, x, y, w, h, text, {
  geometry: "roundRect", fill: opts.fill ?? PALE, borderRadius: 6,
  line: { style: "solid", fill: opts.border ?? BORDER, width: 1.2 }, valign: "middle", ...opts,
});

const label = (slide, x, y, w, text, color = BLUE, h = 34) => box(slide, x, y, w, h, text, {
  geometry: "roundRect", fill: color, color: "#FFFFFF", size: 17, bold: true, align: "center",
  valign: "middle", borderRadius: 6, insets: { left: 4, right: 4, top: 0, bottom: 0 },
});

function bullets(slide, x, y, w, h, items, opts = {}) {
  const shape = box(slide, x, y, w, h, "", opts);
  shape.text.set(items.map((t) => ({ bulletCharacter: "•", marginLeft: 22 * 12700, indent: -11 * 12700, spaceAfter: 700, runs: [t] })));
  shape.text.style = { typeface: FONT, fontSize: opts.size ?? 19, color: opts.color ?? TEXT, verticalAlignment: "top", autoFit: "shrinkText", lineSpacing: 1.15, insets: { left: 10, right: 10, top: 8, bottom: 8 } };
  return shape;
}

function connector(slide, from, to, fromSide = "right", toSide = "left", color = "#7D91B3") {
  const link = slide.shapes.connect(from, to, { kind: "straight", fromSide, toSide, line: { style: "solid", fill: color, width: 2 }, tail: { type: "arrow", width: "med", length: "med" } });
  link.bringToFront();
  return link;
}

async function image(slide, file, x, y, w, h, alt, opts = {}) {
  const blob = await fs.readFile(file);
  return slide.images.add({ blob, contentType: "image/png", alt, fit: opts.fit ?? "contain", crop: opts.crop, geometry: opts.geometry, borderRadius: opts.borderRadius, position: { left: x, top: y, width: w, height: h } });
}

// Content page: navy header band with event/track, title row, footer with page number.
function page(titleText, part, note, opts = {}) {
  const slide = p.slides.add();
  slide.background.fill = "#FFFFFF";
  slide.shapes.add({ geometry: "rect", position: { left: 0, top: 0, width: 1280, height: 46 }, fill: { type: "gradient", angleDeg: 0, stops: [{ offset: 0, color: NAVY }, { offset: 100000, color: BLUE }] }, line: NONE_LINE });
  box(slide, 28, 0, 400, 46, "职途智航 · 高校毕业生就业治理智能体", { size: 15, bold: true, color: "#FFFFFF", valign: "middle" });
  box(slide, 820, 0, 432, 46, `${EVENT} · ${TRACK}`, { size: 14, color: "#DCE6FF", align: "right", valign: "middle" });
  box(slide, 56, 62, 960, 52, titleText, { size: 30, bold: true, color: NAVY, valign: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  if (part) box(slide, 1040, 70, 184, 36, part, { size: 16, bold: true, color: BLUE, align: "right", valign: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  slide.shapes.add({ geometry: "line", position: { left: 56, top: 118, width: 1168, height: 0 }, fill: "none", line: { style: "solid", fill: BORDER, width: 1 } });
  const index = p.slides.items.length;
  box(slide, 1150, 688, 100, 26, opts.pageLabel ?? String(index), { size: 12, color: MUTED, align: "right", valign: "middle" });
  if (opts.footnote) box(slide, 56, 688, 900, 26, `注：${FOOTNOTE}`, { size: 12, color: MUTED, valign: "middle" });
  notes.push(note);
  return slide;
}

// 1. Cover.
{
  const s = p.slides.add();
  s.background.fill = { type: "gradient", angleDeg: 120, stops: [{ offset: 0, color: "#10275A" }, { offset: 100000, color: BLUE }] };
  box(s, 60, 40, 700, 36, `${EVENT}  ·  ${TRACK}`, { size: 18, bold: true, color: "#DCE6FF", valign: "middle" });
  box(s, 140, 210, 1000, 100, "职途智航", { size: 66, bold: true, color: "#FFFFFF", align: "center", valign: "middle" });
  box(s, 140, 318, 1000, 56, "高校毕业生就业治理智能体", { size: 32, bold: true, color: "#FFFFFF", align: "center", valign: "middle" });
  box(s, 140, 382, 1000, 40, "可解释风险预警 · 多智能体仿真推演 · 人工决策闭环", { size: 20, color: "#C9D8FF", align: "center", valign: "middle" });
  s.shapes.add({ geometry: "line", position: { left: 490, top: 446, width: 300, height: 0 }, fill: "none", line: { style: "solid", fill: "#7FA2F0", width: 1.5 } });
  box(s, 140, 466, 1000, 70, "参赛队：哗啦啦的陶喆\n成都信息工程大学", { size: 20, bold: true, color: "#FFFFFF", align: "center", valign: "middle", lineSpacing: 1.4 });
  notes.push("（0:15）各位评委好，我们的作品是职途智航——高校毕业生就业治理智能体，参加智能社会治理赛道。");
}

// 2. Contents.
{
  const s = page("目录", "CONTENTS", "（0:05）汇报分五部分，其中第四部分现场演示系统。");
  const parts = [["01", "团队与问题"], ["02", "模型设计"], ["03", "仿真实验"], ["04", "系统演示"], ["05", "创新与总结"]];
  parts.forEach(([n, t], i) => {
    const x = 92 + i * 224;
    box(s, x, 250, 180, 90, n, { size: 54, bold: true, color: i === 3 ? CYAN : BLUE, align: "center", valign: "middle" });
    s.shapes.add({ geometry: "line", position: { left: x + 40, top: 350, width: 100, height: 0 }, fill: "none", line: { style: "solid", fill: i === 3 ? CYAN : BLUE, width: 3 } });
    box(s, x, 366, 180, 50, t, { size: 23, bold: true, color: NAVY, align: "center", valign: "middle" });
  });
  card(s, 240, 500, 800, 60, "主线：问题 → 模型 → 证据 → 价值", { size: 21, bold: true, color: NAVY, align: "center", fill: LIGHT });
}

// 3. Team.
{
  const s = page("团队介绍", "PART 01", "（0:10）程林负责全部开发与仿真建模，李耀老师把关就业业务逻辑。");
  const members = [
    ["01", "程林", "队长 · 开发与建模负责人", "成都信息工程大学\n空间信息与数字技术 · 2024级\n负责需求、全栈开发、风险模型、ABM 仿真引擎与实验设计", BLUE],
    ["02", "李耀", "指导教师", "成都信息工程大学\n就业指导与项目指导\n负责就业业务边界、治理场景与成果呈现指导", CYAN],
  ];
  members.forEach(([n, name, role, desc, color], i) => {
    const x = i === 0 ? 150 : 690;
    box(s, x, 190, 76, 76, n, { geometry: "ellipse", fill: color, color: "#FFFFFF", size: 25, bold: true, align: "center", valign: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } });
    box(s, x + 100, 188, 320, 46, name, { size: 28, bold: true, color: NAVY, valign: "middle" });
    box(s, x + 100, 236, 320, 32, role, { size: 18, bold: true, color, valign: "middle" });
    card(s, x, 300, 440, 170, desc, { size: 19, lineSpacing: 1.35, insets: { left: 18, right: 18, top: 10, bottom: 10 } });
  });
  card(s, 150, 530, 980, 60, "分工特点：一人完成全栈开发与仿真建模，指导教师把关就业治理业务与展示表达", { size: 20, bold: true, color: NAVY, align: "center", fill: LIGHT });
}

// 4. Governance problem.
{
  const s = page("治理问题：从服务个体到治理群体", "PART 01", "（0:30）稳就业是民生重点。学校层面的真问题是三问：资源投向谁、怎么投、投了有没有用。经验管理回答不了，而且要守住公平、隐私、可解释三条底线。");
  label(s, 70, 140, 340, "政策背景", NAVY);
  bullets(s, 70, 186, 340, 290, [
    "《“十四五”就业促进规划》将高校毕业生列为青年就业重点群体",
    "教育部每年部署毕业生就业创业促进行动，要求健全指导服务、加强精准帮扶",
    "前期“职途智航”已解决学生个体“如何准备”，学校层面缺少量化治理工具",
  ], { size: 18, fill: PALE, line: { style: "solid", fill: BORDER, width: 1 } });
  label(s, 460, 140, 750, "治理三问", BLUE);
  const qs = [
    ["投向谁？", "风险识别依赖教师主观判断，缺少统一、可解释的分级口径", "可解释风险预警"],
    ["怎么投？", "培训、帮扶、岗位推送的效果只能事后统计，投入前无法比较", "多智能体仿真推演"],
    ["有没有用？", "随机波动容易被当成策略效果，结论缺少统计依据", "置信区间 + 模型检验"],
  ];
  qs.forEach(([q, pain, ans], i) => {
    const y = 190 + i * 96;
    const a = card(s, 460, y, 150, 74, q, { size: 21, bold: true, color: NAVY, align: "center", fill: LIGHT });
    const b = card(s, 630, y, 360, 74, pain, { size: 16 });
    const c = card(s, 1010, y, 200, 74, ans, { size: 17, bold: true, color: GREEN, align: "center", fill: "#EAF8F2", border: "#A8D7C2" });
    connector(s, b, c);
  });
  label(s, 70, 510, 1140, "约束：公平（不用受保护属性） · 隐私（最小数据、小样本抑制） · 可解释（每一分可追溯） · 人工决策", ORANGE, 44);
}

// 5. Positioning and loop.
{
  const s = page("作品定位与治理闭环", "PART 01", "（0:20）在已运行的就业服务系统上，新增预警、画像、仿真、报告四个治理模块，形成六环节闭环。原则是模型辅助、人工决策。");
  await image(s, fig("fig1-architecture.png"), 56, 132, 760, 416, "就业治理智能体总体架构与治理闭环");
  label(s, 850, 140, 374, "三类角色在闭环中的位置", NAVY);
  const roles = [
    ["学生", "职业画像 · 岗位匹配 · 行动计划（原有功能）", BLUE],
    ["就业指导教师", "风险预警：按风险排序授权学生，逐因子拆解并给出干预", CYAN],
    ["就业管理员", "群体画像 · 策略仿真 · 策略报告 · 采纳留痕", GREEN],
  ];
  roles.forEach(([r, d, color], i) => {
    const y = 192 + i * 118;
    label(s, 850, y, 374, r, color);
    card(s, 850, y + 40, 374, 66, d, { size: 16 });
  });
  card(s, 56, 576, 1168, 56, "模型辅助、人工决策：采纳只写审计，系统不自动给学生发消息或修改计划", { size: 19, bold: true, color: NAVY, align: "center", fill: LIGHT });
}

// Native table with a navy header row.
function table(slide, x, y, w, h, values, tracks, opts = {}) {
  const t = slide.tables.add({
    rows: values.length, columns: values[0].length, left: x, top: y, width: w, height: h, values,
    columnTracks: tracks.map((v) => ({ mode: "fr", value: v })),
  });
  t.borders.assign({ style: "solid", fill: BORDER, width: 1 });
  t.cells.block({ row: 0, column: 0, rowCount: values.length, columnCount: values[0].length })
    .assign({ fill: "#FFFFFF", textStyle: { typeface: FONT, fontSize: opts.size ?? 15, color: TEXT }, anchor: "middle" });
  t.cells.block({ row: 0, column: 0, rowCount: 1, columnCount: values[0].length })
    .assign({ fill: NAVY, textStyle: { typeface: FONT, fontSize: opts.size ?? 15, color: "#FFFFFF", bold: true } });
  for (const [r, color] of opts.highlightRows ?? []) {
    t.cells.block({ row: r, column: 0, rowCount: 1, columnCount: values[0].length }).assign({ fill: color });
  }
  return t;
}

// 6. Architecture and division of labour.
{
  const s = page("系统架构与职责分工", "PART 02", "（0:25）前后端分离，业务数据留在 PostgreSQL。治理三个模块都在后端：风险模型、仿真引擎、报告生成器。四方分工：规则算分、ABM 推演、大模型只解读、人做决定。");
  const layers = [
    ["前端", "React + TypeScript：学生 / 教师 / 管理员三端；SVG 图表，无第三方图表库", LIGHT, "#A8BFE9"],
    ["后端", "FastAPI：认证授权 · 岗位匹配 · 风险模型 · ABM 仿真引擎 · 确定性报告生成器 · 审计", "#EAF8F7", "#9ACFC8"],
    ["数据", "PostgreSQL + Alembic：业务表 + simulation_runs（参数、种子、模型版本、结果）", PALE, BORDER],
    ["大模型", "SF-FastGPT：知识问答与报告文字解读，服务端调用，不直接访问业务库", "#FFF6E8", "#F0C47D"],
  ];
  layers.forEach(([name, desc, fill, border], i) => {
    const y = 140 + i * 78;
    label(s, 56, y + 12, 110, name, i === 3 ? ORANGE : i === 1 ? GREEN : BLUE);
    card(s, 182, y, 560, 62, desc, { size: 16, fill, border });
  });
  label(s, 790, 140, 434, "四方分工", NAVY);
  const roles = [
    ["确定性规则", "岗位匹配与风险分，每一分可追溯", BLUE],
    ["ABM 仿真", "投入前推演策略效果，输出置信区间", CYAN],
    ["大模型", "只解读确定性报告，不产生任何数字", ORANGE],
    ["人工", "教师复核个体，管理员采纳策略", GREEN],
  ];
  roles.forEach(([r, d, color], i) => {
    const y = 190 + i * 74;
    box(s, 790, y, 130, 60, r, { geometry: "roundRect", fill: color, color: "#FFFFFF", size: 17, bold: true, align: "center", valign: "middle", borderRadius: 6 });
    card(s, 930, y, 294, 60, d, { size: 15 });
  });
  card(s, 56, 476, 1168, 120, "", { fill: "#FFFFFF" });
  const flow = ["感知\n群体画像", "预警\n风险模型", "推演\nABM 仿真", "建议\n确定性报告", "确认\n人工采纳", "反馈\n指导意见回流"];
  let prev;
  flow.forEach((t, i) => {
    const b = card(s, 82 + i * 192, 494, 150, 84, t, { size: 17, bold: true, color: NAVY, align: "center", fill: i % 2 ? "#EAF8F7" : LIGHT });
    if (prev) connector(s, prev, b);
    prev = b;
  });
}

// 7. Risk model.
{
  const s = page("可解释就业准备度风险模型", "PART 02", "（0:30）风险分是六个因子相加，满分 100。每个非零因子对应一条原因和一条干预。输入在结构上不含性别、籍贯等受保护属性，也不含学号和联系方式。");
  box(s, 56, 128, 1168, 40, "R = F画像 + F匹配 + F缺口 + F阶段 + F计划 + F时效 ，R ∈ [0, 100]      高风险 R ≥ 60 · 中风险 35 ≤ R < 60 · 低风险 R < 35", { size: 18, bold: true, color: NAVY, valign: "middle" });
  table(s, 56, 176, 820, 430, [
    ["因子", "满分", "计分规则", "对应干预"],
    ["画像完整度", "25", "无画像 25；技能 < 3 项或无项目 10", "提醒完善职业画像"],
    ["岗位匹配", "25", "最高匹配分 ≥ 70 为 0；50–69 为 12；< 50 为 25", "组织岗位方向咨询"],
    ["技能缺口", "15", "min(15, 5 × 最佳岗位缺口技能数)", "推荐技能补强资源"],
    ["求职阶段", "20", "探索期且距毕业 ≤ 12 月 20；准备期且 ≤ 6 月 12", "安排一对一生涯面谈"],
    ["行动计划", "10", "尚未生成行动计划 10", "督促生成行动计划"],
    ["画像时效", "5", "超过 30 天未更新 5", "跟进近况"],
  ], [1.1, 0.6, 3, 1.6], { size: 15 });
  label(s, 904, 176, 320, "设计约束", NAVY);
  bullets(s, 904, 220, 320, 250, [
    "纯函数：相同输入必得相同分数",
    "输入不含性别、籍贯、家庭、健康、民族、政治面貌",
    "接口不返回学号与联系方式",
    "页面标注“仅辅助指导，不作评价或处分依据”",
  ], { size: 16, fill: PALE, line: { style: "solid", fill: BORDER, width: 1 } });
  card(s, 904, 490, 320, 116, "同一模型两处使用\n教师预警看板 + 仿真中每名合成学生每周的风险更新", { size: 16, bold: true, color: GREEN, align: "center", fill: "#EAF8F2", border: "#A8D7C2" });
}

// 8. Same-source modelling.
{
  const s = page("业务与仿真同源", "PART 02", "（0:20）仿真里的合成学生直接调用线上的匹配规则和风险模型。我们用 500 组随机样本做等价性测试，仿真评分器和业务评分器逐分一致。所以仿真里的“达标”“高风险”和教师看到的是同一口径。");
  const biz = card(s, 70, 150, 470, 250, "", { fill: LIGHT, border: "#A8BFE9" });
  label(s, 90, 166, 430, "线上业务系统", BLUE);
  bullets(s, 90, 210, 430, 180, ["MatchingService：五维岗位匹配", "风险模型：六因子加和", "教师看板与管理员画像使用"], { size: 18 });
  const sim = card(s, 740, 150, 470, 250, "", { fill: "#EAF8F7", border: "#9ACFC8" });
  label(s, 760, 166, 430, "ABM 仿真引擎", CYAN);
  bullets(s, 760, 210, 430, 180, ["FastScorer：仿真高速评分器", "直接调用同一风险模型", "每名合成学生每周更新最佳匹配与风险"], { size: 18 });
  connector(s, biz, sim, "right", "left", GREEN);
  box(s, 548, 236, 184, 70, "500 组随机样本\n逐分一致", { size: 17, bold: true, color: GREEN, align: "center", valign: "middle" });
  box(s, 70, 430, 1140, 44, "S = 50·(命中技能/要求技能) + 20·[专业符合] + 15·(命中项目信号/项目信号数) + 5·[城市一致] + 10·[目标岗位相关]", { size: 18, bold: true, color: NAVY, align: "center", valign: "middle", fill: PALE, geometry: "roundRect", borderRadius: 6 });
  card(s, 70, 500, 1140, 96, "意义：避免“仿真一套、业务一套”。仿真得出的“准备达标”“高风险”与教师在系统中看到的指标同一口径，推演结论可以直接对应到业务动作。", { size: 19, color: TEXT, align: "center" });
}

// 9. ABM agents and weekly loop.
{
  const s = page("多智能体仿真模型：主体与周推进", "PART 02", "（0:30）三类主体：学生、教师、岗位市场。学生有主动性、学习率、城市弹性三个异质参数。每周按固定五步推进，所有随机性由种子派生，城市可见性和行动判定用独立随机流。");
  const agents = [
    ["学生智能体", `专业、技能 2–5 项、项目、目标岗位/城市\n学习率 λ ~ U(0.15, 0.45)\n主动性 θ ~ U(0.3, 0.9)\n城市弹性 φ ~ U(0, 1)\n初始阶段 探索 50% · 准备 35% · 求职 15%`, BLUE],
    ["教师", `每周可用会谈 C = 教师数 × 每周会谈数\n默认 ${P.counselor_count} × ${P.sessions_per_week}；被服务者 θ + 0.15`, CYAN],
    ["岗位市场", `已发布岗位模板，覆盖多城市与专业\n容量 ⌈N · ρ / M⌉，默认 ρ = ${P.supply_ratio}`, GREEN],
  ];
  let y = 132;
  agents.forEach(([name, desc, color], i) => {
    const h = i === 0 ? 186 : 104;
    label(s, 56, y, 430, name, color);
    card(s, 56, y + 38, 430, h - 40, desc, { size: 15, lineSpacing: 1.3 });
    y += h + 14;
  });
  await image(s, fig("fig2-weekly-flow.png"), 512, 132, 712, 300, "仿真模型的周推进流程");
  const steps = [
    ["① 教师服务", "按策略选学生，已匹配者不占会谈"],
    ["② 学生行动", "以概率 θ 行动，按 λ 习得首个缺口技能"],
    ["③ 投递匹配", "向可见且有容量的前 3 岗投递，≥ 60 分达成"],
    ["④ 城市可见", "以概率 φ 看全城岗位（独立随机流）"],
    ["⑤ 时间推进", "距毕业 −0.25 月，调用业务风险模型更新"],
  ];
  steps.forEach(([t, d], i) => {
    const yy = 446 + i * 46;
    box(s, 512, yy, 130, 40, t, { size: 16, bold: true, color: NAVY, valign: "middle" });
    box(s, 646, yy, 578, 40, d, { size: 15, valign: "middle", fill: PALE, geometry: "roundRect", borderRadius: 5 });
  });
}

// 10. Strategies and metrics.
{
  const s = page("治理策略与输出指标", "PART 02", "（0:20）每种策略只改动模型中的一条规则，这样策略之间的差异可以归因。输出六项指标，与业务系统同口径。");
  label(s, 56, 132, 640, "表 2  治理策略：对模型规则的最小改动", NAVY);
  table(s, 56, 172, 640, 400, [
    ["场景", "策略含义", "对模型的改动"],
    ["现状基线", "维持现有工作方式", "教师每周随机选择学生服务"],
    ["技能补强培训", "面向缺口最大的学生开设培训", "缺口最多的前 30% 学生学习率 +0.2"],
    ["精准帮扶", "依据风险预警分配教师时间", "教师每周按风险分从高到低服务"],
    ["岗位精准推送", "跨城市推送匹配岗位", "所有学生每周可见全部城市岗位"],
    ["组合策略", "三项措施同时实施", "以上三项改动同时生效"],
  ], [1.1, 1.5, 2], { size: 15 });
  label(s, 726, 132, 498, "表 3  输出指标", NAVY);
  table(s, 726, 172, 498, 400, [
    ["指标", "定义"],
    ["就业准备达标率", "最佳匹配分 ≥ 60 的学生占比"],
    ["岗位匹配达成率", "已达成岗位匹配的学生占比"],
    ["高风险人数", "风险等级为高的学生人数"],
    ["平均技能缺口", "最佳匹配岗位的平均缺口技能数"],
    ["教师工时占用率", "实际服务次数 / 可用会谈数"],
    ["技能供需缺口", "容量加权技能需求 − 终点掌握人数"],
  ], [1, 1.6], { size: 15 });
  card(s, 56, 596, 1168, 48, "每种策略只改一条规则 → 策略间差异可以归因到策略本身", { size: 18, bold: true, color: NAVY, align: "center", fill: LIGHT });
}

// 11. Experiment design and V&V.
{
  const s = page("实验设计与模型检验", "PART 03", "（0:30）默认 300 人、16 周、每个策略重复 10 次。用共同随机数让各策略面对同一批学生；报告 95% 置信区间，区间不重叠才说显著。模型检验六项全部做成自动化测试，每次改代码都会重跑。");
  label(s, 56, 132, 470, "实验设计", NAVY);
  const design = [
    ["默认情景", `${P.cohort_size} 人 × ${P.weeks} 周 × ${P.replications} 次重复；距毕业 10 个月起步；种子 ${P.seed}`],
    ["共同随机数", "第 r 次重复对所有策略用同一种子 seed + r：同一批学生、同一随机流"],
    ["区间估计", "均值 ± 1.96·s/√n；两策略 95% CI 不重叠才判显著"],
    ["随机流隔离", "行动、城市可见、基线服务名单各用独立派生的随机流"],
  ];
  design.forEach(([k, v], i) => {
    const y = 176 + i * 104;
    box(s, 56, y, 130, 86, k, { geometry: "roundRect", fill: i === 2 ? GREEN : BLUE, color: "#FFFFFF", size: 17, bold: true, align: "center", valign: "middle", borderRadius: 6 });
    card(s, 196, y, 330, 86, v, { size: 15 });
  });
  label(s, 556, 132, 668, "表 4  模型检验（V&V），全部为自动化测试", NAVY);
  table(s, 556, 176, 668, 400, [
    ["检验", "内容", "判据", "结果"],
    ["等价性", "仿真评分器 vs 业务 MatchingService，500 组样本", "分数完全一致", "通过"],
    ["确定性", "相同参数与种子运行两次", "输出逐字段相等", "通过"],
    ["极端条件", "岗位供给比例 ρ = 0", "匹配达成率恒为 0", "通过"],
    ["极端条件", "教师数为 0", "精准帮扶与基线完全相同", "通过"],
    ["极端条件", "学习率 0 且全员探索期", "准备达标率不上升", "通过"],
    ["性能", "4 策略 × 10 次重复", `≤ 10 秒（实测 ${data.four_scenarios_elapsed_s} 秒）`, "通过"],
  ], [0.9, 2.3, 1.6, 0.6], { size: 14 });
  card(s, 556, 596, 668, 48, "后端自动化测试 104 项全部通过", { size: 18, bold: true, color: GREEN, align: "center", fill: "#EAF8F2", border: "#A8D7C2" });
}

// 12. Endpoint results.
{
  const s = page("结果：终点对比与决策含义", "PART 03", `（0:45）这是核心结果。岗位精准推送把匹配达成率从 ${pct(S.baseline.matched)} 提到 ${pct(S.job_push.matched)}，区间不重叠，显著。精准帮扶不提高平均匹配率，但把高风险学生从 ${num(S.baseline.high_risk)} 人降到 ${num(S.precision_coaching.high_risk)} 人，显著。两类策略对应两类治理目标。`, { footnote: true });
  const order = ["baseline", "skill_training", "precision_coaching", "job_push"];
  const rows = order.map((k) => {
    const v = S[k];
    const lift = k === "baseline" ? "—" : `${pp(v.matched_lift_pp)}（${v.matched_significant ? "显著" : "不显著"}）`;
    const risk = `${num(v.high_risk)}（${ci(v.high_risk)}）${k !== "baseline" && v.high_risk_significant ? " ↓显著" : ""}`;
    return [v.label, `${pct(v.matched)}（${ci(v.matched)}）`, lift, risk];
  });
  table(s, 56, 132, 700, 250, [["策略", "匹配达成率", "较基线 / 百分点", "高风险人数"], ...rows], [1.1, 1.5, 1.3, 1.6], { size: 15, highlightRows: [[4, "#EAF8F2"], [3, "#FFF6E8"]] });
  await image(s, fig("fig5-endpoint.png"), 776, 132, 448, 250, "终点匹配达成率与高风险人数对比");
  const take = [
    ["目标：提高整体匹配率", `优先岗位精准推送：${pp(S.job_push.matched_lift_pp)} 个百分点，显著。城市信息壁垒是限制匹配的重要因素`, BLUE],
    ["目标：兜住困难学生", `精准帮扶或技能培训：高风险 ${num(S.baseline.high_risk)} → ${num(S.precision_coaching.high_risk)} / ${num(S.skill_training.high_risk)} 人，显著；平均匹配率变化不显著`, GREEN],
    ["配套提示", "推送后跨城岗位进入视野，“物联网”技能缺口扩大，推送需配套相应技能培训", ORANGE],
  ];
  take.forEach(([t, d, color], i) => {
    const y = 404 + i * 90;
    label(s, 56, y + 18, 250, t, color, 40);
    card(s, 318, y, 906, 76, d, { size: 18 });
  });
}

// 13. Weekly dynamics.
{
  const s = page("结果：逐周变化", "PART 03", `（0:20）左图匹配率逐周上升，推送一直领先。右图第 0 周有 ${week0.high_risk_count} 名高风险学生，第 14 周起小幅回升，是距毕业 6 个月仍在准备期的学生触发阶段因子，属于模型给出的预警信号。`, { footnote: true });
  await image(s, fig("fig3-matched-rate.png"), 56, 132, 576, 400, "各策略岗位匹配达成率的周变化");
  await image(s, fig("fig4-high-risk.png"), 648, 132, 576, 400, "各策略高风险人数的周变化");
  card(s, 56, 548, 576, 92, `初始（第 0 周）准备达标率 ${(week0.readiness_rate * 100).toFixed(1)}%；16 周内各策略匹配率持续上升，岗位精准推送全程领先`, { size: 17 });
  card(s, 648, 548, 576, 92, `第 0 周高风险 ${week0.high_risk_count} 人。第 14 周起小幅回升：距毕业降至 6 个月，仍在准备期者触发阶段因子，是“临近毕业未求职”的预警信号`, { size: 17, fill: "#FFF6E8", border: "#F0C47D" });
}

// 14. Sensitivity.
{
  const lo = supply[0], hi = supply[supply.length - 1];
  const sig = (sweep) => `${sweep.filter((r) => r.high_risk_significant).length}/${sweep.length}`;
  const sw = data.sweeps;
  const s = page("敏感性分析（OAT）", "PART 03", `（0:25）单因素轮换扫描三个参数。岗位供给是整体匹配的主导因素，供给从 ${lo.value} 到 ${hi.value}，基线匹配率从 ${lo.baseline_matched.mean}% 升到 ${hi.baseline_matched.mean}%。精准帮扶降低高风险的效果在大多数取值下稳健。`, { footnote: true });
  await image(s, fig("fig6-sensitivity.png"), 56, 132, 760, 470, "敏感性分析");
  label(s, 840, 132, 384, "结论", NAVY);
  const points = [
    [`岗位供给是主导因素`, `供给比例 ${lo.value} → ${hi.value}：基线匹配率 ${lo.baseline_matched.mean}% → ${hi.baseline_matched.mean}%`, BLUE],
    ["帮扶压降高风险稳健", `高风险显著低于基线：供给 ${sig(sw.supply_ratio)}、学习率 ${sig(sw.learning_rate)}、教师数 ${sig(sw.counselor_count)} 个取值`, GREEN],
    ["与极端条件一致", "教师数为 0 时帮扶与基线完全相同；人力充足时二者差距缩小", ORANGE],
  ];
  points.forEach(([t, d, color], i) => {
    const y = 180 + i * 140;
    box(s, 840, y, 384, 36, t, { size: 18, bold: true, color, valign: "middle" });
    card(s, 840, y + 40, 384, 86, d, { size: 16 });
  });
}

// 15. Live demo transition.
{
  const s = page("现场演示", "PART 04", "（2:30 演示）切到浏览器。教师：风险预警展开演示学生A；管理员：群体画像切合成数据 → 策略仿真默认参数勾四策略运行（数字与第 12 页一致）→ 生成策略报告 → 历史记录采纳 → 审计页。失败时切附录 D。");
  const steps = [
    ["01", "教师 · 风险预警", "按风险排序授权学生\n展开一名高风险学生的六因子与干预", CYAN],
    ["02", "管理员 · 策略仿真", `默认参数：${P.cohort_size} 人 × ${P.weeks} 周 × ${P.replications} 次，四策略\n约 6 秒出逐周曲线与终点 CI 表`, BLUE],
    ["03", "管理员 · 策略报告", "数字全部由后端计算\n区间重叠的策略写“差异不显著”", GREEN],
    ["04", "管理员 · 采纳留痕", "采纳只写脱敏审计\n不触发任何自动操作", ORANGE],
  ];
  let prev;
  steps.forEach(([n, t, d, color], i) => {
    const x = 56 + i * 300;
    box(s, x + 92, 160, 76, 76, n, { geometry: "ellipse", fill: color, color: "#FFFFFF", size: 25, bold: true, align: "center", valign: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } });
    const c = card(s, x, 260, 260, 64, t, { size: 19, bold: true, color: NAVY, align: "center", fill: LIGHT });
    card(s, x, 336, 260, 130, d, { size: 16, align: "center", lineSpacing: 1.3 });
    if (prev) connector(s, prev, c);
    prev = c;
  });
  card(s, 56, 500, 1168, 64, `现场结果可复现：岗位模板来自固定数据，参数与种子相同则与第 12 页逐字段一致（如岗位精准推送 ${pct(S.job_push.matched)}）`, { size: 19, bold: true, color: GREEN, align: "center", fill: "#EAF8F2", border: "#A8D7C2" });
  box(s, 56, 584, 1168, 40, "演示账号与学生均为合成数据，不含真实学号或联系方式；备份截图见附录 D", { size: 16, color: MUTED, align: "center", valign: "middle" });
}

// 16. Privacy, safety, innovation.
{
  const s = page("隐私安全与特色创新", "PART 05", "（0:25）隐私和安全写进了接口：小样本抑制、越权 403、审计最小化、大模型降级。五点创新：同源建模、无受保护属性的可解释预警、统计上诚实、人工决策闭环、轻量可复制。");
  label(s, 56, 132, 460, "隐私、安全与人工决策", NAVY);
  const guards = [
    ["k = 5 小样本抑制", "群体画像分组少于 5 人合并或隐藏，不返回个人记录"],
    ["越权返回 403", "教师只能看到已授权学生；接口不回显学号与联系方式"],
    ["审计最小化", "只记角色、动作、资源、时间，不记画像正文或密钥"],
    ["大模型可降级", "只解读报告并标注需人工审核；平台不可用时返回确定性报告"],
  ];
  guards.forEach(([t, d], i) => {
    const y = 178 + i * 108;
    box(s, 56, y, 460, 34, t, { size: 18, bold: true, color: BLUE, valign: "middle" });
    card(s, 56, y + 36, 460, 60, d, { size: 15 });
  });
  label(s, 548, 132, 676, "特色与创新", NAVY);
  const ideas = [
    ["业务与仿真同源", "仿真复用线上匹配与风险模型，500 组样本逐分一致"],
    ["无受保护属性的可解释预警", "风险分逐因子拆解并对应干预"],
    ["统计上诚实的策略评估", "共同随机数 + 重复 + 置信区间，重叠即判不显著"],
    ["“模型辅助、人工决策”闭环", "大模型不产生数字，采纳只留痕"],
    ["轻量可复制", "纯 Python 内核，数秒完成，参数可配置，可推广到其他高校"],
  ];
  ideas.forEach(([t, d], i) => {
    const y = 178 + i * 88;
    box(s, 548, y, 56, 72, String(i + 1), { geometry: "roundRect", fill: i % 2 ? CYAN : BLUE, color: "#FFFFFF", size: 24, bold: true, align: "center", valign: "middle", borderRadius: 6 });
    card(s, 614, y, 610, 72, `${t}\n${d}`, { size: 15 });
  });
}

// 17. Limitations, next steps, thanks.
{
  const s = page("局限、后续与致谢", "PART 05", "（0:20）如实说明局限：合成数据、参数未校准、结构假设。后续用脱敏历史数据校准。谢谢各位评委。");
  label(s, 56, 132, 560, "局限", ORANGE);
  bullets(s, 56, 176, 560, 210, [
    "仿真群体为合成数据，结论用于策略间相对比较",
    "λ、θ、φ 等行为参数为合理假设，尚未用真实数据校准",
    "策略以最小规则改动表示，未覆盖政策组合的全部细节",
  ], { size: 18, fill: "#FFF6E8", line: { style: "solid", fill: "#F0C47D", width: 1 } });
  label(s, 664, 132, 560, "后续", GREEN);
  bullets(s, 664, 176, 560, 210, [
    "用脱敏的历届就业数据校准学习率、主动性与城市弹性",
    "对比仿真预测与实际就业结果，迭代模型",
    "在更多院系试用，积累治理策略采纳与效果记录",
  ], { size: 18, fill: "#EAF8F2", line: { style: "solid", fill: "#A8D7C2", width: 1 } });
  s.shapes.add({ geometry: "roundRect", position: { left: 56, top: 418, width: 1168, height: 222 }, fill: { type: "gradient", angleDeg: 120, stops: [{ offset: 0, color: "#10275A" }, { offset: 100000, color: BLUE }] }, line: NONE_LINE, borderRadius: 10 });
  box(s, 56, 446, 1168, 80, "可解释预警 · 先推演后投入 · 人工作决策", { size: 38, bold: true, color: "#FFFFFF", align: "center", valign: "middle" });
  box(s, 56, 540, 1168, 60, "感谢各位评委，欢迎批评指正", { size: 24, color: "#DCE6FF", align: "center", valign: "middle" });
}

// Appendix A. Matching weights.
{
  const s = page("附录 A  岗位匹配五维权重", "APPENDIX", "备用：评委问匹配规则时使用。", { pageLabel: "附 A" });
  const dims = [["技能", 50, BLUE], ["专业", 20, CYAN], ["项目", 15, GREEN], ["目标岗位", 10, ORANGE], ["城市", 5, RED]];
  dims.forEach(([t, v, color], i) => {
    const y = 160 + i * 74;
    box(s, 70, y, 120, 44, t, { size: 20, bold: true, color: NAVY, align: "right", valign: "middle" });
    s.shapes.add({ geometry: "roundRect", position: { left: 206, top: y + 6, width: 400, height: 32 }, fill: "#E8EEF7", line: NONE_LINE, borderRadius: 5 });
    s.shapes.add({ geometry: "roundRect", position: { left: 206, top: y + 6, width: 8 * v, height: 32 }, fill: color, line: NONE_LINE, borderRadius: 5 });
    box(s, 616, y, 80, 44, `${v} 分`, { size: 19, bold: true, color, valign: "middle" });
  });
  label(s, 740, 160, 484, "硬性过滤与解释", NAVY);
  bullets(s, 740, 206, 484, 260, [
    "仅使用已发布、未过期且有来源的岗位",
    "同分按有效期与岗位名固定排序，结果稳定",
    "返回分项得分、能力缺口与岗位来源",
    "行动计划只基于真实缺口生成，不承诺录用",
  ], { size: 18, fill: PALE, line: { style: "solid", fill: BORDER, width: 1 } });
}

// Appendix B. FastGPT.
{
  const s = page("附录 B  SF-FastGPT 双路问答与降级", "APPENDIX", "备用：评委问大模型作用时使用。", { pageLabel: "附 B" });
  const q = card(s, 70, 170, 210, 80, "用户问题 / 仿真报告", { size: 19, bold: true, align: "center", fill: LIGHT });
  const r = card(s, 360, 170, 240, 80, "服务端路由", { size: 20, bold: true, align: "center", fill: "#EAF8F7", border: "#9ACFC8" });
  const c1 = card(s, 690, 130, 250, 66, "职业发展应用", { size: 19, bold: true, align: "center" });
  const c2 = card(s, 690, 224, 250, 66, "就业政策应用", { size: 19, bold: true, align: "center" });
  const a = card(s, 1020, 170, 200, 80, "文字回答 / 解读", { size: 19, bold: true, align: "center", fill: "#FFF6E8", border: "#F0C47D" });
  connector(s, q, r); connector(s, r, c1); connector(s, r, c2); connector(s, c1, a); connector(s, c2, a);
  const cases = [["有结构化来源", "显示回答与来源链接", GREEN], ["无来源或需判断", "保留回答并提示人工确认；报告解读标注“需人工审核”", ORANGE], ["超时或异常", "返回稳定降级提示，仿真报告退回确定性版本", RED]];
  cases.forEach(([t, d, color], i) => {
    const y = 350 + i * 76;
    label(s, 110, y, 250, t, color, 40);
    card(s, 390, y, 800, 40, d, { size: 17 });
  });
  box(s, 110, 590, 1080, 40, "API Key 只在服务端；大模型不直接访问业务数据库，不生成或改写任何仿真数字", { size: 17, bold: true, color: NAVY, align: "center", valign: "middle" });
}

// Appendix C. Data model.
{
  const s = page("附录 C  数据模型与权限边界", "APPENDIX", "备用：评委问数据与权限时使用。", { pageLabel: "附 C" });
  table(s, 56, 140, 1168, 470, [
    ["数据表", "主要字段", "访问边界"],
    ["users", "id · username · role · enrollment_year", "学号与联系方式不进入治理接口"],
    ["career_profiles", "student_id · major · skills · projects · target_roles · job_stage", "教师只见授权学生摘要，不见技能与项目原文"],
    ["job_postings", "title · city · required_skills · source_url · status", "仅已发布且未过期岗位参与匹配"],
    ["match_results / action_plans", "score · gaps / items · status", "学生本人与授权教师可见"],
    ["counselor_student_access", "counselor_id · student_id（唯一）", "决定教师可见范围，越权 403"],
    ["teacher_advice", "counselor_id · student_id · action_plan_id · content", "学生只见意见正文与时间"],
    ["simulation_runs", "params · seed · model_version · results · adopted_scenario", "仅管理员；只存合成数据结果"],
    ["audit_events", "actor_role · action · resource_type · created_at", "不记录画像正文、密钥或连接串"],
  ], [1.3, 2.2, 2], { size: 15 });
}

// Appendix D. Demo backup screenshots.
{
  const s = page("附录 D  演示备份截图", "APPENDIX", "现场演示失败时使用，按顺序讲解四张截图。", { pageLabel: "附 D" });
  const shots = [
    ["1-risk-board.png", "教师 · 风险预警（六因子与干预）", 56, 132, { left: 0.14, top: 0.08, right: 0.0, bottom: 0.08 }],
    ["p1-weekly-chart.png", "管理员 · 策略仿真逐周曲线", 648, 132, undefined],
    ["p3-strategy-report.png", "管理员 · 确定性策略报告", 56, 412, undefined],
    ["5-audit-adopted.png", "管理员 · 审计中的“采纳治理策略”记录", 648, 412, { left: 0.14, top: 0.08, right: 0.0, bottom: 0.45 }],
  ];
  for (const [file, caption, x, y, crop] of shots) {
    await image(s, shotPath(file), x, y, 576, 230, caption, { fit: "contain", crop });
    box(s, x, y + 234, 576, 30, caption, { size: 15, bold: true, color: NAVY, align: "center", valign: "middle" });
  }
}

// EXPORT_PLACEHOLDER

notes.forEach((text, i) => { p.slides.getItem(i).speakerNotes.text = text; });
await (await PresentationFile.exportPptx(p)).save(outPath);
for (const old of await fs.readdir(previewDir)) await fs.rm(path.join(previewDir, old));
for (let i = 0; i < p.slides.items.length; i++) {
  const png = await p.export({ slide: p.slides.getItem(i), format: "png", scale: 1 });
  await fs.writeFile(path.join(previewDir, `slide-${String(i + 1).padStart(2, "0")}.png`), new Uint8Array(await png.arrayBuffer()));
}
console.log(JSON.stringify({ outPath, slides: p.slides.items.length }));
