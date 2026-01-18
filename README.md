# Qwery-Hub

**Qwery-Hub** is an AI-powered study assistant designed to help NUS students manage learning, schedules, and tasks in a single, distraction-free workspace.

This project was built during **NUS HackNRoll** with a focus on productivity, modular UI, and real student workflows.
  
📦 **Repository:** https://github.com/jerejms/qwery-hub

---

## ✨ Features

- 💬 **AI Chat Assistant**
  - Ask questions, sort priorities, and find what need to do now.

- 📅 **NUSMods Integration**
  - Sync and visualize your timetable directly from NUSMods.

- 📝 **Task & Canvas Widgets**
  - View and manage academic tasks alongside chat.

- 🧩 **Widget-Based Sidebar**
  - Modular UI components for maximum flexibility.

- 🔁 **Shared Type System**
  - Centralized schemas and types across apps for consistency.

---

## 🏗️ Tech Stack

- **Frontend:** Next.js, React, TypeScript
- **Styling:** CSS / Tailwind
- **Architecture:** Monorepo
- **Deployment:** Vercel

---

## 📁 Repository Structure
```
├── apps/
│ └── web/ # Main Next.js application
│ ├── app/ # App router
│ ├── lib/ # Utilities & helpers
│ ├── public # Shared image/video
│ ├── server/integration # fetch API calling
│ └── api/ # API routes
├── packages/
│ └── shared/ # Shared schemas, types, utilities
├── .gitignore
├── LICENSE
├── README.md
└── package-lock.json
```

## 🚀 Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm

### Installation

```bash
cd apps/web
npm install
```

### Run Locally

npm run dev

Then opened it in your browser
```bash
http://localhost:3000
```

## Monorepo Packages

apps/web
- Next.js web application
- UI components & widgets
- API routes for chat and scheduling logic

packages/shared
- Shared TypeScript types
- Validation schemas
- Cross-app utilities

## Development Workflow

- Do NOT commit directly to main
- Create a feature branch:
- git checkout -b feat/your-feature-name
- Commit your changes
- Open a Pull Request
- Merge after review
