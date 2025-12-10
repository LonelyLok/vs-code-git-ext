// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { isGitInstalled, isGitRepo, getGitBranches, checkoutBranch, getLastGitCommits, changeCommitTime, deleteBranch, makeNewBranchFromCurrent } from './git-helper';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "vs-code-git-ext" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand('vs-code-git-ext.helloWorld', () => {
    // The code you place here will be executed every time your command is executed
    // Display a message box to the user
    vscode.window.showInformationMessage('Hello World from vs-code-git-ext!');
  });

  context.subscriptions.push(disposable);

  const treeDataProvider = new MyTreeProvider();
  vscode.window.createTreeView('myExtView', { treeDataProvider });

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.checkoutBranch', async (branch: string) => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!cwd) return;

      const target = String(branch).trim();
      try {
        await checkoutBranch(cwd, target);
        vscode.window.showInformationMessage(`Switched to ${target}`);
        treeDataProvider.refresh(); // 🔁 refresh so the "*" moves
      } catch (e: any) {
        vscode.window.showErrorMessage(`Checkout failed: ${e?.message ?? e}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.changeCommitTime', async () => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!cwd) return;
      try {
        await changeCommitTime(cwd);
      } catch (e: any) {
        vscode.window.showErrorMessage(`Change commit time failed: ${e?.message ?? e}`);
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.deleteBranchLocal', async (element) => {
      if (!element || !element.label) return;
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!cwd) return;

      try {
        await deleteBranch(cwd, element.label);
        vscode.window.showInformationMessage(`Deleted branch ${element.label}`);
        treeDataProvider.refresh();
      } catch (e: any) {
        vscode.window.showErrorMessage(`Delete branch failed: ${e?.message ?? e}`);
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.makeNewBranchFromCurrent', async () => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!cwd) return;
      const newBranchName = await vscode.window.showInputBox({
        title: 'New Branch Name',
        prompt: 'New Branch Name',
        placeHolder: 'example',
      });
      if (!newBranchName) {
        vscode.window.showErrorMessage('Branch name is required');
        return;
      }
      try {
        await makeNewBranchFromCurrent(cwd, newBranchName);
        vscode.window.showInformationMessage(`Created and switched to new branch ${newBranchName}`);
        treeDataProvider.refresh();
      } catch (e: any) {
        vscode.window.showErrorMessage(`Create new branch failed: ${e?.message ?? e}`);
      }
    })
  )
}

// This method is called when your extension is deactivated
export function deactivate() { }

class MyTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    const folders = vscode.workspace.workspaceFolders;
    const pwd = folders?.length ? folders[0].uri.fsPath : 'unknown';
    if (!element) {
      const headline = new vscode.TreeItem(
        `Path: ${pwd}`,
        vscode.TreeItemCollapsibleState.None
      );

      // ✅ check if Git is installed
      const installed = await isGitInstalled();
      const gitStatus = new vscode.TreeItem(
        installed ? 'Git installed ✅' : 'Git not installed ❌',
        vscode.TreeItemCollapsibleState.None
      );

      const isRepo = isGitRepo(pwd);

      const repoStatus = new vscode.TreeItem(
        isRepo ? 'This is a Git repository ✅' : 'This is not a Git repository ❌',
        vscode.TreeItemCollapsibleState.Expanded
      );

      return [headline, gitStatus, repoStatus];
    }

    if (element.label === 'This is a Git repository ✅') {
      const branches = await getGitBranches(pwd);
      return branches.map(branch => {
        const isCurrent = branch.startsWith('*');
        const item = new vscode.TreeItem(branch, isCurrent ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None);
        const cleanBranch = isCurrent ? branch.slice(2).trim() : branch;
        item.command = {
          command: 'myExt.checkoutBranch',
          title: 'Checkout Branch',
          arguments: [cleanBranch]
        };
        if (isCurrent) {
          item.contextValue = 'currentBranchItem';
        } else {
          item.contextValue = 'nonCurrentBranchItem';
        }
        return item
      })
    }

    if (element.contextValue === 'currentBranchItem') {
      const items = await getLastGitCommits(pwd, 5);
      return items.map((commit, i) => {
        const commitItem = new vscode.TreeItem(commit, vscode.TreeItemCollapsibleState.None);
        if (i === 0) {
          commitItem.contextValue = 'commitItem';
        }
        return commitItem;
      });
    }

    return [];
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  refresh() {
    this._onDidChangeTreeData.fire();
  }
}