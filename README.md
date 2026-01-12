<!-- <p align="center">
  <img src="public/logo.png" alt="Searchy AI Logo" width="80" height="80" />
</p> -->

<h1 align="center">Searchy AI</h1>

<p align="center">
  <strong>Intelligent search beyond keywords</strong>
</p>

<p align="center">
  Search how you think. Find what you mean.
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#demo">Demo</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#documentation">Docs</a> •
  <a href="#roadmap">Roadmap</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-private%20beta-green" alt="Status" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome" />
</p>

---

## 🎯 What is Searchy AI?

**Searchy AI** is a next-generation semantic search engine that understands *meaning*, not just text. Built on state-of-the-art multimodal AI, it enables users to search using natural language, images, or both — delivering results that truly match intent.

> "Find a cozy sweater that matches my blue jeans" → Searchy AI understands context, style, and compatibility.

---

## ✨ Features

### 🗣️ Natural Language Search
Describe what you're looking for in plain English. No keywords needed.
- *"A lightweight laptop bag for daily commute"*
- *"Comfortable running shoes for flat feet"*
- *"Birthday gift ideas for a 10-year-old who loves science"*

### 🖼️ Visual Search
Upload an image and find similar products instantly. Perfect for when words aren't enough.

### 🧠 Contextual Understanding
Go beyond basic matching. Searchy AI understands abstract concepts and relationships.
- *"Shoes that go well with a maroon shirt and cream pants"*
- *"Home office setup for a minimalist aesthetic"*

### 🌍 Multilingual Support
Search in 9 languages: English, German, Portuguese, Hindi, Arabic, Spanish, Chinese (Simplified), French, and Italian.

---

## 🚀 Demo

Experience Searchy AI in action:

```
🔗 Live Demo: https://searchy.online
```

### Try These Searches:
| Type | Example |
|------|---------|
| Descriptive | *"black running shoes with red accents"* |
| Abstract | *"a backpack that matches cream denim"* |
| Visual | Upload any product image |
| Contextual | *"weekend brunch outfit ideas"* |

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- pnpm (recommended)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/adityaanand176/searchy-ai.git
cd searchy-ai

# Install frontend dependencies
pnpm install

# Install backend dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Add your API keys to .env

# Start the development server
pnpm dev
```

### Environment Variables

Create a `.env` file with:

```env
COHERE_API_KEY=your_cohere_api_key
PINECONE_API_KEY=your_pinecone_api_key
```

---

## 📖 Documentation

### Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React Frontend │ ──▶ │   FastAPI       │ ──▶ │   Cohere        │
│   (Vite + TW)    │     │   Backend       │     │   Embeddings    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │                        │
                                ▼                        ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │   Express.js    │     │   Pinecone      │
                        │   API Gateway   │     │   Vector DB     │
                        └─────────────────┘     └─────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, Tailwind CSS |
| Backend | FastAPI (Python), Express.js |
| AI/ML | Cohere embed-v4.0 (multimodal) |
| Vector DB | Pinecone |
| Deployment | Vercel / Railway |

---

## 🗺️ Roadmap

- [x] Natural language search
- [x] Image-based visual search
- [x] Multimodal query support
- [x] Multilingual support (9 languages)
- [ ] Personalized recommendations
- [ ] Outfit/style suggestions via AI
- [ ] Hybrid filtering (semantic + attributes)
- [ ] Voice search integration
- [ ] Browser extension
- [ ] Mobile app (iOS/Android)

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Fork the repo
# Create your feature branch
git checkout -b feature/amazing-feature

# Commit your changes
git commit -m 'Add amazing feature'

# Push to the branch
git push origin feature/amazing-feature

# Open a Pull Request
```

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 💬 Community & Support

- 📧 **Email**: hello@searchy.ai
- 🐦 **Twitter**: [@SearchyAI](https://twitter.com/searchyai)
- 💼 **LinkedIn**: [Searchy AI](https://linkedin.com/company/searchy-ai)
- 💬 **Discord**: [Join our community](https://discord.gg/searchyai)

---

## 👥 Team

<table>
  <tr>
    <td align="center">
      <a href="https://www.linkedin.com/in/krish-das-215aa4278/">
        <strong>Krish Das</strong>
      </a>
      <br />
      Co-founder
    </td>
    <td align="center">
      <a href="https://www.linkedin.com/in/aditya-astralite-anand/">
        <strong>Aditya Anand</strong>
      </a>
      <br />
      Co-founder
    </td>
    <td align="center">
      <a href="https://www.linkedin.com/in/yashhhhh/">
        <strong>Yash Raj Singh</strong>
      </a>
      <br />
      Co-founder
    </td>
  </tr>
</table>

---

<p align="center">
  <strong>Searchy AI</strong> — Search smarter, not harder.
</p>

<p align="center">
  ⭐ Star us on GitHub if you find this useful!
</p>
