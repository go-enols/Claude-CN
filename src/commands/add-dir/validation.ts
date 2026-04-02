import chalk from 'chalk'
import { stat } from 'fs/promises'
import { dirname, resolve } from 'path'
import type { ToolPermissionContext } from '../../Tool.js'
import { getErrnoCode } from '../../utils/errors.js'
import { expandPath } from '../../utils/path.js'
import {
  allWorkingDirectories,
  pathInWorkingPath,
} from '../../utils/permissions/filesystem.js'

export type AddDirectoryResult =
  | {
      resultType: 'success'
      absolutePath: string
    }
  | {
      resultType: 'emptyPath'
    }
  | {
      resultType: 'pathNotFound' | 'notADirectory'
      directoryPath: string
      absolutePath: string
    }
  | {
      resultType: 'alreadyInWorkingDirectory'
      directoryPath: string
      workingDir: string
    }

export async function validateDirectoryForWorkspace(
  directoryPath: string,
  permissionContext: ToolPermissionContext,
): Promise<AddDirectoryResult> {
  if (!directoryPath) {
    return {
      resultType: 'emptyPath',
    }
  }

  // resolve() strips the trailing slash expandPath can leave on absolute
  // inputs, so /foo and /foo/ map to the same storage key (CC-33).
  const absolutePath = resolve(expandPath(directoryPath))

  // Check if path exists and is a directory (single syscall)
  try {
    const stats = await stat(absolutePath)
    if (!stats.isDirectory()) {
      return {
        resultType: 'notADirectory',
        directoryPath,
        absolutePath,
      }
    }
  } catch (e: unknown) {
    const code = getErrnoCode(e)
    // Match prior existsSync() semantics: treat any of these as "not found"
    // rather than re-throwing. EACCES/EPERM in particular must not crash
    // startup when a settings-configured additional directory is inaccessible.
    if (
      code === 'ENOENT' ||
      code === 'ENOTDIR' ||
      code === 'EACCES' ||
      code === 'EPERM'
    ) {
      return {
        resultType: 'pathNotFound',
        directoryPath,
        absolutePath,
      }
    }
    throw e
  }

  // Get current permission context
  const currentWorkingDirs = allWorkingDirectories(permissionContext)

  // Check if already within an existing working directory
  for (const workingDir of currentWorkingDirs) {
    if (pathInWorkingPath(absolutePath, workingDir)) {
      return {
        resultType: 'alreadyInWorkingDirectory',
        directoryPath,
        workingDir,
      }
    }
  }

  return {
    resultType: 'success',
    absolutePath,
  }
}

export function addDirHelpMessage(result: AddDirectoryResult): string {
  switch (result.resultType) {
    case 'emptyPath':
      return '请提供目录路径。'
    case 'pathNotFound':
      return `路径 ${chalk.bold(result.absolutePath)} 未找到。`
    case 'notADirectory': {
      const parentDir = dirname(result.absolutePath)
      return `${chalk.bold(result.directoryPath)} 不是目录。是否要添加父目录 ${chalk.bold(parentDir)}？`
    }
    case 'alreadyInWorkingDirectory':
      return `${chalk.bold(result.directoryPath)} 已在现有工作目录 ${chalk.bold(result.workingDir)} 中可访问。`
    case 'success':
      return `已将 ${chalk.bold(result.absolutePath)} 添加为工作目录。`
  }
}
