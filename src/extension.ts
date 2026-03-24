// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import {
  isGitInstalled,
  isGitRepo,
  getGitBranches,
  checkoutBranch,
  getLastGitCommits,
  changeCommitTime,
  deleteBranch,
  makeNewBranchFromCurrent,
  updateRefs,
  resetHardOrigin,
  hasUncommittedChanges,
  renameBranch,
  getCurrentBranch,
  hasStagedChanges,
  stageAll,
  unstageAll,
  restoreAll,
  commitWithMessage,
  pushBranch,
  rebaseBranchFromLocal,
  amendCommit
} from './git-helper';

type MyExtConfig = {
  pollIntervalMs: number;
  commitsToShow: number;
  branchPushBlacklist: string[];
};

function readConfig(): MyExtConfig {
  const config = vscode.workspace.getConfiguration('myExt');
  const pollIntervalMs = Math.max(1000, config.get<number>('pollIntervalMs', 3000));
  const commitsToShow = Math.max(1, config.get<number>('commitsToShow', 5));
  const branchPushBlacklist = config.get<string[]>('branchPushBlacklist', []);
  return { pollIntervalMs, commitsToShow, branchPushBlacklist };
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
  const treeDataProvider = new MyTreeProvider();
  treeDataProvider.applyConfig(readConfig());
  await treeDataProvider.init();
  await treeDataProvider.startBackGroundPoll();
  const treeView = vscode.window.createTreeView('myExtView', { treeDataProvider });
  context.subscriptions.push(treeView);
  context.subscriptions.push({ dispose: () => treeDataProvider.dispose() });

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration('myExt')) {
        return;
      }
      treeDataProvider.applyConfig(readConfig());
      treeDataProvider.refresh();
    })
  );

  context.subscriptions.push(vscode.commands.registerCommand('myExt.testing', () => {
    vscode.window.showInformationMessage('test command executed');
  }));

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.checkoutBranch', async (item: BranchTreeItem) => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!cwd) return;

      const target = String(item.branchName).trim();
      try {
        await checkoutBranch(cwd, target);
        vscode.window.showInformationMessage(`Switched to ${target}`);
        treeDataProvider.refresh({ isRefreshTerminal: true }); // 🔁 refresh so the "*" moves
        await treeView.reveal(item, { expand: true });
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
        treeDataProvider.refresh({ isRefreshTerminal: true });
      } catch (e: any) {
        vscode.window.showErrorMessage(`Create new branch failed: ${e?.message ?? e}`);
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.renameBranch', async (element) => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!cwd) return;
      const newBranchName = await vscode.window.showInputBox({
        title: 'Rename Branch To',
        prompt: 'Rename Branch To',
        value: element.branchName,
      });
      if (!newBranchName) {
        vscode.window.showErrorMessage('Branch name is required');
        return;
      }
      try {
        await renameBranch(cwd, newBranchName);
        vscode.window.showInformationMessage(`Renamed branch to ${newBranchName}`);
        treeDataProvider.refresh({ isRefreshTerminal: true });
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
    vscode.commands.registerCommand('myExt.seeStatusOnTerminal', async () => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      const terminal = vscode?.window?.activeTerminal
      if (!cwd || !terminal) return;
      try {
        terminal.sendText('git status');
        treeDataProvider.refresh();
      } catch (e: any) {
        vscode.window.showErrorMessage(`Check status failed: ${e?.message ?? e}`);
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.stageAllChanges', async () => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!cwd) return;
      try {
        await stageAll(cwd);
        vscode.window.showInformationMessage(`Staged all changes`);
        treeDataProvider.refresh();
      } catch (e: any) {
        vscode.window.showErrorMessage(`Stage all changes failed: ${e?.message ?? e}`);
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.unstageAllChanges', async () => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!cwd) return;
      try {
        await unstageAll(cwd);
        vscode.window.showInformationMessage(`Unstaged all changes`);
        treeDataProvider.refresh();
      } catch (e: any) {
        vscode.window.showErrorMessage(`Unstage all changes failed: ${e?.message ?? e}`);
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.restoreAllChanges', async () => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!cwd) return;
      try {
        await restoreAll(cwd);
        vscode.window.showInformationMessage(`Restored all changes`);
        treeDataProvider.refresh();
      } catch (e: any) {
        vscode.window.showErrorMessage(`Restore all changes failed: ${e?.message ?? e}`);
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.commitWithMessage', async () => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!cwd) return;
      const commitMessage = await vscode.window.showInputBox({
        title: 'Commit Message',
        prompt: 'Enter commit message',
        placeHolder: 'example',
      });
      if (!commitMessage) {
        vscode.window.showErrorMessage('Commit message is required');
        return;
      }
      try {
        await commitWithMessage(cwd, commitMessage);
        vscode.window.showInformationMessage(`Committed with message: ${commitMessage}`);
        treeDataProvider.refresh();
      } catch (e: any) {
        vscode.window.showErrorMessage(`Commit with message failed: ${e?.message ?? e}`);
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.pushBranch', async (element) => {
      if (!element || !element.branchName) return;
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!cwd) return;
      try {
        if (treeDataProvider.branchPushBlacklist.includes(element.branchName)) {
          throw new Error(`Branch ${element.branchName} is blacklisted from pushing`);
        }
        await pushBranch(cwd, element.branchName);
        vscode.window.showInformationMessage(`Pushed branch ${element.branchName}`);
        treeDataProvider.refresh();
      } catch (e: any) {
        vscode.window.showErrorMessage(`Push branch failed: ${e?.message ?? e}`);
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.copyBranchName', async (element) => {
      if (!element || !element.branchName) return;
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!cwd) return;
      try {
        await vscode.env.clipboard.writeText(element.branchName);
        vscode.window.showInformationMessage(`Copied branch name ${element.branchName} to clipboard`);
      } catch (e: any) {
        vscode.window.showErrorMessage(`Copy branch name failed: ${e?.message ?? e}`);
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.copyCommitSHA', async (element) => {
      if (!element || !element.commitSHA) return;
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!cwd) return;
      try {
        await vscode.env.clipboard.writeText(element.commitSHA);
        vscode.window.showInformationMessage(`Copied commit SHA ${element.commitSHA} to clipboard`);
      } catch (e: any) {
        vscode.window.showErrorMessage(`Copy commit SHA failed: ${e?.message ?? e}`);
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.rebaseFromLocal', async (element) => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!cwd) return;
      try {
        const rawBranches = await getGitBranches(cwd);
        const filteredBranchs: string[] = []
        rawBranches.forEach(branch => {
          if (branch.startsWith('*')) {
            return;
          }
          filteredBranchs.push(branch);
        })

        if (!filteredBranchs.length) {
          vscode.window.showInformationMessage('No other branches to rebase from');
          return;
        }

        const targetBranch = await vscode.window.showQuickPick(filteredBranchs, {
          placeHolder: 'Select branch to rebase from',
          canPickMany: false,
        })

        if (!targetBranch) {
          vscode.window.showInformationMessage('Rebase cancelled');
          return;
        }

        await rebaseBranchFromLocal(cwd, targetBranch);
        vscode.window.showInformationMessage(`Rebased current branch from ${targetBranch}`);
        treeDataProvider.refresh();
      } catch (e: any) {
        vscode.window.showErrorMessage(`Rebase failed: ${e?.message ?? e}`);
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.amendCommit', async () => {
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
      if (!cwd) return;
      const commitMessage = await vscode.window.showInputBox({
        title: 'Amend Commit Message',
        prompt: 'Enter new commit message',
        placeHolder: 'example',
      });
      if (!commitMessage) {
        vscode.window.showErrorMessage('Commit message is required');
        return;
      }
      try {
        await amendCommit(cwd, commitMessage);
        vscode.window.showInformationMessage(`Updated committed message: ${commitMessage}`);
        treeDataProvider.refresh();
      } catch (e: any) {
        vscode.window.showErrorMessage(`Update commit message failed: ${e?.message ?? e}`);
      }
    })
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('myExt.refreshView', () => {
      treeDataProvider.refresh({ isRefreshTerminal: true });
    })
  );
}

// This method is called when your extension is deactivated
export function deactivate() { }

class BranchTreeItem extends vscode.TreeItem {
  readonly branchName: string;
  readonly parent: vscode.TreeItem | undefined;

  constructor(
    branchName: string,
    isCurrent: boolean,
    parent: vscode.TreeItem | undefined = undefined
  ) {
    super(
      branchName,
      isCurrent
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.None
    );
    this.branchName = branchName;
    this.parent = parent;
  }
}

class CommitTreeItem extends vscode.TreeItem {
  readonly commitSHA: string;
  constructor(
    label: string,
    commitSHA: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.commitSHA = commitSHA;
  }
}

class MyTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private isGitInstalled = false;
  private isGitRepo = false;
  private isUnCommittedChanges = false;
  private currentBranch = '';
  private pollIntervalMs = 3000;
  private commitsToShow = 5;
  branchPushBlacklist: string[] = [];
  private pollTimer?: NodeJS.Timeout;

  private validRepoText = 'This is a Git repository ✅';
  private invalidRepoText = 'This is not a Git repository ❌';

  private repoStatusItem?: vscode.TreeItem;

  getParent(element: vscode.TreeItem): vscode.TreeItem | undefined {
    if (element instanceof BranchTreeItem) {
      return element?.parent;
    }
    return undefined;
  }

  async init() {
    const folders = vscode.workspace.workspaceFolders;
    const pwd = folders?.length ? folders[0].uri.fsPath : 'unknown';
    this.isGitInstalled = await isGitInstalled();
    if (this.isGitInstalled) {
      this.isGitRepo = isGitRepo(pwd);
    }
  }

  async startBackGroundPoll() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
    if (!this.isGitInstalled || !this.isGitRepo) {
      return;
    }
    const folders = vscode.workspace.workspaceFolders;
    const pwd = folders?.length ? folders[0].uri.fsPath : 'unknown';
    const poll = async () => {
      try {
        const [branch, commitChanged] = await Promise.all([
          getCurrentBranch(pwd),
          hasUncommittedChanges(pwd)
        ])

        const isBranchChanged = this.currentBranch !== branch;
        const isCommitChanged = this.isUnCommittedChanges !== commitChanged;
        if (isBranchChanged) {
          // vscode.window.showInformationMessage(`Branch change detected (${this.currentBranch} -> ${branch}), refreshing view...`);
          this.currentBranch = branch;
        }
        if (isCommitChanged) {
          // vscode.window.showInformationMessage(`Uncommitted changes detected on branch ${branch}, refreshing view...`);
          this.isUnCommittedChanges = commitChanged;
        }
        if ([isBranchChanged, isCommitChanged].some(v => v)) {
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
    }, this.pollIntervalMs);
  }

  applyConfig(config: MyExtConfig) {
    const isPollIntervalChanged = this.pollIntervalMs !== config.pollIntervalMs;
    this.pollIntervalMs = config.pollIntervalMs;
    this.commitsToShow = config.commitsToShow;
    this.branchPushBlacklist = config.branchPushBlacklist
    if (isPollIntervalChanged) {
      void this.startBackGroundPoll();
    }
  }

  dispose() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }
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
        isRepo ? this.validRepoText : this.invalidRepoText,
        vscode.TreeItemCollapsibleState.Expanded
      );

      repoStatus.contextValue = "repoStatus"
      this.repoStatusItem = repoStatus;

      return [headline, gitStatus, repoStatus];
    }

    if (element.label === this.validRepoText) {
      const branches = await getGitBranches(pwd);
      return branches.map(branch => {
        const isCurrent = branch.startsWith('*');
        const cleanBranch = isCurrent ? branch.slice(2).trim() : branch;
        const item = new BranchTreeItem(cleanBranch, isCurrent, this.repoStatusItem);
        item.command = {
          command: 'myExt.checkoutBranch',
          title: 'Checkout Branch',
          arguments: [item]
        };
        if (isCurrent) {
          item.contextValue = this.branchPushBlacklist.includes(cleanBranch) ? 'currentBranchItemBlacklisted' : 'currentBranchItem';
          this.currentBranch = cleanBranch;
        } else {
          item.contextValue = 'nonCurrentBranchItem';
        }
        return item
      })
    }

    if (element.contextValue === 'currentBranchItem' || element.contextValue === 'currentBranchItemBlacklisted') {
      const lineItems = [];
      const [items, hasChanges] = await Promise.all([
        getLastGitCommits(pwd, this.commitsToShow),
        hasUncommittedChanges(pwd)
      ]);
      this.isUnCommittedChanges = hasChanges;
      if (hasChanges) {
        const treeItemUncommitted = new vscode.TreeItem('Uncommitted Changes Present', vscode.TreeItemCollapsibleState.None)
        const isStaged = await hasStagedChanges(pwd);
        const iconColor = isStaged ? 'charts.yellow' : 'charts.red';
        const iconShape = isStaged ? 'triangle-up' : 'circle-filled';
        treeItemUncommitted.iconPath = new vscode.ThemeIcon(iconShape, new vscode.ThemeColor(iconColor));
        treeItemUncommitted.contextValue = 'uncommittedChangesItem';
        lineItems.push(treeItemUncommitted);
      }
      for (let i = 0; i < items.length; i++) {
        const commitRaw = items[i];
        const idx = commitRaw.indexOf(" ");
        const longSHA = idx === -1 ? commitRaw : commitRaw.slice(0, idx);
        const commit = idx === -1 ? "" : commitRaw.slice(idx + 1);
        const commitItem = new CommitTreeItem(commit, longSHA);
        if (i === 0) {
          commitItem.contextValue = 'latestCommitItem';
        } else {
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

  refresh(opt?: { isRefreshTerminal?: boolean }) {
    this._onDidChangeTreeData.fire();
    if (opt?.isRefreshTerminal) {
      const terminal = vscode?.window?.activeTerminal
      if (terminal) {
        terminal.sendText('');
      }
    }

  }

  setCuurrentBranch(branch: string) {
    this.currentBranch = branch;
  }
}
