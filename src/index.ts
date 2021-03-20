import { info, getInput, setOutput, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { generate } from "./changelog";
import { gt, lt, eq } from "semver";

const SEMVER_REGEX = /^v([0-9]+)\.([0-9]+)\.([0-9]+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+)?$/;

async function run() {
  try {
    const token = getInput("token", { required: true });
    const exclude = getInput("exclude", { required: false }).split(",");
    const octokit = getOctokit(token);
    const {
      repo: { owner, repo },
      ref,
      sha,
    } = context;

    info(
      `target ref = ${ref}, branch name = ${ref.substr(
        ref.lastIndexOf("/") + 1,
      )}`,
    );

    // fetch tags
    const { data: tags } = await octokit.repos.listTags({
      owner,
      repo,
      per_page: 100,
    });

    // filter only version tags
    const versionTags = tags
      .filter((t) => SEMVER_REGEX.test(t.name))
      .sort((a, b) => {
        if (gt(a.name, b.name)) {
          return -1;
        }
        if (eq(a.name, b.name)) {
          return 0;
        }
        return 1;
      });

    let olderTag;

    if (versionTags.length > 1) {
      // exclude the latest(auto-bumped) tag and choose older one.
      olderTag = versionTags[1];
    } else {
      olderTag = versionTags[0];
    }
    const newerTag = versionTags[0];

    info(
      `${olderTag.name}(${olderTag.commit.sha}) <  <= ${newerTag.name}(${newerTag.commit.sha})`,
    );

    const changelog = await generate(
      octokit,
      exclude,
      owner,
      repo,
      ref.substr(ref.lastIndexOf("/") + 1),
      olderTag.commit.sha,
      `${olderTag.name}...${newerTag.name}`,
    );

    info(changelog);

    setOutput("changelog", changelog);
  } catch (error) {
    setFailed(error.message);
  }
}

run();
