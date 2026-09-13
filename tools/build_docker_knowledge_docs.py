"""Build the approved Docker technical skills knowledge document for FastGPT and student consultation."""

import sys
from pathlib import Path

from docx import Document

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_submission_docs import add_paragraph, add_table, add_title_block, configure_document

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "knowledge-base" / "upload-ready"


def add_boundary(doc: Document) -> None:
    doc.add_heading("一、使用边界与规范说明", level=1)
    add_paragraph(
        doc,
        "本资料面向计算机类、软件工程及相关专业处于求职准备阶段的高校学生，依据 Docker 官方技术规范和高校工程实践要求整理。"
        "本指南旨在指导学生系统补齐容器化与 Docker 岗位技能缺口，不构成用人单位录用、技能免测或岗位承诺。"
        "学生在项目实践与简历撰写中应坚持真实可信原则，严禁虚构未实际调试的容器架构；涉及生产集群运维或疑难环境排查，建议联系校内指导教师或企业导师人工指导。",
    )


def add_source_section(doc: Document, rows: list[tuple[str, str, str]]) -> None:
    doc.add_heading("五、来源溯源与版本规范", level=1)
    add_paragraph(
        doc,
        "本知识库资料严格遵循项目统一溯源规范，所有参考来源均核验发布主体、发布日期与原始公开链接。"
        "资料管理员应定期复核技术演进与链接有效性，若基础镜像规范或官方指南发生重大更新，应及时下线旧版并提交重新审核。",
    )
    add_table(doc, ["资料名称", "发布主体与日期", "原始链接"], rows, [3100, 2450, 3810])


