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

function getLastGitCommits(cwd: string, limit = 5): Promise<string[]> {
    return new Promise((resolve, reject) => {
        exec(
            `git log --no-color -n ${limit} --pretty=format:"%h %s (%ad)" --date=iso`,
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


function isGitRepo(dir: string): boolean {
    return fs.existsSync(path.join(dir, '.git'));
}

export {
    isGitInstalled,
    getGitBranches,
    getLastGitCommits,
    checkoutBranch,
    deleteBranch,
    changeCommitTime,
    makeNewBranchFromCurrent,
    isGitRepo
}