"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const github = __importStar(require("@actions/github"));
const core = __importStar(require("@actions/core"));
const getRequiredInput = (name) => core.getInput(name, { required: true });
const token = getRequiredInput('token');
const creator = core.getInput('creator');
const label = core.getInput('label');
const octokit = github.getOctokit(token);
const { payload, repo } = github.context;
const { action, issue, milestone } = payload;
async function run() {
    if (action !== 'milestoned' && action !== 'demilestoned') {
        core.error('Invalid event ' + action);
        return;
    }
    if (issue.labels.find((v) => v.name === label)) {
        core.info('This is already a plan.');
        return;
    }
    core.info('action: ' + action);
    const filter = {
        ...repo,
        creator: creator,
        milestone: milestone.number,
        labels: 'plan'
    };
    if (creator === '*')
        delete filter.creator;
    const { data } = await octokit.rest.issues.listForRepo(filter);
    if (data.length !== 1) {
        core.notice('No or more than one plan found.');
        return;
    }
    const plan = data[0]; // plan is a issue
    const [, above, backlog, below = ''] = plan.body.match(/(.*# Backlog\s*)(\n(?:- [^-\r\n]+\r?\n)*)(.*)/s); // assuming there is linebreak after list
    core.info(`above: ${JSON.stringify(above)}\nbacklog: ${JSON.stringify(backlog)}\nbelow: ${JSON.stringify(below)}`);
    let new_backlog = backlog.replace(/\r\n/g, '\n');
    if (action === 'demilestoned') {
        const regex = new RegExp(`(?<=\\n)- \\[[ x]\\] #${issue.number} \\n`);
        if (new_backlog.match(regex)) {
            core.info('removed');
            new_backlog = new_backlog.replace(regex, '');
        }
        else {
            core.info('not existing or modified');
        }
    }
    else {
        if (new_backlog.includes(`#${issue.number}`)) {
            core.info('already exists');
        }
        else {
            const backlogs = new_backlog.trim().split('\n');
            const newline = `- [${issue.state === 'open' ? ' ' : 'x'}] #${issue.number} `;
            core.info(`backlogs: ${JSON.stringify(backlogs)}\nnewline: ${newline}`);
            const id = backlogs.findIndex((v) => {
                const match = v.match(/#(\d+)/);
                if (match)
                    if (parseInt(match[1]) > issue.number)
                        return true;
                return false;
            });
            if (id === -1) {
                backlogs.push(newline);
                core.info('appended to the end');
            }
            else {
                core.info('insert before: ' + backlogs[id]);
                backlogs[id] = newline + '\n' + backlogs[id]; // splice have edging case
            }
            new_backlog = '\n' + backlogs.join('\n') + '\n';
        }
    }
    core.info('new: ' + JSON.stringify(new_backlog));
    const resp = await octokit.rest.issues.update({
        ...repo,
        issue_number: plan.number,
        body: above + new_backlog + below
    });
    core.info('resp:\n' + JSON.stringify(resp));
}
try {
    run();
}
catch (error) {
    core.error(JSON.stringify(error));
}
