# Usage

There are several different ways in which you can run the Linter.

## Automatic Formatting

This fork delegates automatic formatting to Automatic Linker. Enable its `Run Linter after formatting` setting to run Linter as part of that workflow.
Linter does not run on save or when switching files, and does not override the save command or Vim's `:w` handler.

## Obsidian Commands

| Obsidian Command | Description | Default Keybinding |
| ---------------- | ----------- | ------------------ |
| `Lint the current file` | Runs the Linter rules against the current file | `Ctrl+Alt+L` |
| `Lint all files in the vault` | Runs the Linter rules against all files in the vault | N/A |
| `Lint all files in the current folder` | Runs the Linter against all files in the current folder and its subfolders | N/A |

Here is an example of linting the current file via an Obsidian Command:

![Demo](../assets/demo.gif)

## File Menu Action Items

There is also the option to lint files or folders by right clicking on them from the file menu and then selecting the corresponding dropdown options.

Here is what the action item for lint file looks like from the file menu:

![Lint file contents from file menu action](../assets/lint-file.png)

Here is what the action item for lint folder looks like from the file menu:

![Lint folder contents from file menu action](../assets/lint-folder.png)
