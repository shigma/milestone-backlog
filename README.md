# Milestoned Issue Backlog

This action backlog milestoned issues into another issue with the same milestone.

## Example usage

```yaml
name: Milestone Issue Backlog

on:
  issues:
    types:
      - milestoned
      - demilestoned

jobs:
  backlog:
    name: Backlog
    runs-on: ubuntu-20.04
    steps:
      - name: Backlog
        uses: H4M5TER/milestone-backlog@v1
        with:
          token: ${{ secrets.PAT }}
          header: '# Backlog'
          label: plan
          creator: '*'
```

## Inputs

### `token`

According to the [doc](https://octokit.github.io/rest.js/v18#issues-update):
> Issue owners and users with push access can edit an issue.

You should provide a GitHub [Personal Access Token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token) with repo permission (which is suggested to belong to a machine user).

### `header` *optional*

Where the backlog list starts with.
Attention that this is used to generate the regex to match the backlogs.

default: `# Backlog`

### `label` *optional*

Use to filter the corresponding issue.

default: `plan`

### `creator` *optional*

Use to filter the corresponding issue.
