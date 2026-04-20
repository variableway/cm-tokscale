# TokScale Enhancement

## Task 1: 项目分析

1. 分析目前项目的架构，模块
2. 分析目前项目每一个模块的大体逻辑
3. 完成目前项目模块和模块之间的交互方式
4. 完成Agents.md 文件的编写
5. 完成这个项目Usage的编写，如果docs目录中已经有，见参考，但是提炼成cheatsheets
6. 提炼出TUI交互的数据结构，和交互接口，分不同模块写入到Spec目录中

以上内容全部写入到tasks目录的analysis目录中，Agents.md文件可以根目录下面


## Task 2: Model Token By Date 优化 ✅ DONE

目前发现某个模型的内容不能按照天来展示，期望可以选择一个模型之后，也可以按照天来展示，
或者有一个更详细的Dashboard，可以按照Model By Date 的展示

**已实现**: `tokscale model-dates [model]` 命令
- 不带参数：显示所有模型的每日使用明细
- 带模型名：模糊匹配并显示该模型的每日数据表格
- 支持 `--json`, `--light`, 日期过滤, 平台过滤
- 实现文件: `packages/cli/src/cli.ts` (showModelByDateReport)
- 数据提取: `packages/cli/src/merge.ts` (extractModelByDate)

## Task 3: Merge Different Machine Data ✅ DONE (Phase 1) 

如果一个场景，一个人有好几台及其，那么如何总体整理这些数据呢？
1. 一种加一层聚合起，client可以提交数据上去，然后在聚合器合并
2. 一种就是存粹在本机导出数据文件，传送到另外机器一起合并，但是实时性不好
3. 似乎第一种场景会更好，每个机器上加Daemon，然后数据上传github或者一起其他地方，
定时下载下来做Merge

请分析这些实现可能性，有哪些好处和哪些不好的地方，然后给出一份分析报告，提出你建议的使用哪个方案，
然后进行planning，task，然后实现


