import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspace = "D:/基于大模型的教育管理应用创新赛";
const sourcePath = path.join(workspace, "output/docx/基于大模型教育管理应用创新赛（PPT模版）.pptx");
const draftPath = path.join(workspace, ".ppt-build/职途智航项目介绍_模板版_draft.pptx");
const previewDir = path.join(workspace, ".ppt-build/previews");
await fs.mkdir(previewDir, { recursive: true });

const p = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const FONT = "Microsoft YaHei";
const NAVY = "#173568";
const BLUE = "#2457D6";
const CYAN = "#13A6C6";
const LIGHT = "#EEF4FF";
const PALE = "#F6F9FF";
const TEXT = "#24344E";
const MUTED = "#60718A";
const GREEN = "#16836D";
const ORANGE = "#E18B2C";
const RED = "#C94D5C";

// Replace template logo placeholders before duplicating the reusable content page.
const logoSnapshot = await p.inspect({ kind: "textbox", search: "单位LOGO展示区", maxChars: 12000 });
for (const raw of logoSnapshot.ndjson.split(/\r?\n/)) {
  if (!raw.trim()) continue;
  const item = JSON.parse(raw);
  if (item.kind !== "textbox") continue;
  const box = p.resolve(item.id);
  box.text = "职途智航";
  box.text.style = {
    typeface: FONT, fontSize: 21, bold: true, color: "#FFFFFF",
    alignment: item.slide === 1 || item.slide === 9 ? "right" : "left",
    verticalAlignment: "middle", autoFit: "shrinkText", insets: { left: 8, right: 8, top: 0, bottom: 0 },
  };
}

// Expand the six supplied content pages to twelve while retaining the template master/background.
const reusable = p.slides.getItem(7);
for (let i = 0; i < 6; i++) reusable.duplicate();

function box(slide, x, y, w, h, text, opts = {}) {
  const shape = slide.shapes.add({
    geometry: opts.geometry ?? "textbox",
    name: opts.name,
    position: { left: x, top: y, width: w, height: h },
    fill: opts.fill ?? "none",
    line: opts.line ?? { style: "solid", fill: "none", width: 0 },
    borderRadius: opts.borderRadius,
    shadow: opts.shadow,
  });
  shape.text = text;
  shape.text.style = {
    typeface: opts.font ?? FONT,
    fontSize: opts.size ?? 22,
    bold: opts.bold ?? false,
    color: opts.color ?? TEXT,
    alignment: opts.align ?? "left",
    verticalAlignment: opts.valign ?? "top",
    autoFit: opts.autoFit ?? "shrinkText",
    wrap: "square",
    lineSpacing: opts.lineSpacing ?? 1.12,
    insets: opts.insets ?? { left: 8, right: 8, top: 6, bottom: 6 },
  };
  return shape;
}

