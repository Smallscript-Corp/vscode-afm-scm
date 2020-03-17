/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ben Crowl. All rights reserved.
 *  Original Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// based on https://github.com/Microsoft/vscode/commit/41f0ff15d7327da30fdae73aa04ca570ce34fa0a

import { ExtensionContext, window, Disposable, commands, OutputChannel } from 'vscode';
import { AfmFinder, Afm, IAfm } from './afmBase';
import { Model } from './model';
import { CommandCenter } from './commands';
import { AfmContentProvider } from './contentProvider';
import * as nls from 'vscode-nls';
import typedConfig from './config';

const localize = nls.config(process.env.VSCODE_NLS_CONFIG)();

async function init(context: ExtensionContext, disposables: Disposable[]): Promise<void> {
    // const { name, version, aiKey } = require(context.asAbsolutePath('./package.json')) as { name: string, version: string, aiKey: string };

    const outputChannel = window.createOutputChannel('Afm');
    disposables.push(outputChannel);

    const enabled = typedConfig.enabled;
    const pathHint = typedConfig.path;
    const info: IAfm = await findAfm(pathHint, outputChannel);
    const afm = new Afm({ afmPath: info.path,
                                version: info.version,
                                enableInstrumentation: enabled,
                                outputChannel: outputChannel });
    const model = new Model(afm);
    disposables.push(model);

    const onRepository = () => commands.executeCommand('setContext', 'afmOpenRepositoryCount', model.repositories.length);
    model.onDidOpenRepository(onRepository, null, disposables);
    model.onDidCloseRepository(onRepository, null, disposables);
    onRepository();

    if (!enabled)
    {
        const commandCenter = new CommandCenter(afm, model, outputChannel);
        disposables.push(commandCenter);
        return;
    }

    outputChannel.appendLine(localize('using afm', "Using afm {0} from {1}", info.version, info.path));
    afm.onOutput(str => outputChannel.append(str), null, disposables);

    disposables.push(
        new CommandCenter(afm, model, outputChannel),
        new AfmContentProvider(model),
    );
}

export async function findAfm(pathHint: string | undefined, outputChannel: OutputChannel): Promise<IAfm> {
    const logger = {
        attempts: <string[]>[],
        log: (path: string) => logger.attempts.push(path)
    }

    try {
        const finder = new AfmFinder(logger);
        return await finder.find(pathHint);
    }
    catch (e) {
        outputChannel.appendLine("Could not find afm, tried:")
        logger.attempts.forEach(attempt => outputChannel.appendLine(` - ${attempt}`));
        throw e;
    }
}

export function activate(context: ExtensionContext) {
    const disposables: Disposable[] = [];
    context.subscriptions.push(new Disposable(() => Disposable.from(...disposables).dispose()));

    init(context, disposables)
        .catch(err => console.error(err));
}