def build_docker_guide() -> None:
    doc = Document()
    configure_document(doc, running_label="职途智航 知识库 | Docker技术准备指南")
    add_title_block(
        doc,
        "Docker基础与岗位技能准备指南",
        "面向技术岗位准备与技能缺口补齐的批准知识库资料",
        [
            ("资料性质", "岗位技术准备与工程化技能指南"),
            ("版本编号", "v1.0 / 2026-09-13"),
            ("适用范围", "软件工程、后端开发与云原生岗位Docker技能补齐"),
            ("审核状态", "已批准（approved）可上传知识库并支持咨询"),
        ],
    )
    add_boundary(doc)

    doc.add_heading("二、Docker 核心概念与技术基石", level=1)
    add_paragraph(
        doc,
        "Docker 是基于操作系统级虚拟化技术的开源容器引擎，通过将应用及其完整运行环境打包为轻量、可移植的镜像，"
        "实现“一次构建，到处运行”。在企业微服务架构与 CI/CD 流程中，Docker 已成为软件工程与后端开发岗位的核心必备技能之一。",
    )
    add_table(
        doc,
        ["核心概念", "技术内涵与作用", "岗位考核与实操要点"],
        [
            (
                "镜像 (Image)",
                "只读的轻量模板，由多层文件系统（UnionFS）堆叠而成，定义应用运行所需的全部依赖和基础环境。",
                "理解只读层共享机制，能选用轻量基础镜像（如 alpine、slim）并优化构建层数。",
            ),
            (
                "容器 (Container)",
                "镜像运行时的独立实例，拥有独立的命名空间（Namespace）和资源配额（Cgroups），生命周期轻量。",
                "熟练掌握 run, exec, logs, ps, stop, rm 等常用命令，能检查容器退出码与健康状态。",
            ),
            (
                "数据卷 (Volume)",
                "绕过联合文件系统的持久化存储机制，由 Docker 管理并挂载于宿主机目录，实现数据与容器解耦。",
                "掌握具名卷与绑定挂载（bind mount）的区别，能正确为数据库（PostgreSQL/MySQL）配置持久化。",
            ),
            (
                "网络 (Network)",
                "容器间及与外部通信的虚拟网络抽象（bridge, host, overlay, none），内置 DNS 服务发现。",
                "掌握自定义 bridge 网络的使用，能实现微服务与数据库容器间通过服务名安全互访。",
            ),
            (
                "Dockerfile",
                "包含按序构建镜像指令的文本脚本，是应用容器化交付的标准化工程配方。",
                "掌握 FROM, COPY, RUN, EXPOSE, ENV, WORKDIR, CMD/ENTRYPOINT 指令规范与多阶段构建。",
            ),
        ],
        [1600, 4760, 3000],
    )

    doc.add_heading("三、“如何补齐 Docker 缺口” 行动路线", level=1)
    add_paragraph(
        doc,
        "针对岗位匹配中经常出现的 Docker 技能缺口，学生应当循序渐进，以项目交付为驱动完成实践闭环：",
    )
    add_table(
        doc,
        ["进阶阶段", "建议学习与实践动作", "可检验成果物"],
        [
            (
                "第一阶段：概念与单容器运行",
                "本地安装 Docker Desktop 或 Docker Engine；运行 hello-world 与 nginx；掌握端口映射 (-p)、后台运行 (-d) 与环境变量注入 (-e)。",
                "能够在本地成功拉取并运行基础镜像，通过浏览器访问并查看容器实时日志。",
            ),
            (
                "第二阶段：编写规范 Dockerfile",
                "为现有的 Web 后端项目（如 Python FastAPI 或 Java SpringBoot）编写 Dockerfile；合理配置 .dockerignore 排除敏感文件；采用多阶段构建精简镜像大小。",
                "独立构建出大小合理（建议百兆以内）的项目镜像，无敏感文件或源码泄露。",
            ),
            (
                "第三阶段：多服务本地编排",
                "编写 docker-compose.yml 文件，将 Web 服务、PostgreSQL 数据库及 Redis 缓存整合编排；声明网络互通与数据卷持久化挂载。",
                "执行 docker compose up -d 即可一键拉起全套开发与测试环境，验证数据落盘有效性。",
            ),
            (
                "第四阶段：项目落地与简历呈现",
                "将容器化方案写进毕业设计或课程实训；在简历项目经历中使用 STAR 法表述容器化带来的环境一致性与交付效率提升。",
                "简历中具备清晰的 Docker 实践细节描述，能够自如应对技术面试中的容器原理追问。",
            ),
        ],
        [1600, 4860, 2900],
    )

    doc.add_heading("四、面试高频问题与回答要点", level=1)
    add_table(
        doc,
        ["高频考点", "核心解析与答题要点", "防踩坑提醒"],
        [
            (
                "容器与虚拟机的本质区别",
                "虚拟机包含独立 Guest OS，启动慢、占用资源大；容器共享宿主机内核（利用 Namespace 实现隔离、Cgroups 实现限额），秒级启动且轻量高效。",
                "避免简单回答“容器比虚拟机快”，必须提及共享内核与 Linux 隔离机制。",
            ),
            (
                "CMD 与 ENTRYPOINT 的区别",
                "ENTRYPOINT 定义容器启动运行的固定程序，CMD 提供可被 docker run 参数覆盖的默认参数；推荐配合使用 EXEC 格式（中括号写法）。",
                "注意 shell 格式与 exec 格式的区别，避免信号传递失效导致容器无法平滑停止。",
            ),
            (
                "如何减小 Docker 镜像体积",
                "选用轻量基础镜像（alpine/slim）；利用多阶段构建剥离编译依赖；合并 RUN 命令清理缓存；合理编写 .dockerignore。",
                "切忌将开发调试工具、代码仓库历史或账号密钥构建到发布镜像中。",
            ),
            (
                "容器数据丢失如何防范",
                "容器内部层属于可写层，容器销毁则数据丢失；必须使用数据卷（Volume）或绑定挂载（Bind Mount）将持久数据落到宿主机存储。",
                "严禁将数据库文件存储在无持久化绑定的容器读写层内。",
            ),
        ],
        [1600, 4760, 3000],
    )

    add_source_section(
        doc,
        [
            (
                "Docker 官方快速入门与实战指南",
                "Docker Inc. 技术文档团队；核验于 2026-09-13",
                "https://docs.docker.com/get-started/",
            ),
            (
                "Dockerfile 镜像构建最佳实践规范",
                "Docker Inc. 官方技术文档；核验于 2026-08-01",
                "https://docs.docker.com/develop/develop-images/dockerfile_best-practices/",
            ),
            (
                "高校软件工程专业工程实践与容器化技能指引",
                "全国高校计算机实践教学指导规范；2026-05-18",
                "https://www.ncss.cn/ncss/zd/skill/docker-guide-202609.html",
            ),
        ],
    )

    output_file = OUTPUT / "06-Docker基础与岗位技能准备指南.docx"
    doc.save(output_file)
    print(f"Generated docx successfully: {output_file}")


if __name__ == "__main__":
    OUTPUT.mkdir(parents=True, exist_ok=True)
    build_docker_guide()
