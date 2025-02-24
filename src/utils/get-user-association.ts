import { Context } from "../types";

export async function isUserCollaborator(context: Context, username: string): Promise<boolean> {
  try {
    // First check org membership
    try {
      const { data } = await context.octokit.rest.orgs.getMembershipForUser({
        org: context.payload.repository.owner.login,
        username,
      });
      // Any org role counts as collaborator
      return true;
    } catch (error) {
      if (error && typeof error === "object" && "status" in error && error.status === 404) {
        // Not an org member, continue to repo permission check
      } else {
        throw error;
      }
    }

    // Then check repo permissions
    const { data } = await context.octokit.rest.repos.getCollaboratorPermissionLevel({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      username,
    });
    
    // Admin or write access counts as collaborator
    return data.permission === "admin" || data.permission === "write";

  } catch (error) {
    if (error && typeof error === "object" && "status" in error && error.status === 404) {
      return false;
    }
    throw error;
  }
}
