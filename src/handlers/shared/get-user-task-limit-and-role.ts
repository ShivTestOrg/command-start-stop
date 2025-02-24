import { ADMIN_ROLES, COLLABORATOR_ROLES, Context, PluginSettings } from "../../types";

interface MatchingUserProps {
  role: string;
  limit: number;
}

export function determineUserRole(role: string): UserRole {
  const normalizedRole = role.toLowerCase();
  if (ADMIN_ROLES.includes(normalizedRole)) {
    return "admin";
  }
  if (COLLABORATOR_ROLES.includes(normalizedRole)) {
    return "collaborator";
  }
  return "contributor";
}

export function getUserTaskLimit(maxConcurrentTasks: PluginSettings["maxConcurrentTasks"], role: string): number {
  const userRole = determineUserRole(role);
  if (userRole === "admin") {
    return Infinity;
  }
  return maxConcurrentTasks[userRole];
}

export async function getUserRoleAndTaskLimit(context: Context, user: string): Promise<MatchingUserProps> {
  const orgLogin = context.payload.organization?.login;
  const { config, logger, octokit } = context;
  const { maxConcurrentTasks } = config;

  try {
    // Validate the organization login
    if (typeof orgLogin !== "string" || orgLogin.trim() === "") {
      throw new Error("Invalid organization name");
    }

    let role;
    let limit;

    try {
      const response = await octokit.rest.orgs.getMembershipForUser({
        org: orgLogin,
        username: user,
      });
      role = response.data.role.toLowerCase();
      limit = getUserTaskLimit(maxConcurrentTasks, role);
      return { role, limit };
    } catch (err) {
      logger.error("Could not get user membership", { err });
    }

    // If we failed to get organization membership, narrow down to repo role
    const permissionLevel = await octokit.rest.repos.getCollaboratorPermissionLevel({
      username: user,
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
    });
    role = permissionLevel.data.role_name?.toLowerCase();
    context.logger.debug(`Retrieved collaborator permission level for ${user}.`, {
      user,
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      isAdmin: permissionLevel.data.user?.permissions?.admin,
      role,
      data: permissionLevel.data,
    });
    limit = getUserTaskLimit(maxConcurrentTasks, role);

    return { role, limit };
  } catch (err) {
    logger.error("Could not get user role", { err });
    return { role: "unknown", limit: maxConcurrentTasks.contributor };
  }
}
