# Tanuki Temaki 🦝🍱

A browser-based anime and manga discovery tool that helps you find new series through intelligent relationship mapping and tag-based clustering, powered by AniList.

## 🎯 Features

- **📺 📖 Anime & Manga Support**: Discover both anime series and manga titles from AniList's comprehensive database
- **Smart Tag Generation**: Automatically generates thematic tags from series descriptions, genres, and metadata
- **Relationship Mapping**: Traces sequels, prequels, adaptations, and recommendations to build a graph of related series
- **Visual Discovery**: View relationships as an interactive tree or detailed table
- **Intelligent Clustering**: Groups similar series together based on tag similarity
- **Media Type Filtering**: Toggle between anime-only, manga-only, or both in search and results
- **Multi-Platform Links**: Displays streaming/reading availability across platforms (Crunchyroll, Netflix, MangaPlus, Viz, etc.)
- **Database Caching**: Fetches series data once and caches it for instant future access
- **Multi-Browser Support**: Chrome, Edge, and Firefox extensions (for Crunchyroll anime)
- **Dark Theme**: Easy on the eyes for those late-night binge planning sessions

## 🏗️ Architecture

Tanuki Temaki uses a hybrid architecture:

- **AniList Integration**: Primary data source for both anime and manga metadata, relationships, and multi-platform availability
- **Browser Extension** (Chrome/Firefox): Optional - extracts data from Crunchyroll pages for anime-only workflows
- **Backend API** (Node.js + Express): Processes data, generates tags, manages database, handles AniList rate limiting
- **Frontend Web App** (React + TypeScript): Beautiful UI with tree and table visualizations, media type switching
- **Database** (PostgreSQL): Caches series data and relationships for fast access

## 📦 Project Structure

```
tanuki-temaki/
├── packages/
│   ├── backend/       # Express API server
│   ├── web/           # React frontend
│   └── extension/     # Chrome/Firefox extension
├── shared/            # Shared TypeScript types
├── docker-compose.yml # Docker deployment
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20
- pnpm >= 8
- Docker (optional, for containerized deployment)
- PostgreSQL 16+ (if not using Docker)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd tanuki-temaki
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start PostgreSQL** (if not using Docker)
   ```bash
   docker run -d \
     --name tanuki-postgres \
     -e POSTGRES_USER=tanuki \
     -e POSTGRES_PASSWORD=your_password \
     -e POSTGRES_DB=tanuki_temaki \
     -p 5432:5432 \
     postgres:16-alpine
   ```

5. **Run database migrations**
   ```bash
   cd packages/backend
   pnpm prisma:migrate
   ```

6. **Start development servers**
   ```bash
   # Terminal 1: Backend
   pnpm dev:backend

   # Terminal 2: Frontend
   pnpm dev:web

   # Terminal 3: Build extension
   cd packages/extension
   pnpm build:all
   ```

7. **Install the extension**
   - **Chrome**: Go to `chrome://extensions`, enable Developer mode, click "Load unpacked", select `packages/extension/dist-chrome`
   - **Firefox**: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", select any file in `packages/extension/dist-firefox`

8. **Open the web app**
   ```
   http://localhost:5173
   ```

### Docker Deployment

For a fully containerized setup:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access the web app at `http://localhost`.

## 📚 Usage

### Anime Discovery
1. Open the Tanuki Temaki web app (`http://localhost:5173`)
2. Select **📺 Anime** mode (default)
3. Search by anime title (e.g., "Spy x Family") OR paste a Crunchyroll URL
4. Click "Discover" to view the series and trace relationships
5. Toggle between tree view (visual graph) and table view (detailed list)
6. Filter by tags, streaming platforms, and related media

### Manga Discovery
1. Open the Tanuki Temaki web app
2. Switch to **📖 Manga** mode
3. Search by manga title (e.g., "Chainsaw Man")
4. Explore related manga, adaptations, and recommendations
5. View reading platform availability (MangaPlus, Viz, BookWalker, etc.)
6. Filter results by tags and platforms

### Advanced Features
- **Media Type Filter**: In results, choose to show anime only, manga only, or both
- **Tag Filtering**: Click tags to require (✓), exclude (✗), or neutral
- **Platform Filtering**: Toggle streaming/reading services on/off
- **Clustering**: Related series are automatically grouped by similarity

## 🛠️ Technology Stack

### Backend
- Node.js 20+ with TypeScript
- Express 4
- Prisma ORM
- PostgreSQL 16
- AniList GraphQL API integration
- WebSocket (ws) for extension communication

### Frontend
- React 18 with TypeScript
- Vite 5
- shadcn/ui + Tailwind CSS
- React Flow (tree visualization)
- TanStack Table (data tables)
- Zustand (state management)
- TanStack Query (server state)

### Extension
- Manifest V3
- TypeScript
- webextension-polyfill (cross-browser compatibility)

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🙏 Acknowledgments

- Logo features a cute tanuki (Japanese raccoon dog) chef
- Powered by [AniList](https://anilist.co/) - the best anime and manga database
- Inspired by the need for better anime and manga discovery tools
- Built with love for the anime and manga community

---

Made with 🦝 by the Tanuki Temaki team
