# Litcode Premium Extension

## Overview
The Litcode Premium Extension is a powerful browser extension designed to enhance your LeetCode experience. It allows you to seamlessly explore company-specific questions directly on the LeetCode problemset and view relevant company data on individual problem pages. This tool is ideal for job seekers, competitive programmers, and anyone looking to streamline their LeetCode practice with a focus on real-world company challenges.

## Features
- **Company Question Integration:** Browse LeetCode's problemset with integrated company filters, making it easy to find questions asked by specific companies.
- **On-Page Company Data:** Get instant access to company-related information directly on any LeetCode problem page, providing valuable context for your preparation.
- **Seamless LeetCode Experience:** Designed to integrate smoothly with the existing LeetCode UI without disruptions.

## Installation

### From Source
1. **Clone the repository:**
   ```bash
   git clone https://github.com/PoorvajHinge/lithcode-premium.git
   cd lithcode-premium
   ```
2. **Load in your browser:**
   *   **Google Chrome / Microsoft Edge:**
       1.  Open the Extension Management page by navigating to `chrome://extensions` (or `edge://extensions`).
       2.  Enable Developer Mode by clicking the toggle switch next to **Developer mode**.
       3.  Click the **Load unpacked** button and select the extension's directory (`lithcode-premium`).
   *   **Mozilla Firefox:**
       1.  Open `about:debugging` in your browser.
       2.  Click **This Firefox** (or **This Nightly**, etc.).
       3.  Click **Load Temporary Add-on...** and select any file inside the extension's directory. (Note: Firefox temporary add-ons are removed when the browser closes).

## Usage
Once installed, navigate to [LeetCode](https://leetcode.com/) and explore the problemset or individual problem pages. The extension will automatically activate and display the enhanced features.

## Project Structure
- `manifest.json`: Defines the extension's properties, permissions, and scripts.
- `background.js`: Handles background tasks and listens for browser events.
- `content.js`: Injects content into LeetCode problem pages to display company data.
- `problemset.js`: Enhances the LeetCode problemset page with company-specific filtering.
- `content.css`: Styling for the injected content on problem pages.
- `problemset.css`: Styling for enhancements on the problemset page.
- `data/`: Contains JSON files for company questions and metadata.
    - `data/*.json`: Problem-specific data.
    - `data/companies/*.json`: Company-specific data.
    - `data/company-list.json`: A list of companies.
    - `data/meta.json`: Metadata for the extension.

## Contributing
We welcome contributions! If you have suggestions for new features, bug fixes, or improvements, please feel free to:
1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'feat: Add new feature'`).
5.  Push to the branch (`git push origin feature/your-feature-name`).
6.  Open a Pull Request.

## License
This project is open-source and available under the [MIT License](https://opensource.org/licenses/MIT).
