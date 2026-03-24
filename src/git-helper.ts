import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

function isGitInstalled(): Promise<boolean> {
    return new Promise(resolve => {
        exec('git --version', (err) => {
            resolve(!err); // if no error, git is installed
        });
    });
}

function getGitBranches(cwd: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
        exec('git branch --no-color', { cwd }, (err, stdout) => {
            if (err) return reject(err);
            const branches = stdout
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);
            resolve(branches);
        });
    });
}

function getCurrentBranch(cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec('git branch --show-current', { cwd }, (err, stdout) => {
            if (err) return reject(err);
            resolve(stdout.trim());
        })
    })
}

function getLastGitCommits(cwd: string, limit = 5): Promise<string[]> {
    return new Promise((resolve, reject) => {
        exec(
            `git log --no-color -n ${limit} --pretty=format:"%H %h %s (%ad)" --date=iso`,
            { cwd },
            (err, stdout) => {
                if (err) return reject(err);

                const commits = stdout
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);

                resolve(commits);
            }
        );
    });
}

function checkoutBranch(cwd: string, branch: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(`git checkout ${branch}`, { cwd }, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function deleteBranch(cwd: string, branch: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(`git branch -D ${branch}`, { cwd }, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function makeNewBranchFromCurrent(cwd: string, newBranchName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(`git checkout -b ${newBranchName}`, { cwd }, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function renameBranch(cwd: string, newBranchName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(`git branch -m ${newBranchName}`, { cwd }, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function hasUncommittedChanges(cwd: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        exec("git status --porcelain", { cwd }, (err, stdout) => {
            if (err) return reject(err);
            resolve(stdout.trim().length > 0);
        });
    });
}

function stageAll(cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec("git add .", { cwd }, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function unstageAll(cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec("git restore --staged .", { cwd }, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function hasStagedChanges(cwd: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
        exec("git diff --cached --quiet", { cwd }, (err) => {
            // exit code 1 = staged changes exist
            // exit code 0 = no staged changes
            if (err) {
                if (err.code === 1) return resolve(true);
                return reject(err);
            }
            resolve(false);
        });
    });
}

function restoreAll(cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec("git restore .", { cwd }, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function updateRefs(cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(`git fetch`, { cwd }, (err) => {
            if (err) return reject(err);
            resolve();
        })
    })
}

function resetHardOrigin(cwd: string, branch: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(`git reset --hard origin/${branch}`, { cwd }, (err) => {
            if (err) return reject(err);
            resolve();
        })
    })
}

function changeCommitTime(cwd: string, newDate?: Date): Promise<void> {
    if (!newDate) {
        newDate = new Date();
    }

    const formatted = newDate.toISOString(); // e.g. 2025-01-01T12:34:56.000Z

    return new Promise((resolve, reject) => {
        exec(
            `git commit --amend --no-edit --date="${formatted}"`,
            {
                cwd,
                env: {
                    GIT_AUTHOR_DATE: formatted,
                    GIT_COMMITTER_DATE: formatted,
                },
            },
            (err, stdout, stderr) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            }
        );
    });
}

function commitWithMessage(cwd: string, message: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(`git commit -m "${message}"`, { cwd }, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function pushBranch(cwd: string, branchName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(`git push origin ${branchName}`, { cwd }, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

function rebaseBranchFromLocal(cwd: string, branchName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(`git rebase ${branchName}`, { cwd }, (err) => {
            if (err) return reject(err);
            resolve();
        });
    })
}


function isGitRepo(dir: string): boolean {
    return fs.existsSync(path.join(dir, '.git'));
}

function amendCommit(cwd: string, message: string): Promise<void> {
    return new Promise((resolve, reject) => {
        exec(`git commit --amend -m "${message}"`, { cwd }, (err) => {
            if (err) return reject(err);
            resolve();
        })
    });
}

export {
    isGitInstalled,
    getGitBranches,
    getLastGitCommits,
    checkoutBranch,
    renameBranch,
    deleteBranch,
    changeCommitTime,
    makeNewBranchFromCurrent,
    updateRefs,
    resetHardOrigin,
    isGitRepo,
    hasUncommittedChanges,
    hasStagedChanges,
    getCurrentBranch,
    stageAll,
    unstageAll,
    restoreAll,
    commitWithMessage,
    pushBranch,
    rebaseBranchFromLocal,
    amendCommit
}