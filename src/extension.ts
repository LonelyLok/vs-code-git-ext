// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { isGitInstalled, isGitRepo, getGitBranches, checkoutBranch, getLastGitCommits, changeCommitTime, deleteBranch, makeNewBranchFromCurrent, updateRefs, resetHardOrigin, hasUncommittedChanges, renameBranch, getCurrentBranch } from './git-helper';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

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
  await treeDataProvider.init();
  await treeDataProvider.startBackGroundPoll(); 
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
        vscode.window.showInformationMessage(`Changed commit time to now`);
        treeDataProvider.refresh();
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

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.renameBranch', async () => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!cwd) return;
      const newBranchName = await vscode.window.showInputBox({
        title: 'Rename Branch To',
        prompt: 'Rename Branch To',
        placeHolder: 'example',
      });
      if (!newBranchName) {
        vscode.window.showErrorMessage('Branch name is required');
        return;
      }
      try {
        await renameBranch(cwd, newBranchName);
        vscode.window.showInformationMessage(`Renamed branch to ${newBranchName}`);
        treeDataProvider.refresh();
      } catch (e: any) {
        vscode.window.showErrorMessage(`Rename branch failed: ${e?.message ?? e}`);
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.fetchAndResetHardOrigin', async (element) => {
      if (!element || !element.branchName) return;
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!cwd) return;
      try {
        await updateRefs(cwd);
        await resetHardOrigin(cwd, element.branchName);
        vscode.window.showInformationMessage(`Fetched and reset hard origin for branch ${element.branchName}`);
        treeDataProvider.refresh();
      } catch (e: any) {
        vscode.window.showErrorMessage(`fetch and reset hard origin failed: ${e?.message ?? e}`);
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.refreshView', () => {
      treeDataProvider.refresh();
    })
  );
}

// This method is called when your extension is deactivated
export function deactivate() { }

class BranchTreeItem extends vscode.TreeItem {
  readonly branchName: string;

  constructor(
    branchName: string,
    isCurrent: boolean
  ) {
    super(
      branchName,
      isCurrent
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );
    this.branchName = branchName;
  }
}

class MyTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private isGitInstalled = false;
  private isGitRepo = false;
  private currentBranch = '';
  private intervalMs = 3000;
  private pollTimer?: NodeJS.Timeout;

  async init() {
    const folders = vscode.workspace.workspaceFolders;
    const pwd = folders?.length ? folders[0].uri.fsPath : 'unknown';
    this.isGitInstalled = await isGitInstalled();
    if (this.isGitInstalled) {
      this.isGitRepo = isGitRepo(pwd);
    }
  }

  async startBackGroundPoll() {
    if (!this.isGitInstalled || !this.isGitRepo) {
      return;
    }
    const folders = vscode.workspace.workspaceFolders;
    const pwd = folders?.length ? folders[0].uri.fsPath : 'unknown';

    const poll = async () => {
      try {
        const branch = await getCurrentBranch(pwd);
        if (this.currentBranch && branch !== this.currentBranch) {
          // this.currentBranch = branch;
          vscode.window.showInformationMessage(`Branch change detected (${this.currentBranch} -> ${branch}), refreshing view...`);
          this.refresh();
        }
      } catch (err) {
        // ignore transient git errors
        console.log(err)
      }
    };

    await poll();

    // then poll
    this.pollTimer = setInterval(() => {
      void poll();
    }, this.intervalMs);
  }

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

      repoStatus.contextValue = "repoStatus"

      return [headline, gitStatus, repoStatus];
    }

    if (element.label === 'This is a Git repository ✅') {
      const branches = await getGitBranches(pwd);
      return branches.map(branch => {
        const isCurrent = branch.startsWith('*');
        const cleanBranch = isCurrent ? branch.slice(2).trim() : branch;
        const item = new BranchTreeItem(cleanBranch, isCurrent);
        item.command = {
          command: 'myExt.checkoutBranch',
          title: 'Checkout Branch',
          arguments: [cleanBranch]
        };
        if (isCurrent) {
          item.contextValue = 'currentBranchItem';
          this.currentBranch = cleanBranch;
        } else {
          item.contextValue = 'nonCurrentBranchItem';
        }
        return item
      })
    }

    if (element.contextValue === 'currentBranchItem') {
      const lineItems = [];
      const [items, hasChanges] = await Promise.all([getLastGitCommits(pwd, 5), hasUncommittedChanges(pwd)]);
      if (hasChanges) {
        lineItems.push(new vscode.TreeItem('Uncommitted Changes Present', vscode.TreeItemCollapsibleState.None));
      }
      for (let i = 0; i < items.length; i++) {
        const commit = items[i];
        const commitItem = new vscode.TreeItem(commit, vscode.TreeItemCollapsibleState.None);
        if (i === 0) {
          commitItem.contextValue = 'commitItem';
        }
        lineItems.push(commitItem);
      }
      return lineItems;
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