# Nada Republicano Player 🎬📚

> **Local Desktop LMS & Study Companion** de alta performance integrado ao **Media Player Classic (MPC-HC / MPC-BE)**.

O **Nada Republicano Player** transforma qualquer pasta local ou biblioteca de cursos e videoaulas em uma plataforma interativa de estudos no seu computador. Com controle sincronizado do player externo, anotações, visualizador de código e materiais, busca instantânea e captura de tela diretamente para a Área de Transferência.

---

## ✨ Principais Funcionalidades

- **Sincronização Bidirecional com MPC-HC / MPC-BE:**
  - Controle de reprodução (Play, Pause, Seek, Velocidade 1x a 2x) diretamente na barra superior.
  - Sincronização em tempo real da posição, duração e status do vídeo.
  - Modo *Snap Assist* (posicionamento lado a lado da janela do app e do player).
  - *Always on Top* integrado.

- **📸 Captura de Frame para Área de Transferência (Clipboard):**
  - Botão de câmera na barra de reprodução e atalho global <kbd>Alt</kbd> + <kbd>S</kbd>.
  - Captura o frame exato em alta resolução diretamente do player.
  - Correção automática de rotação e inversão de varredura (*DIB bottom-up*).
  - A imagem vai pronta para ser colada com <kbd>Ctrl</kbd> + <kbd>V</kbd> em notas (Obsidian, Notion), mensagens ou editores de imagem.

- **🔍 Busca Global Inteligente (<kbd>Ctrl</kbd> + <kbd>K</kbd>):**
  - Paleta de comandos para buscar qualquer curso, aula ou material de apoio.
  - Ao selecionar um resultado de busca, a pasta e subpasta correspondentes se abrem automaticamente na barra lateral.

- **📂 Suporte a Pastas e Submódulos Profundos:**
  - Varredura recursiva de diretórios em múltiplos níveis sem limite de profundidade.
  - Pastas iniciam fechadas para navegação limpa, com expansão sob demanda.
  - Filtro automático de arquivos de sistema (`desktop.ini`, `Thumbs.db`, temporários).

- **💻 Leitor Integrado de Recursos e Código:**
  - Visualizador de código-fonte integrado com realce de sintaxe (*syntax highlighting*).
  - Suporte a Markdown, PDFs, arquivos de texto e anexos complementares.

- **⏱️ Histórico e Progresso:**
  - Card de continuação instantânea ("Continuar de onde parou").
  - Histórico de Cursos Recentes com acesso rápido na barra superior e no dashboard.
  - Salva automaticamente o progresso e percentual de conclusão das aulas.

---

## 🛠️ Tecnologias Utilizadas

- **Core:** [Electron](https://www.electronjs.org/) + [Node.js](https://nodejs.org/)
- **Frontend:** [Vue 3](https://vuejs.org/) (Composition API, `<script setup>`) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool:** [electron-vite](https://electron-vite.org/) + [Vite](https://vitejs.dev/)
- **State Management:** [Pinia](https://pinia.vuejs.org/)
- **Estilização:** [Tailwind CSS](https://tailwindcss.com/)
- **Ícones:** [Lucide Vue Next](https://lucide.dev/)
- **Integração Externa:** MPC-HC / MPC-BE Web Interface API

---

## 📋 Pré-requisitos

1. **Sistema Operacional:** Windows 10 ou Windows 11.
2. **Node.js:** Versão 18 ou superior.
3. **Player de Vídeo:**
   - [MPC-HC (Media Player Classic - Home Cinema)](https://github.com/clsid2/mpc-hc/releases) ou [MPC-BE](https://sourceforge.net/projects/mpcbe/) (ou pacote K-Lite Codec Pack).
   - A interface web do MPC é detectada e configurada automaticamente pelo app na porta padrão `13579`.

---

## 🚀 Instalação e Execução

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
   cd SEU_REPOSITORIO
   ```

2. **Instale as dependências:**
   ```bash
   npm install
   ```

3. **Modo de Desenvolvimento:**
   ```bash
   npm run dev
   ```

4. **Compilar para Produção:**
   ```bash
   npm run build
   ```

5. **Criar Atalho na Área de Trabalho (Windows):**
   ```bash
   npm run shortcut
   ```

---

## ⌨️ Atalhos Úteis

| Atalho | Ação |
|---|---|
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | Abrir a Paleta de Busca / Comandos |
| <kbd>Alt</kbd> + <kbd>S</kbd> | Tirar print do frame atual do MPC e copiar para a Área de Transferência |
| <kbd>Esc</kbd> | Fechar paleta de busca ou modais abertos |

---

## 📁 Estrutura do Projeto

```text
├── scripts/                # Scripts utilitários (criação de atalhos, automações)
├── src/
│   ├── main/               # Processo Principal do Electron
│   │   ├── ipc/            # Handlers de comunicação IPC (Cursos, MPC, Configurações)
│   │   ├── services/       # Serviços (MpcBridge, CourseScanner, Storage, Watcher)
│   │   └── utils/          # Utilitários (Orientação de imagem, limpeza de títulos, registro)
│   ├── preload/            # Context Bridge (API segura exposta para o renderer)
│   ├── renderer/           # Interface Vue 3 (Dashboard, Workspace, Componentes)
│   │   └── src/
│   │       ├── components/ # Componentes da UI (TitleBar, Player, Sidebar, etc.)
│   │       ├── stores/     # Stores Pinia (courseStore, mpcStore, settingsStore)
│   │       └── composables/# Lógica reutilizável (useMpcControls, useTimeFormat)
│   └── shared/             # Tipagens e constantes compartilhadas (IPC, MPC, Cursos)
├── electron.vite.config.ts # Configuração do electron-vite
├── tailwind.config.js      # Configuração do Tailwind CSS
└── package.json            # Metadados e scripts do projeto
```

---

## 📄 Licença

Distribuído sob a licença MIT. Consulte `LICENSE` para mais informações.

