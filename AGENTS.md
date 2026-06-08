# AGENTS.md

## 项目概览
AI 旅行攻略助手 - 用户输入旅行目的地和旅行时间，AI 流式生成旅行攻略和行李建议，查询记录自动保存到数据库。

## 版本技术栈
- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **LLM SDK**: coze-coding-dev-sdk (流式调用)
- **Database**: Supabase (PostgreSQL)

## 目录结构
```
├── public/                 # 静态资源
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── generate/   # 后端 API - 流式生成旅行攻略 + 保存记录到数据库
│   │   │   │   └── route.ts
│   │   │   └── history/    # 后端 API - 查询历史记录
│   │   │       └── route.ts
│   │   ├── globals.css     # 全局样式 + 旅行主题配色
│   │   ├── layout.tsx      # 根布局
│   │   └── page.tsx        # 主页面（输入表单 + 流式结果 + 历史记录）
│   ├── components/ui/      # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/utils.ts        # 工具函数
│   └── storage/database/   # 数据库相关
│       ├── supabase-client.ts  # Supabase 客户端
│       └── shared/
│           └── schema.ts   # 数据库表结构定义
├── DESIGN.md               # 设计规范
├── AGENTS.md               # 项目规范
└── package.json
```

## 数据库表结构
- **travel_records**: 旅行查询记录（id, destination, travel_time, result, created_at）

## 构建与测试命令
- 安装依赖：`pnpm install`
- 开发：`pnpm run dev` (端口 5000)
- 类型检查：`pnpm ts-check`
- 代码检查：`pnpm lint`
- 构建：`pnpm run build`

## 核心功能
1. **后端 API** (`/api/generate`): 接收 destination 和 travelTime，调用 LLM 流式生成旅行攻略和行李建议，同时将记录保存到 Supabase 数据库
2. **后端 API** (`/api/history`): 查询历史记录，支持 limit 参数
3. **前端页面**: 输入表单 + 双栏卡片展示（旅行攻略 | 行李建议）+ 可折叠历史记录列表
4. **流式输出**: SSE 协议 + 前端 ReadableStream reader 打字机效果
5. **Markdown 渲染**: 使用 react-markdown 渲染 AI 输出

## 编码规范
- 仅使用 pnpm 管理依赖
- 严格 TypeScript，禁止隐式 any
- LLM SDK 仅用于后端代码
- 流式输出使用 SSE 协议（text/event-stream）
- 前端使用 ReadableStream reader 读取流式数据
- 数据库操作使用 Supabase SDK（`client.from()`），字段名使用 snake_case
- 所有数据库操作必须检查 `{ data, error }` 并处理错误
