# Contributing to Ottehr

Thank you for considering contributing to Ottehr! We appreciate your interest in making our open-source EHR telehealth platform even better. Please take a moment to review this document to understand how you can contribute effectively.

Read our Code Of Conduct to keep our community approachable and respectable.

## What Contributions We're Looking For

We welcome contributions in the following areas:

- **Bug Reports:** Help us identify and resolve issues by reporting any bugs you encounter.
- **Feature Requests:** Share your ideas for enhancements or new features that could benefit the Ottehr community.
- **Code Contributions:** Contribute to the development of Ottehr by submitting pull requests for bug fixes, new features, or improvements.
- **Documentation:** Enhance our documentation to make it more comprehensive and user-friendly.
- **Testing:** Help us maintain a stable platform by testing new features or fixes and reporting any issues.

## How to File a Bug Report

If you've identified a bug or issue, please follow these steps:

1. **Check Existing Issues:**
   Before filing a new issue, check if a similar one already exists.

2. **Use Issue Templates:**
   If filing a bug report or feature request, use the provided templates to ensure we have all the necessary details.

3. **Provide Details:**
   Clearly describe the issue or feature, including steps to reproduce if applicable.

4. **Attach Screenshots:**
   If relevant, attach screenshots to help illustrate the problem or proposed feature.

## How to Set Up Locally and Run Tests

To set up Ottehr locally and run tests, follow these steps:

1. **Fork the Repository:**
   Fork the Ottehr repository by navigating to [https://github.com/masslight/ottehr/fork](https://github.com/masslight/ottehr/fork).

2. **Clone the Repository:**
   Use the following command to clone the repository to your local machine:
   ```bash
   git clone https://github.com/{{your-git-user-name}}/{{ottehr-fork-name}}.git
   ```
3. **Install Dependencies:**
   Navigate to the cloned repository and run:
   ```bash
   pnpm i
   ```

4. **Run Tests:**
   Execute the tests with:
   ```bash
   pnpm test
   ```

## ESLint

To enhance code readability, we maintain a robust ESLint configuration that ensures strict adherence to coding standards. For an optimal coding experience with real-time linting feedback, we highly recommend using Visual Studio Code (VSCode), which offers an outstanding live linting environment.

To get linting in VSCode:

1. Install the [ESLint Extension](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint).
2. Always open the repo from its root. This allows the extension to detect the `.eslintrc.json` file which specifies the linter configuration.
3. (Optional) Use the [VSCode workspace](./.vscode/Ottehr.code-workspace) for a helpful alternative organization of the project in the VSCode 'Explorer', which most developers find useful. This can be opened in 2 ways:
   1. Open [the file](./.vscode/Ottehr.code-workspace) in VS Code. Click on the "Open Workspace" button in the bottom-right.
   2. `code .vscode/Ottehr.code-workspace`


## Roadmap and Project Vision

Visit our [project board](https://github.com/masslight/ottehr/projects) to view the current roadmap and upcoming features. The project vision is to create a robust and user-friendly open-source EHR telehealth platform.

## How to Get in Touch With Us

If you have questions, suggestions, or just want to chat, you can reach out to us via:

- **GitHub Discussions:** Start a discussion in the [Discussions](https://github.com/masslight/ottehr/discussions) section.
- **Issues:** Use the GitHub [issues](https://github.com/masslight/ottehr/issues) tracker for bug reports and feature requests.
- **Email:** Contact us at info@ottehr.com for additional inquiries.

We appreciate your contributions and look forward to building an outstanding telehealth platform together!