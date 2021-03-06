/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Ben Crowl. All rights reserved.
 *  Original Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { workspace, Disposable } from 'vscode';
import { AfmErrorCodes, AfmError } from "./afmBase";
import { throttle } from './decorators';
import typedConfig from "./config";
import { Repository, Operation } from './repository';

export const enum AutoInOutStatuses {
    Disabled,
    Enabled,
    Error
}

export interface AutoInOutState {
    readonly status: AutoInOutStatuses;
    readonly nextCheckTime?: Date;
    readonly error?: string;
}

const STARTUP_DELAY = 3 * 1000 /* three seconds */;
const OPS_AFFECTING_IN_OUT = Operation.Commit | Operation.RevertFiles | Operation.Update | Operation.Push | Operation.Pull;
const opAffectsInOut = (op: Operation): boolean => (OPS_AFFECTING_IN_OUT & op) > 0;

export class AutoIncomingOutgoing {

    private disposables: Disposable[] = [];
    private timer: NodeJS.Timer | undefined;

    constructor(private repository: Repository) {
        workspace.onDidChangeConfiguration(this.onConfiguration, this, this.disposables);
        this.repository.onDidRunOperation(this.onDidRunOperation, this, this.disposables);
        this.onConfiguration();
    }

    private onConfiguration(): void {
        this.repository.changeAutoInoutState({ status: AutoInOutStatuses.Enabled })
        this.enable();
    }

    enable(): void {
        if (this.enabled) {
            return;
        }

        setTimeout(() => this.refresh(), STARTUP_DELAY); // delay to let 'status' run first
        this.timer = setInterval(() => this.refresh(), typedConfig.autoInOutIntervalMillis);
    }

    disable(): void {
        if (!this.enabled) {
            return;
        }

        clearInterval(this.timer!);
        this.timer = undefined;
    }

    get enabled(): boolean { return this.timer !== undefined; }

    private onDidRunOperation(op: Operation): void {
        if (!this.enabled || !opAffectsInOut(op)) {
            return;
        }
        this.repository.changeInoutAfterDelay();
    }

    @throttle
    private async refresh(): Promise<void> {
        const nextCheckTime = new Date(Date.now() + typedConfig.autoInOutIntervalMillis);
        this.repository.changeAutoInoutState({ nextCheckTime });

        try {
            await this.repository.changeInoutAfterDelay();
        }
        catch (err) {
            if (err instanceof AfmError && (
                err.afmErrorCode === AfmErrorCodes.AuthenticationFailed ||
                err.afmErrorCode === AfmErrorCodes.NotAnAfmRepository )) {
                this.disable();
            }
        }
    }

    dispose(): void {
        this.disable();
        this.disposables.forEach(d => d.dispose());
    }
}