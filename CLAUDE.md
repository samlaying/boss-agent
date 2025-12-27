# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"微光·求职搭子" (Glimmer Vision) is a Chrome browser extension that provides AI-powered job analysis for Boss直聘 (zhipin.com). It functions as a job-seeking assistant with night vision capabilities, helping users analyze job postings, match resumes with positions, and identify potential risks.

## Core Architecture

This is a Manifest V3 Chrome extension with the following main components:

### Key Files Structure
- **manifest.json** - Extension configuration (Manifest V3)
- **background.js** - Service worker handling API calls and core logic (889 lines)
- **content.js** - Content script injected into Boss直聘 pages (6,106 lines) - Main logic hub
- **popup.html/popup.js** - Extension popup interface and settings management
- **injected_probe.js** - Main world script for deep data extraction (Hook techniques)
- **spa_monitor.js** - SPA navigation monitoring
- **style.css** - UI styling for injected elements
- **html2canvas.min.js** - Third-party library for screenshot functionality

### Main Data Flow
1. **Content Script** (`content.js`) - Primary controller that:
   - Monitors DOM changes and job listings
   - Manages UI injection (floating buttons, analysis panels)
   - Coordinates data extraction and API calls
   - Handles job scanning and analysis workflows

2. **Service Worker** (`background.js`) - Backend that:
   - Manages DeepSeek API communication
   - Handles local storage operations
   - Provides AI analysis prompts and logic
   - Manages "energy" (free usage quota) system

3. **Injected Scripts** - Main world scripts that can:
   - Access page-level JavaScript variables
   - Hook into network requests (lab mode)
   - Extract hidden salary and job data
   - Monitor SPA navigation changes

### Message Passing Architecture
Communication between contexts follows Chrome extension messaging patterns:
- **popup.js → background.js**: Settings save/load, energy redemption, AI config generation
- **popup.js → content.js**: Direct job analysis trigger via `chrome.tabs.sendMessage`
- **content.js → background.js**: API calls, storage operations
- **content.js → injected scripts**: Data extraction requests via window events
- **injected scripts → content.js**: Callbacks through custom event system

## Key Features & Implementation

### 1. Job Analysis System
- **Deep Job Analysis**: Extracts job details, calculates match scores (0-100), identifies core strengths
- **Risk Assessment**: Detects scams, insurance sales masquerading as other roles, training loans
- **Interview Strategy**: Generates targeted questions and preparation strategies
- **Resume-JD Matching**: AI-powered matching between user resume and job descriptions

### 2. List Scanning Mode
- **Cruise Mode**: Automatic scanning of job list pages with visual indicators
- **Color Coding**: Green borders for high matches, gray transparency for low matches
- **Auto-pause**: Stops scanning when high-match jobs found (configurable threshold)

### 3. Data Extraction Techniques
- **Passive Scanning**: DOM parsing and global variable inspection
- **Active Probing** (Lab Mode): Network request interception and hooking
- **Hidden Salary Detection**: Extracts concealed salary information from page data

### 4. Security & Privacy
- **Local Storage**: All user data stored locally in browser
- **Data Sanitization**: Automatic removal of sensitive info (phone, name) before API calls
- **Risk Warnings**: Lab mode includes account suspension risk warnings

## Development Notes

### API Integration
- Uses DeepSeek API for AI analysis
- Supports both user-provided API keys and free "energy" quota system
- Serverless proxy integration for free tier management

### Target Platform
- Specifically designed for Boss直聘 (zhipin.com)
- Uses content script injection with specific URL matching
- Handles SPA navigation and dynamic content loading

### UI/UX Patterns
- Floating action buttons for job analysis
- Modal overlays for detailed analysis results
- Real-time character counting and validation
- Progressive disclosure of advanced features

### Configuration Management
- Chrome storage API for settings persistence
- Real-time settings synchronization
- Feature flags for experimental capabilities

## Development & Installation

### Loading the Extension
1. Navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the repository root directory (containing `manifest.json`)

### Chrome Extension Architecture
- **Manifest V3**: Uses modern service worker instead of background pages
- **Content Security Policy**: Restricted to specific domains (zhipin.com, deepseek.com)
- **Permissions**: Requires `storage`, `scripting`, `tabs`, `activeTab`, `notifications`

## Important Considerations

### Security Analysis
This extension uses web scraping and data extraction techniques that may be considered aggressive:
- Hook techniques for data extraction
- Network request interception in "lab mode" (`enableLabMode` flag)
- Potential violation of website terms of service
- Risk of account suspension for users

### Lab Mode (`enableLabMode`)
When enabled in popup.js:51-59, shows user warning about:
- Network request interception risks
- Potential account suspension
- Requires explicit confirmation before enabling

### Code Quality Notes
- Large monolithic files (content.js > 6,000 lines)
- Mixed Chinese/English comments and variable names
- Extensive use of console logging for debugging
- Complex state management across multiple contexts

### Legal & Ethical
- Includes comprehensive disclaimer regarding data privacy
- Warns users about account risks in lab mode
- Designed for personal job-seeking assistance only
- Commercial use restrictions mentioned in documentation