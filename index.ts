import * as github from '@actions/github'
import * as core from '@actions/core'

const getRequiredInput = (name: string) => core.getInput(name, { required: true })
const token = getRequiredInput('token')
const header = core.getInput('header')
const creator = core.getInput('creator')
const label = core.getInput('label')

const octokit = github.getOctokit(token)
const { payload, repo } = github.context
const { action, issue } = payload
const milestone = payload.milestone ?? issue.milestone

async function runIssue() {
  if (!['milestoned', 'demilestoned'].includes(action)) {
    core.error('Invalid event for issue: ' + action)
    return
  }
  const filter = {
    ...repo,
    creator: creator,
    milestone: milestone.number,
    labels: label
  }
  if (creator === '*')
    delete filter.creator
  const { data } = await octokit.rest.issues.listForRepo(filter)
  if (data.length !== 1) {
    core.notice('No or more than one plan found.')
    return
  }
  const plan = data[0] // plan is a issue
  const [, above, backlog, below = ''] =
    plan.body.match(new RegExp(`(.*${header}\\s*)((?:- [^-\\r\\n]+\\r?\\n)*)(.*)`, 's'))
  core.info(`above: ${JSON.stringify(above)}\nbacklog: ${JSON.stringify(backlog)}\nbelow: ${JSON.stringify(below)}`)

  let new_backlog = backlog.replace(/\r\n/g, '\n'), regex
  switch (action) {
    case 'demilestoned':
      regex = new RegExp(`^- \\[[ x]\\] #${issue.number}\\s+`, 'm')
      if (new_backlog.match(regex)) {
        core.info('removed')
        new_backlog = new_backlog.replace(regex, '')
      } else {
        core.info('not existing or modified')
      }
      break
    case 'milestoned':
      if (new_backlog.includes(`#${issue.number}`)) {
        core.info('already exists')
      } else {
        const backlogs = new_backlog.trim().split('\n')
        const newline = `- [${issue.state === 'open' ? ' ' : 'x'}] #${issue.number} `
        core.info(`backlogs: ${JSON.stringify(backlogs)}\nnewline: ${newline}`)
        const id = backlogs.findIndex((v) => {
          const match = v.match(/#(\d+)/)
          if (match)
            if (parseInt(match[1]) > issue.number)
              return true
          return false
        })
        if (id === -1) {
          backlogs.push(newline)
          core.info('appended to the end')
        } else {
          core.info('insert before: ' + backlogs[id])
          backlogs[id] = newline + '\n' + backlogs[id] // splice have edging case
        }
        new_backlog = '\n' + backlogs.join('\n') + '\n'
      }
      break
    default:
      break
  }
  core.info('new: ' + JSON.stringify(new_backlog))
  const resp = await octokit.rest.issues.update({
    ...repo,
    issue_number: plan.number,
    body: above.trimEnd() + '\n' + new_backlog + below
  })
  core.info('resp:\n' + JSON.stringify(resp))
}

async function runPlan() {
  switch (action) {
    case 'closed':
    case 'reopened':
      const resp = await octokit.rest.issues.updateMilestone({
        ...repo,
        milestone_number: milestone.number,
        state: issue.state
      })
      core.info(JSON.stringify(resp))
      break
    default:
      core.error('Invalid event for plan: ' + action)
      break
  }
}

try {
  core.startGroup('context')
  core.info(JSON.stringify(github.context))
  core.endGroup()
  core.info('action: ' + action)
  if (!milestone) { }
  else if (issue.labels.find((v: { name: string }) => v.name === label)) {
    core.info('plan triggered')
    runPlan()
  }
  else {
    runIssue()
  }
} catch (error) {
  core.error(JSON.stringify(error))
}
