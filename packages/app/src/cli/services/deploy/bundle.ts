import {AppInterface} from '../../models/app/app.js'
import {Identifiers} from '../../models/app/identifiers.js'
import {installJavy} from '../function/build.js'
import {ExtensionInstance} from '../../models/extensions/extension-instance.js'
import {zip} from '@shopify/cli-kit/node/archiver'
import {renderConcurrent} from '@shopify/cli-kit/node/ui'
import {AbortSignal} from '@shopify/cli-kit/node/abort'
import {inTemporaryDirectory, mkdirSync, touchFile} from '@shopify/cli-kit/node/fs'
import {joinPath} from '@shopify/cli-kit/node/path'
import {Writable} from 'stream'

export interface BundleOptions {
  app: AppInterface
  bundlePath?: string
  extensions?: ExtensionInstance[]
  stdout: Writable
  identifiers: Identifiers
}

export async function bundleAndBuildExtensions(options: BundleOptions) {
  await inTemporaryDirectory(async (tmpDir) => {
    const bundleDirectory = joinPath(tmpDir, 'bundle')
    await mkdirSync(bundleDirectory)
    await touchFile(joinPath(bundleDirectory, '.shopify'))

    // Force the download of the javy binary in advance to avoid later problems,
    // as it might be done multiple times in parallel. https://github.com/Shopify/cli/issues/2877
    await installJavy(options.app)

    await renderConcurrent({
      processes: options.app.allExtensions.map((extension) => {
        return {
          prefix: extension.localIdentifier,
          action: async (stdout: Writable, stderr: Writable, signal: AbortSignal) => {
            await extension.buildForBundle(
              {stderr, stdout, signal, app: options.app},
              options.identifiers,
              bundleDirectory,
            )
          },
        }
      }),
      showTimestamps: false,
    })

    if (options.bundlePath) {
      await zip({
        inputDirectory: bundleDirectory,
        outputZipPath: options.bundlePath,
      })
    }
  })
}

export async function bundleAndBuildExtensionsInConcurrent(options: BundleOptions) {
  await inTemporaryDirectory(async (tmpDir) => {
    const bundleDirectory = joinPath(tmpDir, 'bundle')
    await mkdirSync(bundleDirectory)
    await touchFile(joinPath(bundleDirectory, '.shopify'))

    const promises = (options.extensions ?? []).map((extension) => {
      return extension.buildForBundle(
        {stderr: options.stdout, stdout: options.stdout, app: options.app},
        options.identifiers,
        bundleDirectory,
      )
    })

    await Promise.all(promises)

    if (options.bundlePath) {
      await zip({
        inputDirectory: bundleDirectory,
        outputZipPath: options.bundlePath,
      })
    }
  })
}
