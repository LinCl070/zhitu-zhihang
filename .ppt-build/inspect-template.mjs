import { FileBlob, PresentationFile } from "@oai/artifact-tool";
import fs from "node:fs/promises";
const sourcePath = "D:/基于大模型的教育管理应用创新赛/output/docx/基于大模型教育管理应用创新赛（PPT模版）.pptx";
const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
console.log((await presentation.inspect({kind:"slide,textbox,shape,image,table,chart,notes,layout", maxChars:50000})).ndjson);
console.log("SLIDES", presentation.slides.items.length);
console.log("SIZE", presentation.slideSize);
for (let i=0;i<presentation.slides.items.length;i++) {
  const slide = presentation.slides.getItem(i);
  const png = await slide.export({format:"png", scale:1});
  await fs.writeFile(`D:/基于大模型的教育管理应用创新赛/.ppt-build/template-${i+1}.png`, new Uint8Array(await png.arrayBuffer()));
}