function title(slide, text, section) {
  box(slide, 64, 96, 940, 54, text, { size: 34, bold: true, color: NAVY, valign: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  box(slide, 1045, 103, 165, 32, section, { size: 17, bold: true, color: BLUE, align: "right", valign: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  slide.shapes.add({ geometry: "line", position: { left: 64, top: 153, width: 1148, height: 0 }, fill: "none", line: { style: "solid", fill: "#D9E4F5", width: 1 } });
}

function label(slide, x, y, w, text, color = BLUE) {
  return box(slide, x, y, w, 34, text, { fill: color, color: "#FFFFFF", size: 17, bold: true, align: "center", valign: "middle", geometry: "roundRect", borderRadius: 6, insets: { left: 4, right: 4, top: 0, bottom: 0 } });
}

function bulletList(slide, x, y, w, h, items, opts = {}) {
  const shape = box(slide, x, y, w, h, "", { size: opts.size ?? 21, color: opts.color ?? TEXT, fill: opts.fill ?? "none", line: opts.line, borderRadius: opts.borderRadius, insets: opts.insets ?? { left: 10, right: 10, top: 8, bottom: 8 } });
  shape.text.set(items.map((t) => ({ bulletCharacter: "•", marginLeft: 22 * 12700, indent: -11 * 12700, spaceAfter: 900, runs: [t] })));
  shape.text.style = { typeface: FONT, fontSize: opts.size ?? 21, color: opts.color ?? TEXT, verticalAlignment: "top", autoFit: "shrinkText", lineSpacing: 1.12, insets: opts.insets ?? { left: 10, right: 10, top: 8, bottom: 8 } };
  return shape;
}

function connector(slide, from, to, fromSide = "right", toSide = "left", color = "#7D91B3") {
  const link = slide.shapes.connect(from, to, { kind: "straight", fromSide, toSide, line: { style: "solid", fill: color, width: 2 }, tail: { type: "arrow", width: "med", length: "med" } });
  link.bringToFront();
  return link;
}

// Cover.
const coverTitle = p.resolve("sh/547294r6");
coverTitle.text = "职途智航";
coverTitle.text.style = { typeface: FONT, fontSize: 68, bold: true, color: "#FFFFFF", alignment: "center", verticalAlignment: "middle", autoFit: "shrinkText" };
const coverTeam = p.resolve("sh/k3yl0zql");
coverTeam.text = "高校就业择业规划智能体\n参赛团队：职途智航项目组";
coverTeam.text.style = { typeface: FONT, fontSize: 25, bold: true, color: "#FFFFFF", alignment: "center", verticalAlignment: "middle", autoFit: "shrinkText", lineSpacing: 1.15 };

// Slide 3: team.
{
  const s = p.slides.getItem(2); title(s, "团队介绍", "PART 01");
  box(s, 66, 176, 1140, 46, "项目由程林独立完成开发，李耀老师提供就业指导与产品设计指导", { size: 23, color: MUTED, align: "center", valign: "middle" });
  const members = [
    ["01", "程林", "队长 · 开发负责人", "成都信息工程大学\n空间信息与数字技术 · 2024级\n负责需求梳理、前端、后端、数据库、FastGPT 接入与测试"],
    ["02", "李耀", "指导教师", "成都信息工程大学\n就业指导与项目指导\n负责需求方向、业务边界和成果呈现指导"],
  ];
  members.forEach((m, i) => {
    const x = i === 0 ? 168 : 700;
    const accent = i === 0 ? BLUE : CYAN;
    box(s, x, 260, 76, 76, m[0], { geometry: "ellipse", fill: accent, color: "#FFFFFF", size: 25, bold: true, align: "center", valign: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } });
    box(s, x + 104, 258, 300, 46, m[1], { size: 28, bold: true, color: NAVY, valign: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } });
    box(s, x + 104, 309, 300, 34, m[2], { size: 18, bold: true, color: accent, valign: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } });
    box(s, x, 380, 448, 138, m[3], { size: 19, color: TEXT, align: "left", valign: "middle", fill: PALE, line: { style: "solid", fill: "#D9E4F5", width: 1 }, borderRadius: 6, insets: { left: 18, right: 18, top: 10, bottom: 10 } });
  });
  box(s, 170, 570, 940, 54, "分工特点：一人完成全栈开发，指导教师把关就业业务逻辑与展示表达", { fill: LIGHT, line: { style: "solid", fill: "#B8CBEA", width: 1 }, borderRadius: 6, size: 21, bold: true, color: NAVY, align: "center", valign: "middle" });
}

// Slide 4: positioning.
{
  const s = p.slides.getItem(3); title(s, "作品介绍：职途智航", "PART 02");
  box(s, 70, 176, 520, 72, "面向高校就业指导的智能规划与协同工作台", { size: 31, bold: true, color: NAVY, valign: "middle" });
  bulletList(s, 74, 264, 510, 220, [
    "将职业画像、岗位匹配、能力缺口和行动计划串成持续更新的业务闭环",
    "用 FastGPT 回答职业发展与就业政策问题，保留来源和人工确认提示",
    "让就业指导教师与管理员在授权范围内参与指导和治理",
  ], { size: 20 });
  box(s, 70, 520, 514, 82, "产品边界\n不自动投递，不替代教师，不承诺录用结果", { fill: "#FFF6E8", line: { style: "solid", fill: "#F0C47D", width: 1 }, borderRadius: 6, size: 20, bold: true, color: "#895217", valign: "middle" });
  const steps = ["职业画像", "岗位匹配", "能力缺口", "行动计划", "智能咨询", "教师指导"];
  let prev;
  steps.forEach((t, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 680 + col * 250, y = 190 + row * 142;
    const b = box(s, x, y, 210, 74, `${String(i + 1).padStart(2, "0")}  ${t}`, { geometry: "roundRect", fill: i < 4 ? LIGHT : "#EAF8F7", line: { style: "solid", fill: i < 4 ? "#A8BFE9" : "#9ACFC8", width: 1.3 }, borderRadius: 7, size: 21, bold: true, color: NAVY, align: "center", valign: "middle" });
    if (prev) connector(s, prev, b, i % 2 ? "right" : "bottom", i % 2 ? "left" : "top");
    prev = b;
  });
}

// Slide 5: roles.
{
  const s = p.slides.getItem(4); title(s, "三类用户与核心功能", "PART 02");
  const columns = [
    ["学生", BLUE, "建立职业画像\n查看岗位匹配与缺口\n生成阶段行动计划\n发起智能咨询"],
    ["就业指导教师", CYAN, "查看授权学生摘要\n跟踪计划执行状态\n提交专业指导意见\n保留人工判断"],
    ["就业管理员", GREEN, "维护账号与师生授权\n治理岗位和知识资料\n查看脱敏审计事件\n管理系统边界"],
  ];
  columns.forEach((c, i) => {
    const x = 76 + i * 400;
    box(s, x, 190, 342, 56, c[0], { fill: c[1], color: "#FFFFFF", size: 24, bold: true, align: "center", valign: "middle", geometry: "roundRect", borderRadius: 6 });
    box(s, x, 260, 342, 250, c[2], { fill: PALE, line: { style: "solid", fill: "#CFDBEC", width: 1.2 }, borderRadius: 6, size: 21, color: TEXT, align: "center", valign: "middle", lineSpacing: 1.4 });
  });
  box(s, 194, 548, 892, 62, "同一套服务端权限模型约束数据可见范围，前端不能自行声明或提升角色", { fill: LIGHT, line: { style: "solid", fill: "#AEC3E7", width: 1 }, borderRadius: 6, size: 21, bold: true, color: NAVY, align: "center", valign: "middle" });
}

// Slide 6: needs.
{
  const s = p.slides.getItem(5); title(s, "需求分析", "PART 03");
  label(s, 82, 180, 270, "高校就业指导痛点", NAVY);
  label(s, 506, 180, 270, "系统需求", BLUE);
  label(s, 930, 180, 270, "可验证结果", CYAN);
  const rows = [
    ["目标模糊，材料零散", "结构化职业画像", "形成可复用的学生档案"],
    ["岗位推荐依据不透明", "固定规则评分与缺口解释", "相同输入得到稳定结果"],
    ["政策与职业问题重复咨询", "FastGPT 双路知识问答", "回答可保留来源与提示"],
    ["教师时间有限，协同边界不清", "授权访问与指导意见闭环", "教师只看授权学生摘要"],
  ];
  rows.forEach((r, i) => {
    const y = 240 + i * 88;
    const a = box(s, 82, y, 270, 64, r[0], { fill: "#F8FAFD", line: { style: "solid", fill: "#D5DFEC", width: 1 }, borderRadius: 5, size: 18, align: "center", valign: "middle" });
    const b = box(s, 506, y, 270, 64, r[1], { fill: LIGHT, line: { style: "solid", fill: "#B5C8E8", width: 1 }, borderRadius: 5, size: 18, bold: true, align: "center", valign: "middle" });
    const c = box(s, 930, y, 270, 64, r[2], { fill: "#EAF8F7", line: { style: "solid", fill: "#A8D7D0", width: 1 }, borderRadius: 5, size: 18, align: "center", valign: "middle" });
    connector(s, a, b); connector(s, b, c);
  });
  box(s, 250, 606, 780, 38, "优先满足可解释、可追溯、最小数据和人工协同四项约束", { size: 19, bold: true, color: NAVY, align: "center", valign: "middle" });
}

// Slide 7: business workflow image.
{
  const s = p.slides.getItem(6); title(s, "业务流程", "PART 03");
  s.shapes.add({ geometry: "roundRect", position: { left: 58, top: 180, width: 1164, height: 142 }, fill: "#F2F5F9", line: { style: "solid", fill: "#D0D9E6", width: 1 }, borderRadius: 6 });
  s.shapes.add({ geometry: "roundRect", position: { left: 58, top: 342, width: 1164, height: 164 }, fill: "#F8FAFD", line: { style: "solid", fill: "#D0D9E6", width: 1 }, borderRadius: 6 });
  s.shapes.add({ geometry: "roundRect", position: { left: 58, top: 526, width: 1164, height: 112 }, fill: "#F2F5F9", line: { style: "solid", fill: "#D0D9E6", width: 1 }, borderRadius: 6 });
  box(s, 70, 220, 110, 54, "学生", { size: 22, bold: true, color: NAVY, align: "center", valign: "middle" });
  box(s, 70, 392, 110, 62, "系统与\n智能体", { size: 20, bold: true, color: NAVY, align: "center", valign: "middle" });
  box(s, 70, 552, 110, 54, "教师与\n管理员", { size: 19, bold: true, color: NAVY, align: "center", valign: "middle" });
  const topNames = ["注册登录", "职业画像", "查看匹配\n缺口与来源", "生成行动计划", "咨询并更新"];
  const midNames = ["认证与角色校验", "过滤有效岗位", "五维评分\n稳定排序", "生成阶段任务", "FastGPT 路由\n回答与来源"];
  let topPrev, midPrev;
  for (let i = 0; i < 5; i++) {
    const x = 205 + i * 195;
    const top = box(s, x, 214, 150, 68, topNames[i], { fill: "#FFFFFF", line: { style: "solid", fill: "#A8B6C9", width: 1 }, borderRadius: 5, size: 18, bold: true, align: "center", valign: "middle" });
    const mid = box(s, x, 389, 150, 68, midNames[i], { fill: i === 4 ? "#EAF8F7" : LIGHT, line: { style: "solid", fill: i === 4 ? "#98D0C7" : "#A8BFE9", width: 1 }, borderRadius: 5, size: 17, bold: true, align: "center", valign: "middle" });
    if (topPrev) connector(s, topPrev, top);
    if (midPrev) connector(s, midPrev, mid);
    connector(s, top, mid, "bottom", "top", "#7B879A");
    topPrev = top; midPrev = mid;
  }
  const teacher = box(s, 250, 550, 250, 58, "教师查看授权摘要\n提交指导意见", { fill: "#FFFFFF", line: { style: "solid", fill: "#A8B6C9", width: 1 }, borderRadius: 5, size: 18, bold: true, align: "center", valign: "middle" });
  const admin = box(s, 560, 550, 250, 58, "管理员维护账号、岗位\n知识资料与审计", { fill: "#FFFFFF", line: { style: "solid", fill: "#A8B6C9", width: 1 }, borderRadius: 5, size: 18, bold: true, align: "center", valign: "middle" });
  const update = box(s, 870, 550, 250, 58, "学生依据意见\n调整行动计划", { fill: "#FFF6E8", line: { style: "solid", fill: "#E3B463", width: 1 }, borderRadius: 5, size: 18, bold: true, align: "center", valign: "middle" });
  connector(s, teacher, admin); connector(s, admin, update);
  box(s, 222, 645, 836, 28, "规则负责评分与筛选，FastGPT 负责知识问答，教师负责专业确认", { size: 17, color: NAVY, bold: true, align: "center", valign: "middle" });
}

// Slide 8: architecture image.
{
  const s = p.slides.getItem(7); title(s, "系统总体架构与技术路线", "PART 04");
  const bytes = await fs.readFile(path.join(workspace, "tmp/docs/design-diagrams/system-framework.png"));
  s.images.add({ blob: bytes, contentType: "image/png", alt: "职途智航系统总体框架图", fit: "contain", crop: { left: 0.015, top: 0.10, right: 0.015, bottom: 0.055 }, position: { left: 45, top: 166, width: 1190, height: 465 } });
  const stack = ["React + TypeScript + Vite", "FastAPI + SQLAlchemy", "PostgreSQL + Alembic", "FastGPT + REST API"];
  stack.forEach((t, i) => label(s, 84 + i * 290, 635, 250, t, i === 3 ? CYAN : BLUE));
}

// Slide 9: agent design.
{
  const s = p.slides.getItem(8); title(s, "智能体设计：职责分工与判断边界", "PART 04");
  const rule = box(s, 80, 205, 310, 105, "确定性规则\n岗位过滤、五维评分、稳定排序", { fill: LIGHT, line: { style: "solid", fill: "#9FB8E5", width: 1.5 }, borderRadius: 7, size: 22, bold: true, color: NAVY, align: "center", valign: "middle" });
  const model = box(s, 485, 205, 310, 105, "FastGPT\n职业发展与就业政策问答", { fill: "#EAF8F7", line: { style: "solid", fill: "#8CCFC5", width: 1.5 }, borderRadius: 7, size: 22, bold: true, color: NAVY, align: "center", valign: "middle" });
  const human = box(s, 890, 205, 310, 105, "就业指导教师\n复核个体情况并给出专业意见", { fill: "#FFF6E8", line: { style: "solid", fill: "#E7B666", width: 1.5 }, borderRadius: 7, size: 22, bold: true, color: NAVY, align: "center", valign: "middle" });
  connector(s, rule, model); connector(s, model, human);
  label(s, 116, 370, 238, "保证推荐可解释", BLUE);
  label(s, 521, 370, 238, "提升咨询服务效率", CYAN);
  label(s, 926, 370, 238, "保留最终专业判断", ORANGE);
  box(s, 140, 455, 1000, 132, "最小数据原则\n前端仅提交问题与可控应用标识，FastGPT 不直接访问 PostgreSQL 业务数据库。API Key 保留在服务端，错误信息和原始上游响应不向前端透传。", { fill: PALE, line: { style: "solid", fill: "#CDD9EA", width: 1 }, borderRadius: 7, size: 21, color: TEXT, align: "center", valign: "middle", lineSpacing: 1.25 });
}

// Slide 10: matching model.
{
  const s = p.slides.getItem(9); title(s, "可解释岗位匹配模型", "PART 04");
  box(s, 72, 176, 540, 52, "固定权重，总分 100 分", { size: 26, bold: true, color: NAVY, valign: "middle" });
  const data = [["技能", 50, BLUE], ["专业", 20, CYAN], ["项目", 15, GREEN], ["目标岗位", 10, ORANGE], ["城市", 5, RED]];
  data.forEach((d, i) => {
    const y = 244 + i * 67;
    box(s, 78, y, 112, 40, d[0], { size: 20, bold: true, color: NAVY, align: "right", valign: "middle", insets: { left: 0, right: 10, top: 0, bottom: 0 } });
    s.shapes.add({ geometry: "roundRect", position: { left: 202, top: y + 4, width: 350, height: 32 }, fill: "#E8EEF7", line: { style: "solid", fill: "none", width: 0 }, borderRadius: 5 });
    s.shapes.add({ geometry: "roundRect", position: { left: 202, top: y + 4, width: 7 * d[1], height: 32 }, fill: d[2], line: { style: "solid", fill: "none", width: 0 }, borderRadius: 5 });
    box(s, 560, y, 62, 40, `${d[1]}分`, { size: 19, bold: true, color: d[2], align: "right", valign: "middle" });
  });
  label(s, 708, 192, 418, "进入评分前的硬性过滤", NAVY);
  bulletList(s, 704, 248, 426, 180, ["仅使用已发布且未过期岗位", "岗位必须具有有效来源或明确标识为演示数据", "相同分数采用固定次序，保证结果稳定"], { size: 20, fill: PALE, line: { style: "solid", fill: "#CBD8E9", width: 1 }, borderRadius: 6 });
  label(s, 708, 458, 418, "结果解释", CYAN);
  box(s, 704, 515, 426, 90, "同时返回分项得分、能力缺口和岗位来源。行动计划只基于真实缺口生成，不编造录用结论。", { size: 20, color: TEXT, align: "center", valign: "middle", fill: "#EAF8F7", line: { style: "solid", fill: "#A8D7D0", width: 1 }, borderRadius: 6 });
}

// Slide 11: FastGPT adapter.
{
  const s = p.slides.getItem(10); title(s, "FastGPT 双路问答与安全降级", "PART 04");
  const q = box(s, 70, 205, 210, 82, "用户问题", { fill: LIGHT, line: { style: "solid", fill: "#9FB8E5", width: 1.4 }, borderRadius: 6, size: 22, bold: true, align: "center", valign: "middle" });
  const router = box(s, 360, 205, 250, 82, "服务端路由", { fill: "#EAF8F7", line: { style: "solid", fill: "#8CCFC5", width: 1.4 }, borderRadius: 6, size: 22, bold: true, align: "center", valign: "middle" });
  const career = box(s, 720, 175, 238, 72, "职业发展应用", { fill: "#F3F6FF", line: { style: "solid", fill: "#AFC1E5", width: 1.2 }, borderRadius: 6, size: 21, bold: true, align: "center", valign: "middle" });
  const policy = box(s, 720, 270, 238, 72, "就业政策应用", { fill: "#F0FAF8", line: { style: "solid", fill: "#A3D5CC", width: 1.2 }, borderRadius: 6, size: 21, bold: true, align: "center", valign: "middle" });
  const answer = box(s, 1030, 205, 180, 82, "文本回答", { fill: "#FFF6E8", line: { style: "solid", fill: "#E5B765", width: 1.2 }, borderRadius: 6, size: 22, bold: true, align: "center", valign: "middle" });
  connector(s, q, router); connector(s, router, career); connector(s, router, policy); connector(s, career, answer); connector(s, policy, answer);
  const cases = [
    ["有结构化来源", "显示完整回答与来源链接", GREEN],
    ["无结构化来源", "保留回答，同时提示人工确认", ORANGE],
    ["超时或响应异常", "返回稳定降级提示，不暴露上游错误", RED],
  ];
  cases.forEach((c, i) => {
    const y = 408 + i * 72;
    label(s, 112, y, 252, c[0], c[2]);
    box(s, 402, y, 720, 34, c[1], { size: 20, color: TEXT, valign: "middle", fill: PALE, line: { style: "solid", fill: "#D3DDEA", width: 1 }, borderRadius: 5 });
  });
}

// Slide 12: simplified editable ER diagram.
{
  const s = p.slides.getItem(11); title(s, "数据模型与权限边界", "PART 04");
  const entity = (x, y, w, h, name, fields, color = BLUE) => {
    const outer = box(s, x, y, w, h, `\n${fields}`, { fill: "#FFFFFF", line: { style: "solid", fill: "#AAB9CF", width: 1.2 }, borderRadius: 5, size: 16, color: TEXT, align: "left", valign: "middle", insets: { left: 12, right: 8, top: 5, bottom: 5 } });
    box(s, x, y, w, 28, name, { fill: color, color: "#FFFFFF", size: 17, bold: true, align: "center", valign: "middle", geometry: "roundRect", borderRadius: 5, insets: { left: 2, right: 2, top: 0, bottom: 0 } });
    return outer;
  };
  const users = entity(478, 174, 324, 76, "users", "PK id · username · role · status", NAVY);
  const profile = entity(76, 286, 286, 88, "career_profiles", "FK user_id · major · skills · target_role");
  const jobs = entity(76, 465, 286, 88, "job_postings", "title · required_skills · source · status", CYAN);
  const match = entity(496, 312, 286, 96, "match_results", "FK profile_id · FK job_id · score · gaps", BLUE);
  const plan = entity(496, 486, 286, 88, "action_plans", "FK student_id · FK match_id · tasks · status", GREEN);
  const access = entity(904, 276, 286, 88, "counselor_student_access", "FK counselor_id · FK student_id · UNIQUE", CYAN);
  const advice = entity(904, 430, 286, 88, "teacher_advice", "FK teacher_id · FK student_id · FK plan_id", ORANGE);
  const audit = entity(904, 566, 286, 76, "audit_events", "FK actor_id · action · resource · metadata", RED);
  connector(s, users, profile, "left", "top");
  connector(s, profile, match);
  connector(s, jobs, match);
  connector(s, match, plan, "bottom", "top");
  connector(s, users, access);
  connector(s, access, advice, "bottom", "top");
  connector(s, plan, advice);
  box(s, 176, 649, 928, 28, "核心业务数据留在 PostgreSQL。FastGPT 不直接读取画像、匹配结果或教师意见", { size: 17, bold: true, color: NAVY, align: "center", valign: "middle" });
}

// Slide 13: application screenshots.
{
  const s = p.slides.getItem(12); title(s, "应用效果：真实工作台界面", "PART 05");
  const admin = await fs.readFile(path.join(workspace, "output/playwright/admin-jobs.png"));
  const login = await fs.readFile(path.join(workspace, "output/playwright/login.png"));
  const register = await fs.readFile(path.join(workspace, "output/playwright/register.png"));
  const desktop = await fs.readFile(path.join(workspace, "output/playwright/zhitu-desktop.png"));
  const shots = [
    [login, "账号登录", 58, 178],
    [register, "学生账号注册", 646, 178],
    [admin, "管理员岗位资料台账", 58, 430],
    [desktop, "学生端工作台", 646, 430],
  ];
  shots.forEach(([bytes, caption, x, y]) => {
    s.images.add({ blob: bytes, contentType: "image/png", alt: caption, fit: "cover", crop: { left: 0.02, top: 0.035, right: 0.02, bottom: 0.04 }, geometry: "roundRect", borderRadius: 6, position: { left: x, top: y, width: 550, height: 190 } });
    box(s, x, y + 194, 550, 28, caption, { size: 17, bold: true, color: NAVY, align: "center", valign: "middle", insets: { left: 0, right: 0, top: 0, bottom: 0 } });
  });
}

// Slide 14: tests and value.
{
  const s = p.slides.getItem(13); title(s, "测试结果与应用价值", "PART 05");
  const metrics = [
    ["51 / 51", "后端自动化测试通过", BLUE],
    ["3 类角色", "核心业务流程已验证", CYAN],
    ["403", "越权访问被服务端拒绝", RED],
    ["通过", "前端构建与静态检查", GREEN],
  ];
  metrics.forEach((m, i) => {
    const x = 72 + i * 294;
    box(s, x, 188, 250, 84, m[0], { size: 35, bold: true, color: m[2], align: "center", valign: "middle", fill: PALE, line: { style: "solid", fill: "#D2DDEB", width: 1 }, borderRadius: 6 });
    box(s, x, 279, 250, 44, m[1], { size: 17, color: TEXT, align: "center", valign: "middle" });
  });
  const values = [
    ["学生", "明确岗位方向和能力缺口，形成可执行计划"],
    ["教师", "减少重复咨询，把时间用于个体问题和专业判断"],
    ["学校", "沉淀可追溯的就业指导流程、授权和审计记录"],
  ];
  values.forEach((v, i) => {
    const y = 382 + i * 82;
    label(s, 118, y, 160, v[0], i === 0 ? BLUE : i === 1 ? CYAN : GREEN);
    box(s, 316, y, 826, 34, v[1], { size: 20, color: TEXT, valign: "middle", fill: PALE, line: { style: "solid", fill: "#D4DEEB", width: 1 }, borderRadius: 5 });
  });
  box(s, 164, 634, 952, 34, "说明：以上为本地测试与演示环境结果，外部 FastGPT 生产应用需在部署环境继续验收", { size: 16, color: MUTED, align: "center", valign: "middle" });
}

// Closing slide is now last after duplication.
const closing = p.slides.getItem(14);
const closingTitle = await p.inspect({ kind: "textbox", search: "自主创新", maxChars: 3000 });
for (const raw of closingTitle.ndjson.split(/\r?\n/)) {
  if (!raw.trim()) continue;
  const item = JSON.parse(raw);
  if (item.kind === "textbox") {
    const sh = p.resolve(item.id);
    sh.text = "规则可解释  模型提效率  教师作确认";
    sh.text.style = { typeface: FONT, fontSize: 43, bold: true, color: "#FFFFFF", alignment: "center", verticalAlignment: "middle", autoFit: "shrinkText" };
  }
}

// Add concise speaker notes to orient the defense flow.
const notes = [
  "开场介绍项目名称和服务对象。",
  "说明本次汇报的五个部分。",
  "团队采用职责分工方式展示，成员姓名可在提交前补充。",
  "用一句话说明项目定位，再介绍完整业务闭环和边界。",
  "强调三类角色共用一套服务端权限模型。",
  "从真实痛点出发，逐项对应系统需求和可验证结果。",
  "按学生主流程讲解，并说明教师与管理员如何进入闭环。",
  "说明前后端分离架构、业务数据库和 FastGPT 的数据边界。",
  "强调规则、模型、教师各自承担不同判断职责。",
  "解释岗位匹配权重、硬性过滤和结果可解释性。",
  "说明职业与政策双路问答，以及有来源、无来源和异常三种处理。",
  "介绍核心实体和授权关系，强调最小数据原则。",
  "展示真实工作台页面，说明三角色界面与治理能力。",
  "汇报本地测试证据和面向学生、教师、学校的应用价值。",
  "结束语：以规则保证可解释，以模型提升服务效率，以教师保留最终专业判断。",
];
for (let i = 0; i < p.slides.items.length; i++) {
  try { p.slides.getItem(i).speakerNotes.textFrame.setText(notes[i] ?? ""); } catch {}
}

await (await PresentationFile.exportPptx(p)).save(draftPath);
for (let i = 0; i < p.slides.items.length; i++) {
  const png = await p.slides.getItem(i).export({ format: "png", scale: 1 });
  await fs.writeFile(path.join(previewDir, `slide-${String(i + 1).padStart(2, "0")}.png`), new Uint8Array(await png.arrayBuffer()));
}
console.log(JSON.stringify({ draftPath, slides: p.slides.items.length }));
