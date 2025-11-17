/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
  async fetch(request, env, ctx) {
    const CORS_HEADERS = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: { ...CORS_HEADERS } });
    }

    if (request.method !== "POST") {
      const form = `<pre><form method="POST" action="/">
      name: <input name="name" />
      url: <input name="url" />
      text: <textarea name="message"></textarea>
  
      <button type="submit">send</button>
      </form>`;
      return new Response(form, {
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "text/html",
        },
      });
    }

    const data = await request.formData();

    const name = data.get("name");
    const message = data.get("message");
    const url = data.get("url");

    const now = new Date();
    const filename = `${now.getTime()}-submission.html`;
    const submission = submissionText(now, name, url, message);

    const pr = await createSubmissionPR(now, filename, submission, name, env);
    console.log("pr", pr);

    const reply = `Thanks! Your message is pending approval.<br />see: <a href="${pr}">${pr}</a>`;

    return new Response(reply, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/html",
      },
    });
  },
};

function submissionText(date, name, url, message) {
  const timestamp = date.toISOString();
  const [day] = timestamp.split("T");
  const link = url ? `(<a href="${url}">${url}</a>)` : "";
  const header = `${day} - ${name} ${link}`.trim();

  return `\n${header}\n\n${message}\n\n`;
}

async function createSubmissionPR(date, filename, html, name, env) {
  const baseUrl = `https://api.github.com/repos/${env.GH_REPO}`;
  const headers = {
    Authorization: `Bearer ${env.GH_TOKEN}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "Cloudflare-Worker",
  };

  // git clone
  const { defaultBranch, baseSha, baseTreeSha } = await gitClone(
    baseUrl,
    headers
  );

  // git checkout -b submission/$filename main
  const branchName = `submission/${filename}`;
  await gitCheckoutNewBranch(baseUrl, headers, branchName, baseSha);

  // echo $html > "entries/${filename}.html"
  const htmlBlobSha = await createFileBlob(baseUrl, headers, html);

  // Prepare files array for commit
  const files = [{ path: `entries/${filename}.html`, blobSha: htmlBlobSha }];

  const commitTitle = `Guestbook submission by ${name || "anonymous"}`;
  const commitMessage = `${commitTitle}\n\nSubmitted at: ${date.toISOString()}`;

  // git commit -am "Guestbook submission by ${name}"
  const commitSha = await gitCommit(
    baseUrl,
    headers,
    baseTreeSha,
    files,
    commitMessage,
    baseSha
  );

  // git push (update branch reference)
  await gitPush(baseUrl, headers, branchName, commitSha);

  // gh pr create
  const prUrl = await createPullRequest(
    baseUrl,
    headers,
    commitTitle,
    branchName,
    defaultBranch,
    commitMessage
  );

  return prUrl;
}

// git clone - Get current state of main branch
async function gitClone(baseUrl, headers) {
  // Get default branch name
  const repoResponse = await fetch(`${baseUrl}`, { headers });
  const repoData = await repoResponse.json();
  const defaultBranch = repoData.default_branch;

  // Get latest commit SHA on default branch
  const refResponse = await fetch(`${baseUrl}/git/ref/heads/${defaultBranch}`, {
    headers,
  });
  const refData = await refResponse.json();
  const baseSha = refData.object.sha;

  // Get the tree (file structure) of this commit
  const commitResponse = await fetch(`${baseUrl}/git/commits/${baseSha}`, {
    headers,
  });
  const commitData = await commitResponse.json();
  const baseTreeSha = commitData.tree.sha;

  return { defaultBranch, baseSha, baseTreeSha };
}

// git checkout -b submission/$filename main
async function gitCheckoutNewBranch(baseUrl, headers, branchName, baseSha) {
  await fetch(`${baseUrl}/git/refs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    }),
  });
}

// echo $html > "entries/${filename}.html"
// Creates file content (blob) in git
async function createFileBlob(baseUrl, headers, content) {
  const blobResponse = await fetch(`${baseUrl}/git/blobs`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      content: content,
      encoding: "utf-8",
    }),
  });
  const blobData = await blobResponse.json();
  return blobData.sha;
}

// git commit -am "message"
// Creates a tree with file changes, then commits it
async function gitCommit(
  baseUrl,
  headers,
  baseTreeSha,
  files,
  commitMessage,
  parentSha
) {
  // Create new tree with file changes
  const treeResponse = await fetch(`${baseUrl}/git/trees`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: files.map((file) => ({
        path: file.path,
        mode: "100644",
        type: "blob",
        sha: file.blobSha,
      })),
    }),
  });
  const treeData = await treeResponse.json();

  // Create commit
  const commitResponse = await fetch(`${baseUrl}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: commitMessage,
      tree: treeData.sha,
      parents: [parentSha],
    }),
  });
  const commitData = await commitResponse.json();

  return commitData.sha;
}

// Update branch to point to new commit
async function gitPush(baseUrl, headers, branchName, commitSha) {
  await fetch(`${baseUrl}/git/refs/heads/${branchName}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      sha: commitSha,
    }),
  });
}

// gh pr create --base main --head submission/$filename
async function createPullRequest(
  baseUrl,
  headers,
  title,
  branchName,
  baseBranch,
  body
) {
  const prResponse = await fetch(`${baseUrl}/pulls`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: title,
      head: branchName,
      base: baseBranch,
      body: body,
    }),
  });
  const prData = await prResponse.json();
  return prData.html_url;
}
