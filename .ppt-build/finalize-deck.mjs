import path from "node:path";
import { pathToFileURL } from "node:url";
import fs from "node:fs/promises";

const workspaceDir = "D:/基于大模型的教育管理应用创新赛";
const SKILL_DIR = "C:/Users/10448/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations";
const candidatePath = path.join(workspaceDir, ".ppt-build/职途智航项目介绍_模板版_draft.pptx");
const finalPath = path.join(workspaceDir, "output/pptx/职途智航项目介绍_答辩版_团队与四图版.pptx");
const sourceTemplatePath = path.join(workspaceDir, "output/docx/基于大模型教育管理应用创新赛（PPT模版）.pptx");
const pythonExecutable = "C:/Users/10448/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe";
await fs.mkdir(path.dirname(finalPath), { recursive: true });

const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href);
const result = await finalizePresentation({
  explicitTotalSlideCount: 15,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  sourceTemplatePath,
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  verifyArtifactToolImport: true,
  receiptPath: path.join(workspaceDir, ".ppt-build/职途智航项目介绍_团队与四图版.validation.json"),
});
console.log(JSON.stringify(result));
