# ZeroScript

> A free AI-powered Roblox Studio assistant that connects supported AI chat providers directly to Roblox Studio through the built-in MCP server.

---

## Overview

ZeroScript is an open-source project that allows supported AI models to interact directly with Roblox Studio. Through a browser extension and a local bridge, AI can read, edit and generate Roblox content without requiring API keys or paid subscriptions.

The project includes:

* Browser Extension
* Python Bridge
* Roblox Studio MCP integration
* Windows launcher
* macOS launcher and compatibility improvements
* Configuration files
* Documentation and assets

---

## Features

* Connect AI directly to Roblox Studio
* Read and edit Luau scripts
* Execute Luau code
* Browse the Roblox hierarchy
* Generate assets and models
* Creator Store integration
* Persistent project memory
* Support for multiple AI providers
* Open source
* No paid subscription required

---

## Supported AI Providers

* DeepSeek
* Gemini
* Kimi
* GLM
* Qwen
* Arena
* Meta AI

---

## Project Structure

```text
zeroscript/
│
├── bridge.py                     # Main bridge between browser and Roblox Studio
├── launch_studio_mcp.py          # Launch helper for Roblox Studio MCP
├── start.py                      # Cross-platform launcher for Windows/macOS/Linux
├── start.sh                      # Linux/macOS shell wrapper for start.py
├── start(MacOS).command          # macOS wrapper for start.py
├── start(Windows).bat            # Windows wrapper for start.py
├── config.json                   # Configuration
├── CHANGELOG.md                  # Release history
├── LICENSE
│
├── assets/
│   ├── banner.svg
│   ├── banner.png
│   └── icon.png
│
├── logs/
│
└── zeroscript-extension/
    ├── manifest.json
    ├── background.js
    ├── popup.html
    ├── popup.js
    ├── overlay.css
    ├── README.md
    │
    ├── core/
    │   ├── main.js
    │   ├── parser.js
    │   └── config.js
    │
    └── providers/
        ├── deepseek.js
        ├── gemini.js
        ├── kimi.js
        ├── glm.js
        ├── qwen.js
        ├── qwen-net.js
        ├── arena.js
        └── meta.js
```

---

# Installation

## Prerequisites

* Python 3.9 or newer
* Google Chrome, Microsoft Edge, or another Chromium-based browser
* Roblox Studio installed
* Roblox Studio MCP server enabled in Assistant Settings > MCP Servers
* The `zeroscript-extension` folder loaded as an unpacked extension

## Common setup for all platforms

1. Download or clone the repository.
2. Extract the ZIP into a folder.
3. Open the browser and load `zeroscript-extension` as an unpacked extension.
4. Open Roblox Studio and enable the built-in MCP server.
5. Open a terminal or command prompt in the extracted repository folder.

## Run ZeroScript for your platform

### Windows

1. Double-click `start(Windows).bat`.
2. If the wrapper does not work, open Command Prompt and run:

```text
py -3 start.py
```

### macOS

1. Double-click `start(MacOS).command`.
2. If the file is not executable, run:

```bash
chmod +x start.py start.sh "start(MacOS).command"
./start(MacOS).command
```

### Linux

1. Open a terminal in the repository folder.
2. Make the launcher executable if needed:

```bash
chmod +x start.py start.sh
```
3. Run:

```bash
./start.sh
```

## Cross-platform fallback

If a wrapper is unavailable or you prefer the single command, run:

```bash
python3 start.py
```

`start.py` is the recommended launcher for all supported platforms.

---

# Browser Extension

The included extension injects the ZeroScript interface into supported AI chat websites and forwards commands to the local bridge.

Supported browsers:

* Google Chrome
* Microsoft Edge
* Chromium-based browsers

---

# Included Components

### Bridge

`bridge.py`

Handles communication between:

* Browser Extension
* Roblox Studio
* MCP Server

---

### Browser Extension

Located in:

```text
zeroscript-extension/
```

Contains:

* Provider integrations
* UI overlay
* Background service
* Parser
* Configuration

---

### Launchers

Windows:

```text
start(Windows).bat
```

macOS:

```text
start(MacOS).command
```

---

# Configuration

Project settings are stored inside:

```text
config.json
```

Modify this file to customize bridge behavior and runtime settings.

---

# Logs

Runtime logs are written to:

```text
logs/
```

These are useful for debugging bridge or connection issues.

---

# License

This project is licensed under the GPL-3.0 License.

See the included `LICENSE` file for full details.

---

# Credits

## Original Project

Huge thanks to **sebattfg** for creating ZeroScript and developing the core project, including:

* Browser extension
* Python bridge
* Provider integrations
* Roblox Studio MCP functionality
* Overall architecture and ongoing development

Without the original work from **sebattfg**, this project would not exist.

## macOS Compatibility

**archivealf** contributed the macOS compatibility layer, including:

* Native macOS launcher
* macOS startup workflow
* macOS bridge compatibility
* Roblox Studio launch improvements for macOS
* Platform-specific fixes required to run ZeroScript on macOS

This allows ZeroScript to be used on both Windows and macOS.

---

# Acknowledgements

Special thanks to:

* **sebattfg** — Original creator and lead developer of ZeroScript.
* **archivealf** — macOS and Linux compatibility, launcher, and platform support.

---

# Disclaimer

ZeroScript is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Roblox Corporation or any AI provider listed above.

Use this software responsibly and in accordance with the terms of service of Roblox and the supported AI platforms.
